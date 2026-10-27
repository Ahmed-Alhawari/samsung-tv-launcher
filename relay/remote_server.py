#!/usr/bin/env python3
"""Phone remote + Claude search for the TV launcher.

Runs on your Mac. Three things talk to it:
  * the TV launcher (remote.js)  - subscribes to /tv/events (Server-Sent Events) and pushes its state to /tv/state
  * your phone                   - opens  http://<mac-ip>:8790/?token=...  (served from remote.html)
  * Claude                       - POST /search asks Claude for suggestions (the API key stays here, never on the TV)

"Keep watching" additions made from the phone are stored in data/watching.json and pulled by the TV.

Environment:
  REMOTE_TOKEN       shared secret for the phone and the TV (required; this is reachable on your LAN)
  ANTHROPIC_API_KEY  for the Claude search box (or sign in with `ant auth login`); without it search says so
  CLAUDE_MODEL       default claude-opus-5-5
  PORT               default 8790
  CLAUDE_MOCK=1      canned search results, for testing without an API key
"""
import hmac, json, os, queue, socket, sys, threading, time
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
TOKEN = os.environ.get("REMOTE_TOKEN", "")
PORT = int(os.environ.get("PORT", "8790"))
MODEL = os.environ.get("CLAUDE_MODEL", "claude-opus-5-5")
MOCK = os.environ.get("CLAUDE_MOCK") == "1"
DATA = Path(os.environ.get("REMOTE_DATA", HERE / "data"))
WATCH_FILE = DATA / "watching.json"

KEYS = {"left", "right", "up", "down", "ok", "back", "yellow", "blue", "green"}
CMDS = {"key", "launch", "night", "profile", "toast"}

lock = threading.Lock()
clients = []        # one queue per connected TV
tv_state = {}       # last state the TV pushed: tiles, profiles, current profile, night
search_times = deque(maxlen=20)


# ---------- keep-watching storage ----------
def load_watching():
    try:
        return json.loads(WATCH_FILE.read_text())
    except (OSError, ValueError):
        return {}


def save_watching():
    DATA.mkdir(parents=True, exist_ok=True)
    tmp = WATCH_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(watching, indent=1))
    tmp.replace(WATCH_FILE)


watching = load_watching()


def clean(v, n):
    return str(v or "").strip()[:n]


def broadcast(msg):
    with lock:
        for q in clients:
            q.put(json.dumps(msg))


# ---------- Claude ----------
_client = None


def parse_json(text):
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise ValueError("Claude's reply had no JSON in it")
    return json.loads(text[start:end + 1])


MOCK_RESULTS = [
    {"title": "Slow Horses", "year": "2022", "service": "Apple TV+", "reason": "Sharp, funny spy drama in short episodes"},
    {"title": "Planet Earth II", "year": "2016", "service": "YouTube", "reason": "Stunning nature documentary, easy to dip into"},
    {"title": "The Bear", "year": "2022", "service": "Netflix", "reason": "Fast, intense kitchen drama under 40 minutes"},
    {"title": "Chef's Table", "year": "2015", "service": "Netflix", "reason": "Beautifully shot food documentaries"},
]


def suggest(query, profile_id):
    services = [t["label"] for t in tv_state.get("tiles", []) if t.get("type") == "app"] or ["Netflix", "YouTube", "Stremio"]
    recent = [w["title"] for w in watching.get(profile_id, [])][:8]

    if MOCK:
        results = MOCK_RESULTS
    else:
        import anthropic
        system = (
            "You help someone pick something to watch on their TV. Their apps: " + ", ".join(services) + ". "
            + ("Shows already on their list: " + "; ".join(recent) + ". " if recent else "")
            + "Suggest 4 or 5 titles that fit the request. Only suggest titles you are confident exist, and never "
              "invent episodes. Availability changes by country and over time, so name the app where the title most "
              "likely streams, using exactly one of their apps' names when one fits, otherwise \"Other\". "
              "Reply with JSON only, no prose and no code fences, in this shape: "
              '{"results":[{"title":"...","year":"2019","service":"<an app name or Other>","reason":"under 14 words"}]}'
        )
        global _client
        if _client is None:
            _client = anthropic.Anthropic()
        msg = _client.messages.create(
            model=MODEL,
            max_tokens=8000,                      # thinking tokens count toward this; the reply itself is tiny
            output_config={"effort": "low"},
            system=system,
            messages=[{"role": "user", "content": query}],
        )
        if msg.stop_reason == "refusal":
            raise PermissionError("Claude declined that request")
        results = parse_json("".join(b.text for b in msg.content if b.type == "text")).get("results", [])

    tiles = {t["label"].lower(): t for t in tv_state.get("tiles", [])}
    out = []
    for r in results[:6]:
        t = tiles.get(clean(r.get("service"), 40).lower())
        out.append({"title": clean(r.get("title"), 80), "year": clean(r.get("year"), 8), "reason": clean(r.get("reason"), 120),
                    "service": clean(r.get("service"), 40), "tile": t["id"] if t else None, "color": t.get("color") if t else None})
    return [o for o in out if o["title"]]


