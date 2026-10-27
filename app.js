(function () {
  var CFG = window.LAUNCHER_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var hasTizen = typeof window.tizen !== "undefined";

  // ---------- storage ----------
  var store = {
    get: function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };
  function getJSON(k, d) { try { var v = JSON.parse(store.get(k)); return v === null || v === undefined ? d : v; } catch (e) { return d; } }
  function setJSON(k, v) { store.set(k, JSON.stringify(v)); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  // ---------- settings (changeable from the Settings screen, remembered on the TV) ----------
  var SAVERS = [["off", "Off"], ["scenic", "Scenic"], ["bigclock", "Big clock"], ["aurora", "Aurora"], ["stars", "Starfield"], ["analog", "Analog clock"]];
  var MINUTES = [1, 2, 5, 10, 20, 30];
  var SV = CFG.screensaver || {};
  var DEF = { saver: SV.mode || "scenic", saverMinutes: SV.minutes || 5, night: false, nightSchedule: false,
    clock24: !!CFG.clock24, wallpaper: null, profile: null };
  var S = getJSON("settings", {});
  Object.keys(DEF).forEach(function (k) { if (S[k] === undefined) S[k] = DEF[k]; });
  function save() { setJSON("settings", S); }

  // ---------- profiles: each has its own usage history and pinned apps ----------
  var profiles = CFG.profiles && CFG.profiles.length ? CFG.profiles : [{ id: "home", name: "Home", keepWatching: [] }];
  function profile() { return profiles.filter(function (p) { return p.id === S.profile; })[0] || profiles[0]; }
  function usage() { return getJSON("usage:" + profile().id, {}); }
  function bump(key) { var u = usage(); u[key] = (u[key] || 0) + 1; setJSON("usage:" + profile().id, u); }
  function pins() { return getJSON("pins:" + profile().id, []); }
  var remoteWatching = {};   // profile id -> shows added from the phone (pulled by remote.js)

  // ---------- toast ----------
  var toastTimer;
  function toast(msg, ms) {
    var t = $("toast");
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3500);
  }

  // ---------- clock + date ----------
  var DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  function clockText(d) {
    d = d || new Date();
    var h = S.clock24 ? pad(d.getHours()) : (d.getHours() % 12 || 12);
    return h + ":" + pad(d.getMinutes());
  }

  function tick() {
    var d = new Date();
    $("time").textContent = clockText(d);
    $("date").textContent = DAYS[d.getDay()] + " " + d.getDate() + " " + MONTHS[d.getMonth()];
    applyNight();
  }

  // ---------- weather (Open-Meteo) ----------
  var WMO = { 0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
    51: "Drizzle", 53: "Drizzle", 55: "Drizzle", 61: "Rain", 63: "Rain", 65: "Heavy rain",
    71: "Snow", 73: "Snow", 75: "Heavy snow", 80: "Showers", 81: "Showers", 82: "Heavy showers",
    95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm" };

  function loadWeather() {
    var w = CFG.weather;
    if (!w) return;
    var unit = w.units === "fahrenheit" ? "fahrenheit" : "celsius";
    var x = new XMLHttpRequest();
    x.open("GET", "https://api.open-meteo.com/v1/forecast?latitude=" + w.latitude + "&longitude=" + w.longitude +
      "&current=temperature_2m,weather_code&temperature_unit=" + unit + "&timezone=auto");
    x.onload = function () {
      try {
        var j = JSON.parse(x.responseText);
        $("wx-temp").textContent = Math.round(j.current.temperature_2m) + "°";
        $("wx-desc").textContent = WMO[j.current.weather_code] || "";
      } catch (e) {}
    };
    x.send();
  }

  // ---------- night mode ----------
  function inNightWindow() {
    var w = CFG.nightWindow || { from: "22:00", to: "06:00" }, d = new Date(), m = d.getHours() * 60 + d.getMinutes();
    function p(s) { var a = s.split(":"); return +a[0] * 60 + +a[1]; }
    var f = p(w.from), t = p(w.to);
    return f <= t ? (m >= f && m < t) : (m >= f || m < t);
  }
  function applyNight() { document.body.classList.toggle("night", !!(S.night || (S.nightSchedule && inNightWindow()))); }

  // ---------- wallpaper (with optional foreground cut-out for the depth effect) ----------
  var wallpapers = CFG.wallpapers || [], wpIdx = 0, wpSaved = 0;

  function applyWallpaper(i, quiet) {
    var w = wallpapers[i], bg = $("wallpaper"), fg = $("front");
    if (!w) return;
    var c = w.clock || ["#ffffff", "#b8b8ff"];
    document.body.style.setProperty("--ca", c[0]); document.body.style.setProperty("--cb", c[1]);
    if (w.css) { bg.style.backgroundImage = w.css; fg.style.backgroundImage = "none"; return; }
    var img = new Image();
    img.onload = function () {
      if (wallpapers[wpIdx] !== w) return;
      bg.style.backgroundImage = "url('" + w.src + "')";
      fg.style.backgroundImage = w.front ? "url('" + w.front + "')" : "none";
    };
    img.onerror = function () { if (!quiet) toast("Can't load " + w.src + ". Copy the image into wallpapers/ first.", 5000); };
    img.src = w.src;
  }

  (function () {
    wallpapers.forEach(function (w, i) { if (w.name === S.wallpaper) wpIdx = i; });
    wpSaved = wpIdx; applyWallpaper(wpIdx, true);
  })();

  // decode every wallpaper once, in the background, so switching between them doesn't stall
  function warmWallpapers() { wallpapers.forEach(function (w) { [w.src, w.front].forEach(function (u) { if (u) { var im = new Image(); im.src = u; } }); }); }
  setTimeout(warmWallpapers, 4000);

  function openWallpaperChooser() {
    wpSaved = wpIdx;
    openList("Wallpaper", wallpapers.map(function (w) { return { name: w.name, hint: w.front ? "depth" : (w.css ? "gradient" : "image") }; }), {
      cls: "wp", start: wpIdx,
      onMove: function (i) { wpIdx = i; applyWallpaper(i); },
      onChoose: function (i) { wpIdx = wpSaved = i; S.wallpaper = wallpapers[i].name; save(); toast("Wallpaper: " + wallpapers[i].name); },
      onCancel: function () { wpIdx = wpSaved; applyWallpaper(wpIdx, true); }
    });
  }

  // ---------- launching ----------
  var mode = "home"; // home | list | ctx | reorder | hdmi

  function colorFor(name) {
    var h = 0; for (var i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360;
    return "hsl(" + h + ",55%,48%)";
  }

  function slug(name) { return String(name).toLowerCase().replace(/\+/g, " plus ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

  // Official app icons: icons/<slug of the app name>.jpg (see tools/fetch_icons.py), then the icon the TV reports
  // for the app (only works if Samsung lets us read it). If none loads, the coloured letter stays.
  var iconOK = {};   // app id -> the source that worked, so re-draws show the icon straight away
  function attachIcon(host, t) {
    var srcs = [];
    if (t.img) srcs.push(t.img);
    srcs.push("icons/" + slug(t.label) + ".jpg");
    if (t.icon) srcs.push(t.icon.charAt(0) === "/" ? "file://" + t.icon : t.icon);
    (function next(i) {
      if (i >= srcs.length) return;
      var im = new Image(); im.className = "ico";
      im.onload = function () { iconOK[t.id] = srcs[i]; host.insertBefore(im, host.firstChild); host.classList.add("has-ico"); };
      im.onerror = function () { next(i + 1); };
      im.src = srcs[i];
    })(Math.max(0, srcs.indexOf(iconOK[t.id])));
  }

  // What you open from the launcher fills the shelf by itself.
  function recents() { return getJSON("recent:" + profile().id, []); }
  function recordRecent(t) {
    var r = recents().filter(function (x) { return x.id !== t.id; });
    r.unshift({ id: t.id, label: t.label, type: t.type, appId: t.appId, number: t.number, color: t.color, icon: t.icon, sub: t.sub, ts: Date.now() });
    setJSON("recent:" + profile().id, r.slice(0, 8));
  }
  function ago(ts) {
    var m = Math.round((Date.now() - ts) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60); if (h < 24) return h + (h === 1 ? " hour ago" : " hours ago");
    var d = Math.round(h / 24); return d + (d === 1 ? " day ago" : " days ago");
  }

  function tileById(id) { return CFG.tiles.filter(function (t) { return t.id === id; })[0]; }
  function appIdFor(t) { return store.get("appId:" + t.id) || t.appId; }

  function launch(t) {
    if (t.type === "hdmi") return openHdmi(t);
    var id = appIdFor(t);
    if (!id) return pickAppFor(t);
    if (!hasTizen) return toast("[browser test] would launch " + t.label + " (" + id + ")");
    try {
      tizen.application.launch(id, function () {}, function (e) {
        toast("Couldn't launch " + t.label + " (" + (e && e.name) + "). Press Yellow to pick the app.", 5000);
      });
    } catch (e) { toast("Launch failed: " + e.message, 5000); }
  }

  function installedApps(cb) {
    if (hasTizen && tizen.application.getAppsInfo) {
      tizen.application.getAppsInfo(function (list) {
        var me = ""; try { me = tizen.application.getCurrentApplication().appInfo.id; } catch (e) {}
        cb(list.filter(function (a) { return a.show !== false && a.id !== me; })
          .map(function (a) { return { id: a.id, name: a.name, icon: a.iconPath }; })
          .sort(function (a, b) { return a.name.localeCompare(b.name); }));
      }, function (e) { toast("Can't list apps: " + e.name, 5000); });
    } else {
      var demo = []; for (var n = 1; n <= 14; n++) demo.push({ id: "demo.app" + n, name: "Demo app " + n });
      cb(demo);
    }
  }

  function pickAppFor(t) {
    installedApps(function (apps) {
      openList("Choose the app for “" + t.label + "”", apps.map(function (a) { return { name: a.name, hint: a.id }; }), {
        onChoose: function (i) { store.set("appId:" + t.id, apps[i].id); toast(t.label + " → " + apps[i].name); }
      });
    });
  }

  function launchApp(a) {
    recordRecent({ id: "pin:" + a.id, label: a.name, type: "app", appId: a.id, icon: a.icon, color: colorFor(a.name) });
    if (!hasTizen) return toast("[browser test] would launch " + a.name);
    try { tizen.application.launch(a.id, function () {}, function (e) { toast("Couldn't launch " + a.name + " (" + (e && e.name) + ")", 5000); }); }
    catch (e) { toast("Launch failed: " + e.message, 5000); }
  }

  // Samsung doesn't document the store's app ID; "org.tizen.tizenstore" is the best candidate, so set
  // storeAppId in config.js if you find the right one with Tizen Studio's Device Manager.
  function openStore() {
    var id = CFG.storeAppId || "org.tizen.tizenstore", help = "Couldn't open the store from here. Open “Apps” on the TV's home screen, install the app, then add it here from All apps.";
    if (!hasTizen) return toast("[browser test] would open the Samsung app store");
    try { tizen.application.launch(id, function () {}, function () { toast(help, 9000); }); } catch (e) { toast(help, 9000); }
  }

  function moreItems(apps) {
    var inDock = pins().map(function (x) { return x.appId; }), hid = hiddenIds();
    var items = [{ kind: "store", name: "Get more apps", hint: "Samsung Apps store" }];
    if (hid.length) items.push({ kind: "restore", name: "Restore removed dock items", hint: String(hid.length) });
    apps.forEach(function (a) { items.push({ kind: "app", app: a, name: a.name, hint: inDock.indexOf(a.id) >= 0 ? "✓ in dock" : "" }); });
    return items;
  }

  function togglePin(a) {
    var p = pins(), at = -1; p.forEach(function (x, n) { if (x.appId === a.id) at = n; });
    if (at >= 0) { p.splice(at, 1); toast("Removed " + a.name + " from the dock"); }
    else { p.push({ appId: a.id, name: a.name, icon: a.icon }); toast("Added " + a.name + " to the dock"); }
    setJSON("pins:" + profile().id, p); render();
  }

  // Everything here works with just the arrows, OK and Back (no coloured buttons needed).
  function openMore(start) {
    installedApps(function (apps) {
      var cur = moreItems(apps);
      openList("All apps", cur, {
        start: start || 0,
        foot: "▲ ▼ select · OK for options · Back close",
        onChoose: function (i) {
          var it = cur[i];
          if (it.kind === "store") openStore();
          else if (it.kind === "restore") { setJSON("hidden:" + profile().id, []); render(); toast("Restored removed items"); }
          else {
            var a = it.app, inDock = pins().some(function (x) { return x.appId === a.id; });
            openList(a.name, [{ name: "Open" }, { name: inDock ? "Remove from dock" : "Add to dock" }], {
              foot: "▲ ▼ select · OK choose · Back",
              onChoose: function (j) { if (j === 0) launchApp(a); else { togglePin(a); openMore(i); } },
              onCancel: function () { openMore(i); }
            });
          }
        }
      });
    });
  }

  // ---------- HDMI ----------
  // The TV rejects a hand-made {type:"HDMI", number:n}; it wants an object from its own VIDEOSOURCE list.
  var hdmiLive = {};   // HDMI number -> true while something is plugged in and sending a signal

  function videoSources(cb, fail) {
    try { tizen.systeminfo.getPropertyValue("VIDEOSOURCE", cb, fail || function () {}); } catch (e) { if (fail) fail(e); }
  }
  function pollHdmi() {
    if (!hasTizen || !tizen.systeminfo) return;
    videoSources(function (src) {
      hdmiLive = {};
      (src.connected || []).forEach(function (s) { if (s.type === "HDMI") hdmiLive[s.number] = true; });
      applyHdmiLive();
    });
  }
  function applyHdmiLive() {
    [].forEach.call(document.querySelectorAll("[data-hdmi]"), function (el) {
      var n = el.getAttribute("data-hdmi"); el.textContent = "HDMI " + n + (hdmiLive[n] ? " · connected" : "");
    });
  }

  function openHdmi(t) {
    if (!hasTizen || !tizen.tvwindow) return toast("[browser test] would switch to HDMI " + t.number);
    function fail(e) { toast("Couldn't switch to HDMI " + t.number + " (" + (e && e.name) + "). Use the Inputs icon instead.", 6000); }
    videoSources(function (src) {
      var pick = null;
      [].concat(src.connected || [], src.disconnected || []).forEach(function (s) { if (!pick && s.type === "HDMI" && s.number === t.number) pick = s; });
      if (!pick) return toast("This TV has no HDMI " + t.number, 5000);
      try {
        tizen.tvwindow.setSource(pick, function () {
          tizen.tvwindow.show(function () {
            mode = "hdmi"; document.body.classList.add("passthrough"); document.documentElement.classList.add("passthrough");
          }, fail, ["0px", "0px", "1920px", "1080px"], "MAIN");
        }, fail, "MAIN");
      } catch (e) { fail(e); }
    }, fail);
  }
  function closeHdmi() {
    try { tizen.tvwindow.hide(function () {}, function () {}, "MAIN"); } catch (e) {}
    mode = "home"; document.body.classList.remove("passthrough"); document.documentElement.classList.remove("passthrough");
  }

  // ---------- generic list overlay (wallpapers, app pickers, settings) ----------
  var L = null;

  function openList(title, items, o) {
    o = o || {};
    L = { items: items, idx: o.start || 0, o: o };
    $("picker-title").textContent = title;
    $("picker").className = o.cls || "";
    $("picker-foot").textContent = o.foot || "▲ ▼ select · OK choose · Back cancel";
    $("picker").hidden = false; mode = "list";
    renderList();
    if (o.onMove) o.onMove(L.idx);
  }
  function renderList() {
    var start = Math.max(0, L.idx - 8), html = "";
    L.items.slice(start, start + 14).forEach(function (it, i) {
      html += '<li class="' + (start + i === L.idx ? "focus" : "") + '"><span>' + esc(it.name) + "</span><small>" + esc(it.hint || "") + "</small></li>";
    });
    $("picker-list").innerHTML = html;
  }
  function closeList() { $("picker").hidden = true; $("picker").className = ""; mode = "home"; L = null; }

  function isBack(k) { return k === 10009 || k === 8 || k === 27; }

  function listKey(k) {
    var o = L.o;
    if (k === 38 && L.idx > 0) L.idx--;
    else if (k === 40 && L.idx < L.items.length - 1) L.idx++;
    else if (k === 13) {
      var i = L.idx;
      if (o.refresh) { o.onChoose(i); if (L) { L.items = o.refresh(); renderList(); } return; }
      closeList(); if (o.onChoose) o.onChoose(i); return;
    }
    else if (isBack(k)) { var c = o.onCancel; closeList(); if (c) c(); return; }
    else if (k === 405 && o.onYellow) { o.onYellow(L.idx); return; }
    else return;
    if (o.onMove) o.onMove(L.idx);
    renderList();
  }

  // ---------- settings ----------
  function cycle(arr, cur, key) { var i = 0; arr.forEach(function (v, n) { if ((key ? v[0] : v) === cur) i = n; }); return arr[(i + 1) % arr.length]; }
  function saverLabel() { return SAVERS.filter(function (s) { return s[0] === S.saver; })[0][1]; }

  function settingsItems() {
    var w = CFG.nightWindow || { from: "22:00", to: "06:00" };
    return [
      { name: "Wallpaper", hint: wallpapers[wpSaved] ? wallpapers[wpSaved].name : "" },
      { name: "Screensaver", hint: saverLabel() },
      { name: "Screensaver starts after", hint: S.saverMinutes + " min" },
      { name: "Preview screensaver", hint: "" },
      { name: "Night mode", hint: S.night ? "On" : "Off" },
      { name: "Night schedule", hint: S.nightSchedule ? w.from + " – " + w.to : "Off" },
      { name: "Clock", hint: S.clock24 ? "24-hour" : "12-hour" },
      { name: "Display", hint: "screen " + screen.width + "×" + screen.height + " · page " + innerWidth + "×" + innerHeight },
      { name: "Reset " + profile().name + "’s dock", hint: "order & apps" }
    ].concat(CFG.remote && CFG.remote.url ? [{ name: "Phone remote", hint: "show link" }] : []);
  }

  function openSettings() {
    openList("Settings", settingsItems(), {
      foot: "▲ ▼ select · OK change · Back close",
      refresh: settingsItems,
      onChoose: function (i) {
        if (i === 0) { closeList(); openWallpaperChooser(); return; }
        if (i === 1) S.saver = cycle(SAVERS, S.saver, true)[0];
        if (i === 2) S.saverMinutes = cycle(MINUTES, S.saverMinutes);
        if (i === 3) { closeList(); if (L_.saver) setTimeout(L_.saver.preview, 200); return; }
        if (i === 4) S.night = !S.night;
        if (i === 5) S.nightSchedule = !S.nightSchedule;
        if (i === 6) S.clock24 = !S.clock24;
        if (i === 7) { toast("Screen " + screen.width + "×" + screen.height + ", page " + innerWidth + "×" + innerHeight + ", pixel ratio " + devicePixelRatio, 7000); return; }
        if (i === 8) {
          ["usage:", "order:", "hidden:", "pins:", "recent:"].forEach(function (k) { store.set(k + profile().id, ""); });
          nav.col = 0; dockX = 0; render(); toast("Dock reset for " + profile().name);
        }
        if (i === 9) {
          var R = CFG.remote || {};
          toast(R.url ? "On your phone, open:  " + R.url + "/?token=" + R.token : "Set remote.url and remote.token in config.js (see README)", 20000);
        }
        save(); applyNight(); tick();
      }
    });
  }

  // ---------- home screen: three rows (top bar, keep watching, dock) ----------
  var lists = { top: [], shelf: [], dock: [] }, els = { top: [], shelf: [], dock: [] }, nav = { row: "dock", col: 0 };
  var ICON = {
    moon: '<svg viewBox="0 0 24 24"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
    more: '<svg viewBox="0 0 24 24" style="fill:#fff;stroke:none"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>'
  };

  function buildLists() {
    var p = profile(), u = usage();
    lists.top = profiles.map(function (x) { return { kind: "profile", p: x }; }).concat([{ kind: "moon" }]);

    var cards = (remoteWatching[p.id] || []).concat(p.keepWatching || []).map(function (c, i) { return { kind: "card", c: c, n: u["card:" + c.title] || 0, i: i }; });
    cards.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    var auto = recents().map(function (x) { return { kind: "card", auto: true, t: x, c: { title: x.label, service: "Opened", sub: ago(x.ts), tile: x.id, color: x.color } }; });
    lists.shelfTitle = cards.length ? "Keep watching" : "Recently used";
    lists.shelf = (cards.length ? cards : auto).slice(0, 3);

    var tiles = CFG.tiles.map(function (t, i) { return { kind: "tile", t: t, n: u[t.id] || 0, i: i }; })
      .concat(pins().map(function (x, i) {
        return { kind: "tile", n: 0, i: 100 + i, t: { id: "pin:" + x.appId, label: x.name, type: "app", appId: x.appId, color: colorFor(x.name), icon: x.icon } };
      }));
    var hid = hiddenIds(), order = getJSON("order:" + p.id, []);
    tiles = tiles.filter(function (x) { return hid.indexOf(x.t.id) < 0; });
    if (order.length) {   // the order you set with Reorder; anything new goes at the end
      tiles.sort(function (a, b) {
        var ra = order.indexOf(a.t.id), rb = order.indexOf(b.t.id);
        return (ra < 0 ? 1000 + a.i : ra) - (rb < 0 ? 1000 + b.i : rb);
      });
    } else if (CFG.sortDockByUsage) tiles.sort(function (a, b) { return b.n - a.n || a.i - b.i; });
    lists.dock = tiles.concat([{ kind: "settings" }, { kind: "more" }]);
  }

  function mk(cls, html) { var d = document.createElement("div"); d.className = cls; d.innerHTML = html || ""; return d; }

  function render() {
    buildLists();
    var el;
    el = $("profiles"); el.innerHTML = ""; els.top = [];
    lists.top.forEach(function (it) {
      if (it.kind === "profile") { var c = mk("chip" + (it.p.id === profile().id ? " active" : ""), esc(it.p.name)); el.appendChild(c); els.top.push(c); }
    });
    $("moon").innerHTML = ICON.moon; els.top.push($("moon"));

    el = $("cards"); el.innerHTML = ""; els.shelf = [];
    $("shelf").hidden = !lists.shelf.length; $("shelf-title").textContent = lists.shelfTitle;
    lists.shelf.forEach(function (it) {
      var c = it.c, t = it.auto ? it.t : (tileById(c.tile) || {});
      var d = mk("card", '<div class="poster" style="--c:' + (c.color || t.color || "#555") + '"><span>' + esc((c.title || "?").charAt(0)) + "</span></div>" +
        '<div><div class="svc">' + esc(c.service || t.label || "") + '</div><div class="title">' + esc(c.title) + "</div>" + (c.sub ? '<div class="sub">' + esc(c.sub) + "</div>" : "") + "</div>");
      if (it.auto) attachIcon(d.firstChild, it.t);
      el.appendChild(d); els.shelf.push(d);
    });

    el = $("dock"); el.innerHTML = ""; els.dock = [];
    lists.dock.forEach(function (it) {
      var d;
      if (it.kind === "tile") {
        var t = it.t;
        d = mk("tile", '<span class="glyph">' + esc(t.label.charAt(0)) + '</span><div class="cap"><div class="name">' + esc(t.label) + "</div>" + (t.sub ? '<div class="sub"' + (t.type === "hdmi" ? ' data-hdmi="' + t.number + '"' : "") + ">" + esc(t.sub) + "</div>" : "") + "</div>");
        d.style.setProperty("--c", t.color);
        attachIcon(d, t);
      } else {
        d = mk("tile plain", ICON[it.kind === "settings" ? "gear" : "more"] + '<div class="cap"><div class="name">' + (it.kind === "settings" ? "Settings" : "All apps") + "</div></div>");
      }
      el.appendChild(d); els.dock.push(d);
    });
    clamp(); focus(); applyHdmiLive();
  }

  function rowsAvail() { return ["top", "shelf", "dock"].filter(function (r) { return lists[r].length; }); }
  function clamp() {
    if (!lists[nav.row].length) nav.row = "dock";
    nav.col = Math.max(0, Math.min(nav.col, lists[nav.row].length - 1));
  }
  function focus() {
    ["top", "shelf", "dock"].forEach(function (r) {
      els[r].forEach(function (e, i) { e.classList.toggle("focus", nav.row === r && nav.col === i); });
    });
    if (mode === "reorder" && els.dock[nav.col]) els.dock[nav.col].classList.add("grab");
    scrollDock();
  }

  // ---------- dock: scroll, pop-up menu, reorder, remove ----------
  var PITCH = 150, VIEW = 1700, dockX = 0, ctx = null, reorderId = null;
  function hiddenIds() { return getJSON("hidden:" + profile().id, []); }
  function tileCount() { return lists.dock.length - 2; }   // the last two are Settings and All apps

  function scrollDock() {
    if (nav.row === "dock") {   // keep the focused icon in view, moving the strip as little as possible
      var left = nav.col * PITCH, right = (nav.col + 1) * PITCH;
      if (left < dockX) dockX = left;
      if (right > dockX + VIEW - 90) dockX = right - (VIEW - 90);
      dockX = Math.max(0, dockX);
    }
    $("dock").style.transform = "translateX(" + (-dockX) + "px)";
  }

  function openCtx() {
    var it = lists.dock[nav.col]; if (!it || it.kind !== "tile") return;
    var t = it.t, items = [{ id: "reorder", name: "Reorder" }, { id: "remove", name: "Remove from dock" }];
    if (t.type === "app" && t.id.indexOf("pin:") !== 0) items.push({ id: "change", name: "Change app…" });
    ctx = { items: items, idx: 0, t: t }; mode = "ctx";
    $("ctx").style.left = Math.max(20, Math.min(1570, 110 + 14 + nav.col * PITCH - dockX + 60 - 165)) + "px";
    renderCtx(); $("ctx").hidden = false;
  }
  function renderCtx() {
    $("ctx").innerHTML = '<div class="ctx-title">' + esc(ctx.t.label) + "</div>" +
      ctx.items.map(function (it, i) { return '<div class="ctx-item' + (i === ctx.idx ? " focus" : "") + '">' + esc(it.name) + "</div>"; }).join("");
  }
  function closeCtx() { $("ctx").hidden = true; ctx = null; mode = "home"; }
  function ctxKey(k) {
    if (k === 38 && ctx.idx > 0) ctx.idx--;
    else if (k === 40 && ctx.idx < ctx.items.length - 1) ctx.idx++;
    else if (k === 13) {
      var c = ctx, id = c.items[c.idx].id; closeCtx();
      if (id === "reorder") { reorderId = c.t.id; mode = "reorder"; focus(); toast("◀ ▶ move · OK when done", 600000); }
      else if (id === "remove") removeFromDock(c.t);
      else pickAppFor(c.t);
      return;
    }
    else if (isBack(k)) { closeCtx(); return; }
    else return;
    renderCtx();
  }

  function reorderKey(k) {
    var n = tileCount(), i = nav.col, j = i;
    if (k === 37) j = i - 1; else if (k === 39) j = i + 1;
    else if (k === 13 || isBack(k)) { reorderId = null; mode = "home"; $("toast").hidden = true; focus(); toast("Order saved", 1500); return; }
    else return;
    if (j < 0 || j >= n) return;
    var ids = lists.dock.slice(0, n).map(function (x) { return x.t.id; }), tmp = ids[i];
    ids[i] = ids[j]; ids[j] = tmp;
    setJSON("order:" + profile().id, ids);
    nav.col = j; render();
  }

  function removeFromDock(t) {
    if (t.id.indexOf("pin:") === 0) setJSON("pins:" + profile().id, pins().filter(function (p) { return "pin:" + p.appId !== t.id; }));
    else { var h = hiddenIds(); h.push(t.id); setJSON("hidden:" + profile().id, h); }
    render(); toast("Removed " + t.label + ". Bring it back from the … button", 4000);
  }

  function activate(it) {
    if (it.kind === "profile") { S.profile = it.p.id; save(); render(); }
    else if (it.kind === "moon") { S.night = !S.night; save(); applyNight(); }
    else if (it.kind === "card") {
      if (it.auto) { recordRecent(it.t); launch(it.t); return; }
      bump("card:" + it.c.title); var t = tileById(it.c.tile); if (t) { recordRecent(t); launch(t); } else toast("No tile “" + it.c.tile + "” in config.js");
    }
    else if (it.kind === "tile") { bump(it.t.id); recordRecent(it.t); launch(it.t); }
    else if (it.kind === "settings") openSettings();
    else if (it.kind === "more") openMore();
  }

  // ---------- keys ----------
  var K = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, GREEN: 404, YELLOW: 405, BLUE: 406, E: 69, W: 87, N: 78 };
  if (hasTizen && tizen.tvinputdevice) {
    ["ColorF1Green", "ColorF2Yellow", "ColorF3Blue"].forEach(function (key) { try { tizen.tvinputdevice.registerKey(key); } catch (e) {} });
  }

  document.addEventListener("keydown", function (ev) {
    var k = ev.keyCode;
    if (mode === "hdmi") { if (isBack(k)) closeHdmi(); return; }
    if (mode === "list") { listKey(k); return; }
    if (mode === "ctx") { ctxKey(k); return; }
    if (mode === "reorder") { reorderKey(k); return; }

    var rows = rowsAvail(), ri = rows.indexOf(nav.row);
    if (k === K.LEFT) nav.col--;
    else if (k === K.RIGHT) nav.col++;
    else if (k === K.UP && ri > 0) { nav.row = rows[ri - 1]; }
    else if (k === K.DOWN && nav.row === "dock" && lists.dock[nav.col].kind === "tile") { openCtx(); return; }
    else if (k === K.DOWN && ri < rows.length - 1) { nav.row = rows[ri + 1]; }
    else if (k === K.ENTER) { activate(lists[nav.row][nav.col]); return; }
    else if ((k === K.YELLOW || k === K.E) && nav.row === "dock" && lists.dock[nav.col].kind === "tile" && lists.dock[nav.col].t.type === "app") { pickAppFor(lists.dock[nav.col].t); return; }
    else if ((k === K.BLUE || k === K.W) && wallpapers.length) { openWallpaperChooser(); return; }
    else if (k === K.GREEN || k === K.N) { S.night = !S.night; save(); applyNight(); return; }
    else if (k === 10009 && hasTizen) { try { tizen.application.getCurrentApplication().exit(); } catch (e) {} return; }
    else return;
    clamp(); focus();
  });

  // ---------- fit to window (1920x1080 design; identical to scale 1 on the TV) ----------
  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    document.body.style.transform = s === 1 ? "" : "scale(" + s + ")";
  }
  window.addEventListener("resize", fit); fit();

  // ---------- init ----------
  var KEYCODES = { left: 37, up: 38, right: 39, down: 40, ok: 13, back: 27, green: 404, yellow: 405, blue: 406 };
  var L_ = window.__launcher = {
    S: S, CFG: CFG, wallpapers: wallpapers, clockText: clockText, mode: function () { return mode; }, saver: null, render: render,
    toast: toast,
    // used by remote.js (the phone remote)
    state: function () {
      return {
        tiles: CFG.tiles.map(function (t) { return { id: t.id, label: t.label, type: t.type, color: t.color }; }),
        profiles: profiles.map(function (p) { return { id: p.id, name: p.name }; }),
        profile: profile().id, night: document.body.classList.contains("night")
      };
    },
    key: function (name) { document.dispatchEvent(new KeyboardEvent("keydown", { keyCode: KEYCODES[name], bubbles: true })); },
    launchTile: function (id) { var t = tileById(id); if (t) { bump(t.id); recordRecent(t); launch(t); } else toast("No tile “" + id + "”"); },
    toggleNight: function () { S.night = !S.night; save(); applyNight(); },
    setProfile: function (id) { if (profiles.some(function (p) { return p.id === id; })) { S.profile = id; save(); render(); } },
    setWatching: function (map) { remoteWatching = map || {}; render(); }
  };
  render(); tick(); pollHdmi(); setInterval(pollHdmi, 10000); setInterval(tick, 15000); loadWeather(); setInterval(loadWeather, 20 * 60 * 1000);
})();
