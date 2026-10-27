# Samsung TV Home Launcher

A custom, ad-free home screen for a Samsung Smart TV (Tizen web app), built because the stock one was cluttered.

- A big clock that sits **behind** the scenery (the iPhone lock-screen depth effect), with date and weather
- A **dock of the apps you actually use**, in the order you choose (press ▼ on an app to reorder or remove it)
- A shelf that fills itself with **what you opened recently**
- Reads the TV's own **list of installed apps** and shows when a console on an **HDMI** input is switched on
- Profiles, night mode, five screensavers, wallpapers, and a **one-command installer**
- Tuned from **frame-time measurements on the real TV** (60 fps while navigating)

Built and tested on a **Samsung UA58AU7000 (2021, Tizen 6.0)**. Other 2019+ Tizen TVs should work but are untested.

> Not affiliated with Samsung or any streaming service. App names and logos belong to their owners. **App icons are
> not included in this repository**: you download them yourself (see below).

## Quick start

1. **Icons** (each app's own icon, from Apple's public App Store listing):
   ```
   python3 tools/fetch_icons.py Netflix YouTube "Disney+" "Prime Video:Amazon Prime Video" "Apple TV" "OSN+" Shahid \
     STARZPLAY Plex Spotify "PlayStation:PlayStation App" "Nintendo Switch:Nintendo Switch Online"
   sips -Z 256 icons/*.jpg        # macOS: shrink them for the TV
   ```
   Apps without an icon file show a coloured letter instead. (Stremio isn't in the US App Store; save its logo as
   `icons/stremio.jpg` yourself if you want it.)
2. **Make it yours.** Copy `config.local.example.js` to `config.local.js` (git-ignored) for your profile names and
   weather city. Edit the `tiles` in `config.js` for your apps (see the next section for finding their IDs).
3. **Install on the TV** (setup below), then `./install_to_tv.sh <tv-ip>`.

## Finding your TV's app IDs

App IDs differ by TV and region (guessing them is how you get a tile that opens nothing). Two ways to get yours:
- On the TV, the **… (All apps)** screen lists what's installed; add an app to the dock from there.
- For `config.js`, read them from the TV with `tizen.application.getAppsInfo()` (needs the `application.info` privilege,
  already in `config.xml`). Each app's `id` is what goes in `appId`. Launch-test each one.

## What this can and can't do

- It's a normal Tizen web app, installed through Developer Mode. Samsung doesn't let you replace its own home screen.
- **HDMI inputs:** switching works only with an input object taken from the TV's own `VIDEOSOURCE` list; a hand-made
  `{type: "HDMI", number: n}` is rejected (`TypeMismatchError`). The same list says which ports are connected.
- **It can't start itself at power-on** (see Install). It can't read watch history out of Netflix/YouTube, so the shelf
  shows recent *apps*, not episodes. Home always goes to Samsung's home screen.

## About the TV's browser

It's about Chromium 76 and draws web apps on a **1920×1080 surface** that the panel stretches to 4K (measured:
`screen` is 1920×1080 whatever the viewport says; a 3840-wide page just shows the top-left corner). So the launcher is
designed at 1920×1080 and art is sized to match; 4K-sized images only slow it down.

Code is written to that level: no CSS `inset`, no flexbox `gap`, no `:has()`, plain ES5 JavaScript. Newer features
don't error on the TV, they silently do nothing.

