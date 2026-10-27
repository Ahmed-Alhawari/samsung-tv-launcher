#!/usr/bin/env python3
"""Serve upcoming Google Calendar events to the TV as JSON.

Google's iCal feed has no CORS headers, so the TV app can't read it directly. This script fetches the
feed (server-side), expands recurring events, and serves  GET /events?token=...  with CORS enabled.

Environment:
  CALENDAR_ICS_URL   Google Calendar -> Settings -> your calendar -> "Secret address in iCal format"
                     (a local .ics file path also works, handy for testing). Several URLs: comma-separated.
  RELAY_TOKEN        shared secret the TV sends as ?token=  (required; the endpoint is reachable on your LAN)
  PORT               default 8787
  DAYS               how many days ahead to return, default 14
"""
import json, os, sys, time, urllib.request
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

import icalendar
import recurring_ical_events

SOURCES = [s.strip() for s in os.environ.get("CALENDAR_ICS_URL", "").split(",") if s.strip()]
TOKEN = os.environ.get("RELAY_TOKEN", "")
PORT = int(os.environ.get("PORT", "8787"))
DAYS = int(os.environ.get("DAYS", "14"))
CACHE_SECONDS = 300
_cache = {"at": 0.0, "events": []}


def read_source(src):
    if src.startswith(("http://", "https://")):
        with urllib.request.urlopen(src, timeout=20) as r:
            return r.read()
    with open(src, "rb") as f:
        return f.read()


def to_iso(v):
    """Return (iso string, all_day). Timed events are converted to the machine's local timezone."""
    if isinstance(v, datetime):
        if v.tzinfo is not None:
            v = v.astimezone()
        return v.isoformat(), False
    return v.isoformat(), True


def load_events():
    now = datetime.now().astimezone()
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=DAYS)
    out = []
    for src in SOURCES:
        cal = icalendar.Calendar.from_ical(read_source(src))
        for ev in recurring_ical_events.of(cal).between(start, end):
            if str(ev.get("STATUS", "")).upper() == "CANCELLED":
                continue
            s_iso, all_day = to_iso(ev.decoded("DTSTART"))
            dtend = ev.decoded("DTEND") if ev.get("DTEND") else ev.decoded("DTSTART")
            e_iso, _ = to_iso(dtend)
            out.append({
                "title": str(ev.get("SUMMARY", "(no title)")),
                "start": s_iso, "end": e_iso, "allDay": all_day,
                "location": str(ev.get("LOCATION", "")) or None,
            })
    out.sort(key=lambda e: e["start"])
    return out


def events():
    if time.time() - _cache["at"] > CACHE_SECONDS:
        try:
            _cache["events"] = load_events()
            _cache["at"] = time.time()
        except Exception as exc:  # keep serving the last good data
            print("refresh failed:", exc, file=sys.stderr)
            if not _cache["events"]:
                raise
    return _cache["events"]


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path != "/events":
            return self._send(404, {"error": "not found"})
        if parse_qs(url.query).get("token", [""])[0] != TOKEN:
            return self._send(403, {"error": "bad token"})
        try:
            self._send(200, {"events": events(), "generated": datetime.now().astimezone().isoformat()})
        except Exception as exc:
            self._send(502, {"error": str(exc)})

    def log_message(self, fmt, *args):  # don't log the token-bearing URL
        pass


if __name__ == "__main__":
    if not SOURCES or not TOKEN:
        sys.exit("Set CALENDAR_ICS_URL and RELAY_TOKEN (see the docstring).")
    print(f"Calendar relay on :{PORT}  ({len(SOURCES)} calendar(s), next {DAYS} days)")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
