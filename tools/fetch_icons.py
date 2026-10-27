#!/usr/bin/env python3
"""Download official app icons into icons/ using Apple's public App Store search.

  python3 tools/fetch_icons.py Netflix YouTube "Disney+" "Nintendo Switch:Nintendo Switch Online"

Each argument is  <name on the dock>  or  <name on the dock>:<App Store search term>.
The icon is saved as icons/<slug>.jpg (512 px; shrink with: sips -Z 256 icons/*.jpg). The launcher looks for icons/<slug>.jpg for every app
whose name slugifies the same way (see slug() in app.js), so "Disney+" -> disney-plus.jpg.
Icons are the apps' own artwork, used here only as shortcuts on your own TV.
"""
import json, re, sys, urllib.parse, urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "icons"


def slug(name):
    return re.sub(r"^-|-$", "", re.sub(r"[^a-z0-9]+", "-", name.lower().replace("+", " plus ")))


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read()


def main():
    OUT.mkdir(exist_ok=True)
    for arg in sys.argv[1:]:
        name, _, term = arg.partition(":")
        term = term or name
        if term.startswith("bundle:"):   # exact App Store app, e.g. "HBO Max:bundle:com.wbd.stream"
            q = urllib.parse.urlencode({"bundleId": term[7:], "country": "us"})
            results = json.loads(fetch("https://itunes.apple.com/lookup?" + q))["results"]
        else:
            q = urllib.parse.urlencode({"term": term, "entity": "software", "country": "us", "limit": 5})
            results = json.loads(fetch("https://itunes.apple.com/search?" + q))["results"]
        if not results:
            print(f"!! {name}: no App Store match for {term!r}")
            continue
        want = term.lower()
        pick = next((r for r in results if r["trackName"].lower().startswith(want)), results[0])
        art = pick["artworkUrl512"]
        (OUT / (slug(name) + ".jpg")).write_bytes(fetch(art))
        print(f"{name:18} -> icons/{slug(name)}.jpg   ({pick['trackName']} · {pick['sellerName']})")


if __name__ == "__main__":
    main()
