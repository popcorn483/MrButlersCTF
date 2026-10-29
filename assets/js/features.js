/* Mr Butler's CTF — extra features: badges, daily challenge, streaks, solve celebration, certificate.
   Everything here derives from the existing progress state, so it survives download/upload for free. */
(function () {
  'use strict';
  if (!window.CTF || !window.CTF.getState) return;
  var CTF = window.CTF, U = window.CTFUtil || {};
  var esc = U.esc || function (s) { return String(s); };
  var toast = U.toast || function () { };
  var CH = CTF.CH, CATS = CTF.CATS, TIERS = CTF.TIERS, BY_ID = CTF.BY_ID;
  var SEEN_KEY = 'mbctf-badges-seen-v1', SOUND_KEY = 'mbctf-celebrate-sound';
  var $ = function (s, r) { return (r || document).querySelector(s); };

  // ---------- derived stats from progress ----------
  function stats() {
    var S = CTF.getState(), solved = S.solved || {}, hints = S.hints || {}, tries = S.tries || {};
    var ids = Object.keys(solved).filter(function (id) { return BY_ID[id]; });
    var n = ids.length;
    // per category
    var catSolved = {}, catTotal = {};
    CATS.forEach(function (c) { catSolved[c.id] = 0; catTotal[c.id] = 0; });
    CH.forEach(function (c) { catTotal[c.cat]++; });
    ids.forEach(function (id) { catSolved[BY_ID[id].cat]++; });
    // no-hint, first-try (exclude revealed answers)
    var noHint = 0, firstTry = 0;
    ids.forEach(function (id) {
      var s = solved[id]; if (s.r) return;
      if (!hints[id]) noHint++;
      if (!tries[id]) firstTry++;
    });
    // solves per calendar day + streaks
    var dayset = {};
    ids.forEach(function (id) { var d = new Date(solved[id].t); dayset[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] = (dayset[d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate()] || 0) + 1; });
    var maxInDay = 0; Object.keys(dayset).forEach(function (k) { if (dayset[k] > maxInDay) maxInDay = dayset[k]; });
    // build sorted list of unique day-indices
    var dayIdx = {};
    ids.forEach(function (id) { var d = new Date(solved[id].t); dayIdx[Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000)] = true; });
    var days = Object.keys(dayIdx).map(Number).sort(function (a, b) { return a - b; });
    var longest = 0, run = 0, prev = null;
    days.forEach(function (d) { run = (prev !== null && d === prev + 1) ? run + 1 : 1; if (run > longest) longest = run; prev = d; });
    // current streak: count back from today (grace: counts if last solve was today or yesterday)
    var now = new Date(); var todayIdx = Math.floor(new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime() / 86400000);
    var cur = 0;
    if (days.length) {
      var last = days[days.length - 1];
      if (last === todayIdx || last === todayIdx - 1) {
        cur = 1; var p = last;
        for (var i = days.length - 2; i >= 0; i--) { if (days[i] === p - 1) { cur++; p = days[i]; } else break; }
      }
    }
    return { n: n, total: CH.length, catSolved: catSolved, catTotal: catTotal, noHint: noHint, firstTry: firstTry, maxInDay: maxInDay, longestStreak: longest, curStreak: cur };
  }

  // ---------- badge catalogue ----------
  var BADGES = [
    { id: 'first', icon: '🚩', name: 'First Flag', desc: 'Solve your very first challenge', goal: 1, val: function (s) { return s.n; } },
    { id: 'ten', icon: '🔟', name: 'Perfect Ten', desc: 'Solve 10 challenges', goal: 10, val: function (s) { return s.n; } },
    { id: 'fifty', icon: '🎖️', name: 'Half Century', desc: 'Solve 50 challenges', goal: 50, val: function (s) { return s.n; } },
    { id: 'hundred', icon: '💯', name: 'Centurion', desc: 'Solve 100 challenges', goal: 100, val: function (s) { return s.n; } },
    { id: 'all', icon: '🏁', name: 'Completionist', desc: 'Solve every challenge on the board', goal: null, val: function (s) { return s.n; }, done: function (s) { return s.n >= s.total; }, label: function (s) { return s.n + '/' + s.total; } },
    { id: 'allround', icon: '🌈', name: 'All-Rounder', desc: 'Solve at least one in every category', goal: null, done: function (s) { return CATS.every(function (c) { return s.catSolved[c.id] > 0; }); }, label: function (s) { return CATS.filter(function (c) { return s.catSolved[c.id] > 0; }).length + '/' + CATS.length + ' cats'; } },
    { id: 'nohint', icon: '🧠', name: 'Pure Skill', desc: 'Solve 10 challenges with no hints and no peeking', goal: 10, val: function (s) { return s.noHint; } },
    { id: 'firsttry', icon: '🎯', name: 'Sharpshooter', desc: 'Nail 5 challenges on the very first try', goal: 5, val: function (s) { return s.firstTry; } },
    { id: 'onfire', icon: '🔥', name: 'On Fire', desc: 'Solve 5 challenges in a single day', goal: 5, val: function (s) { return s.maxInDay; } },
    { id: 'streak3', icon: '🌅', name: 'Three-Day Streak', desc: 'Solve something 3 days running', goal: 3, val: function (s) { return s.longestStreak; } },
    { id: 'streak7', icon: '⚡', name: 'Week Warrior', desc: 'Solve something 7 days running', goal: 7, val: function (s) { return s.longestStreak; } }
  ];
  // one "category master" badge per category
  CATS.forEach(function (cat) {
    BADGES.push({
      id: 'cat-' + cat.id, icon: cat.icon, name: cat.name + ' Master', desc: 'Clear every ' + cat.name + ' challenge',
      done: function (s) { return s.catTotal[cat.id] > 0 && s.catSolved[cat.id] >= s.catTotal[cat.id]; },
      label: function (s) { return s.catSolved[cat.id] + '/' + s.catTotal[cat.id]; }
    });
  });
  function earned(b, s) { return b.done ? b.done(s) : (b.val(s) >= b.goal); }
  function progressLabel(b, s) {
    if (b.label) return b.label(s);
    if (b.goal) return Math.min(b.val(s), b.goal) + '/' + b.goal;
    return '';
  }

  // ---------- badge shelf (My progress) ----------
  function renderBadges() {
    var box = $('#badgeShelf'); if (!box) return;
    var s = stats();
    var got = BADGES.filter(function (b) { return earned(b, s); }).length;
    box.innerHTML = '<div class="badge-head"><h2>Your badges <span class="badge-count">' + got + '/' + BADGES.length + '</span></h2>' +
      '<button class="btn small sound-toggle" id="soundToggle">' + (soundOn() ? '🔊 Celebration sound: on' : '🔇 Celebration sound: off') + '</button></div>' +
      '<div class="badge-grid">' + BADGES.map(function (b) {
        var on = earned(b, s);
        return '<div class="badge-tile' + (on ? ' got' : '') + '" title="' + esc(b.desc) + '">' +
          '<span class="badge-ic">' + b.icon + '</span>' +
          '<span class="badge-nm">' + esc(b.name) + '</span>' +
          '<span class="badge-dsc">' + esc(b.desc) + '</span>' +
          '<span class="badge-prog">' + (on ? '✓ earned' : esc(progressLabel(b, s))) + '</span>' +
          '</div>';
      }).join('') + '</div>';
    var st = $('#soundToggle');
    if (st) st.addEventListener('click', function () {
      try { localStorage.setItem(SOUND_KEY, soundOn() ? '0' : '1'); } catch (e) { }
      renderBadges();
      if (soundOn()) chime();
    });
  }

  // ---------- newly-earned detection (toast + celebrate) ----------
  function seenSet() { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); } catch (e) { return []; } }
  function saveSeen(arr) { try { localStorage.setItem(SEEN_KEY, JSON.stringify(arr)); } catch (e) { } }
  function syncSeen(announce) {
    var s = stats(), now = BADGES.filter(function (b) { return earned(b, s); }).map(function (b) { return b.id; });
    var seen = seenSet(), fresh = now.filter(function (id) { return seen.indexOf(id) < 0; });
    saveSeen(now);
    if (announce && fresh.length) {
      fresh.forEach(function (id, i) {
        var b = BADGES.filter(function (x) { return x.id === id; })[0];
        setTimeout(function () { toast('🏅 Badge unlocked — ' + b.icon + ' ' + b.name + '!', 3000); }, 900 + i * 1600);
      });
    }
    return fresh;
  }

  // ---------- daily challenge + streak ----------
  function todayKey() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 16777619) >>> 0; } return h; }
  function dailyChallenge() { return CH[hashStr('mbctf|' + todayKey()) % CH.length]; }
  function renderDaily() {
    var box = $('#dailyCard'); if (!box) return;
    var S = CTF.getState(), c = dailyChallenge(), cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
    var done = !!(S.solved && S.solved[c.id]);
    var s = stats();
    var streakTxt = s.curStreak > 0
      ? '🔥 ' + s.curStreak + '-day streak' + (s.curStreak >= 3 ? ' — on fire!' : '!')
      : 'Solve one today to start a streak';
    box.innerHTML =
      '<div class="daily-card' + (done ? ' done' : '') + '">' +
        '<div class="daily-main">' +
          '<div class="daily-flag">★ Challenge of the Day</div>' +
          '<div class="daily-title">' + esc(c.title) + '</div>' +
          '<div class="daily-meta">' + cat.icon + ' ' + esc(cat.name) + ' · ' + TIERS[c.tier].name + ' · ' + c.pts + ' pts</div>' +
        '</div>' +
        '<div class="daily-side">' +
          '<span class="streak-pill">' + streakTxt + '</span>' +
          (done
            ? '<span class="daily-done">✓ Solved today</span>'
            : '<button class="btn primary" id="dailyBtn">Take it on →</button>') +
        '</div>' +
      '</div>';
    var btn = $('#dailyBtn');
    if (btn) btn.addEventListener('click', function () { CTF.show('board'); CTF.openChal(c.id); });
  }

  // ---------- certificate ----------
  function renderCertCard() {
    var box = $('#certCard'); if (!box) return;
    var s = stats();
    if (!s.n) {
      box.innerHTML = '<div class="cert-cta locked"><div><b>🎓 Certificate of Achievement</b><p class="muted small">Solve your first flag to unlock a printable certificate you can keep or hand to your teacher.</p></div></div>';
      return;
    }
    box.innerHTML = '<div class="cert-cta"><div><b>🎓 Certificate of Achievement</b>' +
      '<p class="muted small">You\'ve earned a certificate — print it or save it as a PDF.</p></div>' +
      '<button class="btn primary" id="openCert">Create my certificate</button></div>';
    $('#openCert').addEventListener('click', openCertificate);
  }
  function buildSheet(name) {
    var s = stats(), S = CTF.getState();
    var got = BADGES.filter(function (b) { return earned(b, s); });
    var d = new Date();
    var dateStr = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    var scoreEl = document.getElementById('playerScore');
    var pts = scoreEl ? scoreEl.textContent : '';
    return '<div class="cert-inner">' +
      '<div class="cert-top">Mr Butler\'s CTF</div>' +
      '<div class="cert-sub">Certificate of Achievement</div>' +
      '<div class="cert-awarded">This certifies that</div>' +
      '<div class="cert-person">' + esc(name || 'A brilliant codebreaker') + '</div>' +
      '<div class="cert-line">has reached the rank of <b>' + esc(CTF.rankName()) + '</b>, solving <b>' + s.n + '</b> of ' + s.total + ' challenges and earning <b>' + pts + '</b> points.</div>' +
      (got.length ? '<div class="cert-badges">' + got.map(function (b) { return '<span title="' + esc(b.name) + '">' + b.icon + '</span>'; }).join('') + '</div>' : '') +
      '<div class="cert-foot"><span>' + dateStr + '</span><span class="cert-sig">Mr Butler · Digital Technology</span></div>' +
    '</div>';
  }
  function openCertificate() {
    var S = CTF.getState();
    var input = $('#certName'); if (input) input.value = S.name || '';
    var render = function () { $('#certSheet').innerHTML = buildSheet(input ? input.value : S.name); };
    render();
    if (input && !input._wired) { input._wired = true; input.addEventListener('input', render); }
    if (window.CTFModal) window.CTFModal.open('#certModal');
  }
  (function () {
    var pb = $('#certPrint');
    if (pb) pb.addEventListener('click', function () { document.body.classList.add('printing-cert'); window.print(); setTimeout(function () { document.body.classList.remove('printing-cert'); }, 500); });
  })();

  // ---------- celebration: confetti + optional chime ----------
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function confetti() {
    if (reduce) return;
    var cv = $('#confetti'); if (!cv) return;
    var ctx = cv.getContext('2d'), W = cv.width = innerWidth, H = cv.height = innerHeight;
    var cols = ['#39ff9e', '#4cc9ff', '#ffbf47', '#ff6b9d', '#b388ff'];
    var parts = [];
    for (var i = 0; i < 130; i++) parts.push({ x: W / 2 + (Math.random() - 0.5) * 120, y: H * 0.32, vx: (Math.random() - 0.5) * 11, vy: Math.random() * -13 - 4, g: 0.32 + Math.random() * 0.2, s: 5 + Math.random() * 6, c: cols[i % cols.length], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4, a: 1 });
    cv.style.opacity = '1';
    var t0 = performance.now();
    (function frame(t) {
      ctx.clearRect(0, 0, W, H);
      var alive = false;
      parts.forEach(function (p) {
        p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; if (t - t0 > 1400) p.a -= 0.04;
        if (p.a > 0 && p.y < H + 20) { alive = true; ctx.save(); ctx.globalAlpha = Math.max(0, p.a); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); ctx.restore(); }
      });
      if (alive) requestAnimationFrame(frame); else { ctx.clearRect(0, 0, W, H); cv.style.opacity = '0'; }
    })(t0);
  }
  function soundOn() { try { return localStorage.getItem(SOUND_KEY) !== '0'; } catch (e) { return true; } }
  function chime() {
    if (!soundOn() || reduce) return;
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ac = chime._ac || (chime._ac = new AC());
      if (ac.state === 'suspended') ac.resume();
      var notes = [523.25, 659.25, 783.99, 1046.5], t = ac.currentTime;
      notes.forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        var st = t + i * 0.085;
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.14, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.28);
        o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st + 0.3);
      });
    } catch (e) { }
  }
  function celebrate() { confetti(); chime(); }
  window.CTFCelebrate = celebrate;

  // ---------- events ----------
  document.addEventListener('ctf:solve', function () {
    celebrate();
    renderDaily(); renderBadges(); renderCertCard();
    syncSeen(true);
  });
  document.addEventListener('ctf:progress', function () { renderBadges(); renderCertCard(); });
  document.addEventListener('ctf:refresh', function () { renderDaily(); renderBadges(); renderCertCard(); syncSeen(false); });

  // ---------- boot ----------
  renderDaily(); renderBadges(); renderCertCard();
  syncSeen(false); // seed seen-set silently so we don't re-toast existing badges
})();
