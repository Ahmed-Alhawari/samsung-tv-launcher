// Subscribes to an ntfy topic and shows incoming messages as a banner + inbox entry.
// Send from a phone with the ntfy app, or: curl -d "Dinner is ready" -H "Title: Wife" ntfy.sh/<topic>
(function () {
  var N = (window.LAUNCHER_CONFIG || {}).notifications;
  var list = document.getElementById("inbox-list");
  var banner = document.getElementById("banner");
  var items = [], seen = {}, bannerTimer;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function hhmm(ts) { var d = new Date(ts * 1000); return (d.getHours() < 10 ? "0" : "") + d.getHours() + ":" + (d.getMinutes() < 10 ? "0" : "") + d.getMinutes(); }

  // The inbox card only appears when there is something in it; status messages (connecting, offline) are not shown.
  var box = document.getElementById("inbox");
  function render() {
    box.hidden = !items.length;
    list.innerHTML = items.map(function (n) {
      return "<li><time>" + hhmm(n.time) + "</time>" + (n.title ? "<b>" + esc(n.title) + "</b>" : "") + esc(n.message || "") + "</li>";
    }).join("");
  }

  function show(n) {
    banner.innerHTML = (n.title ? "<b>" + esc(n.title) + "</b>" : "") + esc(n.message || "");
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { banner.hidden = true; }, 8000);
  }

  function onMessage(n, live) {
    if (n.event !== "message" || seen[n.id]) return;
    seen[n.id] = true;
    items.unshift(n);
    items = items.slice(0, N.keep || 5);
    render();
    if (live) show(n);
  }

  if (!N || !N.topic || /^CHANGE-ME/.test(N.topic)) { render("Set a notifications topic in config.js"); return; }

  render("Connecting…");
  var started = Date.now();
  var es = new EventSource(N.server + "/" + encodeURIComponent(N.topic) + "/sse?since=1h");
  es.onopen = function () { if (!items.length) render(); };
  es.onmessage = function (ev) {
    try {
      var n = JSON.parse(ev.data);
      // messages replayed from the last hour fill the inbox quietly; only newer ones pop up
      onMessage(n, Date.now() - started > 3000 && n.time * 1000 > started - 5000);
    } catch (e) {}
  };
  es.onerror = function () { if (!items.length) render("Notifications offline — retrying"); };
})();
