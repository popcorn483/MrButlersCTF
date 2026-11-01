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
    paintClock(); setButtons(); renderBoard(); startTicker();
    if (EV.running) startTimer();
  }
  function close() {
    scr.hidden = true; document.body.classList.remove('event-open');
    stopTimer(); stopTicker();
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
  $('#evClear').addEventListener('click', function () { rows = []; renderBoard(); });
  function renderBoard() {
    var box = $('#evBoard');
    if (!rows.length) { box.innerHTML = '<p class="ev-empty">No results loaded yet. As teams finish, load their result files and the scoreboard fills in.</p>'; return; }
    var list = rows.map(function (r) { return r.data; }).sort(function (a, b) { return (b.score - a.score) || (a.timeUsedMs - b.timeUsedMs); });
    box.innerHTML = list.map(function (d, i) {
      var medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : (i + 1);
      return '<div class="ev-row' + (i < 3 ? ' top' : '') + '">' +
        '<span class="ev-rank">' + medal + '</span>' +
        '<span class="ev-name">' + esc(d.name || '(no name)') + '</span>' +
        '<span class="ev-pts">' + d.score + '<small> pts</small></span>' +
        '<span class="ev-flags">' + d.solvedCount + '/' + d.paperSize + '</span>' +
        '</div>';
    }).join('');
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
