/* Mr Butler's CTF — main app: board, challenge modal, flags, progress, teacher view */
(function () {
  'use strict';

  // ---------- challenges: encrypted on the public site (no flags or answers in them at all). The key comes from the
  // teacher's Google script, and only once a pupil is approved (or on a teacher PC). Flags are checked by the script.
  var CONTENT_STORE = 'mbctf-content-v1', CKEY_STORE = 'mbctf-ck-v1', ANS_STORE = 'mbctf-ans-v1', META = window.CTF_CONTENT || {};
  function wipeContent() { try { localStorage.removeItem(CONTENT_STORE); localStorage.removeItem(CKEY_STORE); localStorage.removeItem(ANS_STORE); } catch (e) { } }
  function readContent() {
    try {
      var ps = JSON.parse(localStorage.getItem('mbctf-progress-v1') || '{}');
      var tpc = !!localStorage.getItem('mbctf-teacher-livekey-v1') || localStorage.getItem('mbctf-teacher-pc-v1') === '1';
      if (!tpc && (/^(pending|declined|unknown)$/.test(ps.access || '') || !ps.name)) { wipeContent(); return null; }
      var c = JSON.parse(localStorage.getItem(CONTENT_STORE) || 'null');
      return c && c.ver === META.ver && c.data && c.data.challenges ? c.data : null;
    } catch (e) { return null; }
  }
  var DATA = readContent(), CONTENT_READY = !!DATA, CONTENT_STATE = CONTENT_READY ? 'ready' : 'loading';
  if (!DATA) DATA = { cats: [], challenges: [] };
  var CH = DATA.challenges, CATS = DATA.cats;
  var BY_ID = {}; CH.forEach(function (c) { BY_ID[c.id] = c; });
  window.CTF = { DATA: DATA, BY_ID: BY_ID };

  var TIERS = [null,
    { name: 'Beginner', cls: 't1' }, { name: 'Easy', cls: 't2' }, { name: 'Medium', cls: 't3' },
    { name: 'Hard', cls: 't4' }, { name: 'Expert', cls: 't5' }, { name: 'Elite', cls: 't6' }, { name: 'Unreal', cls: 't7' }];
  var TIER_NUMS = [1, 2, 3, 4, 5, 6, 7];
  var UNREAL_NEED = 3;   // Competition Grade solves needed to unlock Unreal
  var ELITE_NEED = 5;   // Hard/Expert solves needed to unlock Competition Grade
  // the board shows 5 challenges per category to start with; solving 3 of them reveals the next 5, and so on
  var REVEAL_STEP = 5, REVEAL_AT = 3;
  function revealCount(solvedHere) { return REVEAL_STEP * (1 + Math.floor((solvedHere + (REVEAL_STEP - REVEAL_AT)) / REVEAL_STEP)); }
  var REVEAL_KEY = 'mbctf-reveal-v1', REVEAL_SEEN = {};
  try { REVEAL_SEEN = JSON.parse(localStorage.getItem(REVEAL_KEY) || '{}') || {}; } catch (e) { }
  var RANKS = [[0, 'Script Kiddie'], [150, 'Packet Sniffer'], [500, 'Bug Hunter'], [1200, 'Flag Collector'],
    [2500, 'Cipher Breaker'], [4500, 'Exploit Engineer'], [7000, 'Red Teamer'], [10000, 'Zero-Day Legend']];
  var TOTAL_PTS = CH.reduce(function (s, c) { return s + c.pts; }, 0);
  var SALT = 'mbctf-progress-v1';
  var STORE_KEY = 'mbctf-progress-v1';

  // ---------- helpers ----------
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, ms || 2200);
  }
  function fmtDate(t) { var d = new Date(t); return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  function randId() { var a = new Uint8Array(8); (window.crypto || {}).getRandomValues ? crypto.getRandomValues(a) : a.forEach(function (_, i) { a[i] = Math.random() * 256; }); return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function download(name, text, type) {
    var blob = new Blob([text], { type: type || 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  window.CTFUtil = { esc: esc, toast: toast, download: download, $: $, $$: $$ };

  // ---------- state ----------
  function blankState() { return { v: 1, pid: randId(), name: '', solved: {}, hints: {}, revealed: {}, tries: {}, tut: {}, wrong: 0, created: Date.now() }; }
  var S = blankState();
  try { var raw = localStorage.getItem(STORE_KEY); if (raw) S = Object.assign(blankState(), JSON.parse(raw)); } catch (e) { /* storage blocked */ }
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { } if (typeof scheduleSync === 'function') scheduleSync(); }
  function score() { var p = 0; Object.keys(S.solved).forEach(function (id) { if (BY_ID[id] && !S.solved[id].r) p += BY_ID[id].pts; }); return p; }
  function solvedCount() { return Object.keys(S.solved).filter(function (id) { return BY_ID[id]; }).length; }
  // Hard (tier 4) and Expert (tier 5) challenges in a category stay locked until
  // the pupil has solved a few of the easier ones (tier <= 3) in that same category.
  function kindTag(c) { var k = c.kind && CATS.filter(function (x) { return x.id === c.kind; })[0]; return k ? '<span class="tag">' + k.icon + ' ' + esc(k.name) + '</span>' : ''; }
  function catUnlock(catId) {
    if (catId === 'unreal') {
      var eliteDone = CH.filter(function (c) { return c.tier === 6 && S.solved[c.id]; }).length;
      return { locked: eliteDone < UNREAL_NEED, need: UNREAL_NEED, have: Math.min(eliteDone, UNREAL_NEED), unreal: true };
    }
    if (catId === 'elite') {
      var hardDone = CH.filter(function (c) { return c.tier >= 4 && c.tier <= 5 && S.solved[c.id]; }).length;
      return { locked: hardDone < ELITE_NEED, need: ELITE_NEED, have: Math.min(hardDone, ELITE_NEED), elite: true };
    }
    var easier = CH.filter(function (c) { return c.cat === catId && c.tier <= 3; });
    var need = Math.min(3, easier.length);
    var have = easier.filter(function (c) { return S.solved[c.id]; }).length;
    return { locked: need > 0 && have < need, need: need, have: have };
  }

  // ---------- header / rank ----------
  function refreshHeader() {
    $('#playerName').textContent = S.name ? S.name + (S.cls ? ' · ' + S.cls : '') : 'Sign in';
    $('#playerScore').textContent = score();
    $('#playerSolved').textContent = solvedCount();
    $('#playerTotal').textContent = CH.length;
    var sc = score(), cur = RANKS[0], nxt = null;
    for (var i = 0; i < RANKS.length; i++) { if (sc >= RANKS[i][0]) { cur = RANKS[i]; nxt = RANKS[i + 1] || null; } }
    $('#rankName').textContent = cur[1];
    var pct = nxt ? (sc - cur[0]) / (nxt[0] - cur[0]) * 100 : 100;
    $('#rankBar').style.width = Math.min(100, pct) + '%';
    $('#rankNext').textContent = nxt ? (nxt[0] - sc) + ' pts to ' + nxt[1] : 'Top rank reached!';
  }
  $('#playerName').addEventListener('click', askName);
  function askName() { askWho(true); }

  // ---------- navigation ----------
  var LEARN_VIEWS = ['start', 'lessons', 'walkthrough', 'resources', 'reference', 'pack'];
  function closeLearnMenu() {
    var lm = document.getElementById('learnMenu'), lt = document.getElementById('learnToggle');
    if (lm) lm.hidden = true; if (lt) lt.setAttribute('aria-expanded', 'false');
  }
  function show(view) {
    if (view === 'teacher' && !teacherSignedIn()) { openTeacherSignIn(); return; }
    $$('.tab').forEach(function (t) { t.classList.toggle('active', t.dataset.view === view); });
    $$('.view').forEach(function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    document.body.classList.toggle('view-board', view === 'board'); // drawer board-options only on the board
    document.body.classList.toggle('view-home', view === 'home');   // hide the hamburger on the home screen
    var lt = document.getElementById('learnToggle');
    if (lt) lt.classList.toggle('active', LEARN_VIEWS.indexOf(view) >= 0);
    closeLearnMenu();
    if (view === 'home') renderHome();
    if (view === 'board') { renderRecommend(); renderBanners(); }
    if (view === 'progress') renderProgress();
    if (view === 'leaderboard') loadBoard(true);
    if (view === 'toolkit' && window.Toolkit) Toolkit.ensure();
    if (view === 'test' && window.TestArea) TestArea.enter();
    if (view !== 'toolkit') returnTo = null;
    updateToolBack();
    if (window.CTFCloseNav) window.CTFCloseNav();
    window.scrollTo(0, 0);
  }
  var returnTo = null; // {view, id, label} — where "Back to challenge" goes from the Toolkit
  function updateToolBack() {
    var bar = document.getElementById('toolBack'); if (!bar) return;
    var onToolkit = document.getElementById('view-toolkit').classList.contains('active');
    if (returnTo && onToolkit) { bar.hidden = false; var l = bar.querySelector('.tb-label'); if (l) l.textContent = '← Back to: ' + returnTo.label; }
    else bar.hidden = true;
  }
  window.CTFReturn = { set: function (view, id, label) { returnTo = { view: view, id: id, label: label }; } };
  (function () {
    var btn = document.getElementById('toolBackBtn');
    if (btn) btn.addEventListener('click', function () {
      var r = returnTo; if (!r) { show('board'); return; }
      if (r.view === 'test' && window.TestArea && TestArea.open) { show('test'); TestArea.open(r.id); }
      else { show('board'); openChal(r.id); }
    });
  })();
  window.CTFShow = show;
  document.body.classList.toggle('view-board', document.getElementById('view-board').classList.contains('active'));
  document.body.classList.toggle('view-home', document.getElementById('view-home').classList.contains('active'));
  $$('.tab[data-view]').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.view); }); });
  $$('.tab-menu-item').forEach(function (t) { t.addEventListener('click', function () { show(t.dataset.view); }); });
  var learnToggle = document.getElementById('learnToggle');
  if (learnToggle) learnToggle.addEventListener('click', function (e) {
    e.stopPropagation();
    var lm = document.getElementById('learnMenu'), open = lm.hidden;
    lm.hidden = !open; learnToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  document.addEventListener('click', function (e) { if (!e.target.closest('.tab-group')) closeLearnMenu(); });
  // mobile hamburger
  var hamburger = document.getElementById('hamburger');
  function closeNav() { document.body.classList.remove('nav-open'); if (hamburger) hamburger.setAttribute('aria-expanded', 'false'); }
  if (hamburger) hamburger.addEventListener('click', function (e) {
    e.stopPropagation();
    var open = document.body.classList.toggle('nav-open');
    hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) closeLearnMenu();
  });
  document.addEventListener('click', function (e) {
    if (!document.body.classList.contains('nav-open')) return;
    if (!e.target.closest('#mainNav') && !e.target.closest('#hamburger')) closeNav();
  });
  window.CTFCloseNav = closeNav;
  var navCloseBtn = document.getElementById('navClose');
  if (navCloseBtn) navCloseBtn.addEventListener('click', function (e) { e.stopPropagation(); closeNav(); });
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-goto]');
    if (g) { e.preventDefault(); show(g.dataset.goto); if (g.dataset.anchor) { var el = document.getElementById(g.dataset.anchor); if (el) el.scrollIntoView(); } return; }
    var c = e.target.closest('[data-chal]');
    if (c) { e.preventDefault(); if (BY_ID[c.dataset.chal]) openChal(c.dataset.chal); }
  });

  // ---------- filters ----------
  var F = { tiers: { 1: true, 2: true, 3: true, 4: true, 5: true, 6: true, 7: true }, q: '', hide: false };
  function renderChips() {
    ['#tierChips', '#navTierChips'].forEach(function (sel) {
      var box = document.querySelector(sel); if (!box) return;
      box.innerHTML = '';
      for (var t = 1; t <= 7; t++) {
        var b = document.createElement('button');
        b.className = 'chip ' + TIERS[t].cls + (F.tiers[t] ? ' on' : '');
        b.innerHTML = '<span class="dot" style="background:var(--tc)"></span>' + TIERS[t].name;
        b.dataset.t = t;
        b.addEventListener('click', function () { var k = this.dataset.t; F.tiers[k] = !F.tiers[k]; renderChips(); renderBoard(); });
        box.appendChild(b);
      }
    });
  }
  function setHideSolved(val) {
    F.hide = val;
    var a = document.getElementById('hideSolved'), bb = document.getElementById('navHideSolved');
    if (a) a.checked = val; if (bb) bb.checked = val;
    renderBoard();
  }
  $('#searchBox').addEventListener('input', function () { F.q = this.value.toLowerCase(); renderBoard(); });
  $('#hideSolved').addEventListener('change', function () { setHideSolved(this.checked); });

  // ---------- board ----------
  var CONTENT_MSG = {
    loading: ['⏳', 'Loading the challenges…', 'This only takes a moment the first time.'],
    setup: ['🛠️', 'The challenges aren’t ready yet', 'Mr Butler is still setting them up. This page will open them by itself as soon as he has.'],
    access: ['🔒', 'Not approved yet', 'The challenges open once Mr Butler has approved you.'],
    offline: ['📡', 'Can’t load the challenges', 'Mr Butler’s CTF needs an internet connection to unlock the challenges the first time. Trying again…'],
    storage: ['💾', 'This browser can’t store the challenges', 'Private / incognito windows block it. Open the site in a normal window.']
  };
  function contentNote() {
    var m = CONTENT_MSG[CONTENT_STATE] || CONTENT_MSG.loading;
    var t = isTeacherDevice() && CONTENT_STATE !== 'loading';
    return '<div class="callout content-note"><div class="cn-ic">' + m[0] + '</div><h3>' + m[1] + '</h3><p class="muted">' + m[2] + '</p>' +
      (t ? '<p class="small">Teacher PC: unlock them here with your Teacher password (this also installs the answers on your Google script once it’s updated).</p><button type="button" class="btn primary" data-unlock>🔑 Unlock with Teacher password</button>' : '') + '</div>';
  }
  function renderBoard() {
    var board = $('#board'); board.innerHTML = '';
    if (!CONTENT_READY) { board.innerHTML = contentNote(); return; }
    CATS.forEach(function (cat) {
      var unlock = catUnlock(cat.id);
      var matchAll = CH.filter(function (c) {
        if (c.cat !== cat.id || !F.tiers[c.tier]) return false;
        if (F.hide && S.solved[c.id]) return false;
        if (F.q && (c.title + ' ' + c.id).toLowerCase().indexOf(F.q) < 0) return false;
        return true;
      });
      // hide Hard/Expert while the category is locked (but never hide a solved one)
      var hiddenHard = [];
      var list = matchAll.filter(function (c) {
        if (unlock.locked && c.tier >= 4 && !S.solved[c.id]) { hiddenHard.push(c); return false; }
        return true;
      });
      var all = CH.filter(function (c) { return c.cat === cat.id; });
      var done = all.filter(function (c) { return S.solved[c.id]; }).length;
      // progressive reveal: only the first few unsolved challenges show; solving more reveals the next batch (teacher PCs see everything)
      var showAll = isTeacherDevice(), reveal = showAll ? all.length : Math.min(all.length, revealCount(done));
      var open = {}, fresh = {}, prevSeen = REVEAL_SEEN[cat.id] || 0;
      var NEW = REVEAL_SEEN._new || (REVEAL_SEEN._new = {});
      all.slice(0, reveal).forEach(function (c, i) { open[c.id] = 1; if (!showAll && prevSeen && i >= prevSeen) { fresh[c.id] = 1; NEW[c.id] = 1; } });
      Object.keys(NEW).forEach(function (id) { if (open[id] && !S.solved[id]) fresh[id] = 1; });
      var unrevealed = all.filter(function (c) { return !open[c.id] && !S.solved[c.id]; }).length;
      list = list.filter(function (c) { return open[c.id] || S.solved[c.id]; });
      hiddenHard = hiddenHard.filter(function (c) { return open[c.id]; });
      if (!showAll && reveal > prevSeen) {
        var nNew = reveal - prevSeen;
        if (prevSeen) toast('🔓 ' + nNew + ' new ' + cat.name + ' challenge' + (nNew > 1 ? 's' : '') + ' revealed!', 3500);
        REVEAL_SEEN[cat.id] = reveal; try { localStorage.setItem(REVEAL_KEY, JSON.stringify(REVEAL_SEEN)); } catch (e) { }
      }
      if (!list.length && !hiddenHard.length && !(unrevealed && !F.q)) return;
      var sec = document.createElement('section'); sec.className = 'cat';
      sec.innerHTML = '<div class="cat-head"><div class="cat-title"><span class="cat-icon">' + cat.icon + '</span>' + esc(cat.name) +
        '</div><div class="cat-blurb">' + esc(cat.blurb) + '</div><button class="cat-guide" data-guide="' + cat.id + '">How to approach</button>' +
        '<div class="cat-count">' + done + '/' + all.length + '</div></div><div class="tiles"></div>';
      var tiles = $('.tiles', sec);
      list.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'tile ' + TIERS[c.tier].cls + (S.solved[c.id] ? ' solved' : '') + (S.tut && S.tut[c.id] ? ' tut-used' : '') + (fresh[c.id] && !S.solved[c.id] ? ' tile-new' : '');
        b.innerHTML = (S.tut && S.tut[c.id] ? '<span class="tut-mark" title="Tutorial used">📘</span>' : '') + '<div class="tile-title">' + esc(c.title) + '</div><div class="tile-foot"><span>' + TIERS[c.tier].name + '</span><span class="tile-pts">' + c.pts + '</span></div>';
        b.addEventListener('click', function () {
          if (REVEAL_SEEN._new && REVEAL_SEEN._new[c.id]) { delete REVEAL_SEEN._new[c.id]; try { localStorage.setItem(REVEAL_KEY, JSON.stringify(REVEAL_SEEN)); } catch (e) { } b.classList.remove('tile-new'); }
          openChal(c.id);
        });
        tiles.appendChild(b);
      });
      if (hiddenHard.length) {
        var remain = unlock.need - unlock.have;
        var lb = document.createElement('button'); lb.className = 'tile tile-locked';
        lb.innerHTML = '<span class="lock-ic">🔒</span><div class="tile-title">' + hiddenHard.length + ' harder challenge' + (hiddenHard.length > 1 ? 's' : '') +
          '</div><div class="tile-foot"><span>' + (unlock.unreal ? 'Solve ' + remain + ' more Competition Grade to unlock' : unlock.elite ? 'Solve ' + remain + ' more Hard/Expert to unlock' : 'Solve ' + remain + ' more here to unlock') + '</span></div>';
        lb.addEventListener('click', function () { toast(unlock.unreal ? '🌌 Unreal unlocks once you have solved ' + UNREAL_NEED + ' Competition Grade challenges (' + unlock.have + '/' + UNREAL_NEED + ' so far).' : unlock.elite ? '🏆 Competition Grade unlocks once you have solved ' + ELITE_NEED + ' Hard or Expert challenges (' + unlock.have + '/' + ELITE_NEED + ' so far).' : '🔒 Solve ' + remain + ' more ' + cat.name + ' challenge' + (remain > 1 ? 's' : '') + ' to unlock the harder ones.', 4000); });
        tiles.appendChild(lb);
      }
      if (unrevealed && !F.q) {
        var needMore = 1; while (revealCount(done + needMore) <= reveal) needMore++;
        var nb = document.createElement('button'); nb.className = 'tile tile-locked tile-more';
        nb.innerHTML = '<span class="lock-ic">✨</span><div class="tile-title">' + Math.min(REVEAL_STEP, unrevealed) + ' more to reveal</div>' +
          '<div class="tile-foot"><span>Solve ' + needMore + ' more here</span><span class="tile-pts">' + unrevealed + ' left</span></div>';
        nb.addEventListener('click', function () { toast('✨ Solve ' + needMore + ' more ' + cat.name + ' challenge' + (needMore > 1 ? 's' : '') + ' to reveal the next ' + Math.min(REVEAL_STEP, unrevealed) + '. ' + unrevealed + ' still hidden in this category.', 4000); });
        tiles.appendChild(nb);
      }
      board.appendChild(sec);
    });
    if (!board.children.length) board.innerHTML = '<div class="empty">No challenges match those filters.</div>';
    renderRecommend();
  }
  function nextRecommended() {
    var unsolved = CH.filter(function (c) { return !S.solved[c.id] && c.tier < 6; });
    if (!unsolved.length) return null;
    var catIdx = {}; CATS.forEach(function (c, i) { catIdx[c.id] = i; });
    unsolved.sort(function (a, b) { return a.tier - b.tier || catIdx[a.cat] - catIdx[b.cat] || a.id.localeCompare(b.id); });
    return unsolved[0];
  }
  function openRecommended() {
    var pick = nextRecommended();
    if (pick) { show('board'); openChal(pick.id); }
    else { show('test'); }
  }
  // animated circuit-trace background (same visual language as the splash / sister app)
  function buildHomeBg() {
    var bg = document.querySelector('.home-bg'); if (!bg) return;
    var HL = ['#8AB6FF', '#4FD6C6', '#BDA2FF', '#FF8FBC', '#F5B25C', '#85D68C', '#A8B2FF', '#5CD3EE', '#FF9E78', '#E59AF2'];
    var port = (window.innerHeight || 1) > (window.innerWidth || 1), VB = port ? '0 0 300 400' : '0 0 400 300';
    var T = port
      ? [['M-10 70H50L80 100H120', 0], ['M310 48H240L210 78H180', 2], ['M90 -10V30L115 55', 8], ['M-10 330H52L82 300H125', 4], ['M310 352H246L216 322H176', 7], ['M215 410V372L190 347', 1], ['M-10 128H30', 5], ['M310 272H268', 9], ['M-10 200H44L74 230', 3], ['M310 168H252L222 198', 6]]
      : [['M-10 70H70L100 100H150', 0], ['M410 52H330L300 82H262', 2], ['M-10 232H58L88 202H138', 4], ['M410 246H344L314 216H258', 7], ['M120 -10V30L150 60', 8], ['M286 310V272L256 242', 1], ['M-10 150H40', 5], ['M410 150H362', 9], ['M-10 300H64L94 272', 3], ['M410 96H356L326 124', 6]];
    var paths = T.map(function (t, i) {
      var cur = [0, 0];
      t[0].match(/[MHVL][^MHVL]*/g).forEach(function (s) { var c = s[0], v = s.slice(1).trim().split(/\s+/).map(Number); if (c === 'M' || c === 'L') cur = [v[0], v[1]]; else if (c === 'H') cur = [v[0], cur[1]]; else cur = [cur[0], v[0]]; });
      var dl = (i * 0.45).toFixed(2), col = HL[t[1]];
      return '<path class="trace-base" d="' + t[0] + '" stroke="' + col + '"/>' +
        '<path class="trace-flow" d="' + t[0] + '" pathLength="1" stroke="' + col + '" style="animation-delay:' + dl + 's"/>' +
        '<circle cx="' + cur[0] + '" cy="' + cur[1] + '" r="4" fill="var(--desk)" stroke="' + col + '" style="animation-delay:' + (i * 0.2).toFixed(2) + 's"/>';
    }).join('');
    bg.innerHTML = '<svg class="home-traces" viewBox="' + VB + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + paths + '</svg>';
  }
  function renderHome() {
    var h = document.querySelector('.home'); // replay the entrance animation each time home is shown
    if (h) { h.classList.remove('home-in'); void h.offsetWidth; h.classList.add('home-in'); }
    var bg = document.querySelector('.home-bg');
    if (bg) { if (!bg.firstChild) buildHomeBg(); bg.classList.remove('draw'); void bg.offsetWidth; bg.classList.add('draw'); }
    var box = document.getElementById('homeCont'); if (!box) return;
    var n = solvedCount(), pick = nextRecommended();
    if (!n || !pick) { box.innerHTML = ''; return; }
    var cat = CATS.filter(function (x) { return x.id === pick.cat; })[0];
    var frac = n / CH.length, C = 100.5, off = (C * (1 - frac)).toFixed(1);
    box.innerHTML = '<a class="home-cont" href="#" id="homeContLink" title="Resume: ' + esc(pick.title) + '">' +
      '<svg class="hc-ring" viewBox="0 0 40 40" aria-hidden="true"><circle class="hc-track" cx="20" cy="20" r="16"/>' +
      '<circle class="hc-arc" cx="20" cy="20" r="16" style="stroke-dasharray:' + C + ';stroke-dashoffset:' + off + '"/></svg>' +
      '<span class="hc-tx"><small>Continue</small><b>' + esc(pick.title) + '</b></span></a>';
    var a = document.getElementById('homeContLink');
    if (a) a.addEventListener('click', function (e) { e.preventDefault(); openRecommended(); });
  }
  function renderRecommend() {
    var box = document.getElementById('recommend'); if (!box) return;
    if (!CONTENT_READY) { box.innerHTML = ''; return; }
    var n = solvedCount();
    var pick = nextRecommended();
    if (!pick) {
      box.innerHTML = '<div class="recommend-card done"><div class="rec-left"><div class="rec-label">🏆 All done</div><div class="rec-title">You have solved every challenge!</div><div class="rec-why">Incredible work. Try the Test area to see how you do under real conditions.</div></div><button class="btn primary" data-goto="test">Go to Test area</button></div>';
      updateNavContinue(); return;
    }
    var cat = CATS.filter(function (x) { return x.id === pick.cat; })[0];
    var why = n === 0 ? 'A gentle place to begin — this is your first flag.' :
      (pick.tier <= 1 ? 'A quick Beginner win to keep your streak going.' :
       pick.tier === 2 ? 'A nice next step up from the basics.' : 'Ready for a bit more of a challenge?');
    box.innerHTML = '<div class="recommend-card"><div class="rec-left"><div class="rec-label">👉 ' + (n === 0 ? 'Start here' : 'Recommended next') + '</div>' +
      '<div class="rec-title">' + esc(pick.title) + '</div>' +
      '<div class="rec-why">' + cat.icon + ' ' + esc(cat.name) + ' · ' + TIERS[pick.tier].name + ' · ' + pick.pts + ' pts — ' + why + '</div></div>' +
      '<button class="btn primary" data-rec="' + pick.id + '">Open this one</button></div>';
    var btn = box.querySelector('[data-rec]');
    if (btn) btn.addEventListener('click', function () { openChal(pick.id); });
    updateNavContinue();
  }
  function updateNavContinue() {
    var el = document.getElementById('navContinue'); if (!el) return;
    var pick = nextRecommended();
    var started = solvedCount() > 0;
    el.textContent = pick ? (started ? '▶ Continue where you left off' : '▶ Start your first challenge') : '🏆 All done — try the Test area';
  }
  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-guide]');
    if (g) { show('start'); var el = document.getElementById('guide-' + g.dataset.guide); if (el) { el.scrollIntoView({ block: 'start' }); el.style.outline = '2px solid var(--cyan)'; setTimeout(function () { el.style.outline = ''; }, 1500); } }
  });

  // ---------- modals ----------
  function openModal(id) { $(id).hidden = false; document.body.style.overflow = 'hidden'; }
  function closeModal(m) { m.hidden = true; if ($$('.modal').every(function (x) { return x.hidden; })) document.body.style.overflow = ''; }
  window.CTFModal = { open: openModal, close: function (id) { closeModal($(id)); } };
  $$('.modal').forEach(function (m) {
    m.addEventListener('click', function (e) { if (e.target === m || e.target.closest('[data-close]')) closeModal(m); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    var open = $$('.modal').filter(function (m) { return !m.hidden; });
    if (open.length) closeModal(open[open.length - 1]);
  });

  // ---------- source viewer with highlighting ----------
  function highlightHTML(src) {
    var s = esc(src);
    s = s.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '\u0001$1\u0002');
    s = s.replace(/(&lt;\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?&gt;)/g, function (m, a, tag, attrs, b) {
      if (m.indexOf('\u0001') >= 0) return m;
      attrs = attrs.replace(/([\w-:@]+)(=)(&quot;[\s\S]*?&quot;|&#39;[\s\S]*?&#39;)/g, '<span class="hl-attr">$1</span>$2<span class="hl-str">$3</span>');
      return '<span class="hl-tag">' + a + tag + '</span>' + attrs + '<span class="hl-tag">' + b + '</span>';
    });
    return s.replace(/\u0001/g, '<span class="hl-com">').replace(/\u0002/g, '</span>');
  }
  window.CTFHighlight = highlightHTML;
  function showSource(title, src) {
    $('#srcTitle').textContent = title;
    $('#srcCode').innerHTML = highlightHTML(src);
    openModal('#srcModal');
  }
  window.CTFShowSource = showSource;
  $('#viewSiteHtml').addEventListener('click', function () {
    showSource("View HTML: this page", '<!doctype html>\n' + document.documentElement.outerHTML.replace(/<script>window\.CTF_BUNDLE[\s\S]*?<\/script>/, ''));
  });

  // ---------- challenge modal ----------
  var current = null;
  function openChal(id) {
    var c = BY_ID[id]; if (!c) return;
    var tn = document.getElementById('chalTeacherNote'); if (tn) tn.remove();
    current = c;
    var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
    var card = $('#chalModal .modal-card');
    card.className = 'modal-card ' + TIERS[c.tier].cls;
    $('#chalMeta').innerHTML = '<span class="tag">' + cat.icon + ' ' + esc(cat.name) + '</span>' + kindTag(c) + '<span class="tag tier">' + TIERS[c.tier].name +
      '</span><span class="tag pts">' + c.pts + ' pts</span><span class="tag">' + esc(c.id) + '</span>' + (S.solved[id] ? '<span class="tag done">✓ solved</span>' : '');
    $('#chalTitle').textContent = c.title;
    var desc = $('#chalDesc'); desc.innerHTML = c.desc;
    enhanceData(desc);
    renderFiles(c);
    renderActions(c);
    renderHints(c);
    renderAnswer(c);
    $('#flagInput').value = '';
    var msg = $('#flagMsg'); msg.className = 'flag-msg'; msg.textContent = S.solved[id] ? 'You have already solved this one.' : '';
    openModal('#chalModal');
    setTimeout(function () { $('#flagInput').focus(); }, 50);
  }
  window.CTFOpenChal = openChal;

  function enhanceData(root) {
    $$('pre.data', root).forEach(function (pre) {
      var wrap = document.createElement('div'); wrap.className = 'data-wrap';
      pre.parentNode.insertBefore(wrap, pre); wrap.appendChild(pre);
      var tools = document.createElement('div'); tools.className = 'data-tools';
      tools.innerHTML = '<button class="btn small" data-act="copy">Copy</button><button class="btn small" data-act="dec">Send to Decoder</button>' +
        (pre.dataset.freq ? '<button class="btn small" data-act="freq">Send to Frequency analysis</button>' : '');
      wrap.appendChild(tools);
      tools.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var text = pre.textContent;
        if (b.dataset.act === 'copy') { copyText(text); }
        if (b.dataset.act === 'dec') { if (current) CTFReturn.set('board', current.id, current.title); closeModal($('#chalModal')); show('toolkit'); Toolkit.open('decoder', text); }
        if (b.dataset.act === 'freq') { if (current) CTFReturn.set('board', current.id, current.title); closeModal($('#chalModal')); show('toolkit'); Toolkit.open('freq', text); }
      });
    });
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { toast('Copied'); }, fallback);
    else fallback();
    function fallback() { var t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); toast('Copied'); } catch (e) { } t.remove(); }
  }
  window.CTFCopy = copyText;

  function renderFiles(c) {
    var box = $('#chalFiles'); box.innerHTML = '';
    if (!c.files || !c.files.length) return;
    var wrap = document.createElement('div'); wrap.className = 'files';
    c.files.forEach(function (f, i) {
      var row = document.createElement('div'); row.className = 'file-row';
      var btns = '';
      if (f.kind === 'text') btns += '<button class="btn small" data-f="view">View</button>';
      if (f.kind === 'image') btns += '<button class="btn small" data-f="img">Open in Image inspector</button>';
      btns += '<button class="btn small" data-f="hex">Open in Hex viewer</button><button class="btn small" data-f="dl">Download</button>';
      row.innerHTML = '<span class="fname">📄 ' + esc(f.name) + '</span>' + btns;
      row.addEventListener('click', function (e) {
        var b = e.target.closest('button'); if (!b) return;
        var act = b.dataset.f;
        if (act === 'view') { showText(f.name, f.text); }
        if (act === 'dl') { if (f.url || f.enc) fileBlob(f).then(function (bl) { var a = document.createElement('a'); a.href = URL.createObjectURL(bl); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 60000); }, function () { toast('Couldn’t open that file — check the internet connection.'); }); else download(f.name, f.text, 'text/plain'); }
        if (act === 'hex') { CTFReturn.set('board', c.id, c.title); closeModal($('#chalModal')); show('toolkit'); Toolkit.open('hex', { file: f }); }
        if (act === 'img') { CTFReturn.set('board', c.id, c.title); closeModal($('#chalModal')); show('toolkit'); Toolkit.open('image', { file: f }); }
      });
      wrap.appendChild(row);
    });
    box.appendChild(wrap);
  }
  function showText(name, text) {
    $('#srcTitle').textContent = name;
    $('#srcCode').textContent = text;
    openModal('#srcModal');
  }

  function renderActions(c) {
    var old = document.getElementById('chalTutorial'); if (old) old.remove();
    var box = $('#chalActions'); box.innerHTML = '';
    var v = document.createElement('button'); v.className = 'btn';
    v.textContent = '</> View HTML of this challenge';
    v.title = 'Inspect Element is blocked on school PCs, so use this to see the raw HTML of the challenge text.';
    v.addEventListener('click', function () { showSource('View HTML: ' + c.title, c.desc); });
    box.appendChild(v);
    if (!assistOff()) {
      var t = document.createElement('button'); t.className = 'btn' + (S.tut && S.tut[c.id] ? ' tut-done' : '');
      t.textContent = (S.tut && S.tut[c.id]) ? '📘 How to complete this (used)' : '📘 How to complete this';
      t.title = 'A step-by-step tutorial of the method — without giving away the flag.';
      t.addEventListener('click', function () { toggleTutorial(c, t); });
      box.appendChild(t);
    }
  }
  function tutorialSteps(c) {
    var base = (c.tut && c.tut.length) ? c.tut.slice() : (c.hints || []).slice();
    var steps = ['Look at the challenge and work out what kind of puzzle it is — the <a href="#" data-goto="reference">Reference cheat sheet</a> helps if you are unsure.'];
    steps = steps.concat(base);
    steps.push('Follow those steps, then submit your flag. No need to peek at the answer — you can do this!');
    return steps;
  }
  function toggleTutorial(c, btn) {
    var box = document.getElementById('chalTutorial');
    if (box) { box.remove(); if (btn) btn.classList.remove('on'); return; }
    if (!S.tut) S.tut = {}; S.tut[c.id] = (S.tut[c.id] || 0) + 1; save(); renderBoard();
    box = document.createElement('div'); box.id = 'chalTutorial'; box.className = 'hint-box tutorial-box';
    box.innerHTML = '<div class="hint-warn" style="color:var(--cyan)">📘 How to complete this</div>' +
      '<ol class="walk">' + tutorialSteps(c).map(function (s) { return '<li>' + s + '</li>'; }).join('') + '</ol>' +
      '<p class="muted small">This teaches the method, not the answer — you still find the flag yourself. Want the full answer too? The walkthrough is below.</p>';
    $('#chalActions').after(box);
    if (btn) btn.classList.add('on');
    box.scrollIntoView({ block: 'nearest' });
  }

  function testLive() { return window.TestArea && TestArea.isLive && TestArea.isLive(); }
  // ---------- view mode: 'real' (no assistance, default) or 'tutorial' (full help) ----------
  var MODE_KEY = 'mbctf-mode', viewMode = 'real';
  try { var _m = localStorage.getItem(MODE_KEY); if (_m === 'tutorial' || _m === 'real') viewMode = _m; } catch (e) { }
  function assistOff() { return testLive() || viewMode === 'real' || !!(current && current.tier >= 6); }
  function updateModeUI() {
    $$('.mode-btn').forEach(function (b) { var on = b.dataset.mode === viewMode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
    var d = document.getElementById('modeDesc');
    if (d) d.textContent = viewMode === 'real'
      ? 'Like the day — no hints or walkthroughs. View HTML still works.'
      : 'Full help — hints, walkthroughs and the How-to-complete tutorial.';
    document.body.classList.toggle('mode-real', viewMode === 'real');
  }
  function setMode(m) {
    if (m !== 'real' && m !== 'tutorial') return;
    viewMode = m; try { localStorage.setItem(MODE_KEY, m); } catch (e) { }
    updateModeUI(); renderBoard();
    if (window.CTFCloseNav) window.CTFCloseNav();
    if (current && !$('#chalModal').hidden) { renderActions(current); renderHints(current); renderAnswer(current); }
  }
  $$('.mode-btn').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
  function renderHints(c) {
    var box = $('#chalHints'); box.innerHTML = '';
    if (testLive()) { box.innerHTML = '<div class="hint-box" style="border-color:var(--red)"><div class="hint-warn" style="color:var(--red)">🔒 Assistance is off during a test</div>Hints and walkthroughs are hidden while a test is running — just like the real event. They come back when the test ends.</div>'; return; }
    if (c.tier === 7) { box.innerHTML = '<div class="hint-box" style="border-color:var(--t7)"><div class="hint-warn" style="color:var(--t7)">🌌 Unreal</div>No hints, no tutorial, no walkthrough &mdash; and nobody will tell you what kind of puzzle this is. Several steps, probably a decoy or two. Take notes as you go.</div>'; return; }
    if (c.tier === 6) { box.innerHTML = '<div class="hint-box" style="border-color:var(--t6)"><div class="hint-warn" style="color:var(--t6)">🏆 Competition grade</div>No hints, tutorials or walkthroughs &mdash; just like the real event. Read everything carefully, work out what you have been given, and use the Toolkit. Your teacher has the answers if you are really stuck.</div>'; return; }
    if (viewMode === 'real') { box.innerHTML = '<div class="hint-box" style="border-color:var(--amber)"><div class="hint-warn">🎯 Real-event view</div>No hints or walkthroughs here — this is how the real competition feels. Switch to <b>Tutorial</b> view at the top of the board if you would like help.</div>'; return; }
    if (!c.hints || !c.hints.length) return;
    var used = S.hints[c.id] || 0;
    for (var i = 0; i < used && i < c.hints.length; i++) {
      var h = document.createElement('div'); h.className = 'hint-box';
      h.innerHTML = '<div class="hint-warn">💡 Hint ' + (i + 1) + ' of ' + c.hints.length + '</div>' + c.hints[i];
      box.appendChild(h);
    }
    if (used < c.hints.length) {
      var b = document.createElement('button'); b.className = 'btn small';
      b.textContent = used ? '💡 Show another hint' : '💡 Stuck? Take a hint (' + c.hints.length + ' available)';
      b.addEventListener('click', function () { S.hints[c.id] = used + 1; save(); renderHints(c); });
      box.appendChild(b);
      var note = document.createElement('div'); note.className = 'hint-reassure'; note.textContent = 'Using a hint is a smart move while you practise — that is exactly what they are here for.'; box.appendChild(note);
    } else {
      var done = document.createElement('div'); done.className = 'hint-reassure'; done.textContent = 'That is every hint for this one. Still stuck? The full walkthrough below will talk you through it.'; box.appendChild(done);
    }
  }

  var lastTry = {};
  // revealed answers this pupil has fetched (kept apart from progress files, so they're never passed around)
  function ansCache() { try { return JSON.parse(localStorage.getItem(ANS_STORE) || '{}'); } catch (e) { return {}; } }
  function getAnswer(c) {   // the walkthrough and flag come from the teacher's script (the reveal is recorded there)
    var have = ansCache()[c.id]; if (have) return Promise.resolve(have);
    if (!SYNC_URL) return Promise.reject(new Error('offline'));
    var lk = ''; try { lk = localStorage.getItem('mbctf-teacher-livekey-v1') || ''; } catch (e) { }
    var q = isTeacherDevice() && lk ? 'action=answer&key=' + encodeURIComponent(lk) : 'action=reveal&id=' + encodeURIComponent(S.pid);
    return api(q + '&cid=' + encodeURIComponent(c.id)).then(function (j) {
      if (!j || !j.ok) throw new Error((j && j.error) || 'offline');
      var a = { f: j.f, sol: j.sol || '', walk: j.walk || [] }, all = ansCache(); all[c.id] = a;
      try { localStorage.setItem(ANS_STORE, JSON.stringify(all)); } catch (e) { }
      return a;
    });
  }
  function reveal(c) {
    if (!S.solved[c.id] && !S.revealed[c.id] && !confirm('Show the full walkthrough? You will get 0 points for this challenge if you reveal it before solving it.')) return false;
    S.revealed[c.id] = S.revealed[c.id] || Date.now(); save(); renderAnswer(c);
    var box = document.getElementById('chalAnswer'); if (box) box.scrollIntoView({ block: 'nearest' });
    return true;
  }
  // Why a challenge quietly tells you how to solve it — the clue-reading skill, by category.
  var CLUES = {
    warmup: 'Warm-ups are deliberately one move long. The title plus a single technical word — <b>Base64</b>, <b>binary</b>, <b>reverse</b>, <b>ROT/Caesar</b> — names the exact tool you need. The whole skill here is learning to spot that one word and let it name the solution.',
    crypto: 'Crypto challenges nearly always reveal the <b>shape</b> of the data or name the cipher family on purpose. An <code>=</code> on the end whispers Base64; only 0s and 1s means binary; words that look <i>almost</i> right are a Caesar shift; the word "key" hints at XOR. The author plants that fingerprint so you can recognise it and reach for the matching decoder — not guess.',
    stego: 'A steganography task hands you a picture and tells you it "looks normal" or is "hiding something". That wording <i>is</i> the clue: nothing is wrong with the image you can see, so the message lives in the bytes — the metadata, the strings, or the lowest bit of each pixel. Work from the outside in.',
    programming: 'Programming puzzles describe a <b>rule</b> and then give you far more data than you could process by hand ("every tenth character", "add up the ones that…"). The giveaway is the scale: if doing it manually would be slow and error-prone, the challenge is telling you to write a short loop in C# to do it for you.',
    web: 'Web challenges point you at the browser — "the page checks the password", something is "hidden", "look closer at the site". Because your browser runs the page, everything it uses (HTML, comments, scripts, cookies) is visible to you through <b>View HTML</b>. The moment a challenge mentions the page <i>doing</i> something, that is the signpost to read its code.',
    forensics: 'Forensics tasks give you a file plus a contradiction — a <code>.txt</code> that will not open as text, a download that behaves oddly. That mismatch between the name and the behaviour is the clue: file names lie, the bytes do not. Check the real type by its <b>magic bytes</b> in the Hex viewer, and skim the strings for <code>flag{</code>.',
    osint: 'OSINT challenges ask a question about a real person, place or account and give you a public starting point (a username, a photo, a handle). The tell is that there is nothing to decode — the answer is already out in the open. The challenge is testing whether you can find and join up details people have made public.',
    reversing: 'Reverse-engineering tasks show you a process with input going in and a result coming out, then ask for the input that produces a target. The clue is <b>direction</b>: you are handed the forward steps on purpose, so the solution is to undo each one in reverse order.',
    networking: 'Networking challenges speak in packets, captures, ports and protocol names. That vocabulary is the signpost: the flag is somewhere inside the conversation between machines. Follow the stream or read the exact field the challenge names, rather than treating the data as one random blob.',
    safety: 'Online-safety questions are scenarios — a suspicious link, a reused password, an oversharing post. The clue is hidden in the <i>details</i> of the scenario: one specific thing is the risk. Solving it is spotting which detail would actually get someone caught out.',
    logic: 'Logic puzzles have nothing to decode — everything you need is in the question. The skill is <b>computational thinking</b>: break the problem into steps (decomposition), spot the rule or pattern, ignore the detail that does not matter (abstraction), and work it through carefully like a computer would. For traces and sequences, do it on paper step by step; for deduction, write down what <i>must</i> be true from each clue.'
  };
  function clueBlock(c) {
    var txt = CLUES[c.cat]; if (!txt) return '';
    return '<div class="clue-read"><div class="clue-head">🔍 Reading the clues — why this challenge pointed you here</div><p>' + txt + '</p></div>';
  }
  function renderAnswer(c) {
    var box = document.getElementById('chalAnswer');
    if (!box) { box = document.createElement('div'); box.id = 'chalAnswer'; box.className = 'hints'; $('#flagMsg').after(box); }
    box.innerHTML = '';
    if (assistOff()) return;
    var tries = (S.tries && S.tries[c.id]) || 0;
    if (S.revealed[c.id]) {
      var A = ansCache()[c.id];
      if (!A) {
        box.innerHTML = '<div class="hint-box answer-box"><div class="hint-warn">📖 Full walkthrough</div><p class="muted">Loading the walkthrough…</p></div>';
        getAnswer(c).then(function () { if (current && current.id === c.id) renderAnswer(c); }, function (err) {
          if (current && current.id === c.id) box.innerHTML = '<div class="hint-box answer-box"><div class="hint-warn">📖 Full walkthrough</div><p>' + (err.message === 'setup' ? 'Mr Butler is still setting up the answers — try again in a minute.' : 'Couldn’t load the walkthrough — check the internet connection and open the challenge again.') + '</p></div>';
        });
        return;
      }
      var mine = lastTry[c.id];
      var useWalk = A.walk && A.walk.length;
      var steps = (useWalk ? A.walk : (c.hints || [])).map(function (h) { return '<li>' + h + '</li>'; }).join('');
      box.innerHTML = '<div class="hint-box answer-box"><div class="hint-warn">📖 Full walkthrough</div>' +
        clueBlock(c) +
        (steps ? '<p><b>' + (useWalk ? 'Thinking it through:' : 'Step by step:') + '</b></p><ol class="walk">' + steps + '</ol>' : '') +
        (A.sol ? '<p><b>Why it works:</b> ' + A.sol + '</p>' : '') +
        '<p class="flag-reveal">The flag is <code>' + esc(A.f) + '</code></p>' +
        (mine ? '<p>Your last answer was <code>' + esc(mine) + '</code> ' + (mine.toLowerCase() === String(A.f).toLowerCase() ? '<span class="ok-tick">✓ that matches</span>' : '✗ which does not match') + '</p>' : '') +
        (S.solved[c.id] && !S.solved[c.id].r ? '' : '<p class="muted small">Revealed challenges score 0 points, but you can still submit the flag to tick it off.</p>') + '</div>';
      return;
    }
    // after 3 wrong tries, nudge a full walkthrough; otherwise a quieter button
    if (tries >= 3) {
      var n = document.createElement('div'); n.className = 'hint-box walk-nudge';
      n.innerHTML = '<div class="hint-warn">Stuck? That\'s okay.</div><p>You\'ve had a few goes at this one. Want a full step-by-step walkthrough?</p>';
      var wb = document.createElement('button'); wb.className = 'btn primary small'; wb.textContent = '📖 Walk me through it';
      wb.addEventListener('click', function () { reveal(c); });
      n.appendChild(wb); box.appendChild(n);
    } else {
      var b = document.createElement('button'); b.className = 'btn small'; b.textContent = '📖 Show full walkthrough';
      b.addEventListener('click', function () { reveal(c); });
      box.appendChild(b);
    }
  }

  $('#flagForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (typeof accessBlocked === 'function' && (accessBlocked() || needsSignIn())) { guard(); return; }
    var c = current; if (!c) return;
    var raw = $('#flagInput').value.trim(), msg = $('#flagMsg');
    if (!raw) return;
    lastTry[c.id] = raw;
    var sbtn = this.querySelector('button[type=submit]'); if (sbtn && sbtn.disabled) return;
    if (!SYNC_URL) { msg.className = 'flag-msg bad'; msg.textContent = 'Flags are checked by Mr Butler’s Google script, which isn’t connected.'; return; }
    if (sbtn) sbtn.disabled = true; msg.className = 'flag-msg'; msg.textContent = 'Checking…';
    api('action=submit&id=' + encodeURIComponent(S.pid) + '&cid=' + encodeURIComponent(c.id) + '&flag=' + encodeURIComponent(raw) + '&h=' + (S.hints[c.id] || 0)).then(function (j) {
      if (sbtn) sbtn.disabled = false;
      if (!j || !j.ok) {
        msg.className = 'flag-msg bad';
        msg.textContent = !j ? 'Couldn’t check that flag — try again.' : j.error === 'slow' ? 'That’s a lot of guesses! Wait a minute, then try again.' : (j.error === 'setup' || j.error === 'key') ? 'Mr Butler is still setting up the answers — try again in a minute.' : j.error === 'access' ? 'You need to be approved before your flags count.' : 'Couldn’t check that flag — try again.';
        if (j && j.error === 'access') checkAccess();
        return;
      }
      if (j.correct) flagRight(c, j.p, msg); else flagWrong(c, raw, !!j.close, msg);
    }, function () { if (sbtn) sbtn.disabled = false; msg.className = 'flag-msg bad'; msg.textContent = 'Couldn’t reach Mr Butler’s script to check that flag. Check the internet connection and try again.'; });
  });
  function flagRight(c, proof, msg) {
    {
      if (!S.solved[c.id]) {
        var rv = S.revealed[c.id] ? 1 : 0;
        var firstTry = !(S.tries && S.tries[c.id]);
        S.solved[c.id] = { t: Date.now(), p: proof, h: S.hints[c.id] || 0, r: rv };
        save();
        try { document.dispatchEvent(new CustomEvent('ctf:solve', { detail: { id: c.id, revealed: rv, firstTry: firstTry } })); } catch (e) { }
        var praise = ['Brilliant work', 'Nicely done', 'You got it', 'Spot on', 'Great solve', 'Well played'];
        var p = praise[Math.floor(Math.random() * praise.length)];
        msg.className = 'flag-msg ok'; msg.textContent = rv ? '✓ Correct! No points this time because you saw the answer first — but you learned the method, and that is what counts.' : '✓ ' + p + '! +' + c.pts + ' points.';
        toast(rv ? '✓ Correct — answer was revealed, 0 pts' : '🚩 ' + p + '! ' + c.title + ' (+' + c.pts + ')');
        milestone(c);
        if (!S.name) setTimeout(function () { if (confirm('Nice! Add your name so your teacher knows whose progress file this is?')) askName(); }, 600);
      } else { msg.className = 'flag-msg ok'; msg.textContent = '✓ Still correct — nice to see it stuck!'; }
      refreshHeader(); renderBoard(); openChalMeta(c); renderAnswer(c);
    }
  }
  function flagWrong(c, raw, close, msg) {
    S.wrong++; if (!S.tries) S.tries = {}; S.tries[c.id] = (S.tries[c.id] || 0) + 1; save();
    var tries = S.tries[c.id];
    msg.className = 'flag-msg bad';
    if (close) {
      msg.className = 'flag-msg info'; msg.textContent = 'So close — that is exactly right! Just wrap it as flag{...} and submit again.';
    } else if (!/^flag\{.*\}$/i.test(raw)) {
      msg.textContent = 'Not quite yet — flags here look like flag{something}. Keep going, you are on the right track.';
    } else {
      var enc = ['Not that one — but every wrong guess rules something out. Have another look.',
                 'Not yet. That is completely normal — take a hint if you would like a nudge.',
                 'Close the gap bit by bit. Try the Decoder or a hint if you are stuck.',
                 'Keep at it — the best solvers get plenty wrong before it clicks.'];
      msg.textContent = enc[Math.min(tries, enc.length) - 1] || enc[enc.length - 1];
    }
    renderAnswer(c);
    var f = $('#flagForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
  }
  function milestone(c) {
    var n = solvedCount();
    setTimeout(function () {
      if (n === 1) { toast('🎉 Your very first flag! This is how every CTF journey starts.'); return; }
      if (n === 10) { toast('🔟 Ten flags down — you are really getting the hang of this!'); return; }
      if (n === 25) { toast('⭐ 25 solved! You are building serious skills.'); return; }
      if (n === 50) { toast('🏅 Halfway-ish — 50 flags! Brilliant commitment.'); return; }
      if (n === 100) { toast('💯 One hundred flags! You are a force to be reckoned with.'); return; }
      var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
      var all = CH.filter(function (x) { return x.cat === c.cat; });
      if (all.every(function (x) { return S.solved[x.id]; })) toast('🏆 You cleared every ' + cat.name + ' challenge — amazing!');
    }, 1300);
  }
  function openChalMeta(c) {
    var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
    $('#chalMeta').innerHTML = '<span class="tag">' + cat.icon + ' ' + esc(cat.name) + '</span>' + kindTag(c) + '<span class="tag tier">' + TIERS[c.tier].name +
      '</span><span class="tag pts">' + c.pts + ' pts</span><span class="tag">' + esc(c.id) + '</span><span class="tag done">✓ solved</span>';
  }

  // ---------- progress ----------
  function renderProgress() {
    var sc = score(), n = solvedCount(), hintsUsed = Object.keys(S.hints).reduce(function (s, k) { return s + S.hints[k]; }, 0), revCount = Object.keys(S.revealed || {}).length, tutCount = Object.keys(S.tut || {}).filter(function (id) { return BY_ID[id]; }).length;
    var tierDone = [0, 0, 0, 0, 0, 0, 0, 0];
    Object.keys(S.solved).forEach(function (id) { if (BY_ID[id]) tierDone[BY_ID[id].tier]++; });
    var enc;
    if (n === 0) enc = 'Every expert started with zero flags. Head to the board and grab your first — the Warm-Up category is the perfect place to start.';
    else if (n < 10) enc = 'Great start' + (S.name ? ', ' + S.name : '') + '! You have ' + n + ' flag' + (n === 1 ? '' : 's') + ' already. Keep that momentum going.';
    else if (n < 50) enc = 'You are doing really well — ' + n + ' flags and climbing. Your pattern-spotting is getting sharper every session.';
    else if (n < CH.length) enc = 'Seriously impressive: ' + n + ' flags solved. You have turned into a proper flag hunter.';
    else enc = 'You solved every single challenge. Outstanding — you are ready for anything the event throws at you!';
    var banner = document.getElementById('progEnc');
    if (!banner) { banner = document.createElement('div'); banner.id = 'progEnc'; banner.className = 'callout good'; $('#statGrid').before(banner); }
    banner.innerHTML = enc;
    $('#statGrid').innerHTML =
      '<div class="stat"><b>' + sc + '</b><span>points of ' + TOTAL_PTS + '</span></div>' +
      '<div class="stat"><b>' + n + '</b><span>flags of ' + CH.length + '</span></div>' +
      '<div class="stat"><b>' + hintsUsed + '</b><span>hints used</span></div>' +
      '<div class="stat"><b>' + tutCount + '</b><span>tutorials used</span></div>' +
      '<div class="stat"><b>' + S.wrong + '</b><span>wrong guesses</span></div>' +
      '<div class="stat"><b>' + revCount + '</b><span>answers revealed</span></div>' +
      TIER_NUMS.map(function (t) {
        var tot = CH.filter(function (c) { return c.tier === t; }).length;
        return '<div class="stat ' + TIERS[t].cls + '"><b style="color:var(--tc)">' + tierDone[t] + '/' + tot + '</b><span>' + TIERS[t].name + '</span></div>';
      }).join('');
    $('#catBars').innerHTML = CATS.map(function (cat) {
      var all = CH.filter(function (c) { return c.cat === cat.id; }), d = all.filter(function (c) { return S.solved[c.id]; }).length;
      return '<div class="cat-bar"><span>' + cat.icon + ' ' + esc(cat.name) + '</span><div class="track"><div class="fill" style="width:' + (d / all.length * 100) + '%"></div></div><span class="num">' + d + '/' + all.length + '</span></div>';
    }).join('');
    var hist = Object.keys(S.solved).filter(function (id) { return BY_ID[id]; }).sort(function (a, b) { return S.solved[b].t - S.solved[a].t; });
    $('#history').innerHTML = hist.length ? hist.map(function (id) {
      var c = BY_ID[id];
      return '<div><span class="when">' + fmtDate(S.solved[id].t) + '</span><span>' + esc(c.title) + ' <span class="muted">(' + esc(c.id) + ', ' + c.pts + ' pts' + (S.solved[id].h ? ', ' + S.solved[id].h + ' hint' + (S.solved[id].h > 1 ? 's' : '') : '') + (S.solved[id].r ? ', answer revealed' : '') + ')</span></span></div>';
    }).join('') : '<p class="muted">No flags yet. Head to the board and start with the Warm-Up category.</p>';
    renderSaveStatus();
    try { document.dispatchEvent(new CustomEvent('ctf:progress')); } catch (e) { }
  }

  function makeExport() {
    var payload = { app: 'MrButlersCTF', v: 1, pid: S.pid, name: S.name, cls: S.cls || '', exported: Date.now(), score: score(), solved: S.solved, hints: S.hints, revealed: S.revealed, tries: S.tries, tut: S.tut, wrong: S.wrong, created: S.created };
    if (S.prevPids && S.prevPids.length) payload.prevPids = S.prevPids;
    var body = JSON.stringify(payload);
    return JSON.stringify({ data: payload, check: sha256(body + SALT) }, null, 1);
  }
  function parseImport(text) {
    var obj = JSON.parse(text);
    if (!obj || !obj.data || obj.data.app !== 'MrButlersCTF') throw new Error('This is not a Mr Butler\'s CTF progress file.');
    var ok = sha256(JSON.stringify(obj.data) + SALT) === obj.check;
    return { data: obj.data, ok: ok };
  }
  // ---------- "saved since" tracking, so we can nudge pupils before they log off ----------
  var SAVE_KEY = 'mbctf-saved-v1';
  function savedMark() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '{}'); } catch (e) { return {}; } }
  function markSaved() { try { localStorage.setItem(SAVE_KEY, JSON.stringify({ count: solvedCount(), at: Date.now() })); } catch (e) { } renderSaveBanner(); renderSaveStatus(); }
  function unsavedCount() { return Math.max(0, solvedCount() - (savedMark().count || 0)); }

  // merge a loaded progress payload into the current state (used by file load and resume code)
  function applyImport(d) {
    var added = 0;
    if (!Object.keys(S.solved).length) { S.pid = d.pid; }
    if (d.pid === S.pid) {
      Object.keys(d.solved || {}).forEach(function (id) { if (!S.solved[id]) { S.solved[id] = d.solved[id]; added++; } });
    } else {
      Object.keys(d.solved || {}).forEach(function (id) { if (!S.solved[id]) { S.solved[id] = { t: d.solved[id].t, p: '', h: d.solved[id].h || 0, r: d.solved[id].r || 0, m: 1 }; added++; } });
    }
    Object.keys(d.hints || {}).forEach(function (id) { S.hints[id] = Math.max(S.hints[id] || 0, d.hints[id]); });
    if (!S.tut) S.tut = {}; Object.keys(d.tut || {}).forEach(function (id) { S.tut[id] = Math.max(S.tut[id] || 0, d.tut[id]); });
    Object.keys(d.revealed || {}).forEach(function (id) { if (!S.revealed[id]) S.revealed[id] = d.revealed[id]; });
    if (!S.tries) S.tries = {}; Object.keys(d.tries || {}).forEach(function (id) { S.tries[id] = Math.max(S.tries[id] || 0, d.tries[id]); });
    S.wrong = Math.max(S.wrong, d.wrong || 0);
    if (!S.name && d.name) S.name = d.name;
    if (!S.cls && d.cls) S.cls = d.cls;
    save(); markSaved(); refreshHeader(); renderBoard(); renderProgress();
    try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (e) { }
    return added;
  }

  // ---------- live sync: send progress to the teacher's Google Sheet automatically ----------
  // Optional — switched on by setting syncUrl in assets/js/config.js. Sends the same signed
  // payload as the progress file, so the teacher view verifies it exactly like a file.
  var SYNC_URL = (window.CTF_CONFIG && window.CTF_CONFIG.syncUrl) || '';
  var syncTimer = null, syncState = { at: 0, ok: null };
  function isTeacherDevice() { try { return !!localStorage.getItem('mbctf-teacher-livekey-v1') || localStorage.getItem('mbctf-teacher-pc-v1') === '1'; } catch (e) { return false; } }
  function hasActivity() { return !isTeacherDevice() && !!S.name && !!S.cls && (!S.access || S.access === 'approved'); }
  function syncBody() {
    var obj = JSON.parse(makeExport());
    try { var t = window.TestArea && TestArea.liveSnapshot && TestArea.liveSnapshot(); if (t) obj.test = t; } catch (e) { }
    return JSON.stringify(obj);
  }
  function pushSync(leaving) {
    clearTimeout(syncTimer); syncTimer = null;
    if (!SYNC_URL || !hasActivity()) return;
    if (navigator.onLine === false) { syncState.ok = false; renderSyncStatus(); syncTimer = setTimeout(pushSync, 60000); return; }
    var body = syncBody();
    if (leaving && navigator.sendBeacon) {
      try { if (navigator.sendBeacon(SYNC_URL, new Blob([body], { type: 'text/plain' }))) return; } catch (e) { }
    }
    fetch(SYNC_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: body.length < 60000 })
      .then(function () { syncState = { at: Date.now(), ok: true }; renderSyncStatus(); })
      .catch(function () { syncState.ok = false; renderSyncStatus(); syncTimer = setTimeout(pushSync, 60000); });
  }
  // flags the teacher has marked completed for this pupil (Teacher tab › pupil › challenge › Mark completed)
  function fetchAwards() {
    if (!SYNC_URL || !hasActivity() || navigator.onLine === false) return;
    fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'action=myawards&id=' + encodeURIComponent(S.pid) + '&t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (!j || !j.ok || !j.awards) return;
        var a = j.awards, added = [], changed = false, moved = false;
        if (j.movedTo && /^[0-9a-f]{16}$/.test(j.movedTo) && j.movedTo !== S.pid) {   // the teacher merged this login into another
          adoptPid(j.movedTo); if (j.name) S.name = j.name; if (j.cls) S.cls = j.cls; S.pinOk = 1; moved = changed = true;
        }
        if (j.json) { try { var R = parseImport(j.json);
          if (R.ok && R.data.pid === S.pid) Object.keys(R.data.solved || {}).forEach(function (cid) { var o = R.data.solved[cid]; if (BY_ID[cid] && !o.a && (!S.solved[cid] || (S.solved[cid].r && !o.r))) { S.solved[cid] = o; changed = true; } });
        } catch (x) { } }
        Object.keys(a).forEach(function (cid) {
          if (!BY_ID[cid]) return; var s = S.solved[cid];
          if (!s || s.r) { S.solved[cid] = { t: a[cid], p: '', h: S.hints[cid] || 0, r: 0, a: 1 }; added.push(BY_ID[cid].title); changed = true; }
        });
        Object.keys(S.solved).forEach(function (cid) { if (S.solved[cid].a && !a[cid]) { delete S.solved[cid]; changed = true; } });
        if (!changed) return;
        save(); refreshHeader(); renderBoard(); renderProgress();
        try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (e) { }
        if (moved) toast('🔗 Your teacher joined your two logins together — you’re ' + S.name + ' (' + S.cls + ').', 5000);
        else if (added.length) toast('✅ Your teacher marked ' + (added.length === 1 ? '“' + added[0] + '”' : added.length + ' challenges') + ' as completed!', 5000);
      }).catch(function () { });
  }
  window.CTFFetchAwards = fetchAwards;
  function scheduleSync(ms) { if (!SYNC_URL) return; clearTimeout(syncTimer); syncTimer = setTimeout(pushSync, ms || 4000); }
  window.CTFSyncSoon = function () { scheduleSync(1500); };
  function renderSyncStatus() {
    var el = document.getElementById('syncStatus'); if (!el) return;
    if (!SYNC_URL) { el.hidden = true; return; }
    el.hidden = false;
    var who = S.name ? '' : ' <a href="#" id="syncNameLink">Add your name</a> so your teacher knows it\'s you.';
    if (syncState.ok === false) el.innerHTML = '⚠ Couldn\'t reach your teacher\'s sheet just now — your progress is still on this computer and will send again shortly.' + who;
    else if (syncState.at) el.innerHTML = '📡 Your teacher can see your progress — last sent ' + new Date(syncState.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '.' + who;
    else el.innerHTML = '📡 Your progress is sent to your teacher automatically as you solve.' + who;
    var a = document.getElementById('syncNameLink'); if (a) a.addEventListener('click', function (e) { e.preventDefault(); askName(); });
  }
  if (SYNC_URL) {
    setTimeout(pushSync, 3000);
    // heartbeat so the teacher sees who is on the site right now, even before their first solve
    setInterval(function () { if (!document.hidden && !syncTimer) pushSync(); if (!document.hidden) fetchAwards(); }, 3 * 60000);
    setTimeout(fetchAwards, 5000);
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden' && syncTimer) pushSync(true); });
    window.addEventListener('pagehide', function () { if (syncTimer) pushSync(true); });
    window.addEventListener('online', function () { if (syncState.ok === false) pushSync(); });
  }

  // ---------- pupil sign-in: first name + surname, form class and a 4-digit PIN (as on the Digital Technology site) ----------
  // Required before using the site (teacher PCs excepted). The teacher's Google script checks the PIN, registers new
  // pupils, and hands back an existing pupil's progress so it follows them to any PC.
  var WHO_LATER = 'mbctf-who-later';
  function whoDone() {
    var later = false; try { later = !!sessionStorage.getItem(WHO_LATER); } catch (e) { }
    return !!(S.name && S.cls && (S.pinOk || later || !SYNC_URL));
  }
  function adoptPid(newId) {   // this device joins an existing pupil: re-key this device's own solves to their ID
    var old = S.pid; if (!newId || newId === old) return;
    if (Object.keys(S.solved).length) S.prevPids = (S.prevPids || []).filter(function (x) { return x !== old; }).concat(old).slice(-10);
    S.pid = newId;
  }
  function askWho(editing) {
    if (document.getElementById('whoModal') || (isTeacherDevice() && !editing)) return;
    editing = !!editing && whoDone();
    var d = document.createElement('div'); d.id = 'whoModal'; d.className = 'who-modal';
    d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'whoH');
    d.innerHTML = '<form class="who-card" novalidate>' +
      '<div class="who-flag">⚑</div><h2 id="whoH">Who’s practising?</h2>' +
      '<p class="muted small">Enter your name, form class and a 4-digit PIN. Your progress is saved under your name, so it follows you to any computer, and your teacher can see how you’re getting on.</p>' +
      '<label class="field-label" for="whoN">First name and surname</label><input class="io" id="whoN" autocomplete="name" maxlength="40">' +
      '<label class="field-label" for="whoC">Form class</label><input class="io" id="whoC" maxlength="12" placeholder="e.g. 11B or 13D" autocomplete="off">' +
      '<label class="field-label" for="whoP">PIN</label><input class="io" id="whoP" type="password" inputmode="numeric" pattern="[0-9]*" maxlength="4" autocomplete="off" placeholder="4 digits">' +
      '<small class="muted">First time? Choose one you’ll remember. Use the same PIN on every computer.</small>' +
      '<div class="who-btns">' + (editing ? '<button type="button" class="btn" id="whoCancel">Cancel</button>' : '') + '<button class="btn primary" id="whoGo">Continue</button></div>' +
      '<p class="who-msg" aria-live="polite"></p>' +
      '<details class="who-load"' + (editing ? ' hidden' : '') + '><summary>📂 Started before? Load your progress file or resume code</summary>' +
      '<div class="who-load-body"><label class="btn small" for="whoFile">⬆ Choose progress file</label><input type="file" id="whoFile" accept=".json,application/json" hidden>' +
      '<textarea class="io" id="whoCode" rows="2" placeholder="…or paste your resume code" spellcheck="false"></textarea>' +
      '<button type="button" class="btn small" id="whoCodeGo">▶ Load resume code</button>' +
      '<p class="who-load-msg small" aria-live="polite"></p></div></details>' +
      '<button type="button" class="linkish who-teacher" id="whoTeacher">👩‍🏫 Teacher? Sign in here</button></form>';
    document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
    var n = $('#whoN', d), c = $('#whoC', d), pinI = $('#whoP', d), m = $('.who-msg', d), go = $('#whoGo', d);
    n.value = S.name || ''; c.value = S.cls || '';
    function close() { d.remove(); document.documentElement.style.overflow = ''; refreshHeader(); renderSyncStatus(); }
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); if (editing) close(); } }, true);
    var cancel = $('#whoCancel', d); if (cancel) cancel.addEventListener('click', close);
    $('#whoTeacher', d).addEventListener('click', function () { openTeacherSignIn(); });
    // bring in progress from before sign-in existed (a progress file or resume code), then sign in as normal
    var lm = $('.who-load-msg', d);
    function loaded(text) {
      var r; try { r = parseImport(text); } catch (x) { lm.className = 'who-load-msg small bad-text'; lm.textContent = x.message || 'That isn’t a Mr Butler’s CTF progress file.'; return; }
      if (!r.ok) { lm.className = 'who-load-msg small bad-text'; lm.textContent = 'This progress has been edited by hand, so it can’t be loaded.'; return; }
      if (solvedCount() && r.data.pid !== S.pid && !confirm('This computer already has some progress. Add the solves from this file to it?')) return;
      var added = applyImport(r.data), dn = String(r.data.name || '').replace(/\s+/g, ' ').trim();
      if (dn.split(' ').length >= 2 && !n.value.trim()) n.value = dn;
      if (r.data.cls && !c.value.trim()) c.value = r.data.cls;
      lm.className = 'who-load-msg small good-text';
      lm.textContent = '✓ Loaded ' + solvedCount() + ' solve' + (solvedCount() === 1 ? '' : 's') + (added ? ' (' + added + ' new)' : '') + '. Now check your name, add your form class and PIN, and press Continue.';
      setTimeout(function () { (!n.value.trim() ? n : !c.value.trim() ? c : pinI).focus(); }, 50);
    }
    $('#whoFile', d).addEventListener('change', function () {
      var f = this.files[0], inp = this; if (!f) return;
      f.text().then(function (t) { loaded(t); inp.value = ''; });
    });
    $('#whoCodeGo', d).addEventListener('click', function () {
      var code = $('#whoCode', d).value; if (!code.trim()) return;
      decodeResumeCode(code).then(loaded).catch(function (x) { lm.className = 'who-load-msg small bad-text'; lm.textContent = x.message; });
    });
    $('form', d).addEventListener('submit', function (e) {
      e.preventDefault();
      var name = n.value.replace(/\s+/g, ' ').trim(), cls = c.value.replace(/\s+/g, '').toUpperCase(), pin = pinI.value.trim();
      if (name.split(' ').length < 2) { m.textContent = 'Please enter your first name and surname.'; n.focus(); return; }
      if (!/^[A-Z0-9]{1,12}$/.test(cls)) { m.textContent = 'Please enter your form class, e.g. 11B.'; c.focus(); return; }
      if (!/^\d{4}$/.test(pin)) { m.textContent = 'Please enter a 4-digit PIN.'; pinI.focus(); return; }
      // switching to a different pupil on this computer: start them from a clean slate (the old pupil's work is already on the sheet)
      var other = !editing ? false : S.name && (S.name.toLowerCase() !== name.toLowerCase() || (S.cls && S.cls !== cls));
      if (other && solvedCount()) {
        if (!confirm('Switch to ' + name + ' (' + cls + ')?\n\n' + S.name + '’s progress stays saved for them. This computer will show ' + name + '’s progress instead.')) return;
        if (syncTimer) pushSync(true);
      }
      if (other) { S = blankState(); save(); }
      go.disabled = true; m.textContent = 'Checking…';
      function finish(found, offline) {
        if (found) { adoptPid(found.id); S.name = found.name || name; S.cls = found.cls || cls; S.pinOk = 1; S.access = found.status || 'approved'; }
        else { S.name = name; S.cls = cls; S.pinOk = 0; S.access = S.access || 'approved'; try { sessionStorage.setItem(WHO_LATER, '1'); } catch (x) { } }   // offline or an older script: let them practise; the sheet checks again later
        var added = 0;
        if (found && found.json) { try { var r = parseImport(found.json); if (r.ok && r.data.pid === S.pid) added = applyImport(r.data); } catch (x) { } }
        save(); refreshHeader(); renderBoard(); renderProgress();
        try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (x) { }
        close(); if (S.access !== 'approved') { wipeContent(); if (CONTENT_READY) { location.reload(); return; } showWaiting(); return; } pushSync(); setTimeout(fetchAwards, 1500); if (found) ensureContent();
        toast(found && !found.fresh ? '👋 Welcome back, ' + S.name.split(' ')[0] + '!' + (added ? ' ' + added + ' solve' + (added === 1 ? '' : 's') + ' loaded from your other computer.' : '') : '👋 Hi ' + S.name.split(' ')[0] + ' — you’re signed in.', 4000);
        void offline;
      }
      if (!SYNC_URL) return finish(null, true);
      function call(retry) {
        var ctl = window.AbortController ? new AbortController() : null, t = ctl && setTimeout(function () { ctl.abort(); }, 9000);
        fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'action=whois&name=' + encodeURIComponent(name) + '&cls=' + encodeURIComponent(cls) + '&pin=' + pin + '&id=' + encodeURIComponent(S.pid) + '&t=' + Date.now(),
          { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined })
          .then(function (x) { return x.json(); }).then(function (j) {
            if (t) clearTimeout(t);
            if (j && j.error === 'pin') { go.disabled = false; pinI.value = ''; pinI.focus(); m.textContent = 'That PIN doesn’t match the one for ' + name + '.' + (j.left != null ? ' ' + j.left + ' ' + (j.left === 1 ? 'try' : 'tries') + ' left.' : '') + ' Forgotten it? Ask your teacher to reset it.'; return; }
            if (j && j.error === 'locked') { go.disabled = false; m.textContent = 'Too many wrong PINs. Try again in 15 minutes, or ask your teacher to reset your PIN.'; return; }
            if (j && j.error === 'removed' && retry) { S.pid = randId(); return call(false); }
            if (j && j.ok && j.id) return finish(j, false);
            finish(null, true);   // older teacher script, or it said no: carry on, the PIN is checked next time
          }).catch(function () { if (t) clearTimeout(t); finish(null, true); });   // offline or slow: carry on for now
      }
      call(true);
    });
    setTimeout(function () { (S.name ? (S.cls ? pinI : c) : n).focus(); }, 60);
  }
  window.CTFWho = askWho;
  if (accessBlocked()) { lockdown(true); setTimeout(showWaiting, 0); }
  setTimeout(function () { if (!isTeacherDevice() && !whoDone()) askWho(false); else if (!isTeacherDevice() && S.name) checkAccess(); }, 400);

  // ---------- unlocking the challenges ----------
  function api(qs) {
    return fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + qs + '&t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.json(); });
  }
  window.CTFApi = function (qs) { return SYNC_URL ? api(qs) : Promise.reject(new Error('nosync')); };
  function keyBytes(k) { return Uint8Array.from(atob(k), function (ch) { return ch.charCodeAt(0); }); }
  function ckDecrypt(buf, k) {
    var b = new Uint8Array(buf);
    return crypto.subtle.importKey('raw', keyBytes(k), 'AES-GCM', false, ['decrypt']).then(function (key) {
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.slice(0, 12) }, key, b.slice(12));
    });
  }
  function fileBlob(f) {   // challenge files are encrypted too; decrypt on demand
    if (!f.enc) return f.url ? fetch(f.url).then(function (r) { return r.blob(); }) : Promise.resolve(new Blob([f.text || ''], { type: 'text/plain' }));
    var k = ''; try { k = localStorage.getItem(CKEY_STORE) || ''; } catch (e) { }
    return fetch(f.enc).then(function (r) { if (!r.ok) throw new Error('fetch'); return r.arrayBuffer(); }).then(function (b) { return ckDecrypt(b, k); })
      .then(function (pt) { return new Blob([pt], { type: f.mime || 'application/octet-stream' }); });
  }
  window.CTF.fileBlob = fileBlob;
  var contentBusy = false, contentRetry = null;
  function setContentState(st) { CONTENT_STATE = st; if (!CONTENT_READY) { var b = $('#board'); if (b) b.innerHTML = contentNote(); } }
  function ensureContent(givenKey) {
    if (CONTENT_READY || contentBusy || !META.url) return;
    if (!givenKey && !isTeacherDevice() && (accessBlocked() || needsSignIn() || !S.name)) return;
    if (!(window.crypto && crypto.subtle)) { setContentState('storage'); return; }
    contentBusy = true; setContentState('loading');
    var stored = ''; try { stored = localStorage.getItem(CKEY_STORE) || ''; } catch (e) { }
    var lk = ''; try { lk = localStorage.getItem('mbctf-teacher-livekey-v1') || ''; } catch (e) { }
    var getKey = givenKey ? Promise.resolve(givenKey) : stored ? Promise.resolve(stored) : !SYNC_URL ? Promise.reject(new Error('offline')) :
      api('action=ckey&' + (isTeacherDevice() && lk ? 'key=' + encodeURIComponent(lk) : 'id=' + encodeURIComponent(S.pid))).then(function (j) {
        if (j && j.ok && j.k) return j.k; throw new Error(j && j.ok ? 'setup' : ((j && j.error) || 'offline'));
      });
    getKey.then(function (k) {
      return fetch(META.url).then(function (r) { if (!r.ok) throw new Error('offline'); return r.arrayBuffer(); })
        .then(function (b) { return ckDecrypt(b, k); })
        .then(function (pt) {
          var data = JSON.parse(new TextDecoder().decode(pt));
          try { localStorage.setItem(CKEY_STORE, k); localStorage.setItem(CONTENT_STORE, JSON.stringify({ ver: META.ver, data: data })); } catch (e) { }
          var back = null; try { back = JSON.parse(localStorage.getItem(CONTENT_STORE) || 'null'); } catch (e) { }
          if (!back || back.ver !== META.ver) throw new Error('storage');
          location.reload();
        }, function (err) {
          if (err && /^(offline|storage)$/.test(err.message)) throw err;
          try { localStorage.removeItem(CKEY_STORE); } catch (e) { }   // wrong / old key: ask the script next time
          throw new Error(k === stored ? 'retry' : 'setup');
        });
    }).catch(function (err) {
      contentBusy = false;
      var m = (err && err.message) || 'offline'; if (m === 'key') m = 'setup';   // an older script without the answers
      if (m === 'retry') return ensureContent();
      setContentState(/^(setup|access|storage)$/.test(m) ? m : 'offline');
      if (m === 'access') checkAccess();
      clearTimeout(contentRetry); if (m !== 'storage') contentRetry = setTimeout(function () { if (!document.hidden) ensureContent(); else contentRetry = setTimeout(ensureContent, 30000); }, m === 'setup' ? 30000 : 20000);
    });
  }
  document.addEventListener('click', function (e) {
    if (!e.target.closest || !e.target.closest('[data-unlock]')) return;
    var pw = prompt('Teacher password:'); if (!pw) return;
    openVault(pw).then(function (d) { try { sessionStorage.setItem(STAFF_SS, pw); } catch (x) { } useVault(d, pw); }, function () { alert('That password isn’t right.'); });
  });
  setTimeout(function () { if (!CONTENT_READY && (isTeacherDevice() || (!accessBlocked() && !needsSignIn() && S.name))) ensureContent(); }, 600);

  // ---------- access approval: new pupils wait until a teacher lets them in ----------
  var waitTimer = null;
  function checkAccess(cb) {
    if (!SYNC_URL || isTeacherDevice()) return;
    fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'action=access&id=' + encodeURIComponent(S.pid) + '&t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.json(); }).then(function (j) {
        // only pending / declined block; anything else (approved, an older script, offline) lets them in, so nobody is locked out by a fault
        var st = j && j.ok && /^(pending|declined|unknown)$/.test(j.status || '') ? j.status : 'approved';
        if (st === 'unknown') {   // not registered (e.g. deleted by the teacher): sign in again
          S.pinOk = false; S.access = ''; save(); wipeContent();
          if (CONTENT_READY) { location.reload(); return; }
          askWho(false); if (cb) cb(st); return;
        }
        var was = S.access; S.access = st; if (was !== st) save();
        if (st !== 'approved') { wipeContent(); if (CONTENT_READY) { location.reload(); return; } }
        else ensureContent();
        if (st === 'approved') { lockdown(false); var w = document.getElementById('waitModal'); if (w) { w.remove(); document.documentElement.style.overflow = ''; clearInterval(waitTimer); toast('🎉 You’re in! Your teacher has approved you.', 4500); pushSync(); fetchAwards(); } }
        else showWaiting();
        if (cb) cb(st);
      }).catch(function () { });
  }
  // ---------- lockdown: while a pupil is waiting (or declined, or not signed in) the site stays hidden ----------
  // Removing or hiding the waiting / sign-in box only brings it straight back, and the page behind it is hidden too.
  // (The real protection is on the teacher's sheet: nothing from an unapproved pupil is saved or counted.)
  function accessBlocked() { return !isTeacherDevice() && /^(pending|declined)$/.test(S.access || ''); }
  function needsSignIn() { return !!SYNC_URL && !isTeacherDevice() && !whoDone(); }
  function lockdown(on) { document.documentElement.classList.toggle('mb-locked', !!on); }
  function fixBox(el) {   // only touch what has actually been tampered with, so the guard never triggers itself
    if (el.hasAttribute('hidden')) el.removeAttribute('hidden');
    if (el.hasAttribute('style')) el.removeAttribute('style');
    if (el.className !== 'who-modal') el.className = 'who-modal';
  }
  var guardBusy = false;
  function guard() {
    if (guardBusy) return; guardBusy = true;
    try {
      var tm = document.getElementById('teacherModal'), teacherOpen = tm && !tm.hidden;
      if (accessBlocked()) {
        lockdown(true);
        var w = document.getElementById('waitModal');
        if (!w || !document.body.contains(w)) showWaiting();
        else { fixBox(w); if (!w.querySelector('.wait-card')) showWaiting(true); }
      } else if (needsSignIn()) {
        lockdown(true);
        var s = document.getElementById('whoModal');
        if (!s && !teacherOpen) askWho(false);
        else if (s) fixBox(s);
      } else lockdown(false);
    } finally { guardBusy = false; }
  }
  new MutationObserver(function () { guard(); }).observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden'] });
  setInterval(guard, 1500);
  function showWaiting(redraw) {
    var d = document.getElementById('waitModal'), declined = S.access === 'declined';
    lockdown(true);
    if (!d) {
      d = document.createElement('div'); d.id = 'waitModal'; d.className = 'who-modal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
      document.body.appendChild(d); document.documentElement.style.overflow = 'hidden';
      d.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); } }, true);
    }
    clearInterval(waitTimer); if (!declined) waitTimer = setInterval(function () { if (!document.getElementById('waitModal')) return clearInterval(waitTimer); if (!document.hidden) checkAccess(); }, 20000);
    d.innerHTML = '<div class="who-card wait-card"><div class="who-flag">' + (declined ? '⛔' : '⏳') + '</div>' +
      '<h2>' + (declined ? 'Access not approved' : 'Waiting for approval') + '</h2>' +
      '<p>' + (declined ? 'Mr Butler hasn’t approved access for ' + esc(S.name || 'this name') + (S.cls ? ' (' + esc(S.cls) + ')' : '') + '. If you think this is a mistake, speak to him.'
        : 'Thanks, ' + esc((S.name || '').split(' ')[0] || 'you') + '! Mr Butler needs to approve you before you can use Mr Butler’s CTF. This page opens by itself as soon as he does.') + '</p>' +
      '<div class="who-btns"><button type="button" class="btn" id="waitOther">Sign out</button>' + (declined ? '' : '<button type="button" class="btn primary" id="waitCheck">Check again</button>') + '</div>' +
      '<p class="who-msg" aria-live="polite"></p>' +
      '<button type="button" class="linkish who-teacher" id="waitTeacher">👩‍🏫 Teacher? Sign in here</button></div>';
    var wc = d.querySelector('#waitCheck');
    if (wc) wc.addEventListener('click', function () { var b = this, m = d.querySelector('.who-msg'); b.disabled = true; m.textContent = 'Checking…';
      checkAccess(function (st) { b.disabled = false; if (document.getElementById('waitModal')) m.textContent = st === 'pending' ? 'Not approved yet — this page will open by itself when it is.' : ''; }); });
    d.querySelector('#waitOther').addEventListener('click', function () {
      clearInterval(waitTimer); S = blankState(); save(); wipeContent(); d.remove(); document.documentElement.style.overflow = '';
      S = blankState(); save(); refreshHeader(); renderBoard(); renderProgress(); askWho(false);
    });
    d.querySelector('#waitTeacher').addEventListener('click', function () { openTeacherSignIn(); });
  }

  // ---------- pupils' leaderboard (scores checked by the teacher's Google script) ----------
  var LB = { rows: null, at: 0, cls: null, timer: null, busy: false };
  function myTag() { return sha256('board|' + S.pid).slice(0, 10); }
  function loadBoard(show) {
    if (!SYNC_URL) { $('#lbpInfo').textContent = 'The leaderboard needs your teacher’s live class sheet, which isn’t set up on this site.'; return; }
    if (LB.busy) return; LB.busy = true;
    if (show && !LB.rows) $('#lbpInfo').textContent = 'Loading…';
    fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'action=board&t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.text(); }).then(function (txt) {
        LB.busy = false; var j = null; try { j = JSON.parse(txt); } catch (e) { }
        var teacher = isTeacherDevice();
        if (!j) { $('#lbpInfo').textContent = 'The leaderboard isn’t working yet.' + (teacher ? ' Teacher: the Google script needs permission — in Apps Script choose the “authorise” function and press Run once (see SETUP step 5).' : ' Your teacher has been told.'); teacherBoard('pupils can’t see it until the script has permission (run “authorise” once)'); return; }
        if (!j.ok) { $('#lbpInfo').textContent = j.error === 'off' ? 'Your teacher has turned the leaderboard off for now.' : j.error === 'script' ? 'The leaderboard hit a problem.' + (teacher ? ' Script said: ' + (j.detail || '') : '') : 'The leaderboard isn’t switched on yet — your teacher needs to update the class sheet.'; $('#lbpTable').innerHTML = ''; teacherBoard(j.error === 'off' ? 'hidden from pupils (BOARD_PUBLIC = false)' : j.error === 'script' ? 'script error: ' + (j.detail || '') : 'pupils need the updated script'); return; }
        LB.rows = j.rows || []; LB.at = j.at || Date.now(); renderLb();
      }).catch(function () { LB.busy = false; $('#lbpInfo').textContent = 'Couldn’t reach the leaderboard just now. It will try again shortly.'; teacherBoard('pupils can’t see it yet: the Google script returned an error. Usually that means it needs permission — in Apps Script run the “authorise” function once, then deploy a new version'); });
    clearTimeout(LB.timer);
    LB.timer = setTimeout(function () { if (document.getElementById('view-leaderboard').classList.contains('active') && !document.hidden) loadBoard(); }, 30000);
  }
  function teacherBoard(note) {
    if (!(isTeacherDevice() && LIVE.key && SYNC_URL)) return false;
    fetch(liveUrl(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) return;
      T.awards = res.awards || T.awards || {}; T.aliasOf = {}; var AL = res.aliases || {};
      Object.keys(AL).forEach(function (old) { var k = AL[old], n = 0; while (AL[k] && n++ < 20) k = AL[k]; (T.aliasOf[k] = T.aliasOf[k] || []).push(old); });
      var rows = [];
      (res.rows || []).forEach(function (x) {
        try { var r = parseImport(x.json); r.seen = x.seen; injectAwards(r.data); var st = rowStats(r), nm = st.name.trim().split(/\s+/);
          rows.push({ n: nm[0] + (nm.length > 1 ? ' ' + nm[nm.length - 1].charAt(0) + '.' : ''), c: st.cls, p: st.pts, f: st.n, t: st.last, k: sha256('board|' + r.data.pid).slice(0, 10) }); } catch (e) { }
      });
      rows.sort(function (a, b) { return (b.p - a.p) || (a.t - b.t); });
      LB.rows = rows; LB.at = Date.now(); renderLb();
      $('#lbpInfo').textContent += ' · teacher preview from your live data' + (note ? ' — ' + note : '');
    }).catch(function () { });
    return true;
  }
  function renderLb() {
    var rows = LB.rows || [], me = myTag(), mine = rows.filter(function (r) { return r.k === me; })[0];
    var classes = rows.map(function (r) { return r.c; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }).sort();
    if (LB.cls === null) LB.cls = '';
    var sel = $('#lbpClass');
    sel.innerHTML = '<option value="">Everyone (' + rows.length + ')</option>' + classes.map(function (c) { return '<option value="' + esc(c) + '"' + (LB.cls === c ? ' selected' : '') + '>' + esc(c) + (mine && mine.c === c ? ' (my class)' : '') + '</option>'; }).join('');
    var list = LB.cls ? rows.filter(function (r) { return r.c === LB.cls; }) : rows;
    var rank = 0, prev = null;
    list = list.map(function (r, i) { if (!prev || r.p !== prev.p) rank = i + 1; prev = r; return Object.assign({ rank: rank }, r); });
    var meRow = list.filter(function (r) { return r.k === me; })[0];
    $('#lbpInfo').textContent = list.length + ' pupil' + (list.length === 1 ? '' : 's') + (LB.cls ? ' in ' + LB.cls : '') + ' · updated ' + new Date(LB.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    $('#lbpMe').innerHTML = meRow ? '<div class="lbp-me">You are <b>#' + meRow.rank + '</b> of ' + list.length + ' with <b>' + meRow.p + '</b> points' + (meRow.rank > 1 ? ' — <b>' + (list[meRow.rank - 2] ? list.filter(function (x) { return x.rank < meRow.rank; }).slice(-1)[0].p - meRow.p : 0) + '</b> behind the next place up.' : '. Top of the table! 🎉') + '</div>'
      : (S.name ? '<div class="lbp-me muted">Solve a flag and you’ll appear here within a minute or two.</div>' : '');
    var top = list.slice(0, 50);
    if (meRow && meRow.rank > 50) top.push(meRow);
    $('#lbpTable').innerHTML = list.length ? '<table class="lb lbp"><thead><tr><th>#</th><th>Name</th><th>Class</th><th>Points</th><th>Flags</th></tr></thead><tbody>' + top.map(function (r) {
      var medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : r.rank;
      return '<tr class="' + (r.k === me ? 'lbp-mine' : '') + '"><td class="num">' + medal + '</td><td>' + esc(r.n) + (r.k === me ? ' <span class="badge good">you</span>' : '') + '</td><td>' + esc(r.c || '–') + '</td><td class="num">' + r.p + '</td><td class="num">' + r.f + '</td></tr>';
    }).join('') + '</tbody></table>' + (list.length > 50 ? '<p class="muted small">Showing the top 50.</p>' : '') : '<p class="muted">Nobody has scored yet. Be the first!</p>';
  }
  $('#lbpClass').addEventListener('change', function () { LB.cls = this.value; renderLb(); });
  $('#lbpRefresh').addEventListener('click', function () { loadBoard(true); });
  document.addEventListener('visibilitychange', function () { if (!document.hidden && document.getElementById('view-leaderboard').classList.contains('active')) loadBoard(); });

  // ---------- resume code: the same signed progress data as the file, as copy-paste text ----------
  function b64uEnc(bytes) { var s = ''; for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function b64uDec(str) { str = str.replace(/-/g, '+').replace(/_/g, '/'); while (str.length % 4) str += '='; var bin = atob(str), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }
  function gzip(str) { var cs = new CompressionStream('gzip'); return new Response(new Blob([str]).stream().pipeThrough(cs)).arrayBuffer().then(function (buf) { return new Uint8Array(buf); }); }
  function gunzip(bytes) { var ds = new DecompressionStream('gzip'); return new Response(new Blob([bytes]).stream().pipeThrough(ds)).text(); }
  function makeResumeCode() {
    var json = makeExport();
    if (window.CompressionStream) {
      return gzip(json).then(function (bytes) { return 'C1~' + b64uEnc(bytes); }).catch(function () { return 'R1~' + b64uEnc(new TextEncoder().encode(json)); });
    }
    return Promise.resolve('R1~' + b64uEnc(new TextEncoder().encode(json)));
  }
  function decodeResumeCode(code) {
    code = (code || '').trim().replace(/\s+/g, '');
    var i = code.indexOf('~'), tag = i > 0 ? code.slice(0, i) : '', body = i > 0 ? code.slice(i + 1) : code;
    var bytes;
    try { bytes = b64uDec(body); } catch (e) { return Promise.reject(new Error('That does not look like a resume code. Check you copied all of it.')); }
    if (tag.charAt(0) === 'C') {
      if (!window.DecompressionStream) return Promise.reject(new Error('This code needs a newer browser to open. Load your progress file instead.'));
      return gunzip(bytes);
    }
    return Promise.resolve(new TextDecoder().decode(bytes));
  }
  function importMsg(cls, text) { var m = $('#importMsg'); if (!m) return; m.hidden = false; m.className = 'notice ' + cls; m.textContent = text; }
  function loadPayload(d, ok) {
    if (!ok) throw new Error('This progress has been edited by hand, so it can\'t be loaded.');
    if (Object.keys(S.solved).length && d.pid !== S.pid && !confirm('This progress belongs to "' + (d.name || 'unnamed') + '". Merge their solves into the progress on this computer?')) return null;
    return applyImport(d);
  }
  $('#exportBtn').addEventListener('click', function () {
    if (!S.name) askName();
    var name = (S.name || 'player').replace(/[^\w-]+/g, '_');
    var d = new Date(), stamp = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    download('MrButlersCTF-' + name + '-' + stamp + '.json', makeExport());
    markSaved(); toast('Progress file downloaded — keep it safe for next time');
  });
  $('#importFile').addEventListener('change', function () {
    var file = this.files[0]; if (!file) return; var input = this;
    file.text().then(function (text) {
      var r = parseImport(text); var added = loadPayload(r.data, r.ok);
      if (added === null) return;
      importMsg('good', 'Loaded from your file. ' + added + ' new solve' + (added === 1 ? '' : 's') + ' added. Welcome back' + (S.name ? ', ' + S.name : '') + '!');
    }).catch(function (err) { importMsg('bad', err.message || 'Could not read that file.'); }).then(function () { input.value = ''; });
  });
  // resume code: copy mine
  var mcb = $('#makeCodeBtn');
  if (mcb) mcb.addEventListener('click', function () {
    if (!solvedCount()) { importMsg('bad', 'Solve at least one challenge first, then you\'ll have something to save.'); return; }
    if (!S.name) askName();
    makeResumeCode().then(function (code) {
      var out = $('#resumeOut'); out.hidden = false; out.value = code;
      out.focus(); out.select();
      var done = function () { markSaved(); toast('Resume code copied — paste it somewhere safe for next time'); importMsg('good', 'Here is your resume code. It\'s copied to your clipboard — paste it into OneNote, a note, or an email, and bring it back next time.'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, function () { try { document.execCommand('copy'); } catch (e) { } done(); });
      else { try { document.execCommand('copy'); } catch (e) { } done(); }
    });
  });
  // resume code: continue from one
  var lcb = $('#loadCodeBtn');
  if (lcb) lcb.addEventListener('click', function () {
    var code = ($('#resumeIn') || {}).value || '';
    if (!code.trim()) { importMsg('bad', 'Paste your resume code into the box first.'); return; }
    decodeResumeCode(code).then(function (json) {
      var r = parseImport(json); var added = loadPayload(r.data, r.ok);
      if (added === null) return;
      $('#resumeIn').value = '';
      importMsg('good', 'Welcome back' + (S.name ? ', ' + S.name : '') + '! Restored from your resume code — ' + added + ' new solve' + (added === 1 ? '' : 's') + ' added.');
    }).catch(function (err) { importMsg('bad', err.message || 'That resume code could not be read. Check you copied all of it.'); });
  });

  // ---------- save status + banners (so nobody loses their work on a wiped school PC) ----------
  function renderSaveStatus() {
    renderSyncStatus();
    var el = document.getElementById('saveStatus'); if (!el) return;
    var n = solvedCount(), u = unsavedCount();
    if (!n) { el.hidden = true; return; }
    el.hidden = false;
    if (u > 0) { el.className = 'save-status warn'; el.innerHTML = '⚠ You have <b>' + u + '</b> new solve' + (u === 1 ? '' : 's') + ' that aren\'t saved for next time yet. Copy your resume code or download your file below.'; }
    else { el.className = 'save-status ok'; el.innerHTML = '✓ All your progress is saved. Keep your resume code or file safe and you can carry on next time.'; }
  }
  function renderSaveBanner() {
    var el = document.getElementById('saveBanner'); if (!el) return;
    var u = unsavedCount();
    if (u < 3 || (window.TestArea && TestArea.isLive && TestArea.isLive())) { el.hidden = true; return; }
    el.hidden = false; el.className = 'notice-banner save';
    el.innerHTML = '<span>💾 You\'ve solved <b>' + u + '</b> flags since you last saved. Don\'t lose them when you log off!</span>' +
      '<span class="nb-btns"><button class="btn small primary" data-goto="progress">Save my progress →</button></span>';
  }
  var resumeDismissed = false;
  function renderResumeBanner() {
    var el = document.getElementById('resumeBanner'); if (!el) return;
    if (resumeDismissed || solvedCount() > 0) { el.hidden = true; return; }
    el.hidden = false; el.className = 'notice-banner resume';
    el.innerHTML = '<span>👋 Been here before? Your work may have been cleared when you logged off. Load your <b>resume code</b> or <b>file</b> to carry on.</span>' +
      '<span class="nb-btns"><button class="btn small primary" data-goto="progress">Continue →</button><button class="btn small nb-x" id="resumeBannerX" aria-label="Dismiss">✕</button></span>';
    var x = document.getElementById('resumeBannerX');
    if (x) x.addEventListener('click', function (e) { e.stopPropagation(); resumeDismissed = true; el.hidden = true; });
  }
  function renderBanners() { renderSaveBanner(); renderResumeBanner(); }

  // gentle one-time nudge once a pupil has some solves this session
  var sessSolves = 0, nudged = false;
  document.addEventListener('ctf:solve', function () {
    sessSolves++;
    renderBanners(); renderSaveStatus();
    if (!nudged && sessSolves >= 3 && unsavedCount() >= 3) {
      nudged = true;
      setTimeout(function () { toast('💾 Nice progress! Remember to save it (My progress) before you log off, so you can carry on next time.', 4200); }, 2000);
    }
  });
  document.addEventListener('ctf:refresh', function () { renderBanners(); renderSaveStatus(); });
  $('#resetBtn').addEventListener('click', function () {
    if (!confirm('Delete ALL progress on this computer? Download a progress file first if you want to keep it.')) return;
    S = blankState(); save(); try { localStorage.removeItem(SAVE_KEY); } catch (e) { } resumeDismissed = true;
    refreshHeader(); renderBoard(); renderProgress(); toast('Progress reset');
    if (!isTeacherDevice()) setTimeout(function () { askWho(false); }, 300);
    try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (e) { }
  });

  // ---------- teacher ----------
  var T = { rows: [], key: {}, sort: 'pts', ans: {} };   // key / ans are filled from the answer book on teacher PCs
  $('#teacherFiles').addEventListener('change', function () {
    var files = Array.prototype.slice.call(this.files), input = this;
    Promise.all(files.map(function (f) { return f.text().then(function (t) { try { var r = parseImport(t); r.file = f.name; return r; } catch (e) { return { err: f.name }; } }); }))
      .then(function (res) {
        var bad = [];
        res.forEach(function (r) {
          if (r.err) { bad.push(r.err); return; }
          T.rows = T.rows.filter(function (x) { return x.data.pid !== r.data.pid || x.data.exported > r.data.exported; });
          if (!T.rows.some(function (x) { return x.data.pid === r.data.pid; })) T.rows.push(r);
        });
        var m = $('#teacherMsg'); m.hidden = false;
        m.className = 'notice ' + (bad.length ? 'bad' : 'good');
        m.textContent = 'Loaded ' + (res.length - bad.length) + ' file(s).' + (bad.length ? ' Could not read: ' + bad.join(', ') : '');
        renderTeacher(); input.value = '';
      });
  });
  $('#teacherClass').addEventListener('change', function () { T.cls = this.value; T.sel = null; renderTeacher(); });
  $('#teacherClear').addEventListener('click', function () { T.rows = []; T.sel = null; renderTeacher(); $('#teacherMsg').hidden = true; });
  function rowStats(r) {
    var d = r.data, pts = 0, n = 0, unv = 0, tiers = [0, 0, 0, 0, 0, 0, 0, 0], last = 0;
    Object.keys(d.solved || {}).forEach(function (id) {
      var c = BY_ID[id]; if (!c) return;
      var s = d.solved[id], valid = true;
      if (T.key && T.key[id]) valid = isAwarded(d.pid, id) || proofOk(d.pid, id, s.p);
      if (!valid) { unv++; return; }
      if (!s.r) pts += c.pts; n++; tiers[c.tier]++; last = Math.max(last, s.t);
    });
    var hints = Object.keys(d.hints || {}).reduce(function (s, k) { return s + d.hints[k]; }, 0), rev = Object.keys(d.revealed || {}).length;
    var tutIds = Object.keys(d.tut || {}).filter(function (id) { return BY_ID[id]; });
    return { name: d.name || '(no name)', pts: pts, n: n, unv: unv, rev: rev, tiers: tiers, hints: hints, tut: tutIds.length, tutIds: tutIds, last: last, ok: r.ok, file: r.file, seen: r.seen || 0, fresh: !!r.fresh, pid: d.pid, cls: d.cls || '' };
  }
  // ---------- teacher: one pupil's challenge-by-challenge detail ----------
  function renderPupilDetail() {
    var box = $('#pupilDetail'); if (!box) return;
    var r = T.sel && T.rows.filter(function (x) { return x.data.pid === T.sel; })[0];
    if (!r) { box.innerHTML = ''; box.hidden = true; return; }
    box.hidden = false;
    var d = r.data, st = rowStats(r), solved = d.solved || {}, tries = d.tries || {}, hints = d.hints || {}, tut = d.tut || {}, rev = d.revealed || {};
    function verified(id) { return !T.key[id] || isAwarded(d.pid, id) || proofOk(d.pid, id, solved[id].p); }
    var cats = CATS.map(function (cat) {
      var list = CH.filter(function (c) { return c.cat === cat.id; });
      var done = list.filter(function (c) { return solved[c.id]; }).length;
      var tiles = list.map(function (c) {
        var s = solved[c.id], cls = 'pd-tile ' + TIERS[c.tier].cls, tip = c.title + ' · ' + TIERS[c.tier].name + ' · ' + c.pts + ' pts';
        if (s && !verified(c.id)) { cls += ' unv'; tip += ' — UNVERIFIED solve'; }
        else if (s && s.r) { cls += ' rev'; tip += ' — solved after revealing the answer (0 pts)'; }
        else if (s && isAwarded(d.pid, c.id)) { cls += ' ok awd'; tip += ' — marked completed by teacher'; }
        else if (s) { cls += ' ok'; tip += ' — solved ' + fmtDate(s.t); }
        else if (tries[c.id] || hints[c.id] || tut[c.id] || rev[c.id]) { cls += ' tried'; tip += ' — attempted, not solved'; }
        var extra = [];
        if (tries[c.id]) extra.push(tries[c.id] + ' wrong');
        if (hints[c.id]) extra.push(hints[c.id] + ' hint' + (hints[c.id] > 1 ? 's' : ''));
        if (tut[c.id]) extra.push('tutorial');
        if (rev[c.id] && !s) extra.push('answer shown');
        if (extra.length) tip += ' (' + extra.join(', ') + ')';
        return '<button type="button" class="' + cls + '" data-open="' + c.id + '" title="' + esc(tip) + ' — click to open">' + (s ? (s.r ? '👁' : '✓') : (cls.indexOf('tried') >= 0 ? '…' : '')) + '</button>';
      }).join('');
      return '<div class="pd-cat"><div class="pd-cat-head"><span>' + cat.icon + ' ' + esc(cat.name) + '</span><span class="muted small">' + done + '/' + list.length + '</span></div><div class="pd-tiles">' + tiles + '</div></div>';
    }).join('');
    // activity list: solves newest first, then challenges they tried but haven't cracked
    var solvedIds = Object.keys(solved).filter(function (id) { return BY_ID[id]; }).sort(function (a, b) { return solved[b].t - solved[a].t; });
    var stuck = CH.filter(function (c) { return !solved[c.id] && (tries[c.id] || hints[c.id] || tut[c.id] || rev[c.id]); });
    function line(c, s) {
      var bits = [TIERS[c.tier].name, c.pts + ' pts'];
      if (tries[c.id]) bits.push(tries[c.id] + ' wrong attempt' + (tries[c.id] > 1 ? 's' : ''));
      if (hints[c.id]) bits.push(hints[c.id] + ' hint' + (hints[c.id] > 1 ? 's' : ''));
      if (tut[c.id]) bits.push('used tutorial');
      if (rev[c.id]) bits.push('answer revealed');
      var flag = s ? (!verified(c.id) ? '<span class="badge bad">unverified</span>' : s.r ? '<span class="badge">0 pts</span>' : '<span class="badge good">+' + c.pts + '</span>') : '<span class="badge">not solved</span>';
      return '<div class="pd-line" data-open="' + c.id + '" title="Open this challenge"><span class="when">' + (s ? fmtDate(s.t) : '') + '</span><span><b>' + esc(c.title) + '</b> <span class="muted small">' + esc(c.id) + ' · ' + bits.join(' · ') + '</span></span>' + flag + '</div>';
    }
    box.innerHTML = '<div class="pd-head"><div><h2>' + esc(st.name) + '</h2><p class="muted small">' + st.pts + ' pts · ' + st.n + ' flags · ' + st.hints + ' hints · ' + st.tut + ' tutorials · ' + st.rev + ' answers revealed' +
      (r.seen ? ' · last on the site ' + fmtDate(r.seen) : '') + '</p></div><div class="pd-btns">' + (r.seen && SYNC_URL ? '<button class="btn small" id="pdPin">🔑 Reset PIN</button>' : '') + (r.seen && SYNC_URL ? '<button class="btn small" id="pdMerge">🔗 Merge a second login</button>' : '') + '<button class="btn danger small" id="pdDelete">🗑 Delete pupil</button><button class="btn small" id="pdClose">✕ Close</button></div></div>' +
      '<p class="pd-key small muted"><span class="pd-tile ok">✓</span> solved <span class="pd-tile ok awd">✓</span> marked by teacher <span class="pd-tile rev">👁</span> solved after revealing answer <span class="pd-tile tried">…</span> attempted <span class="pd-tile"></span> not started — hover a square for details</p>' +
      (SYNC_URL ? '<div class="pick-bar' + (T.pickMode ? ' on' : '') + '" id="pickBar"></div>' : '') +
      '<div class="pd-cats' + (T.pickMode ? ' picking' : '') + '">' + cats + '</div>' +
      '<h3>Solved (' + solvedIds.length + ')</h3>' + (solvedIds.length ? solvedIds.map(function (id) { return line(BY_ID[id], solved[id]); }).join('') : '<p class="muted">Nothing solved yet.</p>') +
      (stuck.length ? '<h3>Tried but not solved yet (' + stuck.length + ')</h3>' + stuck.map(function (c) { return line(c, null); }).join('') : '');
    $('#pdClose').addEventListener('click', function () { T.sel = null; renderTeacher(); });
    $('#pdDelete').addEventListener('click', function () { deletePupil(r, st.name); });
    var mgB = $('#pdMerge'); if (mgB) mgB.addEventListener('click', function () { mergePanel(r, st.name); });
    var pinB = $('#pdPin');
    if (pinB) pinB.addEventListener('click', function () {
      if (!confirm('Reset ' + st.name + '\'s PIN?\n\nThe next time they sign in, whatever 4-digit PIN they type becomes their new PIN.')) return;
      if (!LIVE.key && !askLiveKey()) return;
      fetch(liveUrl('&action=resetpin&pid=' + encodeURIComponent(d.pid)), { cache: 'no-store' }).then(function (x) { return x.json(); }).then(function (res) {
        if (res.ok && res.reset) toast('🔑 PIN reset — ' + st.name + ' can choose a new one when they next sign in', 4500);
        else if (res.ok) toast('Your Google script needs updating to reset PINs — see teacher-sync/SETUP.md (step 4)', 6000);
        else toast(res.error === 'not registered' ? st.name + ' hasn\'t signed in with a PIN yet' : 'Not reset: ' + (res.error || 'error'));
      }).catch(function () { toast('Couldn\'t reach the sheet'); });
    });
    $$('[data-open]', box).forEach(function (el) {
      el.addEventListener('click', function () {
        if (T.pickMode && el.classList.contains('pd-tile')) { togglePick(el.dataset.open, el); return; }
        openChal(el.dataset.open); teacherNote(el.dataset.open, d, st.name);
      });
    });
    if (T.pickMode) $$('button.pd-tile[data-open]', box).forEach(function (el) { if (T.pick[el.dataset.open]) el.classList.add('picked'); });
    drawPickBar(r, st.name);
  }
  // ---------- teacher: select several challenges and mark them completed together (for one or more pupils) ----------
  T.pick = {}; T.pickMode = false; T.pickFor = {};
  function pickCount() { return Object.keys(T.pick).length; }
  function togglePick(cid, el) { if (T.pick[cid]) delete T.pick[cid]; else T.pick[cid] = 1; if (el) el.classList.toggle('picked', !!T.pick[cid]); drawPickBar(); }
  var pickCtx = null;
  function drawPickBar(r, name) {
    if (r) pickCtx = { r: r, name: name };
    var bar = $('#pickBar'); if (!bar || !pickCtx) return;
    r = pickCtx.r; name = pickCtx.name;
    if (!T.pickMode) {
      bar.innerHTML = '<button class="btn small" id="pickStart">☑ Select challenges to mark completed</button> <span class="muted small">Tick several squares, then mark them all at once — for ' + esc(name.split(' ')[0]) + ' or for a whole group.</span>';
      $('#pickStart').addEventListener('click', function () { T.pickMode = true; T.pick = {}; T.pickFor = {}; T.pickFor[r.data.pid] = 1; renderPupilDetail(); });
      return;
    }
    var n = pickCount(), others = T.rows.filter(function (x) { return x.seen && x.data.pid !== r.data.pid; }).map(rowStats);
    var cls = r.data.cls || ''; others.sort(function (a, b) { return ((b.cls === cls) - (a.cls === cls)) || a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name); });
    var who = Object.keys(T.pickFor).length;
    bar.innerHTML = '<div class="pick-row"><b>' + n + ' challenge' + (n === 1 ? '' : 's') + ' selected</b>' +
      '<span class="muted small">Click squares to tick or untick. Already-solved ones are skipped.</span>' +
      '<span class="pick-acts"><button class="btn small" id="pickAllTried">Tick all attempted</button><button class="btn small" id="pickClear">Clear</button>' +
      '<button class="btn primary small" id="pickGo"' + (n ? '' : ' disabled') + '>✅ Mark ' + n + ' completed for ' + (who === 1 ? esc(name.split(' ')[0]) : who + ' pupils') + '</button>' +
      '<button class="btn small" id="pickUndo"' + (n ? '' : ' disabled') + '>Undo marks</button><button class="btn small" id="pickDone">Done</button></span></div>' +
      (others.length ? '<details class="pick-who"' + (who > 1 ? ' open' : '') + '><summary>Also mark for other pupils (' + (who - 1) + ' chosen)</summary><div class="pick-tools">' +
        (cls ? '<button class="btn small" id="pickClass">Tick everyone in ' + esc(cls) + '</button>' : '') + '<button class="btn small" id="pickNone">Just ' + esc(name.split(' ')[0]) + '</button></div><div class="pick-list">' +
        others.map(function (o) { return '<label><input type="checkbox" data-pid="' + esc(o.pid) + '"' + (T.pickFor[o.pid] ? ' checked' : '') + '> ' + esc(o.name) + (o.cls ? ' <span class="muted small">' + esc(o.cls) + '</span>' : '') + '</label>'; }).join('') + '</div></details>' : '') +
      '<div class="pick-progress small" id="pickProg"></div>';
    $('#pickClear').addEventListener('click', function () { T.pick = {}; renderPupilDetail(); });
    $('#pickDone').addEventListener('click', function () { T.pickMode = false; T.pick = {}; renderPupilDetail(); });
    $('#pickAllTried').addEventListener('click', function () {
      var d = r.data, sv = d.solved || {};
      CH.forEach(function (c) { if (!sv[c.id] && ((d.tries || {})[c.id] || (d.hints || {})[c.id] || (d.tut || {})[c.id] || (d.revealed || {})[c.id])) T.pick[c.id] = 1; });
      renderPupilDetail();
    });
    $$('.pick-list input', bar).forEach(function (cb) { cb.addEventListener('change', function () { if (cb.checked) T.pickFor[cb.dataset.pid] = 1; else delete T.pickFor[cb.dataset.pid]; drawPickBar(); }); });
    var pc = $('#pickClass'); if (pc) pc.addEventListener('click', function () { others.forEach(function (o) { if (o.cls === cls) T.pickFor[o.pid] = 1; }); drawPickBar(); var dd = $('.pick-who', bar); if (dd) dd.open = true; });
    var pn = $('#pickNone'); if (pn) pn.addEventListener('click', function () { T.pickFor = {}; T.pickFor[r.data.pid] = 1; drawPickBar(); });
    $('#pickGo').addEventListener('click', function () { bulkAward(true); });
    $('#pickUndo').addEventListener('click', function () { bulkAward(false); });
  }
  function bulkAward(on) {
    if (!LIVE.key && !askLiveKey()) return;
    var cids = Object.keys(T.pick), pids = Object.keys(T.pickFor), jobs = [];
    pids.forEach(function (pid) {
      var row = T.rows.filter(function (x) { return x.data.pid === pid; })[0]; if (!row) return;
      var sv = row.data.solved || {};
      cids.forEach(function (cid) {
        var mine = isAwarded(pid, cid), self = sv[cid] && !sv[cid].a && !sv[cid].r && proofOk(pid, cid, sv[cid].p);
        if (on && !mine && !self) jobs.push([row, cid]);
        if (!on && mine) jobs.push([row, cid]);
      });
    });
    var names = pids.length === 1 ? (T.rows.filter(function (x) { return x.data.pid === pids[0]; })[0] || { data: {} }).data.name : pids.length + ' pupils';
    if (!jobs.length) { toast(on ? 'Nothing to mark — those are already solved or marked' : 'None of those are marked by you'); return; }
    if (!confirm((on ? 'Mark ' : 'Remove the mark from ') + jobs.length + ' challenge' + (jobs.length === 1 ? '' : 's') + (on ? ' as completed' : '') + ' for ' + names + '?' + (on ? '\n\nThey get the full points, and it appears on their computers within a few minutes.' : ''))) return;
    var done = 0, fail = 0, i = 0, prog = $('#pickProg'), btns = $$('#pickBar button'); btns.forEach(function (b) { b.disabled = true; });
    function show() { if (prog) prog.textContent = (on ? 'Marking… ' : 'Removing… ') + (done + fail) + ' / ' + jobs.length + (fail ? ' (' + fail + ' failed)' : ''); }
    function next() {
      if (i >= jobs.length) return Promise.resolve();
      var j = jobs[i++], row = j[0], cid = j[1], pid = row.data.pid;
      return fetch(liveUrl('&action=' + (on ? 'award' : 'unaward') + '&pid=' + encodeURIComponent(pid) + '&cid=' + encodeURIComponent(cid)), { cache: 'no-store' })
        .then(function (x) { return x.json(); }).then(function (res) {
          if (!res.ok || res.awarded === undefined) throw new Error(res.error || 'old script');
          T.awards = T.awards || {}; T.awards[pid] = T.awards[pid] || {};
          if (on) T.awards[pid][cid] = Date.now(); else delete T.awards[pid][cid];
          done++;
        }).catch(function () { fail++; }).then(function () { show(); return next(); });
    }
    show();
    Promise.all([next(), next(), next()]).then(function () {   // three at a time
      T.rows.forEach(function (x) { if (T.pickFor[x.data.pid]) injectAwards(x.data); });
      T.pick = {}; renderTeacher();
      toast(fail ? (done + ' done, ' + fail + ' failed — check the teacher key and try again') : (on ? '✅ Marked ' : 'Removed ') + done + ' challenge' + (done === 1 ? '' : 's') + (on ? ' as completed' : '') + ' for ' + names, 5000);
    });
  }
  // When the teacher opens a challenge from a pupil's breakdown: show that pupil's record and the answer
  function teacherNote(id, d, name) {
    var c = BY_ID[id], old = document.getElementById('chalTeacherNote'); if (old) old.remove();
    if (!c) return;
    var s = (d.solved || {})[id], tries = (d.tries || {})[id] || 0, hints = (d.hints || {})[id] || 0, tut = (d.tut || {})[id], rev = (d.revealed || {})[id];
    var bits = [];
    if (s && isAwarded(d.pid, id)) bits.push('marked completed by you ' + fmtDate((T.awards[d.pid] || {})[id]));
    else if (s) bits.push(s.r ? 'solved after revealing the answer (0 pts)' : 'solved ' + fmtDate(s.t)); else bits.push('not solved yet');
    if (tries) bits.push(tries + ' wrong attempt' + (tries > 1 ? 's' : ''));
    if (hints) bits.push(hints + ' hint' + (hints > 1 ? 's' : ''));
    if (tut) bits.push('used the tutorial');
    if (rev && !s) bits.push('revealed the answer');
    var n = document.createElement('div'); n.id = 'chalTeacherNote'; n.className = 'teacher-note';
    n.innerHTML = '<div><b>👩‍🏫 ' + esc(name) + ':</b> ' + bits.join(' · ') + '</div>' +
      '<details><summary>Show answer (teacher)</summary><p class="small tn-ans">Loading…</p></details>';
    n.querySelector('details').addEventListener('toggle', function () {
      var el = n.querySelector('.tn-ans'); if (!this.open || el.dataset.done) return;
      var t = T.ans[id]; (t ? Promise.resolve(t) : getAnswer(c)).then(function (a) { el.dataset.done = 1; el.innerHTML = (a.sol || '') + '<br>Flag: <code>' + esc(a.f) + '</code>'; }, function () { el.textContent = 'Couldn’t load the answer — check the teacher key / internet.'; });
    });
    var meta = document.getElementById('chalMeta'); meta.after(n);
    var ok = s && !s.r && (isAwarded(d.pid, id) || proofOk(d.pid, id, s.p));
    if (SYNC_URL && LIVE.key) {
      var row = document.createElement('div'); row.className = 'tn-mark';
      if (isAwarded(d.pid, id)) row.innerHTML = '<span class="badge good">✓ Marked completed by you</span> <button type="button" class="btn small" id="tnUnmark">Undo</button>';
      else if (ok) row.innerHTML = '<span class="badge good">✓ Solved by the pupil (verified)</span>';
      else row.innerHTML = '<button type="button" class="btn primary small" id="tnMark">✅ Mark completed for ' + esc(name.split(' ')[0]) + '</button> <span class="muted small">Full ' + c.pts + ' points' + (s && s.r ? ' (they had revealed the answer)' : '') + '.</span>';
      n.insertBefore(row, n.querySelector('details'));
      var mk = row.querySelector('#tnMark'), un = row.querySelector('#tnUnmark');
      if (mk) mk.addEventListener('click', function () { setAward(d, id, true, name); });
      if (un) un.addEventListener('click', function () { setAward(d, id, false, name); });
    }
  }
  // a solve is genuine if its proof matches this pupil's ID, or the ID of a login merged into them
  function proofOk(pid, cid, p) {
    var f = T.key[cid]; if (!p) return false; if (!f) return true;   // without the answer book, the script has already checked it
    var ids = [pid].concat((T.aliasOf && T.aliasOf[pid]) || []);
    for (var i = 0; i < ids.length; i++) if (sha256(ids[i] + '|' + f.toLowerCase()).slice(0, 16) === p) return true;
    return false;
  }
  function isAwarded(pid, cid) { return !!(T.awards && T.awards[pid] && T.awards[pid][cid]); }
  function injectAwards(d) {   // an awarded flag counts as solved, even before the pupil's computer has picked it up
    var a = (T.awards || {})[d.pid] || {}; d.solved = d.solved || {};
    Object.keys(a).forEach(function (cid) { if (BY_ID[cid] && (!d.solved[cid] || d.solved[cid].r)) d.solved[cid] = { t: a[cid], p: '', h: (d.hints || {})[cid] || 0, r: 0, a: 1 }; });
    Object.keys(d.solved).forEach(function (cid) { if (d.solved[cid].a && !a[cid]) delete d.solved[cid]; });
  }
  function setAward(d, cid, on, name) {
    if (!LIVE.key && !askLiveKey()) return;
    var c = BY_ID[cid]; if (on && !confirm('Mark "' + c.title + '" as completed for ' + name + '?\n\nThey get the full ' + c.pts + ' points, and it shows on their computer as marked by you.')) return;
    fetch(liveUrl('&action=' + (on ? 'award' : 'unaward') + '&pid=' + encodeURIComponent(d.pid) + '&cid=' + encodeURIComponent(cid)), { cache: 'no-store' })
      .then(function (x) { return x.json(); }).then(function (res) {
        if (!res.ok || res.awarded === undefined) { toast(res.error === 'key' ? 'Teacher key not accepted' : 'Your Google script needs updating to mark flags — see teacher-sync/SETUP.md (step 4)', 6000); return; }
        T.awards = T.awards || {}; T.awards[d.pid] = T.awards[d.pid] || {};
        if (on) T.awards[d.pid][cid] = Date.now(); else delete T.awards[d.pid][cid];
        var row = T.rows.filter(function (x) { return x.data.pid === d.pid; })[0]; if (row) injectAwards(row.data);
        renderTeacher(); teacherNote(cid, row ? row.data : d, name);
        toast(on ? '✅ Marked completed for ' + name : 'Mark removed', 3500);
      }).catch(function () { toast('Couldn\'t reach the sheet'); });
  }
  // ---------- merge a pupil's second login into this one ----------
  function mergePanel(r, name) {
    var box = $('#pupilDetail'), old = $('#mergeBox'); if (old) { old.remove(); return; }
    var others = T.rows.filter(function (x) { return x.seen && x.data.pid !== r.data.pid; }).map(rowStats);
    var cls = r.data.cls || '';
    others.sort(function (a, b) { return ((b.cls === cls) - (a.cls === cls)) || a.name.localeCompare(b.name); });
    var m = document.createElement('div'); m.id = 'mergeBox'; m.className = 'merge-box';
    if (!others.length) { m.innerHTML = '<p class="muted small">There are no other pupils to merge.</p>'; }
    else m.innerHTML = '<b>🔗 Merge a second login into ' + esc(name) + '</b>' +
      '<p class="small muted">Pick the other login this pupil made (e.g. a misspelt name or wrong class). Its solves, hints and teacher marks move into <b>' + esc(name) + '</b>, it disappears from the list, and signing in with either name opens ' + esc(name) + '’s progress from now on.</p>' +
      '<div class="merge-row"><select class="io" id="mergeFrom">' + others.map(function (o) {
        return '<option value="' + esc(o.pid) + '">' + esc(o.name) + (o.cls ? ' · ' + esc(o.cls) : '') + ' — ' + o.pts + ' pts, ' + o.n + ' flag' + (o.n === 1 ? '' : 's') + (o.last ? ', last solve ' + fmtDate(o.last) : '') + '</option>';
      }).join('') + '</select><button class="btn primary small" id="mergeGo">Merge into ' + esc(name.split(' ')[0]) + '</button></div>';
    box.querySelector('.pd-head').after(m);
    var go = $('#mergeGo'); if (!go) return;
    go.addEventListener('click', function () {
      var sel = $('#mergeFrom'), from = sel.value, label = sel.options[sel.selectedIndex].textContent.split(' — ')[0];
      if (!confirm('Merge "' + label + '" into ' + name + '?\n\n' + label + ' will be removed from the list and everything they did moves to ' + name + '. This can’t be undone from here.')) return;
      if (!LIVE.key && !askLiveKey()) return;
      go.disabled = true; go.textContent = 'Merging…';
      fetch(liveUrl('&action=merge&from=' + encodeURIComponent(from) + '&to=' + encodeURIComponent(r.data.pid)), { cache: 'no-store' }).then(function (x) { return x.json(); }).then(function (res) {
        if (res.ok && res.merged) { toast('🔗 Merged ' + label + ' into ' + name, 4000); T.rows = T.rows.filter(function (x) { return x.data.pid !== from; }); liveFetch(); }
        else { go.disabled = false; go.textContent = 'Merge into ' + name.split(' ')[0]; toast(res.error === 'key' ? 'Teacher key not accepted' : res.ok ? 'Your Google script needs updating to merge pupils — see teacher-sync/SETUP.md (step 4)' : 'Not merged: ' + (res.error || 'error'), 6000); }
      }).catch(function () { go.disabled = false; go.textContent = 'Merge into ' + name.split(' ')[0]; toast('Couldn’t reach the sheet'); });
    });
  }
  function deletePupil(r, name) {
    var pid = r.data.pid;
    function dropLocal() { delete PEND.joined[pid]; T.rows = T.rows.filter(function (x) { return x.data.pid !== pid; }); T.sel = null; renderTeacher(); }
    if ((!r.seen && !r.fresh) || !SYNC_URL) {   // a hand-loaded file: just take it off this screen
      if (confirm('Remove "' + name + '" from this leaderboard?')) { dropLocal(); toast('Removed'); }
      return;
    }
    if (!confirm('Delete "' + name + '" from the live class view?\n\nThey are removed from the Google Sheet and that device won\'t be shown again (good for test accounts). If it was a real pupil, they can press "Reset everything" on My progress to appear again as new.')) return;
    if (!LIVE.key && !askLiveKey()) return;
    fetch(liveUrl('&action=delete&pid=' + encodeURIComponent(pid)), { cache: 'no-store' }).then(function (res) { return res.json(); }).then(function (res) {
      if (res.ok && res.deleted) { dropLocal(); toast('🗑 Deleted ' + name); }
      else if (res.ok) toast('Your Google script needs updating to delete pupils — see teacher-sync/SETUP.md (step 4)', 6000);
      else toast(res.error === 'key' ? 'Teacher key not accepted' : 'Not deleted: ' + (res.error || 'error'));
    }).catch(function () { toast('Couldn\'t reach the sheet'); });
  }
  function struggleSummary() {
    var count = {};
    T.rows.forEach(function (r) {
      Object.keys(r.data.tut || {}).forEach(function (id) { if (BY_ID[id]) count[id] = (count[id] || 0) + 1; });
    });
    var ids = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; });
    if (!ids.length) return '';
    var rows = ids.slice(0, 15).map(function (id) {
      var c = BY_ID[id], cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
      return '<div class="struggle-row"><span class="struggle-n">' + count[id] + '</span><span>' + esc(c.title) + '</span>' +
        '<span class="muted small">' + cat.icon + ' ' + esc(cat.name) + ' · ' + TIERS[c.tier].name + '</span></div>';
    }).join('');
    return '<h2>Where pupils needed the tutorial</h2><p class="muted small">How many pupils opened the “How to complete this” tutorial on each challenge — your class’s trickiest topics, most pupils first.</p><div class="struggle-list">' + rows + '</div>';
  }
  function renderTeacher() {
    var box = $('#teacherTable');
    if (!T.rows.length) { box.innerHTML = '<p class="muted">' + (LIVE.on ? 'Live view is on — pupils will appear here as soon as they start.' : 'No files loaded yet.') + '</p>'; renderPupilDetail(); return; }
    var all = T.rows.map(rowStats);
    var classes = all.map(function (r) { return r.cls; }).filter(function (c, i, a) { return c && a.indexOf(c) === i; }).sort();
    var cf = $('#teacherClass');
    if (cf) {
      if (T.cls && classes.indexOf(T.cls) < 0) T.cls = '';
      cf.innerHTML = '<option value="">All classes (' + all.length + ')</option>' + classes.map(function (c) { var n = all.filter(function (r) { return r.cls === c; }).length; return '<option value="' + esc(c) + '"' + (T.cls === c ? ' selected' : '') + '>' + esc(c) + ' (' + n + ')</option>'; }).join('');
      cf.hidden = !classes.length;
    }
    var rows = T.cls ? all.filter(function (r) { return r.cls === T.cls; }) : all;
    var k = T.sort;
    rows.sort(function (a, b) { return k === 'name' ? a.name.localeCompare(b.name) : k === 'cls' ? (a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name)) : (b[k] - a[k]) || (a.last - b.last); });
    box.innerHTML = '<table class="lb"><thead><tr><th>#</th><th data-k="name">Name</th><th data-k="cls">Class</th><th data-k="pts">Points</th><th data-k="n">Flags</th>' +
      TIER_NUMS.map(function (t) { return '<th>' + TIERS[t].name + '</th>'; }).join('') +
      '<th data-k="hints">Hints</th><th data-k="tut">Tutorials</th><th data-k="rev">Answers revealed</th><th>Last solve</th><th>Source</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        var active = r.seen && Date.now() - r.seen < 5 * 60000;
        return '<tr class="pupil-row' + (T.sel === r.pid ? ' sel' : '') + '" data-pid="' + esc(r.pid) + '" title="Click to see their challenges"><td class="num">' + (i + 1) + '</td><td>' + (active ? '<span class="live-dot" title="Active in the last 5 minutes"></span>' : '') + esc(r.name) + '</td><td>' + esc(r.cls || '–') + '</td><td class="num">' + r.pts + '</td><td class="num">' + r.n + '</td>' +
          TIER_NUMS.map(function (t) { return '<td class="num">' + r.tiers[t] + '</td>'; }).join('') +
          '<td class="num">' + r.hints + '</td><td class="num' + (r.tut ? ' tut-cell' : '') + '">' + r.tut + '</td><td class="num">' + r.rev + '</td><td class="num">' + (r.last ? fmtDate(r.last) : '-') + '</td><td>' +
          (r.seen ? '<span class="badge live" title="Sent automatically">live · ' + new Date(r.seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + '</span> ' : '') +
          (r.fresh ? '<span class="badge new" title="Approved — appears with scores once they start">approved · not started</span>' : r.ok ? '<span class="badge good">ok</span>' : '<span class="badge bad">edited</span>') +
          (r.unv ? ' <span class="badge bad">' + r.unv + ' unverified</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' + struggleSummary();
    $$('th[data-k]', box).forEach(function (th) { th.addEventListener('click', function () { T.sort = th.dataset.k === 'pts' ? 'pts' : th.dataset.k; renderTeacher(); }); });
    $$('tr.pupil-row', box).forEach(function (tr) { tr.addEventListener('click', function () { T.sel = T.sel === tr.dataset.pid ? null : tr.dataset.pid; renderTeacher(); if (T.sel) { var el = $('#pupilDetail'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } }); });
    T.lastRows = rows;
    renderPupilDetail();
  }
  $('#teacherCsv').addEventListener('click', function () {
    if (!T.lastRows) return toast('Load some files first');
    var lines = [['Rank', 'Name', 'Class', 'Points', 'Flags', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Elite', 'Unreal', 'Hints', 'Tutorials used', 'Answers revealed', 'Unverified', 'Last solve'].join(',')];
    T.lastRows.forEach(function (r, i) {
      lines.push([i + 1, '"' + r.name.replace(/"/g, '""') + '"', r.cls, r.pts, r.n, r.tiers[1], r.tiers[2], r.tiers[3], r.tiers[4], r.tiers[5], r.tiers[6], r.tiers[7], r.hints, r.tut, r.rev, r.unv, r.last ? new Date(r.last).toISOString() : ''].join(','));
    });
    download('MrButlersCTF-leaderboard.csv', lines.join('\n'), 'text/csv');
  });

  // ---------- teacher: live class view from the Google Sheet ----------
  var LIVE = { on: false, timer: null, key: '' }, LIVE_KEY_STORE = 'mbctf-teacher-livekey-v1';
  try { LIVE.key = localStorage.getItem(LIVE_KEY_STORE) || ''; } catch (e) { }
  function liveSignedIn() { var b = $('#liveSignOut'); if (b) b.hidden = !teacherSignedIn(); updateTeacherUI(); }
  function liveBtnIcon() { var b = $('#liveBtn'); if (!b) return; b.textContent = LIVE.on ? '⏸' : '▶'; b.title = LIVE.on ? 'Pause live view' : 'Start live view'; b.setAttribute('aria-label', b.title); b.classList.toggle('on', !!LIVE.on); }
  function liveInfo(cls, html) { var el = $('#liveInfo'); if (!el) return; el.className = 'small ' + (cls || 'muted'); el.innerHTML = html; }
  function askLiveKey() {
    var k = prompt('Teacher key (the TEACHER_KEY you set in the Google Apps Script):', LIVE.key || '');
    if (k === null || !k.trim()) return false;
    LIVE.key = k.trim(); try { localStorage.setItem(LIVE_KEY_STORE, LIVE.key); } catch (e) { }
    liveSignedIn(); return true;
  }
  function liveUrl(extra) { return SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'key=' + encodeURIComponent(LIVE.key) + (extra || '') + '&t=' + Date.now(); }
  function liveFetch(force) {
    if ((!LIVE.on && !force) || (document.hidden && !force)) return;
    fetch(liveUrl(), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok) {
        if (res.error === 'key') { stopLive(); try { localStorage.removeItem(LIVE_KEY_STORE); } catch (e) { } LIVE.key = ''; try { localStorage.removeItem(TEACHER_PC); sessionStorage.removeItem(STAFF_SS); } catch (e) { } liveSignedIn(); liveInfo('bad-text', 'The teacher password has changed. Sign in again with the new one.'); openTeacherSignIn(); $('#tmMsg').className = 'flag-msg'; $('#tmMsg').textContent = 'The teacher password has changed — enter the new one.'; }
        else liveInfo('bad-text', 'The sheet replied with an error: ' + esc(res.error || 'unknown'));
        return;
      }
      var byPid = {};
      T.rows.forEach(function (r) { if (!r.seen) byPid[r.data.pid] = r; });   // keep any hand-loaded files
      var bad = 0, tests = [];
      (res.rows || []).forEach(function (x) {
        try {
          var raw = JSON.parse(x.json); if (raw.test) tests.push(testRow(raw.test, x.seen));
          var r = parseImport(x.json); r.file = 'live'; r.seen = x.seen;
          var cur = byPid[r.data.pid];
          if (!cur || (cur.data.exported || 0) <= (r.data.exported || 0)) byPid[r.data.pid] = r;
        } catch (e) { bad++; }
      });
      if (byPid[S.pid] && !Object.keys(S.solved).length && !S.name) delete byPid[S.pid];
      (res.joined || []).forEach(function (j) { delete PEND.joined[j.pid]; if (!byPid[j.pid]) byPid[j.pid] = joinedRow(j); });
      Object.keys(PEND.joined).forEach(function (k) { if (byPid[k]) delete PEND.joined[k]; else byPid[k] = joinedRow(PEND.joined[k]); });   // just approved: show them until the sheet catches up   // this teacher PC's own visit before signing in
      T.awards = res.awards || {};
      T.aliasOf = {}; var AL = res.aliases || {};
      Object.keys(AL).forEach(function (old) { var k = AL[old], n = 0; while (AL[k] && n++ < 20) k = AL[k]; (T.aliasOf[k] = T.aliasOf[k] || []).push(old); });
      Object.keys(byPid).forEach(function (k) { injectAwards(byPid[k].data); });
      T.rows = Object.keys(byPid).map(function (k) { return byPid[k]; });
      renderTeacher(); renderLiveTests(tests); feedEventChallenges(); renderPending(res.pending || [], res.approval, res.mail); renderInstall(res.installed);
      var n = T.rows.filter(function (r) { return r.seen || r.fresh; }).length, active = (res.rows || []).filter(function (x) { return Date.now() - x.seen < 5 * 60000; }).length;
      liveInfo('muted', '<span class="live-dot"></span>Live · ' + n + ' pupil' + (n === 1 ? '' : 's') + ' · ' + active + ' active · updated ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + (bad ? ' · ' + bad + ' unreadable' : ''));
    }).catch(function () { liveInfo('bad-text', 'Couldn\'t reach the Google Sheet — trying again in a moment…'); });
  }
  // ---------- projector event screen: the practice-challenge leaderboard, and a refresh it can ask for ----------
  function feedEventChallenges() {
    if (!window.CTFEventChallenges) return;
    var list = T.rows.map(function (r) { var st = rowStats(r); return { pid: st.pid, name: st.name, cls: st.cls, pts: st.pts, n: st.n, last: st.last }; })
      .filter(function (x) { return x.pts > 0 || x.n > 0; });
    try { window.CTFEventChallenges(list); } catch (e) { }
  }
  window.CTFLiveNow = function () { if (!SYNC_URL || !LIVE.key) return false; liveFetch(true); return true; };
  // ---------- teacher: live Test area (mock competition) results ----------
  function testRow(t, seen) {
    var pts = 0, n = 0, unv = 0;
    Object.keys(t.proofs || {}).forEach(function (id) {
      var c = BY_ID[id]; if (!c) return;
      if (T.key[id] && sha256(t.pid + '|' + T.key[id].toLowerCase()).slice(0, 16) !== t.proofs[id]) { unv++; return; }
      pts += c.pts; n++;
    });
    var used = t.status === 'running' ? Date.now() - t.start : t.timeUsedMs;
    var left = t.status === 'running' ? Math.max(0, t.minutes * 60000 - (Date.now() - t.start)) : 0;
    if (t.status === 'running' && !left) t.status = 'timeup';
    return { app: 'MrButlersCTF-Test', pid: t.pid, name: t.name || '(no name)', exported: t.exported, score: pts, solvedCount: n, paperSize: t.paperSize, paper: t.paper || 'p0', paperTitle: t.paperTitle || 'Mock CTF',
      timeUsedMs: Math.min(used, t.minutes * 60000), left: left, status: t.status, wrong: t.wrong || 0, unv: unv, seen: seen, live: true };
  }
  function mmss(ms) { var s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + ('0' + s % 60).slice(-2); }
  function renderLiveTests(list) {
    var box = $('#liveTestTable'); if (!box) return;
    if (window.CTFEventLive) try { window.CTFEventLive(list); } catch (e) { }
    if (!list.length) { box.innerHTML = ''; return; }
    list.sort(function (a, b) { return a.paper.localeCompare(b.paper) || (b.score - a.score) || (a.timeUsedMs - b.timeUsedMs); });
    var running = list.filter(function (d) { return d.status === 'running'; }).length, rank = 0, lastPaper = null;
    box.innerHTML = '<h2>🔒 Test area — live results</h2><p class="muted small">' + list.length + ' started · ' + running + ' still running. Grouped by paper, then ranked by points, then fastest. Also feeds the projector event scoreboard automatically.</p>' +
      '<table class="lb"><thead><tr><th>#</th><th>Name / team</th><th>Paper</th><th>Points</th><th>Flags</th><th>Status</th><th>Time used</th><th>Wrong guesses</th><th></th></tr></thead><tbody>' +
      list.map(function (d, i) {
        var st = d.status === 'running' ? '<span class="badge live">running · ' + mmss(d.left) + ' left</span>' : d.status === 'finished' ? '<span class="badge good">finished</span>' : '<span class="badge">time up</span>';
        rank = d.paper === lastPaper ? rank + 1 : 1; lastPaper = d.paper;
        return '<tr><td class="num">' + rank + '</td><td>' + esc(d.name) + '</td><td>' + esc(d.paperTitle) + '</td><td class="num">' + d.score + '</td><td class="num">' + d.solvedCount + '/' + d.paperSize + '</td><td>' + st +
          '</td><td class="num">' + mmss(d.timeUsedMs) + '</td><td class="num">' + d.wrong + '</td><td>' + (d.unv ? '<span class="badge bad">' + d.unv + ' unverified</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>';
  }
  // ---------- teacher: sign-up requests (approve / decline / delete declined) ----------
  var PEND = { list: [], seen: null, tab: 'waiting', busy: {}, joined: {} };
  // an approved pupil who hasn't sent any progress yet: an empty row so they're on the list straight away
  function joinedRow(j) { return { data: { app: 'MrButlersCTF', pid: j.pid, name: j.name, cls: j.cls, solved: {}, hints: {}, revealed: {}, tut: {}, tries: {} }, ok: true, file: 'live', seen: 0, fresh: true, joinedAt: j.at || 0 }; }
  function ago(t) {
    if (!t) return '';
    var s = Math.max(0, (Date.now() - t) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    if (s < 7 * 86400) return Math.round(s / 86400) + ' d ago';
    return new Date(t).toLocaleDateString([], { day: 'numeric', month: 'short' });
  }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function renderPending(list, on, mail) {
    if (mail !== undefined) PEND.mail = mail;
    if (on !== undefined) PEND.on = on;
    PEND.list = list.filter(function (x) { return !PEND.busy[x.pid]; }); list = PEND.list;
    var box = $('#pendBox'); if (!box) return;
    var waiting = list.filter(function (x) { return x.status === 'pending'; }), declined = list.filter(function (x) { return x.status === 'declined'; });
    var tab = $('#navTeacher'); if (tab) tab.innerHTML = '👩‍🏫 Teacher' + (waiting.length ? ' <span class="pend-count">' + waiting.length + '</span>' : '');
    if (PEND.seen !== null && waiting.length > PEND.seen) { toast('🙋 ' + (waiting.length - PEND.seen) + ' new pupil' + (waiting.length - PEND.seen === 1 ? '' : 's') + ' waiting for approval', 5000); PEND.tab = 'waiting'; }
    PEND.seen = waiting.length;
    var oldScript = on === undefined && PEND.on === undefined;   // the live feed has no approval info: the script predates approvals and sign-up emails
    if (PEND.on === false && !list.length) { box.innerHTML = ''; return; }
    if (PEND.tab === 'declined' && !declined.length) PEND.tab = 'waiting';
    var showing = PEND.tab === 'declined' ? declined : waiting;
    var rq = $('#tdReqN'); if (rq) { rq.hidden = !waiting.length; rq.textContent = waiting.length; }
    var rb = $('#tdReq'); if (rb) rb.classList.toggle('on', !!PEND.open);
    var warn = oldScript || (PEND.mail && PEND.mail.error);
    if (!waiting.length && !PEND.open && !warn) { box.innerHTML = ''; return; }

    function row(x) {
      var dec = x.status === 'declined', p = esc(x.pid);
      return '<li class="req-row">' +
        '<span class="req-av" aria-hidden="true">' + esc(initials(x.name)) + '</span>' +
        '<span class="req-who"><b>' + esc(x.name) + '</b><span class="req-meta">' + (x.cls ? '<span class="req-cls">' + esc(x.cls) + '</span>' : '') + (x.at ? '<span>' + (dec ? 'Asked ' : '') + ago(x.at) + '</span>' : '') + '</span></span>' +
        '<span class="req-btns">' + (dec
          ? '<button class="btn small" data-appr="' + p + '">Approve</button><button class="btn small danger req-del" data-del="' + p + '" title="Delete this request" aria-label="Delete request from ' + esc(x.name) + '">🗑 Delete</button>'
          : '<button class="btn small req-ghost" data-decl="' + p + '">Decline</button><button class="btn primary small" data-appr="' + p + '">Approve</button>') +
        '</span></li>';
    }
    var mailLine = oldScript ? '<span class="bad-text">⚠ Your Google script is an older version, so approvals and sign-up emails are off. Paste in the latest Code.gs, run “authorise” once, then deploy a New version.</span>'
      : PEND.mail && PEND.mail.error ? '<span class="bad-text">⚠ Last sign-up email failed: ' + esc(PEND.mail.error) + '</span>'
      : PEND.mail && PEND.mail.on === false ? '<span>Sign-up emails are off</span>'
      : '<span>✉ You’re emailed for each new sign-up</span>';
    var action = PEND.tab === 'waiting'
      ? (waiting.length > 1 ? '<button class="btn primary small" id="pendAll">Approve all ' + waiting.length + '</button>' : '')
      : (declined.length > 1 ? '<button class="btn danger small" id="pendDelAll">🗑 Delete all ' + declined.length + '</button>' : '');
    var empty = PEND.tab === 'waiting'
      ? '<div class="req-empty"><span class="req-empty-ic">✓</span><div><b>All caught up</b><span>New pupils appear here the first time they sign in.</span></div></div>'
      : '';
    box.innerHTML = '<section class="req-card' + (waiting.length ? ' has' : '') + '">' +
      '<header class="req-head"><h3>Sign-up requests</h3>' + (waiting.length ? '' : '<button class="req-x" id="pendClose" title="Close" aria-label="Close">✕</button>') + '' +
        '<div class="req-tabs" role="tablist">' +
          '<button role="tab" class="req-tab' + (PEND.tab === 'waiting' ? ' on' : '') + '" data-ptab="waiting" aria-selected="' + (PEND.tab === 'waiting') + '">Waiting <span class="req-n' + (waiting.length ? ' hot' : '') + '">' + waiting.length + '</span></button>' +
          (declined.length ? '<button role="tab" class="req-tab' + (PEND.tab === 'declined' ? ' on' : '') + '" data-ptab="declined" aria-selected="' + (PEND.tab === 'declined') + '">Declined <span class="req-n">' + declined.length + '</span></button>' : '') +
        '</div><span class="req-act">' + action + '</span></header>' +
      (showing.length ? '<ul class="req-list">' + showing.map(row).join('') + '</ul>' : empty) +
      (PEND.tab === 'declined' ? '<p class="req-hint">Deleting a request removes it from your sheet. If that pupil signs in again, they’ll appear under Waiting as a new request.</p>' : '') +
      '<footer class="req-foot">' + mailLine + '<button class="linkish" id="pendMail">Send test email</button><span id="pendMailMsg"></span></footer>' +
      '</section>';

    var pc = $('#pendClose'); if (pc) pc.addEventListener('click', function () { PEND.open = false; renderPending(PEND.list); });
    $$('[data-ptab]', box).forEach(function (b) { b.addEventListener('click', function () { PEND.tab = b.dataset.ptab; renderPending(PEND.list); }); });
    $$('[data-appr]', box).forEach(function (b) { b.addEventListener('click', function () { b.disabled = true; setAccessFor(b.dataset.appr, true); }); });
    $$('[data-decl]', box).forEach(function (b) { b.addEventListener('click', function () { var x = byPid(b.dataset.decl); if (confirm('Decline ' + (x ? x.name : 'this pupil') + '?\n\nThey won’t be able to use Mr Butler’s CTF under this name. You can still approve or delete them from the Declined tab.')) { b.disabled = true; setAccessFor(b.dataset.decl, false); } }); });
    $$('[data-del]', box).forEach(function (b) { b.addEventListener('click', function () { var x = byPid(b.dataset.del); if (confirm('Delete the request from ' + (x ? x.name : 'this pupil') + '?\n\nIt’s removed from your sheet. If they sign in again, they’ll show up as a new request.')) deleteRequests([b.dataset.del]); }); });
    var all = $('#pendAll'); if (all) all.addEventListener('click', function () { all.disabled = true; setAccessFor(waiting.map(function (x) { return x.pid; }).join(','), true); });
    var dall = $('#pendDelAll'); if (dall) dall.addEventListener('click', function () { if (confirm('Delete all ' + declined.length + ' declined requests?\n\nThey’re removed from your sheet. Anyone who signs in again will show up as a new request.')) deleteRequests(declined.map(function (x) { return x.pid; })); });
    $('#pendMail').addEventListener('click', function () {
      var b = this, m = $('#pendMailMsg'); if (!LIVE.key && !askLiveKey()) return;
      b.disabled = true; m.className = 'muted'; m.textContent = 'Sending…';
      fetch(liveUrl('&action=testmail'), { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (txt) {
        var j = null; try { j = JSON.parse(txt); } catch (e) { }
        b.disabled = false;
        if (!j) { m.className = 'bad-text'; m.textContent = 'The script gave an error page — it probably needs permission: in Apps Script run “authorise” once, then deploy a New version.'; return; }
        if (j.ok && j.sent) { m.className = 'good-text'; m.textContent = '✓ Sent to ' + j.to + ' — check that inbox (and junk). ' + j.quota + ' emails left today.' + (j.signins ? '' : ' Note: EMAIL_SIGNINS is false, so sign-ups won’t be emailed.'); return; }
        m.className = 'bad-text';
        m.textContent = j.error === 'key' ? 'Teacher key not accepted.' : j.error && j.error !== 'key' && j.ok === false && !/permission|authori/i.test(j.error) ? '✕ ' + j.error : /permission|authori/i.test(j.error || '') ? '✕ The script isn’t allowed to send email yet: in Apps Script run “authorise” once and accept, then deploy a New version.' : '✕ Your script is an older version without emails — paste in the latest Code.gs and deploy a New version.';
      }).catch(function () { b.disabled = false; m.className = 'bad-text'; m.textContent = 'Couldn’t reach the script.'; });
    });
  }
  function byPid(pid) { return PEND.list.filter(function (y) { return y.pid === pid; })[0]; }
  function setAccessFor(pids, ok) {
    if (!LIVE.key && !askLiveKey()) { renderPending(PEND.list); return; }
    fetch(liveUrl('&action=' + (ok ? 'approve' : 'decline') + '&pids=' + encodeURIComponent(pids)), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (res) {
      if (!res.ok || res.access === undefined) { renderPending(PEND.list); toast(res.error === 'key' ? 'Teacher key not accepted' : 'Your Google script needs updating for approvals — see teacher-sync/SETUP.md', 6000); return; }
      var set = {}; pids.split(',').forEach(function (p) { set[p] = 1; });
      if (ok) {
        var have = {}; T.rows.forEach(function (r) { have[r.data.pid] = 1; });
        PEND.list.forEach(function (x) { if (set[x.pid] && !have[x.pid]) { PEND.joined[x.pid] = x; T.rows.push(joinedRow(x)); } });
        renderTeacher();
      }
      renderPending(PEND.list.filter(function (x) { return !set[x.pid] || !ok; }).map(function (x) { return set[x.pid] && !ok ? Object.assign({}, x, { status: 'declined' }) : x; }));
      toast(ok ? '✓ Approved — they’ll be let in within 20 seconds' : 'Declined', 3500);
    }).catch(function () { renderPending(PEND.list); toast('Couldn’t reach the sheet'); });
  }
  // Deleting a declined request uses the script's existing "delete" action (Pupils, Access and progress rows), so no redeploy is needed.
  function deleteRequests(pids) {
    if (!LIVE.key && !askLiveKey()) return;
    pids.forEach(function (p) { PEND.busy[p] = 1; });
    renderPending(PEND.list);
    var done = 0, failed = [];
    (function next(i) {
      if (i >= pids.length) {
        failed.forEach(function (p) { delete PEND.busy[p]; });
        if (done) toast('🗑 Deleted ' + done + ' request' + (done === 1 ? '' : 's'), 3500);
        if (failed.length) { toast('Couldn’t delete ' + failed.length + ' — they’ll reappear on the next refresh', 5000); liveFetch(); }
        setTimeout(function () { pids.forEach(function (p) { delete PEND.busy[p]; }); }, 30000);   // forget once the sheet has caught up
        return;
      }
      fetch(liveUrl('&action=delete&pid=' + encodeURIComponent(pids[i])), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (res) {
        if (res.ok && res.deleted) done++; else { failed.push(pids[i]); if (res.error === 'key') toast('Teacher key not accepted'); }
      }).catch(function () { failed.push(pids[i]); }).then(function () { next(i + 1); });
    })(0);
  }
  function startLive() {
    if (!LIVE.key && !askLiveKey()) return;
    LIVE.on = true; liveBtnIcon();
    liveInfo('muted', 'Connecting…');
    liveFetch(); clearInterval(LIVE.timer); LIVE.timer = setInterval(liveFetch, 20000);
  }
  function stopLive() {
    LIVE.on = false; clearInterval(LIVE.timer); LIVE.timer = null;
    liveBtnIcon();
    liveInfo('muted', '⏸ Paused');
  }
  // ---------- teacher access: one password (the Teacher Area password) signs a PC in ----------
  var TEACHER_PC = 'mbctf-teacher-pc-v1', STAFF_SS = 'mbctf-staff-v1';
  function teacherSignedIn() { var lk = !!(LIVE && LIVE.key); try { return lk || localStorage.getItem(TEACHER_PC) === '1'; } catch (e) { return lk; } }
  function updateTeacherUI() {
    var on = teacherSignedIn(), tab = $('#navTeacher'), hb = $('#homeTeacher'), fb = $('#footTeacher');
    if (tab) tab.style.display = on ? '' : 'none';
    if (hb) { var ht = $('#homeTeacherT'), hu = $('#homeTeacherU');
      if (ht) { ht.textContent = on ? 'Teacher dashboard' : 'Teacher login'; hu.textContent = on ? 'You’re signed in on this computer — open the live class view' : 'Staff only: live class progress, marking and the answer book'; }
      else hb.textContent = on ? '👩‍🏫 Teacher dashboard' : '👩‍🏫 Teacher access'; }
    if (fb) fb.textContent = on ? '👩‍🏫 Teacher dashboard' : '👩‍🏫 Teacher access';
  }
  function openTeacherSignIn() {
    $('#tmMsg').textContent = ''; $('#tmPw').value = ''; openModal('#teacherModal');
    setTimeout(function () { $('#tmPw').focus(); }, 50);
  }
  function teacherEntry() { if (teacherSignedIn()) show('teacher'); else openTeacherSignIn(); }
  function b64bytes(s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); }
  function openVault(password) {
    if (!(window.crypto && crypto.subtle)) return Promise.reject(new Error('This browser can\'t check the password here.'));
    return fetch('assets/teacher/vault.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
      var te = new TextEncoder();
      return crypto.subtle.importKey('raw', te.encode(password), 'PBKDF2', false, ['deriveKey']).then(function (km) {
        return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64bytes(v.salt), iterations: v.it, hash: 'SHA-256' }, km, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
      }).then(function (key) { return crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64bytes(v.iv) }, key, b64bytes(v.ct)); })
        .then(function (pt) { return JSON.parse(new TextDecoder().decode(pt)); }, function () { throw new Error('wrong'); });
    });
  }
  // The answer book holds the flags, solutions, the challenge key and the Test password. A teacher PC hands them to
  // the Google script (Install answers), so pupils' flags can be checked there; the public site never has them.
  function useVault(data, pw) {
    var info = data.info || {};
    if (data.answers) Object.keys(data.answers).forEach(function (cid) {
      var a = data.answers[cid], x = {}; try { x = JSON.parse(a[2] || '{}'); } catch (e) { }
      T.key[cid] = a[0]; T.ans[cid] = { f: a[0], sol: x.s || '', walk: x.w || [] };
    });
    if (info.contentKey && !CONTENT_READY) ensureContent(info.contentKey);
    T.vault = data; T.pw = pw;
    if (T.installWanted || (T.feedVer !== undefined && T.feedVer !== META.ver && T.autoTried !== META.ver)) { T.autoTried = META.ver; installAnswers(false); }
  }
  function installAnswers(manual) {
    var msg = $('#installMsg');
    if (!T.vault) {
      T.installWanted = true;
      var pw = prompt('Enter the Teacher Area password to install the answers on your Google script:'); if (!pw) { T.installWanted = false; return; }
      openVault(pw).then(function (d) { try { sessionStorage.setItem(STAFF_SS, pw); } catch (e) { } useVault(d, pw); }, function () { T.installWanted = false; alert('That password isn’t right.'); });
      return;
    }
    T.installWanted = false;
    if (!SYNC_URL || !LIVE.key || T.installing) return;
    var d = T.vault, info = d.info || {};
    if (!d.answers || !info.contentKey) { if (msg) msg.textContent = 'The answer book is out of date — reload the page.'; return; }
    T.installing = true; if (msg) { msg.className = 'small'; msg.textContent = 'Installing answers on your Google script…'; } if (manual) toast('🔐 Installing answers…');
    fetch(SYNC_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ kind: 'install', key: LIVE.key, k: info.contentKey, ver: info.contentVer, answers: d.answers, testpw: info.testPassword || '' }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        T.installing = false;
        if (j && j.ok && j.installed) { T.installed = j.ver; renderInstall(j.ver); if (manual || j.cleaned) toast('🔐 Answers installed for ' + j.installed + ' challenges' + (j.cleaned ? ' · ' + j.cleaned + ' pupil record(s) had unprovable solves removed' : ''), 5000); }
        else if (msg) { $('#installBox').hidden = false; msg.className = 'small bad-text'; msg.textContent = j && j.error === 'key' ? 'The script rejected the teacher key.' : 'Your Google script needs updating first (see teacher-sync/SETUP.md).'; }
      }).catch(function () { T.installing = false; if (msg) { $('#installBox').hidden = false; msg.className = 'small bad-text'; msg.textContent = 'Couldn’t reach the script (it may need updating — see teacher-sync/SETUP.md).'; } });
  }
  // ---------- teacher: a password for each practice test paper (kept on the Google script, never on this site) ----------
  function openTestPw() {
    var box = $('#testPwBox'); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    if (!LIVE.key && !askLiveKey()) return;
    var papers = (window.TestArea && TestArea.papers) ? TestArea.papers() : [];
    box.hidden = false; box.className = 'tpw-card';
    box.innerHTML = '<div class="tpw-head"><h3>🔑 Test passwords</h3><button class="ibtn" id="tpwClose" aria-label="Close" title="Close">✕</button></div><p class="muted small">Loading…</p>';
    $('#tpwClose').addEventListener('click', function () { box.hidden = true; });
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    fetch(liveUrl('&action=testpws'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok || !j.papers) { box.querySelector('p').outerHTML = '<p class="bad-text small">' + (j && j.error === 'key' ? 'Teacher key not accepted.' : 'Your Google script needs updating for per-paper passwords: paste in the latest teacher-sync/Code.gs, then Deploy › Manage deployments › New version.') + '</p>'; return; }
      var fb = j.fallback || '';
      box.innerHTML = '<div class="tpw-head"><h3>🔑 Test passwords</h3><button class="ibtn" id="tpwClose" aria-label="Close" title="Close">✕</button></div>' +
        '<p class="muted small">Pupils need the password for the paper they choose. Leave one blank to use the answer-book password' + (fb ? ' (<code>' + esc(fb) + '</code>)' : '') + '. Changes work straight away.</p>' +
        papers.map(function (p) {
          return '<form class="tpw-row" data-paper="' + p.id + '"><span class="tpw-name"><b>' + p.icon + ' ' + esc(p.title) + '</b><span class="muted small">' + esc(p.level) + '</span></span>' +
            '<input class="io" maxlength="40" autocomplete="off" spellcheck="false" placeholder="' + esc(fb ? 'blank = ' + fb : 'set a password') + '" value="' + esc(j.papers[p.id] || '') + '" aria-label="Password for ' + esc(p.title) + '">' +
            '<button class="btn small primary" type="submit">Save</button><span class="tpw-msg small"></span></form>';
        }).join('');
      $('#tpwClose').addEventListener('click', function () { box.hidden = true; });
      $$('.tpw-row', box).forEach(function (f) {
        f.addEventListener('submit', function (e) {
          e.preventDefault();
          var inp = f.querySelector('input'), btn = f.querySelector('button'), m = f.querySelector('.tpw-msg'), pw = inp.value.trim();
          btn.disabled = true; m.className = 'tpw-msg small muted'; m.textContent = 'Saving…';
          fetch(liveUrl('&action=settestpw&paper=' + f.dataset.paper + '&pw=' + encodeURIComponent(pw)), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (r) {
            btn.disabled = false;
            if (r && r.ok) { m.className = 'tpw-msg small good-text'; m.textContent = pw ? '✓ Saved' : '✓ Using the answer-book password'; }
            else { m.className = 'tpw-msg small bad-text'; m.textContent = r && r.error === 'too long' ? 'Keep it under 40 characters.' : 'Not saved — update your Google script.'; }
          }).catch(function () { btn.disabled = false; m.className = 'tpw-msg small bad-text'; m.textContent = 'Couldn’t reach the script.'; });
        });
      });
    }).catch(function () { var p = box.querySelector('p'); if (p) { p.className = 'bad-text small'; p.textContent = 'Couldn’t reach the Google script.'; } });
  }
  function renderInstall(ver) {
    var box = $('#installBox'); if (!box) return;
    if (ver === undefined) { box.hidden = true; return; }   // older script: nothing to show
    T.feedVer = ver;
    var ok = ver && ver === META.ver; box.hidden = !!ok;
    box.className = 'callout ' + (ok ? 'install-ok' : 'warn');
    box.innerHTML = ok ? '<span id="installMsg" class="small"></span> <button type="button" class="linkish small" id="installBtn">Retry</button>'
      : '<b>🔐 Answers need installing</b><p class="small">' + (ver ? 'The challenges have changed since the answers were installed.' : 'Your Google script doesn’t have the answers yet, so pupils can’t open or score any challenges.') + '</p><button type="button" class="btn primary small" id="installBtn">Install answers now</button> <span id="installMsg" class="small"></span>';
    $('#installBtn').addEventListener('click', function () { installAnswers(true); });
    if (!ok && T.vault && !T.installing && T.autoTried !== META.ver) { T.autoTried = META.ver; installAnswers(false); }
  }
  // a teacher PC that signed in this session opens the answer book quietly
  setTimeout(function () { var pw = ''; try { pw = sessionStorage.getItem(STAFF_SS) || ''; } catch (e) { } if (pw && isTeacherDevice()) openVault(pw).then(function (d) { useVault(d, pw); }, function () { }); }, 300);

  $('#tmForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var pw = $('#tmPw').value, msg = $('#tmMsg'); if (!pw) return;
    msg.className = 'flag-msg'; msg.textContent = 'Checking…';
    openVault(pw).then(function (data) {
      try { localStorage.setItem(TEACHER_PC, '1'); sessionStorage.setItem(STAFF_SS, pw); } catch (err) { }
      var lk = data.info && data.info.liveKey;
      if (lk && !LIVE.key) { LIVE.key = lk; try { localStorage.setItem(LIVE_KEY_STORE, lk); } catch (err) { } }
      useVault(data, pw);
      closeModal($('#teacherModal')); var wm = document.getElementById('whoModal'); if (wm) wm.remove(); var wt = document.getElementById('waitModal'); if (wt) { wt.remove(); clearInterval(waitTimer); } lockdown(false); document.documentElement.style.overflow = ''; liveSignedIn(); show('teacher');
      if (SYNC_URL && LIVE.key && !LIVE.on) startLive();
      toast('👩‍🏫 Signed in — this PC is now a teacher screen');
    }).catch(function (err) {
      msg.className = 'flag-msg bad'; msg.textContent = err.message === 'wrong' ? '✗ That password isn\'t right.' : '✗ ' + err.message;
    });
  });
  function forgotPassword(msgEl) {
    if (!SYNC_URL) { msgEl.className = 'flag-msg bad'; msgEl.textContent = 'Password emails need the live class Google script set up.'; return; }
    msgEl.className = 'flag-msg'; msgEl.textContent = 'Sending…';
    fetch(SYNC_URL + (SYNC_URL.indexOf('?') < 0 ? '?' : '&') + 'action=forgot&t=' + Date.now(), { cache: 'no-store', credentials: 'omit' })
      .then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && j.sent) { msgEl.className = 'flag-msg ok'; msgEl.textContent = '📧 Sent to ' + j.to + '. Check your inbox (and junk folder).'; }
        else if (j && j.ok && j.wait) { msgEl.className = 'flag-msg'; msgEl.textContent = 'An email was sent a few minutes ago. Check your inbox (and junk folder), or try again in 10 minutes.'; }
        else { msgEl.className = 'flag-msg bad'; msgEl.textContent = 'Couldn’t send it — the Google script may need updating (see teacher-sync/SETUP.md).'; }
      }).catch(function () { msgEl.className = 'flag-msg bad'; msgEl.textContent = 'Couldn’t reach the Google script. Check the internet connection and try again.'; });
  }
  window.CTFForgotPassword = forgotPassword;
  $('#tmForgot').addEventListener('click', function () { forgotPassword($('#tmMsg')); });
  ['#homeTeacher', '#footTeacher'].forEach(function (sel) { var b = $(sel); if (b) b.addEventListener('click', function (e) { e.preventDefault(); teacherEntry(); }); });
  updateTeacherUI();

  (function initLive() {
    var box = $('#liveBox'); if (!box) return;
    var menu = $('#tdMenu'), more = $('#tdMore');
    function closeMenu() { menu.hidden = true; more.setAttribute('aria-expanded', 'false'); }
    more.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; more.setAttribute('aria-expanded', String(!menu.hidden)); });
    menu.addEventListener('click', function (e) { if (e.target.closest('button, label')) setTimeout(closeMenu, 0); });
    document.addEventListener('click', function (e) { if (!menu.hidden && !e.target.closest('.tmenu')) closeMenu(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !menu.hidden) closeMenu(); });
    if (!SYNC_URL) {
      ['#liveBtn', '#tdReq', '#tdInstall', '#tdTestPw', '#tdMail', '#liveKeyBtn', '#liveClear'].forEach(function (k) { var e = $(k); if (e) e.hidden = true; });
      liveInfo('muted', 'Not set up yet. Connect a Google Sheet once and every pupil\'s progress arrives here automatically — no files to collect. Follow <a href="https://github.com/popcorn483/MrButlersCTF/blob/main/teacher-sync/SETUP.md" target="_blank" rel="noopener">the 5-minute setup guide</a>.');
      return;
    }
    $('#liveBtn').addEventListener('click', function () { LIVE.on ? stopLive() : startLive(); });
    liveBtnIcon();
    $('#tdReq').addEventListener('click', function () { PEND.open = !PEND.open; renderPending(PEND.list || []); var pb = $('#pendBox'); if (PEND.open && pb.firstChild) pb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); });
    $('#tdInstall').addEventListener('click', function () { installAnswers(true); });
    $('#tdTestPw').addEventListener('click', function () { openTestPw(); });
    $('#tdMail').addEventListener('click', function () { PEND.open = true; renderPending(PEND.list || []); var m = $('#pendMail'); if (m) m.click(); });
    $('#liveKeyBtn').addEventListener('click', function () { if (askLiveKey() && LIVE.on) liveFetch(); });
    $('#liveSignOut').addEventListener('click', function () {
      if (!confirm('Sign this PC out of the teacher view?\n\nThe teacher key is forgotten here, and anyone using this PC afterwards is tracked as a pupil again.')) return;
      stopLive(); LIVE.key = ''; try { localStorage.removeItem(LIVE_KEY_STORE); localStorage.removeItem(TEACHER_PC); sessionStorage.removeItem(STAFF_SS); } catch (e) { } wipeContent(); setTimeout(function () { location.reload(); }, 1200);
      T.rows = T.rows.filter(function (r) { return !r.seen; }); T.sel = null; renderTeacher(); renderLiveTests([]);
      liveSignedIn(); show('home'); toast('Signed out of teacher access on this PC');
    });
    liveSignedIn();
    $('#liveClear').addEventListener('click', function () {
      if (!LIVE.key && !askLiveKey()) return;
      if (!confirm('Clear ALL pupils\' live progress from the Google Sheet? Use this before a new group or a fresh competition. Pupils keep their progress on their own computers and it re-sends next time they solve.')) return;
      fetch(liveUrl('&action=clear'), { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) return toast('Not cleared — check the teacher key');
        T.rows = T.rows.filter(function (r) { return !r.seen; }); renderTeacher(); toast('Live data cleared');
      }).catch(function () { toast('Couldn\'t reach the sheet'); });
    });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && LIVE.on) liveFetch(); });
    if (LIVE.key) startLive(); else liveInfo('muted', 'Press ▶ and enter your teacher key to see the class live.');
  })();

  // ---------- getting started page ----------
  $('#startContent').innerHTML = window.CTF_START_HTML(CATS);
  if (window.CTF_WALK_HTML) $('#walkContent').innerHTML = window.CTF_WALK_HTML();
  if (window.CTF_RES_HTML) $('#resContent').innerHTML = window.CTF_RES_HTML();
  if (window.CTF_LESSONS_HTML) $('#lessonsContent').innerHTML = window.CTF_LESSONS_HTML();
  if (window.CTF_TOOLS_HELP_HTML) { var tg = document.getElementById('toolGuideBody'); if (tg) tg.innerHTML = window.CTF_TOOLS_HELP_HTML(); }
  if (window.CTF_REFERENCE_HTML) $('#refContent').innerHTML = window.CTF_REFERENCE_HTML();
  if (window.CTF_PACK_HTML) $('#packContent').innerHTML = window.CTF_PACK_HTML();

  // Surprise me: open a random unsolved challenge (any if all solved)
  function surprise() {
    var pool = CH.filter(function (c) { return !S.solved[c.id]; });
    if (!pool.length) pool = CH;
    if (window.CTFCloseNav) window.CTFCloseNav();
    show('board'); openChal(pool[Math.floor(Math.random() * pool.length)].id);
  }
  var rb = document.getElementById('randomBtn'); if (rb) rb.addEventListener('click', surprise);
  var ns = document.getElementById('navSurprise'); if (ns) ns.addEventListener('click', surprise);
  var nc = document.getElementById('navContinue'); if (nc) nc.addEventListener('click', function () { if (window.CTFCloseNav) window.CTFCloseNav(); openRecommended(); });
  var nhs = document.getElementById('navHideSolved'); if (nhs) nhs.addEventListener('change', function () { setHideSolved(this.checked); });
  // Teacher: challenge list CSV (no answers)
  var clc = document.getElementById('challengeListCsv');
  if (clc) clc.addEventListener('click', function () {
    var lines = [['ID', 'Title', 'Category', 'Difficulty', 'Points'].join(',')];
    CH.forEach(function (c) {
      var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
      lines.push([c.id, '"' + c.title.replace(/"/g, '""') + '"', cat.name, TIERS[c.tier].name, c.pts].join(','));
    });
    download('MrButlersCTF-challenge-list.csv', lines.join('\n'), 'text/csv');
    toast('Challenge list downloaded');
  });
  // print action (Reference page)
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="print"]')) { e.preventDefault(); window.print(); }
    // print one classroom-pack handout on its own
    var ph = e.target.closest('[data-print-handout]');
    if (ph) {
      e.preventDefault();
      var id = ph.getAttribute('data-print-handout');
      var h = document.querySelector('.handout[data-handout="' + id + '"]');
      if (h) {
        $$('.handout').forEach(function (x) { x.classList.remove('printing'); });
        h.classList.add('printing'); document.body.classList.add('printing-handout');
        window.print();
        setTimeout(function () { document.body.classList.remove('printing-handout'); h.classList.remove('printing'); }, 600);
      }
    }
    // print the whole pack
    if (e.target.closest('#printAllPack')) {
      e.preventDefault();
      document.body.classList.add('printing-pack'); window.print();
      setTimeout(function () { document.body.classList.remove('printing-pack'); }, 600);
    }
  });

  // ---------- hooks for features.js (badges, daily challenge, streaks, certificate) ----------
  window.CTF.getState = function () { return S; };
  window.CTF.openChal = openChal;
  window.CTF.show = show;
  window.CTF.CH = CH; window.CTF.CATS = CATS; window.CTF.TIERS = TIERS;
  window.CTF.rankName = function () { var e = document.getElementById('rankName'); return e ? e.textContent : ''; };

  // ---------- boot ----------
  // home screen wiring
  var brandEl = document.querySelector('.brand');
  if (brandEl) { brandEl.style.cursor = 'pointer'; brandEl.setAttribute('role', 'link'); brandEl.setAttribute('tabindex', '0'); brandEl.setAttribute('title', 'Home');
    brandEl.addEventListener('click', function () { show('home'); });
    brandEl.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); show('home'); } }); }
  var homeAboutBtn = document.getElementById('homeAboutBtn');
  if (homeAboutBtn) homeAboutBtn.addEventListener('click', function () {
    var p = document.getElementById('homeAbout'), open = p.hidden; p.hidden = !open; homeAboutBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });

  renderChips(); renderBoard(); refreshHeader(); renderTeacher(); updateModeUI(); renderBanners(); renderHome();
  if (!S.name) setTimeout(function () { var w = $('#playerName'); w.style.color = 'var(--amber)'; }, 300);
  var hash = location.hash.replace('#', '');
  if (BY_ID[hash]) openChal(hash);
})();
