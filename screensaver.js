// Five screensavers: scenic (the depth wallpapers drifting), bigclock, aurora, stars, analog.
// Starts after the idle time chosen in Settings; any remote key wakes it (and is swallowed).
// The clock-based ones move every minute so no part of the panel stays lit in one spot (burn-in).
(function () {
  var L = window.__launcher, saver = document.getElementById("saver");
  var active = false, last = Date.now(), ints = [], frame = null;

  // canvas drawn at the screen's real resolution (the page is laid out at 1920x1080 and scaled up on 4K)
  function crisp(cv) { var k = Math.max(1, window.innerWidth / 1920); cv.width = 1920 * k; cv.height = 1080 * k; var c = cv.getContext("2d"); c.scale(k, k); return c; }
  function every(fn, ms) { fn(); ints.push(setInterval(fn, ms)); }
  function rnd(a, b) { return Math.round(a + Math.random() * (b - a)); }
  function clear() { ints.forEach(clearInterval); ints = []; if (frame) clearInterval(frame); frame = null; saver.innerHTML = ""; }

  function start(forced) {
    if (active) return;
    var m = L.S.saver === "off" ? "scenic" : L.S.saver;   // previewing while "Off" still shows something
    active = true; saver.hidden = false;
    clear(); MODES[m]();
  }
  function stop() { active = false; saver.hidden = true; clear(); last = Date.now(); }

  var MODES = {
    scenic: function () {
      var list = L.wallpapers.filter(function (w) { return w.front; });
      if (!list.length) list = L.wallpapers;
      saver.innerHTML = '<div class="sv-layer"></div><div class="sv-clock"><div class="t"></div></div><div class="sv-layer"></div><div class="sv-fade"></div>';
      var layers = saver.querySelectorAll(".sv-layer"), t = saver.querySelector(".t"), fade = saver.querySelector(".sv-fade"), k = 0;

      function show(w) {
        var c = w.clock || ["#fff", "#b8b8ff"];
        saver.style.setProperty("--ca", c[0]); saver.style.setProperty("--cb", c[1]);
        layers[0].style.backgroundImage = w.css || "url('" + w.src + "')";
        layers[1].style.backgroundImage = w.front ? "url('" + w.front + "')" : "none";
        [layers[0], layers[1]].forEach(function (l) { l.style.animation = "none"; void l.offsetWidth; l.style.animation = ""; });
      }
      show(list[0]);
      every(function () { t.textContent = L.clockText(); }, 15000);
      if (list.length > 1) ints.push(setInterval(function () {
        fade.classList.add("on");
        setTimeout(function () { k = (k + 1) % list.length; show(list[k]); fade.classList.remove("on"); }, 1500);
      }, 45000));
    },

    bigclock: function () {
      saver.innerHTML = '<div class="sv-big"></div>';
      var b = saver.firstChild;
      every(function () { b.textContent = L.clockText(); }, 15000);
      every(function () { b.style.left = rnd(40, 1100) + "px"; b.style.top = rnd(20, 640) + "px"; }, 60000);
    },

    aurora: function () {
      saver.innerHTML = '<div class="blob a"></div><div class="blob b"></div><div class="blob c"></div><div class="sv-small"></div>';
      var s = saver.querySelector(".sv-small");
      every(function () { s.textContent = L.clockText(); }, 15000);
      every(function () { s.style.left = rnd(80, 1500) + "px"; s.style.top = rnd(80, 850) + "px"; }, 60000);
    },

    stars: function () {
      saver.innerHTML = '<canvas width="1920" height="1080"></canvas><div class="sv-small"></div>';
      var cv = saver.firstChild, ctx = crisp(cv), s = saver.querySelector(".sv-small"), stars = [], i;
      for (i = 0; i < 220; i++) stars.push({ x: Math.random() * 1920, y: Math.random() * 1080, r: .6 + Math.random() * 1.8, p: Math.random() * 6.28, v: .6 + Math.random() * 1.6 });
      var t0 = Date.now();
      frame = setInterval(function () {
        var t = (Date.now() - t0) / 1000;
        ctx.clearRect(0, 0, 1920, 1080);
        stars.forEach(function (st) {
          ctx.fillStyle = "rgba(255,255,255," + (0.35 + 0.65 * Math.abs(Math.sin(st.p + t * st.v))) + ")";
          ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.283); ctx.fill();
        });
      }, 1000 / 15);
      every(function () { s.textContent = L.clockText(); }, 15000);
      every(function () { s.style.left = rnd(80, 1500) + "px"; s.style.top = rnd(80, 850) + "px"; }, 60000);
    },

    analog: function () {
      saver.innerHTML = '<canvas width="1920" height="1080"></canvas>';
      var cv = saver.firstChild, ctx = crisp(cv), cx = 960, cy = 540, R = 300;
      every(function () { cx = rnd(420, 1500); cy = rnd(360, 720); }, 60000);
      function hand(a, len, w, col) {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = "round";
        ctx.beginPath(); ctx.moveTo(cx - Math.sin(a + Math.PI) * 0, cy);
        ctx.lineTo(cx + Math.sin(a) * len, cy - Math.cos(a) * len); ctx.stroke();
      }
      frame = setInterval(function () {
        var d = new Date(), s = d.getSeconds() + d.getMilliseconds() / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
        ctx.clearRect(0, 0, 1920, 1080);
        ctx.strokeStyle = "rgba(255,255,255,.25)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.283); ctx.stroke();
        for (var i = 0; i < 12; i++) {
          var a = i * Math.PI / 6;
          ctx.strokeStyle = "rgba(255,255,255,.7)"; ctx.lineWidth = i % 3 === 0 ? 7 : 3;
          ctx.beginPath(); ctx.moveTo(cx + Math.sin(a) * (R - 28), cy - Math.cos(a) * (R - 28)); ctx.lineTo(cx + Math.sin(a) * (R - 6), cy - Math.cos(a) * (R - 6)); ctx.stroke();
        }
        hand(h * Math.PI / 6, R * .5, 12, "#fff");
        hand(m * Math.PI / 30, R * .78, 8, "#fff");
        hand(s * Math.PI / 30, R * .86, 3, "#ff9f0a");
        ctx.fillStyle = "#ff9f0a"; ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 6.283); ctx.fill();
      }, 1000 / 20);
    }
  };

  // any key wakes the screensaver and is swallowed, so waking never triggers an action
  document.addEventListener("keydown", function (e) {
    last = Date.now();
    if (active) { e.stopPropagation(); e.preventDefault(); stop(); }
  }, true);

  setInterval(function () {
    if (active || L.S.saver === "off" || L.mode() !== "home") return;
    if (Date.now() - last > L.S.saverMinutes * 60000) start();
  }, 5000);

  L.saver = { preview: function () { last = Date.now(); start(true); } };
})();
