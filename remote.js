// Connects the launcher to relay/remote_server.py so a phone can drive it.
//  - listens on /tv/events (Server-Sent Events) for key presses, app launches, night mode, profile changes
//  - pushes the launcher's state (apps, profiles) to the relay so the phone page matches this TV
//  - pulls the "Keep watching" shows that were added from the phone
(function () {
  var L = window.__launcher, R = (L.CFG.remote || {});
  if (!R.url) return;
  var base = R.url.replace(/\/$/, ""), q = "?token=" + encodeURIComponent(R.token || "");
  var lastState = "";

  function request(method, path, body, cb) {
    var x = new XMLHttpRequest();
    x.open(method, base + path + q);
    if (body) x.setRequestHeader("Content-Type", "text/plain");   // text/plain avoids a CORS preflight; the relay parses it as JSON
    x.onload = function () { if (cb) { try { cb(JSON.parse(x.responseText)); } catch (e) {} } };
    x.send(body ? JSON.stringify(body) : null);
  }

  function pushState(force) {
    var s = L.state(), j = JSON.stringify(s);
    if (force || j !== lastState) { lastState = j; request("POST", "/tv/state", s); }
  }
  function pullWatching() { request("GET", "/watching/all", null, function (j) { L.setWatching(j.watching); }); }

  function handle(c) {
    if (c.type === "key") L.key(c.key);
    else if (c.type === "launch") L.launchTile(c.tile);
    else if (c.type === "night") L.toggleNight();
    else if (c.type === "profile") L.setProfile(c.id);
    else if (c.type === "watching") pullWatching();
    else if (c.type === "toast") L.toast(c.text);
    setTimeout(function () { pushState(false); }, 150);
  }

  // EventSource reconnects on its own when the Mac sleeps or the network blips
  var es = new EventSource(base + "/tv/events" + q);
  es.onopen = function () { pushState(true); pullWatching(); };
  es.onmessage = function (ev) { try { handle(JSON.parse(ev.data)); } catch (e) {} };

  setInterval(function () { pushState(false); }, 5000);
})();
