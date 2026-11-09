/* Test area: an exam-style mock that mimics the real event.
   Three papers (Foundations, Challenger, Final Boss). Password-gated to start, a countdown timer, a fixed paper, NO hints and NO walkthroughs,
   and a results screen the teacher can collect. Assistance is switched off everywhere while a test runs. */
(function () {
  'use strict';

  // ===================== TEACHER SETTINGS =====================
  // Change the password pupils must type to start, and how long the test runs.
  var CONFIG = {
    // the start password is NOT kept here (this site is public): it is checked by the teacher's Google script,
    // which got it from the answer book (Teacher tab › 🔐 Install answers). The same password opens every paper.
    papers: [
      { id: 'p1', icon: '🌱', title: 'Paper 1 · Foundations', level: 'Beginner & Intermediate', minutes: 45,
        blurb: 'A first taste of the real event. Mostly one-step challenges across every category, with a few two-step ones to finish.',
        paper: ['warm-q05', 'web-q03', 'cry-q01', 'for-q05', 'steg-q08', 'osint-q02',
              'net-q05', 'safe-q01', 'warm-q26', 'web-q16', 'cry-q16', 'for-q14',
              'steg-q11', 'osint-q12', 'rev-q13', 'net-q14', 'safe-q16', 'prog-q13',
              'log-q16', 'cry-q20', 'web-q19', 'for-q21', 'log-q20', 'net-q21'] },
      { id: 'p2', icon: '⚡', title: 'Paper 2 · Challenger', level: 'Intermediate & Hard', minutes: 60,
        blurb: 'Multi-step puzzles, files to dig through and a little scripting. Pick your battles and keep moving.',
        paper: ['cry-q21', 'web-q17', 'for-q19', 'steg-q23', 'osint-q21', 'rev-q20',
              'safe-q22', 'prog-q22', 'web-q28', 'cry-q29', 'for-q25', 'steg-q28',
              'osint-q30', 'rev-q32', 'net-q28', 'safe-q29', 'prog-q25', 'log-q29',
              'cry-q27', 'for-q32', 'cry-q35', 'web-q38', 'rev-q33', 'net-q38'] },
      { id: 'p3', icon: '🌌', title: 'Paper 3 · Final Boss', level: 'Expert & Unreal', minutes: 90,
        blurb: 'Expert, Competition Grade and Unreal challenges. As hard as it gets: nobody is expected to finish.',
        paper: ['web-q35', 'cry-q36', 'for-q36', 'steg-q38', 'osint-q36', 'rev-q36',
              'net-q36', 'safe-q35', 'prog-q35', 'log-q34', 'elite-q26', 'elite-q18',
              'elite-q19', 'elite-q23', 'elite-q24', 'elite-q20', 'elite-q33', 'elite-q45',
              'unreal-q12', 'unreal-q25', 'unreal-q11', 'unreal-q14'] }
    ]
  };
  // ============================================================

  var U = window.CTFUtil, $ = U.$, esc = U.esc, toast = U.toast, download = U.download;
  var BY_ID = window.CTF.BY_ID, CATS = window.CTF.DATA.cats;
  var TIER = [null, 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Elite', 'Unreal'];
  var TCLS = [null, 't1', 't2', 't3', 't4', 't5', 't6', 't7'];
  var SALT = 'mbctf-test-v1';
  var KEY = 'mbctf-test-v2';

  // each paper keeps its own clock and result; only one can run at a time
  var PAPERS = CONFIG.papers.map(function (p) { var ids = p.paper.filter(function (id) { return BY_ID[id]; }); return Object.assign({}, p, { ids: ids, total: ids.reduce(function (s, id) { return s + BY_ID[id].pts; }, 0) }); });
  function paperById(id) { return PAPERS.filter(function (p) { return p.id === id; })[0]; }
  var P = PAPERS[0], PAPER = P.ids, TOTAL_PTS = P.total;

  function blank() { return { v: 2, paper: P.id, pid: rid(), name: '', started: false, start: 0, end: 0, finished: false, solved: {}, wrong: 0 }; }
  function rid() { var a = new Uint8Array(6); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; })); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  var ALL = { active: null, papers: {} };
  try { var raw = localStorage.getItem(KEY); if (raw) ALL = Object.assign(ALL, JSON.parse(raw)); } catch (e) { }
  function stateFor(p) { var o = ALL.papers[p.id]; return o ? Object.assign(blank(), o, { paper: p.id }) : null; }
  function use(p) { P = p; PAPER = p.ids; TOTAL_PTS = p.total; TS = stateFor(p) || blank(); }
  var TS = null;
  use(paperById(ALL.active) || PAPERS[0]);
  function save() { ALL.papers[P.id] = TS; ALL.active = P.id; try { localStorage.setItem(KEY, JSON.stringify(ALL)); } catch (e) { } if (window.CTFSyncSoon) window.CTFSyncSoon(); }
  function liveOf(p) { var t = stateFor(p); return !!(t && t.started && !t.finished && Date.now() - t.start < p.minutes * 60000); }
  function runningPaper() { return PAPERS.filter(liveOf)[0] || null; }

  var timer = null;
  function durationMs() { return P.minutes * 60 * 1000; }
  function remaining() { return Math.max(0, durationMs() - (Date.now() - TS.start)); }
  function isLive() { return !!runningPaper(); }
  function tScore() { var p = 0; Object.keys(TS.solved).forEach(function (id) { if (BY_ID[id]) p += BY_ID[id].pts; }); return p; }
  function tCount() { return Object.keys(TS.solved).filter(function (id) { return BY_ID[id]; }).length; }

  var area = function () { return $('#testArea'); };

  function enter(pid) {
    if (!PAPERS.some(function (p) { return p.ids.length; })) { stopTimer(); area().innerHTML = '<div class="test-gate"><div class="test-badge">🔒 Test area</div><h1>Practice tests</h1><p>The tests open once Mr Butler has approved you and the challenges have loaded.</p></div>'; return; }
    var run = runningPaper();
    if (run) { use(run); renderBoard(); startTimer(); return; }
    // a paper whose clock ran out while the pupil was away: close it off
    PAPERS.forEach(function (p) { var t = stateFor(p); if (t && t.started && !t.finished) { use(p); TS.finished = true; TS.end = TS.start + p.minutes * 60000; TS.endReason = 'time'; save(); } });
    if (pid && paperById(pid)) { use(paperById(pid)); if (TS.finished) { checkResets(); return renderResults(); } return renderStart(); }
    renderPicker();
  }

  // ---------- choose a paper ----------
  // the teacher can allow a resit from the Teacher tab: ask the script whether any of this device's papers were reset
  var resetAsked = 0;
  function checkResets() {
    if (!window.CTFApi || Date.now() - resetAsked < 15000) return; resetAsked = Date.now();
    var tids = PAPERS.map(function (p) { var t = stateFor(p); return t && t.started ? t.pid : null; }).filter(Boolean);
    if (!tids.length) return;
    window.CTFApi('action=testresets&tids=' + tids.join(',')).then(function (j) {
      if (!j || !j.ok || !j.resets) return;
      var changed = [];
      PAPERS.forEach(function (p) {
        var t = stateFor(p); if (!t || !j.resets[t.pid] || j.resets[t.pid] < t.start) return;
        delete ALL.papers[p.id]; if (ALL.active === p.id) ALL.active = null; changed.push(p);
      });
      if (!changed.length) return;
      try { localStorage.setItem(KEY, JSON.stringify(ALL)); } catch (e) { }
      use(paperById(ALL.active) || PAPERS[0]);
      toast('↺ Your teacher has reset ' + changed.map(function (p) { return p.title; }).join(' and ') + ' — you can sit it again.', 5000);
      var v = document.getElementById('view-test'); if (v && v.classList.contains('active')) renderPicker();
    }, function () { });
  }
  function renderPicker() {
    stopTimer(); checkResets();
    var cards = PAPERS.map(function (p) {
      var t = stateFor(p), done = t && t.finished, tiers = {};
      p.ids.forEach(function (id) { tiers[BY_ID[id].tier] = 1; });
      var score = done ? Object.keys(t.solved || {}).reduce(function (s, id) { return s + (BY_ID[id] ? BY_ID[id].pts : 0); }, 0) : 0;
      return '<button class="paper-card ' + p.id + (done ? ' done' : '') + '" data-paper="' + p.id + '"' + (p.ids.length ? '' : ' disabled') + '>' +
        '<span class="paper-icon">' + p.icon + '</span>' +
        '<span class="paper-level">' + esc(p.level) + '</span>' +
        '<b class="paper-title">' + esc(p.title) + '</b>' +
        '<span class="paper-blurb">' + esc(p.blurb) + '</span>' +
        '<span class="paper-facts"><span>⏱️ ' + p.minutes + ' min</span><span>🏁 ' + p.ids.length + ' challenges</span><span>⭐ ' + p.total + ' pts</span></span>' +
        '<span class="paper-tiers">' + Object.keys(tiers).map(function (k) { return '<span class="tag tier ' + TCLS[k] + '">' + TIER[k] + '</span>'; }).join('') + '</span>' +
        '<span class="paper-go">' + (done ? '✓ Done · ' + score + ' / ' + p.total + ' pts · see result' : 'Choose this paper →') + '</span>' +
        '</button>';
    }).join('');
    area().innerHTML =
      '<div class="test-picker">' +
      '<div class="test-badge">🔒 Test area</div>' +
      '<h1>Practice tests</h1>' +
      '<p class="muted">Three timed mock papers that work like the real event: a countdown, no hints and no walkthroughs. Start with the one that matches where you are — you can sit each paper once (your teacher can clear it to try again).</p>' +
      '<div class="paper-grid">' + cards + '</div>' +
      '<p class="muted small">Not ready? Keep practising on the <a href="#" data-goto="board">Challenge board</a> instead.</p>' +
      '</div>';
    U.$$('[data-paper]', area()).forEach(function (b) { b.addEventListener('click', function () { enter(b.dataset.paper); }); });
  }

  // ---------- start screen ----------
  function renderStart() {
    stopTimer();
    area().innerHTML =
      '<div class="test-gate">' +
      '<div class="test-badge">🔒 Test area</div>' +
      '<h1>' + P.icon + ' ' + esc(P.title) + '</h1>' +
      '<p class="paper-level-line">' + esc(P.level) + '</p>' +
      '<p>This is a <b>timed mock competition</b> that works like the real event. Before you start, know that:</p>' +
      '<ul class="test-rules">' +
      '<li>⏱️ You have <b>' + P.minutes + ' minutes</b> once you begin. The clock does not stop.</li>' +
      '<li>🚫 There are <b>no hints and no walkthroughs</b> — here or anywhere on the site — while the test runs.</li>' +
      '<li>🧰 You <b>can</b> use the Toolkit (Decoder, Hex viewer and so on), just like on the day.</li>' +
      '<li>🏁 There are ' + PAPER.length + ' challenges worth ' + TOTAL_PTS + ' points. Do the easy ones first.</li>' +
      '<li>🔑 You need the <b>password for this paper</b> from your teacher to begin.</li>' +
      '</ul>' +
      '<form id="testStartForm" class="test-start-form">' +
      '<label class="field-label">Your name or team</label><input class="io" id="testName" maxlength="40" placeholder="e.g. Team Alpha" value="' + esc(TS.name || '') + '">' +
      '<label class="field-label">Password</label><input class="io" id="testPass" type="password" placeholder="ask your teacher" autocomplete="off">' +
      '<div id="testStartMsg" class="flag-msg bad"></div>' +
      '<button class="btn primary big" type="submit">Start the test ▶</button>' +
      '</form>' +
      '<p class="muted small"><a href="#" id="testBack">← Choose a different paper</a></p>' +
      '</div>';
    $('#testBack').addEventListener('click', function (e) { e.preventDefault(); renderPicker(); });
    $('#testStartForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = $('#testPass').value.trim(), m = $('#testStartMsg'), btn = this.querySelector('button[type=submit]'), nm = $('#testName').value.trim().slice(0, 40);
      if (!pass) return;
      if (!window.CTFApi) { m.textContent = '✗ The test needs the internet connection to Mr Butler\'s script.'; return; }
      btn.disabled = true; m.className = 'flag-msg'; m.textContent = 'Checking…';
      window.CTFApi('action=testpass&paper=' + P.id + '&pw=' + encodeURIComponent(pass)).then(function (j) {
        btn.disabled = false; m.className = 'flag-msg bad';
        if (!j || !j.ok) { m.textContent = j && j.error === 'setup' ? '✗ The test isn\'t set up yet — ask your teacher.' : '✗ Couldn\'t check the password. Try again.'; if (!(j && j.error === 'setup')) offerOverride(nm); return; }
        if (!j.pass) { m.textContent = '✗ That password is not right for ' + P.title + '. Ask your teacher.'; return; }
        begin(nm);
      }, function () { btn.disabled = false; m.className = 'flag-msg bad'; m.textContent = '✗ Couldn\'t reach Mr Butler\'s script. Check the internet and try again.'; offerOverride(nm); });
    });
  }
  // Backup plan: if the Google script is down, the teacher can start the paper on this PC with the staff password.
  // It's checked here by unlocking the answer book (no internet to the script needed); flags are then queued until the script is back.
  function offerOverride(nm) {
    if (document.getElementById('testOverride') || !(window.CTF && window.CTF.openVault)) return;
    var f = document.createElement('form'); f.id = 'testOverride'; f.className = 'test-override';
    f.innerHTML = '<p class="small"><b>🛟 Script not answering?</b> Your teacher can start this paper anyway. Flags you enter are saved and checked as soon as the script is back — they count from the moment you sent them.</p>' +
      '<label class="field-label">Teacher: staff password</label><input class="io" type="password" id="testOvPw" autocomplete="off">' +
      '<div class="flag-msg bad" id="testOvMsg"></div><button class="btn" type="submit">Start without the script</button>';
    $('#testStartForm').after(f);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var pw = $('#testOvPw').value, mm = $('#testOvMsg'), b = f.querySelector('button'); if (!pw) return;
      b.disabled = true; mm.className = 'flag-msg'; mm.textContent = 'Checking…';
      window.CTF.openVault(pw).then(function (v) {
        if (v && v.info && v.info.contentKey && window.CTF.useKey) window.CTF.useKey(v.info.contentKey);
        TS_offline = true; begin(($('#testName') && $('#testName').value.trim().slice(0, 40)) || nm);
      }, function () { b.disabled = false; mm.className = 'flag-msg bad'; mm.textContent = '✗ That isn\'t the staff password.'; });
    });
  }
  var TS_offline = false;
  function begin(nm) {
    if (runningPaper()) { toast('Finish the paper you have already started first.'); return enter(); }
    TS = blank(); TS.name = nm; TS.started = true; TS.start = Date.now(); if (TS_offline) TS.offline = true; TS_offline = false; save();
    renderBoard(); startTimer();
    toast('Good luck! The clock has started.');
  }

  // ---------- test board ----------
  function renderBoard() {
    stopTimer();
    var byCat = {};
    PAPER.forEach(function (id) { var c = BY_ID[id]; (byCat[c.cat] = byCat[c.cat] || []).push(c); });
    var cats = CATS.filter(function (cat) { return byCat[cat.id]; });
    area().innerHTML =
      '<div class="test-bar">' +
      '<div class="test-bar-left"><span class="test-badge small">🔒 ' + esc(P.title) + '</span>' + (TS.name ? ' <b>' + esc(TS.name) + '</b>' : '') + '</div>' +
      '<div class="test-timer" id="testTimer">--:--</div>' +
      '<div class="test-bar-right"><span class="test-score"><b id="testScore">0</b> pts · <span id="testSolved">0</span>/' + PAPER.length + '</span>' +
      '<button class="btn danger small" id="testFinish">Finish &amp; see results</button></div>' +
      '</div>' +
      '<div class="test-note">No hints or walkthroughs in here — this is the real thing. The Toolkit is still open to you.</div>' +
      '<div class="board" id="testBoardGrid"></div>';
    var grid = $('#testBoardGrid');
    cats.forEach(function (cat) {
      var sec = document.createElement('section'); sec.className = 'cat';
      sec.innerHTML = '<div class="cat-head"><div class="cat-title"><span class="cat-icon">' + cat.icon + '</span>' + esc(cat.name) + '</div></div><div class="tiles"></div>';
      var tiles = $('.tiles', sec);
      byCat[cat.id].forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'tile ' + TCLS[c.tier] + (TS.solved[c.id] ? ' solved' : '');
        b.innerHTML = '<div class="tile-title">' + esc(c.title) + '</div><div class="tile-foot"><span>' + TIER[c.tier] + '</span><span class="tile-pts">' + c.pts + '</span></div>';
        b.addEventListener('click', function () { openTest(c.id); });
        tiles.appendChild(b);
      });
      grid.appendChild(sec);
    });
    updateHud();
    $('#testFinish').addEventListener('click', function () {
      if (confirm('Finish the test now and see your results? You cannot restart the clock.')) finish('manual');
    });
  }

  function updateHud() {
    var s = $('#testScore'), n = $('#testSolved');
    if (s) s.textContent = tScore(); if (n) n.textContent = tCount();
  }

  // ---------- timer ----------
  function fmt(ms) { var t = Math.ceil(ms / 1000), m = Math.floor(t / 60), s = t % 60; return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s; }
  function tick() {
    var el = $('#testTimer'), left = remaining();
    if (el) { el.textContent = fmt(left); el.classList.toggle('low', left <= 5 * 60 * 1000); el.classList.toggle('critical', left <= 60 * 1000); }
    if (left <= 0) finish('time');
  }
  function startTimer() { stopTimer(); tick(); timer = setInterval(tick, 1000); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  // ---------- test challenge modal ----------
  var current = null;
  function openTest(id) {
    if (!isLive()) { enter(); return; }
    var c = BY_ID[id]; if (!c) return; current = c;
    var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
    $('#testModal .modal-card').className = 'modal-card ' + TCLS[c.tier];
    $('#tChalMeta').innerHTML = '<span class="tag">' + cat.icon + ' ' + esc(cat.name) + '</span><span class="tag tier ' + TCLS[c.tier] + '">' + TIER[c.tier] +
      '</span><span class="tag pts ' + TCLS[c.tier] + '">' + c.pts + ' pts</span>' + (TS.solved[c.id] ? '<span class="tag done">✓ solved</span>' : '');
    $('#tChalTitle').textContent = c.title;
    $('#tChalDesc').innerHTML = c.desc; enhance($('#tChalDesc'));
    renderFiles(c); renderActions(c);
    $('#tFlagInput').value = '';
    var m = $('#tFlagMsg'); m.className = 'flag-msg'; m.textContent = TS.solved[c.id] ? 'You have already captured this flag.' : '';
    window.CTFModal.open('#testModal');
    setTimeout(function () { $('#tFlagInput').focus(); }, 50);
  }

  function enhance(root) {
    U.$$('pre.data', root).forEach(function (pre) {
      if (pre.parentNode.classList.contains('data-wrap')) return;
      var wrap = document.createElement('div'); wrap.className = 'data-wrap';
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      var tools = document.createElement('div'); tools.className = 'data-tools';
      tools.innerHTML = '<button class="btn small" data-a="copy">Copy</button><button class="btn small" data-a="dec">Send to Decoder</button>';
      wrap.appendChild(tools);
      tools.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.a === 'copy') window.CTFCopy(pre.textContent);
        if (b.dataset.a === 'dec') { if (current && window.CTFReturn) window.CTFReturn.set('test', current.id, current.title); window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('decoder', pre.textContent); }
      });
    });
  }
  function renderFiles(c) {
    var box = $('#tChalFiles'); box.innerHTML = '';
    if (!c.files || !c.files.length) return;
    var wrap = document.createElement('div'); wrap.className = 'files';
    c.files.forEach(function (f) {
      var row = document.createElement('div'); row.className = 'file-row';
      var btns = (f.kind === 'text' ? '<button class="btn small" data-f="view">View</button>' : '') +
        (f.kind === 'image' ? '<button class="btn small" data-f="img">Image inspector</button>' : '') +
        '<button class="btn small" data-f="hex">Hex viewer</button>';
      row.innerHTML = '<span class="fname">📄 ' + esc(f.name) + '</span>' + btns;
      row.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.f === 'view') (window.CTF.fileText ? window.CTF.fileText(f) : Promise.resolve(f.text)).then(function (t) { window.CTFShowSource(f.name, t); }, function () { toast('Couldn’t open that file — check the internet connection.'); });
        if (b.dataset.f === 'hex') { if (window.CTFReturn) window.CTFReturn.set('test', c.id, c.title); window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('hex', { file: f }); }
        if (b.dataset.f === 'img') { if (window.CTFReturn) window.CTFReturn.set('test', c.id, c.title); window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('image', { file: f }); }
      });
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
  }
  function renderActions(c) {
    var box = $('#tChalActions'); box.innerHTML = '';
    var v = document.createElement('button'); v.className = 'btn'; v.textContent = '</> View HTML of this challenge';
    v.addEventListener('click', function () { window.CTFShowSource('View HTML: ' + c.title, c.desc); });
    box.appendChild(v);
  }

  $('#tFlagForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var c = current; if (!c) return;
    if (!isLive()) { window.CTFModal.close('#testModal'); enter(); return; }
    var raw = $('#tFlagInput').value.trim(), msg = $('#tFlagMsg');
    if (!raw) return;
    // flags are checked by the teacher's Google script — the answers are not on this site
    var btn = this.querySelector('button[type=submit]'); if (btn && btn.disabled) return;
    if (btn) btn.disabled = true; msg.className = 'flag-msg'; msg.textContent = 'Checking…';
    window.CTFApi('action=submit&mode=test&id=' + encodeURIComponent(window.CTF.getState().pid) + '&tid=' + TS.pid + '&cid=' + encodeURIComponent(c.id) + '&flag=' + encodeURIComponent(raw)).then(function (j) {
      if (btn) btn.disabled = false;
      if (!j || !j.ok) {
        if (j && j.error === 'slow') { msg.className = 'flag-msg bad'; msg.textContent = 'Too many guesses — wait a minute and try again.'; return; }
        queueFlag(c, raw); msg.className = 'flag-msg'; msg.textContent = '⏳ Saved. It can\'t be checked just now, so it will be checked automatically as soon as it can — and it counts from now.'; return;
      }
      if (j.correct) {
        if (!TS.solved[c.id]) { TS.solved[c.id] = { t: Date.now(), p: j.p }; save(); updateHud(); markSolved(c.id); toast('✓ Flag captured (+' + c.pts + ')'); }
        msg.className = 'flag-msg ok'; msg.textContent = '✓ Correct.';
        return;
      }
      TS.wrong++; save();
      msg.className = 'flag-msg bad';
      msg.textContent = /^flag\{.*\}$/i.test(raw) ? '✗ Incorrect.' : '✗ Incorrect. Flags look like flag{...}.';
      var f = $('#tFlagForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
    }, function () { if (btn) btn.disabled = false; queueFlag(c, raw); msg.className = 'flag-msg'; msg.textContent = '⏳ Saved. Mr Butler\'s script can\'t be reached, so your answer is kept and checked automatically as soon as it\'s back — it counts from now. Keep going!'; });
  });

  // ---------- backup plan: answers that couldn't be checked are queued and retried ----------
  function queueFlag(c, raw) {
    TS.queue = (TS.queue || []).filter(function (q) { return !(q.cid === c.id && q.f.toLowerCase() === raw.toLowerCase()); });
    TS.queue.push({ cid: c.id, f: raw, t: Date.now() }); save(); markSolved(); startRetry();
  }
  function queued(t) { return (t && t.queue) || []; }
  function anyQueued() { return PAPERS.some(function (p) { var t = p.id === P.id ? TS : stateFor(p); return queued(t).length; }); }
  var retryT = null, flushing = false;
  function startRetry() { if (!retryT) retryT = setInterval(flushQueue, 20000); }
  function flushQueue() {
    if (flushing || !window.CTFApi) return;
    if (!anyQueued()) { clearInterval(retryT); retryT = null; return; }
    flushing = true;
    var jobs = [];
    PAPERS.forEach(function (p) { var t = p.id === P.id ? TS : stateFor(p); queued(t).forEach(function (q) { jobs.push({ p: p, q: q, tid: t.pid }); }); });
    (function next(i) {
      if (i >= jobs.length) { flushing = false; return; }
      var jb = jobs[i];
      window.CTFApi('action=submit&mode=test&id=' + encodeURIComponent(window.CTF.getState().pid) + '&tid=' + jb.tid + '&cid=' + encodeURIComponent(jb.q.cid) + '&flag=' + encodeURIComponent(jb.q.f)).then(function (j) {
        if (!j || !j.ok) { flushing = false; return; }   // still down (or too fast): try again next round
        settle(jb.p, jb.q, j);
        setTimeout(function () { next(i + 1); }, 1200);
      }, function () { flushing = false; });
    })(0);
  }
  function settle(p, q, j) {
    var t = p.id === P.id ? TS : stateFor(p);
    t.queue = queued(t).filter(function (x) { return x !== q && !(x.cid === q.cid && x.f === q.f); });
    var c = BY_ID[q.cid];
    if (j.correct) { if (!t.solved[q.cid]) { t.solved[q.cid] = { t: q.t, p: j.p }; toast('✓ Checked: ' + (c ? c.title : 'flag') + ' was right (+' + (c ? c.pts : 0) + ')', 4000); } }
    else { t.wrong++; toast('✗ Checked: your answer for ' + (c ? c.title : 'a challenge') + ' was not right.', 4000); }
    if (p.id === P.id) { save(); updateHud(); markSolved(); var v = document.querySelector('.test-results'); if (v) renderResults(); }
    else { ALL.papers[p.id] = t; try { localStorage.setItem(KEY, JSON.stringify(ALL)); } catch (e) { } }
  }
  if (anyQueued()) startRetry();
  function markSolved(id) {
    // lightweight refresh of solved styling on the board tiles
    var grid = $('#testBoardGrid'); if (!grid) return;
    var tiles = U.$$('.tile', grid), i = 0;
    var byCat = {}; PAPER.forEach(function (id) { var c = BY_ID[id]; (byCat[c.cat] = byCat[c.cat] || []).push(c); });
    CATS.filter(function (cat) { return byCat[cat.id]; }).forEach(function (cat) {
      byCat[cat.id].forEach(function (c) { var t = tiles[i++]; if (t) { t.classList.toggle('solved', !!TS.solved[c.id]); t.classList.toggle('queued', !TS.solved[c.id] && queued(TS).some(function (q) { return q.cid === c.id; })); } });
    });
  }

  // ---------- finish + results ----------
  function finish(reason) {
    if (!TS.finished) { TS.finished = true; TS.end = Date.now(); TS.endReason = reason; save(); }
    stopTimer();
    try { window.CTFModal.close('#testModal'); } catch (e) { }
    if (document.getElementById('view-test').classList.contains('active')) renderResults();
    else if (window.CTFShow) window.CTFShow('test'); // enter() will render the results
  }

  function resultPayload() {
    var perCat = {};
    CATS.forEach(function (cat) {
      var ids = PAPER.filter(function (id) { return BY_ID[id].cat === cat.id; });
      if (!ids.length) return;
      perCat[cat.id] = { name: cat.name, solved: ids.filter(function (id) { return TS.solved[id]; }).length, total: ids.length };
    });
    var timeUsed = Math.min(durationMs(), (TS.end || Date.now()) - TS.start);
    var d = { app: 'MrButlersCTF-Test', v: 2, pid: TS.pid, name: TS.name, exported: Date.now(), paper: P.id, paperTitle: P.title,
      score: tScore(), totalPts: TOTAL_PTS, solvedCount: tCount(), paperSize: PAPER.length,
      wrong: TS.wrong, timeUsedMs: timeUsed, endReason: TS.endReason || 'manual',
      solvedIds: Object.keys(TS.solved), perCat: perCat };
    return d;
  }

  function renderResults() {
    stopTimer();
    var d = resultPayload();
    var mins = Math.floor(d.timeUsedMs / 60000), secs = Math.floor((d.timeUsedMs % 60000) / 1000);
    var pct = Math.round(d.score / TOTAL_PTS * 100);
    var msg = pct >= 80 ? 'Outstanding — you are more than ready for the event!' :
      pct >= 50 ? 'Strong effort! A bit more practice on the ones you missed and you will fly.' :
      pct >= 25 ? 'Good start. Head back to the lessons and practise the categories you found tricky.' :
      'Every expert was a beginner once. Work through the Lessons, then come back and smash it.';
    var cats = Object.keys(d.perCat).map(function (k) {
      var pc = d.perCat[k]; return '<div class="cat-bar"><span>' + esc(pc.name) + '</span><div class="track"><div class="fill" style="width:' + (pc.solved / pc.total * 100) + '%"></div></div><span class="num">' + pc.solved + '/' + pc.total + '</span></div>';
    }).join('');
    var solvedList = PAPER.map(function (id) {
      var c = BY_ID[id], cat = CATS.filter(function (x) { return x.id === c.cat; })[0], got = !!TS.solved[id];
      return '<div class="result-row ' + (got ? 'got' : 'miss') + '"><span>' + (got ? '✓' : '○') + ' ' + esc(c.title) + '</span><span class="muted small">' + cat.icon + ' ' + esc(cat.name) + '</span></div>';
    }).join('');
    area().innerHTML =
      '<div class="test-results">' +
      '<div class="test-badge">🏁 ' + esc(P.title) + ' — complete</div>' +
      '<h1>' + (TS.name ? esc(TS.name) + '\'s result' : 'Your result') + '</h1>' +
      (d.endReason === 'time' ? '<p class="muted">Time ran out — here is how you did.</p>' : '') +
      '<div class="result-stats">' +
      '<div class="stat"><b>' + d.score + '</b><span>points of ' + TOTAL_PTS + '</span></div>' +
      '<div class="stat"><b>' + pct + '%</b><span>score</span></div>' +
      '<div class="stat"><b>' + d.solvedCount + '</b><span>flags of ' + PAPER.length + '</span></div>' +
      '<div class="stat"><b>' + mins + 'm ' + secs + 's</b><span>time used</span></div>' +
      '</div>' +
      '<div class="callout good">' + msg + '</div>' +
      '<h2>By category</h2><div class="cat-bars">' + cats + '</div>' +
      '<h2>Challenge by challenge</h2><p class="muted small">The ones you missed are great to practise next — no answers are shown here.</p><div class="result-list">' + solvedList + '</div>' +
      '<div class="progress-actions">' +
      '<button class="btn primary" id="testDownload">⬇ Download my result for my teacher</button>' +
      '<button class="btn" id="testPapers">← All practice tests</button>' +
      '<button class="btn" data-goto="board">Back to practice</button>' +
      (window.CTF && window.CTF.isTeacher && window.CTF.isTeacher() ? '<button class="btn danger" id="testReset">Clear this result (teacher)</button>' : '') +
      '</div>' +
      (queued(TS).length ? '<div class="callout">⏳ ' + queued(TS).length + ' answer' + (queued(TS).length > 1 ? 's are' : ' is') + ' still waiting to be checked. Leave this page open — your score updates by itself when Mr Butler\'s script is back.</div>' : '') +
      '<p class="muted small">Want another go? Ask your teacher — they can reset this paper for you from the Teacher tab.</p>' +
      '<p class="muted small">Assistance (hints and walkthroughs) is back on now the test is over.</p>' +
      '</div>';
    $('#testDownload').addEventListener('click', function () {
      var body = JSON.stringify(d);
      var out = JSON.stringify({ data: d, check: sha256(body + SALT) }, null, 1);
      var nm = (TS.name || 'result').replace(/[^\w-]+/g, '_');
      download('MrButlersCTF-TEST-' + nm + '.json', out);
      toast('Result downloaded — send it to your teacher');
    });
    $('#testPapers').addEventListener('click', function () { renderPicker(); });
    var tr = $('#testReset'); if (tr) tr.addEventListener('click', function () {
      if (confirm('Clear this test result so the paper can be sat again?')) { TS = blank(); save(); renderPicker(); }
    });
  }

  // what the teacher's live view sees: the result payload plus each solve's proof code
  function liveSnapshot() {
    var run = runningPaper(); if (run && run.id !== P.id) use(run);
    if (!TS || !TS.started) return null;
    var d = resultPayload(), proofs = {};
    Object.keys(TS.solved).forEach(function (id) { proofs[id] = TS.solved[id].p; });
    d.proofs = proofs; d.start = TS.start; d.minutes = P.minutes;
    d.status = TS.finished ? 'finished' : (remaining() > 0 ? 'running' : 'timeup');
    return d;
  }
  window.TestArea = { papers: function () { return PAPERS.map(function (p) { return { id: p.id, icon: p.icon, title: p.title, level: p.level }; }); }, enter: enter, isLive: isLive, open: openTest, liveSnapshot: liveSnapshot };
})();
