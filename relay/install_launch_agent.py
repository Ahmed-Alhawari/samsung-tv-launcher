#!/usr/bin/env python3
"""Install a relay as a macOS LaunchAgent (starts at login, restarts if it crashes).

  ../.venv/bin/python install_launch_agent.py                    calendar relay (default)
  ../.venv/bin/python install_launch_agent.py --service remote   phone remote + Claude search
  add --uninstall to remove that service, or --dry-run to print the plist without installing

Secrets (the iCal address, the Anthropic API key) are typed at hidden prompts and stored only in the plist
(chmod 600). Each relay runs under `caffeinate -i`, which keeps the Mac from idle-sleeping while it runs.
"""
import getpass, os, plistlib, secrets, socket, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DOMAIN = f"gui/{os.getuid()}"

SERVICES = {
    "calendar": {"label": "com.local.tv-calendar-relay", "script": "calendar_relay.py", "port": "8787", "log": "tv-calendar-relay.log"},
    "remote": {"label": "com.local.tv-remote-relay", "script": "remote_server.py", "port": "8790", "log": "tv-remote-relay.log"},
}


def lan_ip():
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("10.255.255.255", 1))
            return s.getsockname()[0]
    except OSError:
        return "<this-mac's-ip>"


def ask(env, prompt, required=True):
    v = os.environ.get(env) or getpass.getpass(prompt).strip()
    if required and not v:
        sys.exit("Nothing entered.")
    return v


def main():
    name = sys.argv[sys.argv.index("--service") + 1] if "--service" in sys.argv else "calendar"
    svc = SERVICES.get(name) or sys.exit(f"Unknown service {name!r}. Use calendar or remote.")
    plist_path = Path.home() / "Library/LaunchAgents" / f"{svc['label']}.plist"
    log = Path.home() / "Library/Logs" / svc["log"]

    if "--uninstall" in sys.argv:
        subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{svc['label']}"], check=False)
        plist_path.unlink(missing_ok=True)
        print("Removed.")
        return

    python = HERE.parent / ".venv/bin/python"
    if not python.exists():
        sys.exit(f"Missing {python}. Create the venv first (see README).")

    env = {"PORT": svc["port"]}
    token = None
    if name == "calendar":
        env["CALENDAR_ICS_URL"] = ask("CALENDAR_ICS_URL", "Secret iCal address (hidden; comma-separate several): ")
        token = env["RELAY_TOKEN"] = os.environ.get("RELAY_TOKEN") or secrets.token_urlsafe(24)
    else:
        token = env["REMOTE_TOKEN"] = os.environ.get("REMOTE_TOKEN") or secrets.token_urlsafe(24)
        key = ask("ANTHROPIC_API_KEY", "Anthropic API key (hidden; press Enter to skip, search then stays off): ", required=False)
        if key:
            env["ANTHROPIC_API_KEY"] = key

    plist = {
        "Label": svc["label"],
        "ProgramArguments": ["/usr/bin/caffeinate", "-i", str(python), str(HERE / svc["script"])],
        "EnvironmentVariables": env,
        "WorkingDirectory": str(HERE),
        "RunAtLoad": True,
        "KeepAlive": True,
        "StandardOutPath": str(log),
        "StandardErrorPath": str(log),
    }

    if "--dry-run" in sys.argv:
        print(plistlib.dumps(plist).decode())
        return

    plist_path.parent.mkdir(parents=True, exist_ok=True)
    fd = os.open(plist_path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as f:
        plistlib.dump(plist, f)
    subprocess.run(["launchctl", "bootout", f"{DOMAIN}/{svc['label']}"], check=False, capture_output=True)
    subprocess.run(["launchctl", "bootstrap", DOMAIN, str(plist_path)], check=True)
    ip = lan_ip()
    print(f"Installed and started. Log: {log}\n")
    if name == "calendar":
        print("Put this in config.js:")
        print(f'  agenda: {{ url: "http://{ip}:{svc["port"]}/events", token: "{token}", max: 4 }},')
    else:
        print("Put this in config.js:")
        print(f'  remote: {{ url: "http://{ip}:{svc["port"]}", token: "{token}" }},')
        print(f"\nOn your phone open:  http://{ip}:{svc['port']}/?token={token}   (then Share → Add to Home Screen)")


if __name__ == "__main__":
    main()