**Performance is tuned from measurements on the TV**, not desktop guesses (a desktop browser can't see this):
focus moves are instant, moving pieces are on their own graphics layers, nothing that moves has a blurred shadow, and
only the dock's sideways slide is animated. That holds 60 fps while navigating. Re-measure on the TV if you restyle;
the icon "pop" scale animation, for instance, caused ~25 slow frames per 6 seconds.

## Install on the TV

One-time setup: Tizen SDK with the TV Extensions, a Samsung certificate made in Certificate Manager (tick your TV),
TV Developer Mode on (Apps → 123 → 12345) with **Host PC IP set to the computer address the TV actually sees**
(`route -n get <tv-ip>` shows the interface; if the Mac has Wi-Fi and Ethernet, use the one it reports), and the TV
connected in Device Manager.

Then put your TV's address and certificate profile name in `.tv.env` (git-ignored):

```
TV_IP=192.168.x.x
TIZEN_PROFILE=your-certificate-profile
```

and every update is one command:

```
./install_to_tv.sh            # builds, signs, installs and opens it on the TV
./install_to_tv.sh 192.168.1.20   # or pass the TV address explicitly
```

Things that bit us, so you don't have to rediscover them:
- The TV's installer **fails on package names with a space**, so the script renames `Home Launcher.wgt` first.
- If `sdb` hangs or says "failed to connect", kill the stale helper (`pkill -f "sdb fork-server"`) and run `sdb connect <tv-ip>`
  again; restarting the TV can leave it stuck.
- Uninstall with the full ID: `tizen uninstall -p HomeLaunch.Launcher -s <tv-ip>:26101`. A fresh install clears the
  app's saved settings (profile, dock order, night mode).
- **Opening at power-on.** An app cannot start itself when the TV turns on: Samsung only allows that on commercial
  signage models, and the one forum hint about a hidden `config.xml` flag is unconfirmed. What a consumer TV offers is
  **Autorun Last App** (Settings → General → Smart Features): it reopens whichever app was last in front. So turn that
  on, and leave the TV in the launcher when you switch it off. To make that easy, put the launcher first in Samsung's
  Home bar (Home → Apps → hold OK on Home Launcher → Move) so Home + OK gets you back.

## The home screen

Modelled on a tvOS / iPhone lock-screen look:

- **Clock behind the scenery.** A tall gradient clock sits behind a foreground cut-out of the wallpaper (the
  mountain peak), the same depth trick as the iPhone lock screen. It needs a wallpaper with a `front` layer.
  The Dusk Peaks and Alpine Blue wallpapers have one; for your own photo, add a transparent PNG cut-out of the
  foreground (same size) as `front` in `config.js`. Without `front` the clock simply sits on top.
- **Profiles** (top left chips). Each profile has its own dock (order, removed and added apps) and its own *Keep watching* shelf. Rename
  them in `config.js`. Select a chip and press OK to switch.
- **Your apps along the bottom, in your order.** The dock scrolls sideways when there are more apps than fit.
  Press **▼ on an app** for a menu: **Reorder** (◀ ▶ move it, OK when done), **Remove from dock**, **Change app…**.
  The order is saved per profile. The last two icons are **Settings** and **…**.
- **The … button (All apps).** Lists the apps installed on the TV (hidden system entries are filtered out).
  **Get more apps** tries to open the Samsung store; OK on an app gives **Open** or **Add to dock / Remove from dock**.
  **Restore removed dock items** appears once you have removed something. Samsung doesn't document the store's
  app ID, so if "Get more apps" can't open it, set `storeAppId` in `config.js` (find it with Tizen Studio's Device
  Manager) or install apps from the TV's own Apps screen and then add them here.
- **Recently used shelf.** Fills itself with what you open from the launcher (apps and HDMI inputs, newest first, with
  "5 min ago"). A TV app can't read what you watched inside Netflix/YouTube/Stremio, so it shows apps, not episodes.
  If you'd rather keep a hand-written list of shows, add `keepWatching` entries to a profile in `config.js` and the
  shelf becomes "Keep watching" instead.
- **Night mode.** The moon at top right (or Green / `N`) dims the picture, warms the colours and hides the side
  cards. *Night schedule* in Settings turns it on automatically between the times in `nightWindow`.
- **Settings** (gear in the dock): wallpaper, screensaver style and delay, preview, night mode and schedule,
  12/24-hour clock, clear this profile's history. Everything is remembered on the TV.

Remote keys: arrows move (up/down changes row; ▼ on an app opens its menu), OK opens, Back goes back. Nothing
needs the coloured buttons, since many Samsung remotes don't have them: wallpaper and night mode are in Settings and
on the moon icon. If your remote does have them, **Blue** opens wallpapers and **Green** toggles night mode.
In a browser use W and N.

## Screensavers

Five, chosen in Settings, starting after 1–30 minutes without a key press; any key wakes it (and is swallowed
so waking never triggers an action):

1. **Scenic**: the depth wallpapers drifting slowly with the clock tucked behind the peak.
2. **Big clock**: a large clock on black.
3. **Aurora**: slow-moving colour glows with a small clock.
4. **Starfield**: twinkling stars with a small clock.
5. **Analog clock**: a minimal analog clock.

The clock-only ones move to a new spot every minute so no part of the panel stays lit (burn-in).

## Wallpaper

Settings → Wallpaper (or Blue / `W`). Up/Down previews live, OK saves, Back cancels. The list is `wallpapers`
in `config.js`: three scenic illustrations I drew (Dusk Peaks, Alpine Blue, Dunes), two gradients and "My photo"
(`wallpapers/wallpaper.jpg`). To add a photo: copy it into `wallpapers/`, add a line such as
`{ name: "Beach", src: "wallpapers/beach.jpg", clock: ["#fff", "#9cf"] }`, and reinstall the app (the TV can't
list a folder). 1920×1080, ideally under about 2 MB.

## Weather

Set your latitude/longitude in `config.local.js` (Open-Meteo, no key). The default in `config.js` is London.

## Phone / TV notifications

1. Pick a long random topic and put it in `config.js` under `notifications.topic`.
2. Install the free ntfy app on your phone and subscribe to the same topic (or just send to it).
3. Send one: `curl -H "Title: Wife" -d "Dinner is ready" https://ntfy.sh/<your-topic>`

Messages appear as a banner and, while there is something to show, in a Notifications card on the right. Anyone who knows the topic can read and post, so treat
it like a password, or self-host ntfy.

