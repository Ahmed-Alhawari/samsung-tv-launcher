// Shows the next few Google Calendar events, fetched from relay/calendar_relay.py.
(function () {
  var A = (window.LAUNCHER_CONFIG || {}).agenda;
  var panel = document.getElementById("agenda");
  var list = document.getElementById("agenda-list");
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (!A || !A.url) { panel.hidden = true; return; }

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  // "2026-10-27" (all-day) must be read as a local date, not UTC midnight.
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(s);
  }

  function dayLabel(d, now) {
    var a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    var b = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var diff = Math.round((b - a) / 86400000);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    return DAYS[d.getDay()] + " " + d.getDate();
  }

  function render(events) {
    var now = new Date(), shown = [];
    events.forEach(function (e) {
      var start = parse(e.start), end = parse(e.end);
      if (end <= now) return;   // already over
      shown.push({ e: e, start: start });
    });
    shown = shown.slice(0, A.max || 5);
    if (!shown.length) { list.innerHTML = '<li class="empty">Nothing coming up</li>'; return; }
    list.innerHTML = shown.map(function (x) {
      var when = dayLabel(x.start, now) + (x.e.allDay ? "" : " " + pad(x.start.getHours()) + ":" + pad(x.start.getMinutes()));
      var soon = !x.e.allDay && x.start - now < 3600000 && x.start - now > -3600000;
      return '<li class="' + (soon ? "soon" : "") + '"><time>' + when + "</time>" + esc(x.e.title) + "</li>";
    }).join("");
  }

  var last = [];
  function load() {
    var x = new XMLHttpRequest();
    x.open("GET", A.url + "?token=" + encodeURIComponent(A.token || ""));
    x.timeout = 15000;
    x.onload = function () {
      try {
        if (x.status !== 200) throw new Error(x.status);
        last = JSON.parse(x.responseText).events; render(last);
      } catch (e) { if (!last.length) list.innerHTML = '<li class="empty">Calendar unavailable</li>'; }
    };
    x.onerror = x.ontimeout = function () { if (!last.length) list.innerHTML = '<li class="empty">Calendar offline</li>'; };
    x.send();
  }

  list.innerHTML = '<li class="empty">Loading…</li>';
  load();
  setInterval(load, 10 * 60 * 1000);
  setInterval(function () { if (last.length) render(last); }, 60 * 1000);  // drop finished events
})();