# ---------- HTTP ----------
class Handler(BaseHTTPRequestHandler):
    server_version = "TVRemote/1.0"

    def log_message(self, fmt, *args):   # URLs carry the token, so don't log them
        pass

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _send(self, code, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self._cors()
        self.end_headers()
        self.wfile.write(data)

    def _authed(self, url):
        given = parse_qs(url.query).get("token", [""])[0] or self.headers.get("X-Token", "")
        return bool(TOKEN) and hmac.compare_digest(given, TOKEN)

    def _body(self):
        try:
            n = min(int(self.headers.get("Content-Length", 0)), 100_000)
            return json.loads(self.rfile.read(n) or b"{}")   # the TV sends text/plain to skip CORS preflight
        except ValueError:
            return {}

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in ("/", "/remote"):
            return self._send(200, (HERE / "remote.html").read_bytes(), "text/html; charset=utf-8")
        if not self._authed(url):
            return self._send(403, {"error": "bad token"})
        if url.path == "/tv/events":
            return self._events()
        if url.path == "/state":
            return self._send(200, dict(tv_state, connected=bool(clients), claude=MOCK or bool(os.environ.get("ANTHROPIC_API_KEY"))))
        if url.path == "/watching/all":
            return self._send(200, {"watching": watching})
        if url.path == "/watching":
            return self._send(200, {"items": watching.get(parse_qs(url.query).get("profile", [""])[0], [])})
        self._send(404, {"error": "not found"})

    def do_POST(self):
        url = urlparse(self.path)
        if not self._authed(url):
            return self._send(403, {"error": "bad token"})
        b = self._body()

        if url.path == "/tv/state":
            tv_state.clear()
            tv_state.update({k: b.get(k) for k in ("tiles", "profiles", "profile", "night")})
            return self._send(200, {"ok": True})

        if url.path == "/cmd":
            t = b.get("type")
            if t not in CMDS or (t == "key" and b.get("key") not in KEYS):
                return self._send(400, {"error": "bad command"})
            msg = {"type": t}
            for k in ("key", "tile", "id", "text"):
                if k in b:
                    msg[k] = clean(b[k], 200)
            broadcast(msg)
            return self._send(200, {"ok": True, "connected": bool(clients)})

        if url.path == "/watching":
            pid, item = clean(b.get("profile"), 40), b.get("item") or {}
            entry = {"tile": clean(item.get("tile"), 40), "title": clean(item.get("title"), 80), "sub": clean(item.get("sub"), 60),
                     "service": clean(item.get("service"), 40), "color": clean(item.get("color"), 20) or None}
            if not pid or not entry["title"]:
                return self._send(400, {"error": "profile and title are required"})
            with lock:
                items = [w for w in watching.get(pid, []) if w["title"].lower() != entry["title"].lower()]
                watching[pid] = ([entry] + items)[:30]
                save_watching()
            broadcast({"type": "watching"})
            return self._send(200, {"ok": True, "items": watching[pid]})

        if url.path == "/watching/remove":
            pid, title = clean(b.get("profile"), 40), clean(b.get("title"), 80).lower()
            with lock:
                watching[pid] = [w for w in watching.get(pid, []) if w["title"].lower() != title]
                save_watching()
            broadcast({"type": "watching"})
            return self._send(200, {"ok": True, "items": watching[pid]})

        if url.path == "/search":
            query = clean(b.get("query"), 300)
            if not query:
                return self._send(400, {"error": "ask for something"})
            now = time.time()
            if len(search_times) == search_times.maxlen and now - search_times[0] < 60:
                return self._send(429, {"error": "slow down: 20 searches a minute"})
            search_times.append(now)
            return self._search(query, clean(b.get("profile"), 40))

        self._send(404, {"error": "not found"})

    def _search(self, query, profile_id):
        try:
            self._send(200, {"results": suggest(query, profile_id)})
        except PermissionError as e:
            self._send(200, {"results": [], "error": str(e)})
        except ValueError:
            self._send(502, {"error": "Couldn't read Claude's answer. Try rephrasing."})
        except ImportError:
            self._send(503, {"error": "The anthropic package isn't installed. Run: pip install -r requirements.txt"})
        except Exception as e:   # anthropic.* errors; imported lazily so the server runs without the package
            name = type(e).__name__
            hint = {"AuthenticationError": "Claude rejected the API key", "RateLimitError": "Claude is rate limiting, try again shortly",
                    "APIConnectionError": "Couldn't reach Claude (network)", "TypeError": "No Anthropic API key. Set ANTHROPIC_API_KEY for the relay"}.get(name)
            self._send(503 if name in ("TypeError", "AuthenticationError") else 502, {"error": hint or f"Claude request failed ({name})"})

    def _events(self):
        q = queue.Queue()
        with lock:
            clients.append(q)
        try:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self._cors()
            self.end_headers()
            self.wfile.write(b": connected\n\n")
            self.wfile.flush()
            while True:
                try:
                    self.wfile.write(f"data: {q.get(timeout=15)}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")   # also how we notice the TV went away
                self.wfile.flush()
        except OSError:
            pass
        finally:
            with lock:
                clients.remove(q)


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "<this-mac's-ip>"


if __name__ == "__main__":
    if not TOKEN:
        sys.exit("Set REMOTE_TOKEN (see the docstring).")
    ip = lan_ip()
    print(f"TV remote relay on :{PORT}{'  [MOCK Claude]' if MOCK else ''}")
    print(f"  phone:  http://{ip}:{PORT}/?token={TOKEN}")
    print(f'  config.js:  remote: {{ url: "http://{ip}:{PORT}", token: "{TOKEN}" }}')
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
