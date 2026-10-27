// Edit this file to customise the launcher.
window.LAUNCHER_CONFIG = {
  // Profiles shown as chips at the top left. Each has its own dock (order, removed and added apps) and its
  // own shelf above the dock. The shelf fills itself with the apps you opened most recently on this TV.
  // (A TV app can't read what you watched inside Netflix/YouTube, so titles can't appear on their own.)
  // Optional: keepWatching: [{ tile: "netflix", title: "Rick and Morty", sub: "S1 E1", service: "Netflix" }]
  // replaces the automatic shelf with a list of shows you maintain yourself.
  profiles: [
    { id: "me", name: "Me", keepWatching: [] },
    { id: "guest", name: "Guest", keepWatching: [] }
  ],

  // The dock. appId values were read from this TV (tizen.application.getAppsInfo) and each was launch-tested.
  // label -> icon: icons/<label>.jpg (e.g. "Prime Video" -> icons/prime-video.jpg), else a coloured letter.
  // type "hdmi": switches the TV to HDMI <number> and shows "connected" when something is plugged in and on.
  // More apps: add them from the ... button on the TV, or add a line here (finding IDs: see the README).
  tiles: [
    { id: "netflix",  label: "Netflix",         type: "app",  appId: "org.tizen.netflix-app",        color: "#e50914" },
    { id: "youtube",  label: "YouTube",         type: "app",  appId: "com.samsung.tv.cobalt-yt",     color: "#ff0000" },
    { id: "stremio",  label: "Stremio",         type: "app",  appId: "IkWsFHtOY9.Stremio",           color: "#7b5bf5" },
    { id: "disney",   label: "Disney+",         type: "app",  appId: "Di0N6xZMEA.disneyplus",        color: "#113ccf" },
    { id: "prime",    label: "Prime Video",     type: "app",  appId: "org.tizen.primevideo",         color: "#00a8e1" },
    { id: "appletv",  label: "Apple TV",        type: "app",  appId: "com.samsung.tv.aria-video",    color: "#111111" },
    { id: "osn",      label: "OSN+",            type: "app",  appId: "BlDC3WXVuw.sample",            color: "#1a1a1a" },
    { id: "shahid",   label: "Shahid",          type: "app",  appId: "Ggl33q588H.MBC",               color: "#00c389" },
    { id: "starz",    label: "STARZPLAY",       type: "app",  appId: "d5y9d1orz6.starz",             color: "#111111" },
    { id: "plex",     label: "Plex",            type: "app",  appId: "kIciSQlYEM.plex",              color: "#e5a00d" },
    { id: "spotify",  label: "Spotify",         type: "app",  appId: "rJeHak5zRg.Spotify",           color: "#1db954" },
    { id: "hdmi1",    label: "PlayStation",     type: "hdmi", number: 2, sub: "HDMI 2",             color: "#0070d1" },   // ids are just names; number is the real port
    { id: "hdmi2",    label: "Nintendo Switch", type: "hdmi", number: 1, sub: "HDMI 1",             color: "#e60012" },
    { id: "inputs",   label: "Inputs",          type: "app",  appId: "com.samsung.tv.coba.source",   color: "#2a3142" }
  ],

  // Put the apps each profile opens most at the front of the dock. Off by default: you arrange the dock
  // yourself (press ▼ on an app → Reorder). Once you have reordered, your order wins over this.
  sortDockByUsage: false,

  // App ID used by "Get more apps" in the … screen to open the Samsung store. Samsung doesn't document it;
  // "org.tizen.tizenstore" is tried by default. If it doesn't open, find the right ID in Tizen Studio's Device
  // Manager and put it here.
  // storeAppId: "org.tizen.tizenstore",

  // Wallpapers you can pick from in Settings (or the Blue button / W). The first is the default.
  //   src + front: a scenic wallpaper with a foreground cut-out that the clock tucks behind (the iPhone
  //                lock-screen depth effect). front must be a transparent PNG/SVG the same size as src.
  //   clock: [top, bottom] colours of the clock gradient.
  // Your own photo: copy it into wallpapers/ and add a line. Add a front cut-out PNG for the depth effect.
  // Use 1920x1080 images, ideally under ~2 MB each.
  wallpapers: [
    { name: "Dusk Peaks",  src: "wallpapers/dusk-peaks.jpg",  front: "wallpapers/dusk-peaks-front.png",  clock: ["#ffc0d0", "#b7a0f2"] },
    { name: "Alpine Blue", src: "wallpapers/alpine-blue.jpg", front: "wallpapers/alpine-blue-front.png", clock: ["#ffffff", "#a9cdf2"] },
    { name: "Dunes",       src: "wallpapers/dunes.jpg",                                                   clock: ["#fff3d6", "#ffb98a"] },
    { name: "Aurora",      css: "linear-gradient(135deg, #1b2440, #3a1d4f 55%, #0b0d12)",                clock: ["#e7d9ff", "#8f7bd8"] },
    { name: "Graphite",    css: "linear-gradient(135deg, #0d0d0f, #26272c)",                             clock: ["#ffffff", "#9a9aa3"] },
    { name: "My photo",    src: "wallpapers/wallpaper.jpg" }
  ],

  // Screensaver: starts after minutes of no remote input. mode: off | scenic | bigclock | aurora | stars | analog
  // (changeable in Settings on the TV; these are only the first-run defaults)
  screensaver: { mode: "scenic", minutes: 5 },

  // Night mode (the moon at top right, or Green / N): dims the picture and warms the colours.
  // "Night schedule" in Settings turns it on automatically between these times.
  nightWindow: { from: "22:00", to: "06:00" },

  // Weather (Open-Meteo, no API key). Set your own city in config.local.js.
  weather: { latitude: 51.5072, longitude: -0.1276, city: "London", units: "celsius" },

  // Phone/TV notifications via ntfy (https://ntfy.sh). Anyone who knows the topic can read and post,
  // so make it a long random string. Leave it as CHANGE-ME to disable.
  notifications: { server: "https://ntfy.sh", topic: "CHANGE-ME-pick-a-long-random-string", keep: 4 },

  // Upcoming events from Google Calendar via relay/calendar_relay.py (see README).
  // url: where the relay runs, e.g. "http://192.168.1.50:8787/events". Empty disables the panel.
  agenda: { url: "", token: "", max: 4 },

  // Phone remote + Claude search (relay/remote_server.py running on your Mac; see README).
  // url: the Mac's address on your home network, e.g. "http://192.168.1.50:8790". Empty disables it.
  // token: the REMOTE_TOKEN you started the relay with.
  remote: { url: "", token: "" },

  // 12-hour clock without a leading zero (1:42). true = 24-hour. Also changeable in Settings.
  clock24: false
};
