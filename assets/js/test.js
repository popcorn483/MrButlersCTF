/* Test area: an exam-style mock that mimics the real event.
   Password-gated to start, a countdown timer, a fixed paper, NO hints and NO walkthroughs,
   and a results screen the teacher can collect. Assistance is switched off everywhere while a test runs. */
(function () {
  'use strict';

  // ===================== TEACHER SETTINGS =====================
  // Change the password pupils must type to start, and how long the test runs.
  var CONFIG = {
    password: 'ctf2026',   // tell pupils this on the day (change it here to set your own)
    minutes: 45,           // length of the test
    title: 'Mock CTF',
    // The paper: a balanced spread across categories, easy to hard.
    paper: ['warm-02', 'warm-05', 'cry-01', 'osint-01', 'net-01', 'safe-01',
            'warm-07', 'cry-02', 'web-01', 'for-01', 'steg-02', 'prog-06',
            'cry-08', 'web-03', 'for-03', 'rev-01', 'net-02', 'cry-07',
            'steg-03', 'cry-11', 'web-08', 'for-06', 'rev-06', 'cry-20']
  };
  // ============================================================

  var U = window.CTFUtil, $ = U.$, esc = U.esc, toast = U.toast, download = U.download;
  var BY_ID = window.CTF.BY_ID, CATS = window.CTF.DATA.cats;
  var TIER = [null, 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert'];
  var TCLS = [null, 't1', 't2', 't3', 't4', 't5'];
  var SALT = 'mbctf-test-v1';
  var KEY = 'mbctf-test-v1';

  var PAPER = CONFIG.paper.filter(function (id) { return BY_ID[id]; });
  var TOTAL_PTS = PAPER.reduce(function (s, id) { return s + BY_ID[id].pts; }, 0);

  function blank() { return { v: 1, pid: rid(), name: '', started: false, start: 0, end: 0, finished: false, solved: {}, wrong: 0 }; }
  function rid() { var a = new Uint8Array(6); (crypto.getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; })); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  var TS = blank();
  try { var raw = localStorage.getItem(KEY); if (raw) TS = Object.assign(blank(), JSON.parse(raw)); } catch (e) { }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(TS)); } catch (e) { } }

  var timer = null;
  function durationMs() { return CONFIG.minutes * 60 * 1000; }
  function remaining() { return Math.max(0, durationMs() - (Date.now() - TS.start)); }
  function isLive() { return TS.started && !TS.finished && remaining() > 0; }
  function tScore() { var p = 0; Object.keys(TS.solved).forEach(function (id) { if (BY_ID[id]) p += BY_ID[id].pts; }); return p; }
  function tCount() { return Object.keys(TS.solved).filter(function (id) { return BY_ID[id]; }).length; }

  var area = function () { return $('#testArea'); };

  function enter() {
    if (TS.finished) return renderResults();
    if (TS.started && remaining() > 0) { renderBoard(); startTimer(); return; }
    if (TS.started && remaining() <= 0) { return finish('time'); }
    renderStart();
  }

  // ---------- start screen ----------
  function renderStart() {
    stopTimer();
    area().innerHTML =
      '<div class="test-gate">' +
      '<div class="test-badge">🔒 Test area</div>' +
      '<h1>' + esc(CONFIG.title) + '</h1>' +
      '<p>This is a <b>timed mock competition</b> that works like the real event. Before you start, know that:</p>' +
      '<ul class="test-rules">' +
      '<li>⏱️ You have <b>' + CONFIG.minutes + ' minutes</b> once you begin. The clock does not stop.</li>' +
      '<li>🚫 There are <b>no hints and no walkthroughs</b> — here or anywhere on the site — while the test runs.</li>' +
      '<li>🧰 You <b>can</b> use the Toolkit (Decoder, Hex viewer and so on), just like on the day.</li>' +
      '<li>🏁 There are ' + PAPER.length + ' challenges worth ' + TOTAL_PTS + ' points. Do the easy ones first.</li>' +
      '<li>🔑 You need the <b>password from your teacher</b> to begin.</li>' +
      '</ul>' +
      '<form id="testStartForm" class="test-start-form">' +
      '<label class="field-label">Your name or team</label><input class="io" id="testName" maxlength="40" placeholder="e.g. Team Alpha" value="' + esc(TS.name || '') + '">' +
      '<label class="field-label">Password</label><input class="io" id="testPass" type="password" placeholder="ask your teacher" autocomplete="off">' +
      '<div id="testStartMsg" class="flag-msg bad"></div>' +
      '<button class="btn primary big" type="submit">Start the test ▶</button>' +
      '</form>' +
      '<p class="muted small">Not ready? You can keep practising on the <a href="#" data-goto="board">Challenge board</a> instead.</p>' +
      '</div>';
    $('#testStartForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var pass = $('#testPass').value.trim();
      if (pass !== CONFIG.password) { $('#testStartMsg').textContent = '✗ That password is not right. Ask your teacher for today\'s password.'; return; }
      TS = blank(); TS.name = $('#testName').value.trim().slice(0, 40); TS.started = true; TS.start = Date.now(); save();
      renderBoard(); startTimer();
      toast('Good luck! The clock has started.');
    });
  }

  // ---------- test board ----------
  function renderBoard() {
    stopTimer();
    var byCat = {};
    PAPER.forEach(function (id) { var c = BY_ID[id]; (byCat[c.cat] = byCat[c.cat] || []).push(c); });
    var cats = CATS.filter(function (cat) { return byCat[cat.id]; });
    area().innerHTML =
      '<div class="test-bar">' +
      '<div class="test-bar-left"><span class="test-badge small">🔒 Test in progress</span>' + (TS.name ? ' <b>' + esc(TS.name) + '</b>' : '') + '</div>' +
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
        if (b.dataset.a === 'dec') { window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('decoder', pre.textContent); }
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
        if (b.dataset.f === 'view') window.CTFShowSource(f.name, f.text);
        if (b.dataset.f === 'hex') { window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('hex', { file: f }); }
        if (b.dataset.f === 'img') { window.CTFModal.close('#testModal'); window.CTFShow('toolkit'); window.Toolkit.open('image', { file: f }); }
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
    var norm = raw.toLowerCase();
    if (sha256(norm) === c.h) {
      if (!TS.solved[c.id]) { TS.solved[c.id] = { t: Date.now(), p: sha256(TS.pid + '|' + norm).slice(0, 16) }; save(); updateHud(); markSolved(c.id); toast('✓ Flag captured (+' + c.pts + ')'); }
      msg.className = 'flag-msg ok'; msg.textContent = '✓ Correct.';
      $('#tChalMeta').innerHTML += TS.solved[c.id] ? '' : '';
      return;
    }
    TS.wrong++; save();
    msg.className = 'flag-msg bad';
    msg.textContent = /^flag\{.*\}$/i.test(raw) ? '✗ Incorrect.' : '✗ Incorrect. Flags look like flag{...}.';
    var f = $('#tFlagForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  });
  function markSolved(id) {
    // lightweight refresh of solved styling on the board tiles
    var grid = $('#testBoardGrid'); if (!grid) return;
    var tiles = U.$$('.tile', grid), i = 0;
    var byCat = {}; PAPER.forEach(function (id) { var c = BY_ID[id]; (byCat[c.cat] = byCat[c.cat] || []).push(c); });
    CATS.filter(function (cat) { return byCat[cat.id]; }).forEach(function (cat) {
      byCat[cat.id].forEach(function (c) { var t = tiles[i++]; if (t) t.classList.toggle('solved', !!TS.solved[c.id]); });
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
    var d = { app: 'MrButlersCTF-Test', v: 1, pid: TS.pid, name: TS.name, exported: Date.now(),
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
      '<div class="test-badge">🏁 Test complete</div>' +
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
      '<button class="btn" data-goto="board">Back to practice</button>' +
      '<button class="btn danger" id="testReset">Clear this result</button>' +
      '</div>' +
      '<p class="muted small">Assistance (hints and walkthroughs) is back on now the test is over.</p>' +
      '</div>';
    $('#testDownload').addEventListener('click', function () {
      var body = JSON.stringify(d);
      var out = JSON.stringify({ data: d, check: sha256(body + SALT) }, null, 1);
      var nm = (TS.name || 'result').replace(/[^\w-]+/g, '_');
      download('MrButlersCTF-TEST-' + nm + '.json', out);
      toast('Result downloaded — send it to your teacher');
    });
    $('#testReset').addEventListener('click', function () {
      if (confirm('Clear this test result and return to the start screen?')) { TS = blank(); save(); renderStart(); }
    });
  }

  window.TestArea = { enter: enter, isLive: isLive };
})();