## Google Calendar ("Up next")

Google's calendar feed can't be read directly by a TV app, so a small relay fetches it and serves the
next 14 days of events (recurring events expanded, cancelled ones dropped) as JSON. It must run on a
machine that is on whenever the TV is (a Mac that sleeps will show "Calendar offline").

1. Google Calendar (web) → Settings → your calendar → **Secret address in iCal format**. Copy it.
   Anyone with that URL can read the whole calendar, so keep it out of git and the TV config.
2. Run the relay:
   ```
   cd relay
   python3 -m venv ../.venv && ../.venv/bin/pip install -r requirements.txt
   CALENDAR_ICS_URL="<secret address>" RELAY_TOKEN="<long random string>" ../.venv/bin/python calendar_relay.py
   ```
   Several calendars: comma-separate the URLs. Port defaults to 8787 (`PORT=`), horizon to 14 days (`DAYS=`).
3. In `config.js` set `agenda.url` to `http://<that machine's LAN IP>:8787/events` and `agenda.token` to the
   same `RELAY_TOKEN`. The panel refreshes every 10 minutes. Events starting within the hour get a green bar.

### Run at login on a Mac

```
cd relay
../.venv/bin/python install_launch_agent.py
```

It asks for the secret address (hidden), generates the token, installs a LaunchAgent and prints the
`agenda:` line for `config.js`. Log: `~/Library/Logs/tv-calendar-relay.log`. Remove with `--uninstall`.

Sleep: the relay runs under `caffeinate -i`, which stops *idle* sleep only. It does not stop sleep when you
close the lid or press the sleep button. For a Mac that serves the TV, use System Settings → Energy
(Battery/Power Adapter) → "Prevent automatic sleeping when the display is off", and keep the lid open or use
a display. macOS may ask once to allow incoming connections for Python; allow it. Give the Mac a fixed IP
(DHCP reservation in your router), or the address in `config.js` will go stale.

Google refreshes its iCal feeds slowly (can lag by several hours), so a meeting added minutes ago may not
show yet. The relay is plain HTTP on your LAN, protected only by the token.

## Phone remote + Claude search (optional, not set up)

This is built but **inactive**: it does nothing until `remote.url` is filled in `config.js`, and the launcher works
fully without it. Skip this section unless you want it.

A web page for your phone, served from your Mac: a d-pad (hold an arrow to repeat), buttons to open each app,
night mode, profile switch, a **Find something to watch** box powered by Claude, and a **Keep watching**
manager. Shows you add on the phone appear on the TV's shelf within a second or two and are saved per profile.

How it fits together: the TV launcher keeps a connection open to a small relay (`relay/remote_server.py`) on your
Mac; the phone talks to the same relay. The Anthropic API key lives only on the Mac, never on the TV or phone.

1. Install dependencies once (adds the `anthropic` package):
   ```
   cd relay && python3 -m venv ../.venv && ../.venv/bin/pip install -r requirements.txt
   ```
2. Run it at login (asks for your API key with a hidden prompt; Enter skips it and search stays off):
   ```
   ../.venv/bin/python install_launch_agent.py --service remote
   ```
   It prints the `remote: { url, token }` line for `config.js` and the link to open on your phone. Or run it by
   hand: `REMOTE_TOKEN=<long random> ANTHROPIC_API_KEY=... ../.venv/bin/python remote_server.py`.
3. Paste the `remote:` line into `config.js` and reinstall the app on the TV. Open the phone link, then Share →
   Add to Home Screen. Lost the link? TV → Settings → **Phone remote** shows it.

Things to know:

- **Claude only suggests.** It answers from what it knows, so a title may not be on your apps today or in your
  country. Each suggestion names the app it most likely streams on; you pick the app if it isn't one of yours.
  Opening a suggestion opens the *app*, not the title (Samsung gives apps no way to jump to a specific show).
- **Model and cost.** Defaults to `claude-opus-5-5` at low effort; set `CLAUDE_MODEL` to change it. One search is
  one short request. The relay allows 20 searches a minute. I did not enable the API's server-side refusal
  fallback; a refused request just shows no results.
- **What it can't do.** It can't press buttons *inside* Netflix/YouTube (Samsung doesn't allow one app to send
  remote keys to another), and the arrows only move around the launcher.
- **Security.** The relay is plain HTTP on your home network, protected by the token (checked on every request).
  Anyone on your Wi-Fi who learns the token can control the launcher and spend your API credit, so keep it private
  and use a long random one.
- **Mac asleep = remote offline** (same as the calendar relay; see "Run at login on a Mac" for sleep settings).
- Test without an API key: start the relay with `CLAUDE_MOCK=1` to get canned results.

## Try it without a TV

```
python3 -m http.server 8765
```

Open `http://localhost:8765`. Arrow keys, Enter, `E`. Launches are logged as toasts instead of run.
