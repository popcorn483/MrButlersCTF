/* Projector mock-event screen: a big-screen countdown + live-style team standings for a whole-class
   dress rehearsal. The clock is the shared class clock; teams race it in the Test area on their own
   devices and send in their result files, which the teacher loads here to build the scoreboard. */
(function () {
  'use strict';
  var U = window.CTFUtil || {}, $ = function (s) { return document.querySelector(s); };
  var esc = U.esc || function (s) { return String(s); };
  var KEY = 'mbctf-event-v1', TEST_SALT = 'mbctf-test-v1';
  var scr = $('#eventScreen'); if (!scr) return;

  // ---------- clock state (persisted so an accidental refresh doesn't lose the running clock) ----------
  var EV = { title: '', durMin: 45, running: false, endAt: 0, pausedLeft: 0 };
  try { var raw = localStorage.getItem(KEY); if (raw) EV = Object.assign(EV, JSON.parse(raw)); } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(EV)); } catch (e) { } }
  var timer = null, rows = [], tickerT = null, tickerI = 0;

  function remaining() {
    if (EV.running) return Math.max(0, EV.endAt - Date.now());
    return EV.pausedLeft || EV.durMin * 60000;
  }
  function fmt(ms) { var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }

  function paintClock() {
    var left = remaining(), el = $('#evClock');
    el.textContent = left <= 0 && (EV.running || EV.pausedLeft === 0 && EV.endAt) ? 'TIME!' : fmt(left);
    el.classList.toggle('low', left <= 5 * 60000 && left > 60000);
    el.classList.toggle('critical', left <= 60000 && left > 0);
    el.classList.toggle('done', left <= 0 && EV.running === false && EV.endAt !== 0 && EV.pausedLeft === 0);
  }
  function tick() {
    paintClock();
    if (EV.running && remaining() <= 0) { EV.running = false; EV.pausedLeft = 0; save(); stopTimer(); timeUp(); setButtons(); }
  }
  function startTimer() { stopTimer(); tick(); timer = setInterval(tick, 500); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  function setStatus(t, cls) { var s = $('#evStatus'); s.textContent = t; s.className = 'ev-status' + (cls ? ' ' + cls : ''); }
  function setButtons() {
    var started = EV.running || (EV.pausedLeft > 0 && EV.pausedLeft < EV.durMin * 60000) || (EV.endAt !== 0);
    $('#evStart').hidden = EV.running;
    $('#evPause').hidden = !EV.running;
    $('#evAdd').hidden = !EV.running;
    $('#evReset').hidden = !started;
    $('#evDur').disabled = EV.running;
    $('#evPause').textContent = '⏸ Pause';
    if (EV.running) setStatus('● Event in progress — go go go!', 'live');
    else if (EV.endAt !== 0 && remaining() <= 0) setStatus("⏹ Time! Pencils down.", 'done');
    else if (EV.pausedLeft > 0) setStatus('⏸ Paused', 'paused');
    else setStatus('Ready when you are');
  }

  // ---------- controls ----------
  $('#evDur').addEventListener('change', function () { if (EV.running) return; EV.durMin = parseInt(this.value, 10) || 45; EV.pausedLeft = 0; EV.endAt = 0; save(); paintClock(); setButtons(); });
  $('#evStart').addEventListener('click', function () {
    var left = (EV.pausedLeft && EV.pausedLeft > 0) ? EV.pausedLeft : EV.durMin * 60000;
    EV.endAt = Date.now() + left; EV.running = true; EV.pausedLeft = 0; save();
    startTimer(); setButtons(); beep(2);
  });
  $('#evPause').addEventListener('click', function () {
    if (EV.running) { EV.pausedLeft = remaining(); EV.running = false; save(); stopTimer(); paintClock(); setButtons(); }
  });
  $('#evAdd').addEventListener('click', function () { if (EV.running) { EV.endAt += 5 * 60000; save(); paintClock(); } });
  $('#evReset').addEventListener('click', function () {
    if (!confirm('Reset the clock back to ' + EV.durMin + ' minutes?')) return;
    EV.running = false; EV.endAt = 0; EV.pausedLeft = 0; save(); stopTimer(); paintClock(); setButtons();
  });
  $('#evTitle').addEventListener('input', function () { EV.title = this.value; save(); });

  // ---------- open / close / fullscreen ----------
  function open() {
    if (EV.title) $('#evTitle').value = EV.title;
    $('#evDur').value = String(EV.durMin);
    scr.hidden = false; document.body.classList.add('event-open');
    paintClock(); setButtons(); renderBoard(); startTicker(); startRefresh();
    if (EV.running) startTimer();
  }
  function close() {
    scr.hidden = true; document.body.classList.remove('event-open');
    stopTimer(); stopTicker(); stopRefresh();
    if (document.fullscreenElement) { try { document.exitFullscreen(); } catch (e) { } }
  }
  var ob = document.getElementById('openEvent'); if (ob) ob.addEventListener('click', open);
  $('#evExit').addEventListener('click', close);
  $('#evFull').addEventListener('click', function () {
    try {
      if (!document.fullscreenElement) scr.requestFullscreen();
      else document.exitFullscreen();
    } catch (e) { }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !scr.hidden && !document.fullscreenElement) close(); });

  // ---------- ticker ----------
  var TICKER = [
    'Read every challenge twice before you touch a tool.',
    'Grab the easy flags first — build your score and your confidence.',
    'Stuck for 15 minutes? Move on and come back with fresh eyes.',
    'Right word, wrong shape? Check the flag{ } wrapper, capitals and underscores.',
    'Split the categories across your team, then share what you learn.',
    'An = on the end means Base64. Only 0s and 1s means binary.',
    'Web challenge? Click View HTML first and read the comments.',
    'A file that won’t open? Check its real type in the Hex viewer.',
    'The scoreboard moves right to the end — never give up.',
    'No hints today — but everything you practised has prepared you for this.'
  ];
  function startTicker() { stopTicker(); $('#evTicker').textContent = TICKER[tickerI % TICKER.length]; tickerT = setInterval(function () { tickerI++; var el = $('#evTicker'); el.style.opacity = '0'; setTimeout(function () { el.textContent = TICKER[tickerI % TICKER.length]; el.style.opacity = '1'; }, 300); }, 6000); }
  function stopTicker() { if (tickerT) { clearInterval(tickerT); tickerT = null; } }

  // ---------- standings (load Test result files) ----------
  function parseResult(text) {
    var o = JSON.parse(text);
    if (!o || !o.data || o.data.app !== 'MrButlersCTF-Test') throw new Error('not a test result');
    var ok = sha256(JSON.stringify(o.data) + TEST_SALT) === o.check;
    return { data: o.data, ok: ok };
  }
  $('#evFiles').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files), input = this;
    Promise.all(files.map(function (f) { return f.text().then(function (t) { try { return parseResult(t); } catch (e) { return { err: f.name }; } }); }))
      .then(function (res) {
        var bad = 0;
        res.forEach(function (r) {
          if (r.err) { bad++; return; }
          rows = rows.filter(function (x) { return x.data.pid !== r.data.pid || x.data.exported > r.data.exported; });
          if (!rows.some(function (x) { return x.data.pid === r.data.pid; })) rows.push(r);
        });
        renderBoard(); input.value = '';
        U.toast && U.toast('Loaded ' + (res.length - bad) + ' result(s)' + (bad ? ', ' + bad + ' skipped' : ''));
      });
  });
  $('#evClear').addEventListener('click', function () { rows = rows.filter(function (r) { return r.data.live; }); renderBoard(); });

  // ---------- which leaderboard, and a refresh every minute while the screen is open ----------
  var chal = [], lastScore = {}, refreshT = null, lastAt = 0;
  if (!EV.src) EV.src = 'challenges';
  var srcSel = $('#evSource'); srcSel.value = EV.src;
  srcSel.addEventListener('change', function () { EV.src = this.value; save(); lastScore = {}; renderBoard(); });
  window.CTFEventChallenges = function (list) { chal = list; lastAt = Date.now(); renderBoard(); };
  function refresh() {
    var ok = window.CTFLiveNow && window.CTFLiveNow();
    if (!ok) { $('#evUpdated').innerHTML = '<span class="bad-text">Sign in as the teacher on this PC (Teacher tab) to fill this in automatically.</span>'; }
  }
  function startRefresh() { stopRefresh(); refresh(); refreshT = setInterval(refresh, 60000); paintUpdated(); }
  function stopRefresh() { if (refreshT) { clearInterval(refreshT); refreshT = null; } }
  function paintUpdated() {
    var el = $('#evUpdated'); if (!el || !lastAt) return;
    el.innerHTML = '<span class="live-dot"></span>Updated ' + new Date(lastAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' · refreshes every minute';
  }
  // live results from the Teacher tab's live view (Google Sheet) — merged with any loaded files
  window.CTFEventLive = function (list) {
    lastAt = Date.now();
    rows = rows.filter(function (r) { return !r.data.live; });
    list.forEach(function (d) {
      var cur = rows.filter(function (r) { return r.data.pid === d.pid; })[0];
      if (cur && cur.data.exported >= d.exported) return;
      rows = rows.filter(function (r) { return r.data.pid !== d.pid; }); rows.push({ data: d, ok: true });
    });
    renderBoard();
  };
  function renderBoard() {
    var box = $('#evBoard'); paintUpdated();
    var src = EV.src || 'challenges', list;
    if (src === 'challenges') {
      list = chal.map(function (d) { return { pid: d.pid, name: d.name, sub: d.cls, score: d.pts, flags: d.n + ' flag' + (d.n === 1 ? '' : 's'), tie: -(d.last || 0) }; });
    } else {
      list = rows.map(function (r) { return r.data; }).filter(function (d) { return (d.paper || 'p0') === src || (!d.paper && !d.live); })
        .map(function (d) { return { pid: d.pid, name: d.name || '(no name)', score: d.score, flags: d.solvedCount + '/' + d.paperSize, tie: d.timeUsedMs || 0, running: d.status === 'running' }; });
    }
    if (!list.length) {
      box.innerHTML = '<p class="ev-empty">' + (src === 'challenges' ? 'Nobody has scored on the challenge board yet.' : 'Nobody has started ' + esc(srcSel.options[srcSel.selectedIndex].text.replace(/^\S+\s/, '')) + ' yet. Teams appear here as soon as they begin.') + '</p>';
      return;
    }
    list.sort(function (a, b) { return (b.score - a.score) || (a.tie - b.tie); });
    var rank = 0, prev = null;
    box.innerHTML = list.map(function (d, i) {
      if (prev === null || d.score !== prev) rank = i + 1; prev = d.score;   // equal points share a place
      var medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
      var up = lastScore[d.pid] !== undefined && d.score > lastScore[d.pid];
      return '<div class="ev-row' + (rank <= 3 ? ' top' : '') + (up ? ' ev-up' : '') + '">' +
        '<span class="ev-rank">' + medal + '</span>' +
        '<span class="ev-name"><span class="ev-nm">' + esc(d.name) + '</span>' + (d.sub || d.running ? '<small class="ev-sub">' + (d.sub ? esc(d.sub) : '') + (d.running ? '<span class="ev-running">● live</span>' : '') + '</small>' : '') + '</span>' +
        '<span class="ev-pts">' + d.score + '<small> pts</small></span>' +
        '<span class="ev-flags">' + d.flags + '</span>' +
        '</div>';
    }).join('');
    lastScore = {}; list.forEach(function (d) { lastScore[d.pid] = d.score; });
  }

  // ---------- sounds ----------
  function beep(times) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      var ac = beep._ac || (beep._ac = new AC()); if (ac.state === 'suspended') ac.resume();
      for (var i = 0; i < (times || 1); i++) {
        var o = ac.createOscillator(), g = ac.createGain(), st = ac.currentTime + i * 0.18;
        o.type = 'square'; o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, st); g.gain.exponentialRampToValueAtTime(0.12, st + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, st + 0.15);
        o.connect(g); g.connect(ac.destination); o.start(st); o.stop(st + 0.16);
      }
    } catch (e) { }
  }
  function timeUp() { setStatus("⏹ Time! Pencils down.", 'done'); paintClock(); beep(4); if (window.CTFCelebrate) try { window.CTFCelebrate(); } catch (e) { } }

  window.CTFEvent = { open: open, close: close };
})();
