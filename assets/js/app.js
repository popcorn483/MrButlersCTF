/* Mr Butler's CTF — main app: board, challenge modal, flags, progress, teacher view */
(function () {
  'use strict';

  // ---------- decode challenge bundle (lightly scrambled so answers aren't sitting in plain text) ----------
  function decodeBundle(b64, key) {
    var bin = atob(b64), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i) ^ key.charCodeAt(i % key.length);
    return JSON.parse(new TextDecoder().decode(out));
  }
  var DATA = decodeBundle(window.CTF_BUNDLE, window.CTF_KEY);
  var CH = DATA.challenges, CATS = DATA.cats;
  var BY_ID = {}; CH.forEach(function (c) { BY_ID[c.id] = c; });
  window.CTF = { DATA: DATA, BY_ID: BY_ID };

  var TIERS = [null,
    { name: 'Beginner', cls: 't1' }, { name: 'Easy', cls: 't2' }, { name: 'Medium', cls: 't3' },
    { name: 'Hard', cls: 't4' }, { name: 'Expert', cls: 't5' }];
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
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) { } }
  function score() { var p = 0; Object.keys(S.solved).forEach(function (id) { if (BY_ID[id] && !S.solved[id].r) p += BY_ID[id].pts; }); return p; }
  function solvedCount() { return Object.keys(S.solved).filter(function (id) { return BY_ID[id]; }).length; }
  // Hard (tier 4) and Expert (tier 5) challenges in a category stay locked until
  // the pupil has solved a few of the easier ones (tier <= 3) in that same category.
  function catUnlock(catId) {
    var easier = CH.filter(function (c) { return c.cat === catId && c.tier <= 3; });
    var need = Math.min(3, easier.length);
    var have = easier.filter(function (c) { return S.solved[c.id]; }).length;
    return { locked: need > 0 && have < need, need: need, have: have };
  }

  // ---------- header / rank ----------
  function refreshHeader() {
    $('#playerName').textContent = S.name || 'Set your name';
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
  function askName() {
    var n = prompt('Your name (or team name). This goes on your progress file for your teacher:', S.name || '');
    if (n !== null) { S.name = n.trim().slice(0, 40); save(); refreshHeader(); }
  }

  // ---------- navigation ----------
  var LEARN_VIEWS = ['start', 'lessons', 'walkthrough', 'resources', 'reference', 'pack'];
  function closeLearnMenu() {
    var lm = document.getElementById('learnMenu'), lt = document.getElementById('learnToggle');
    if (lm) lm.hidden = true; if (lt) lt.setAttribute('aria-expanded', 'false');
  }
  function show(view) {
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
  var F = { tiers: { 1: true, 2: true, 3: true, 4: true, 5: true }, q: '', hide: false };
  function renderChips() {
    ['#tierChips', '#navTierChips'].forEach(function (sel) {
      var box = document.querySelector(sel); if (!box) return;
      box.innerHTML = '';
      for (var t = 1; t <= 5; t++) {
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
  function renderBoard() {
    var board = $('#board'); board.innerHTML = '';
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
      if (!list.length && !hiddenHard.length) return;
      var all = CH.filter(function (c) { return c.cat === cat.id; });
      var done = all.filter(function (c) { return S.solved[c.id]; }).length;
      var sec = document.createElement('section'); sec.className = 'cat';
      sec.innerHTML = '<div class="cat-head"><div class="cat-title"><span class="cat-icon">' + cat.icon + '</span>' + esc(cat.name) +
        '</div><div class="cat-blurb">' + esc(cat.blurb) + '</div><button class="cat-guide" data-guide="' + cat.id + '">How to approach</button>' +
        '<div class="cat-count">' + done + '/' + all.length + '</div></div><div class="tiles"></div>';
      var tiles = $('.tiles', sec);
      list.forEach(function (c) {
        var b = document.createElement('button');
        b.className = 'tile ' + TIERS[c.tier].cls + (S.solved[c.id] ? ' solved' : '') + (S.tut && S.tut[c.id] ? ' tut-used' : '');
        b.innerHTML = (S.tut && S.tut[c.id] ? '<span class="tut-mark" title="Tutorial used">📘</span>' : '') + '<div class="tile-title">' + esc(c.title) + '</div><div class="tile-foot"><span>' + TIERS[c.tier].name + '</span><span class="tile-pts">' + c.pts + '</span></div>';
        b.addEventListener('click', function () { openChal(c.id); });
        tiles.appendChild(b);
      });
      if (hiddenHard.length) {
        var remain = unlock.need - unlock.have;
        var lb = document.createElement('button'); lb.className = 'tile tile-locked';
        lb.innerHTML = '<span class="lock-ic">🔒</span><div class="tile-title">' + hiddenHard.length + ' harder challenge' + (hiddenHard.length > 1 ? 's' : '') +
          '</div><div class="tile-foot"><span>Solve ' + remain + ' more here to unlock</span></div>';
        lb.addEventListener('click', function () { toast('🔒 Solve ' + remain + ' more ' + cat.name + ' challenge' + (remain > 1 ? 's' : '') + ' to unlock the harder ones.'); });
        tiles.appendChild(lb);
      }
      board.appendChild(sec);
    });
    if (!board.children.length) board.innerHTML = '<div class="empty">No challenges match those filters.</div>';
    renderRecommend();
  }
  function nextRecommended() {
    var unsolved = CH.filter(function (c) { return !S.solved[c.id]; });
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
    current = c;
    var cat = CATS.filter(function (x) { return x.id === c.cat; })[0];
    var card = $('#chalModal .modal-card');
    card.className = 'modal-card ' + TIERS[c.tier].cls;
    $('#chalMeta').innerHTML = '<span class="tag">' + cat.icon + ' ' + esc(cat.name) + '</span><span class="tag tier">' + TIERS[c.tier].name +
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
        if (act === 'dl') { if (f.url) { var a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); } else download(f.name, f.text, 'text/plain'); }
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
    var base = (c.walk && c.walk.length) ? c.walk.slice() : (c.hints || []).slice();
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
  function assistOff() { return testLive() || viewMode === 'real'; }
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
    safety: 'Online-safety questions are scenarios — a suspicious link, a reused password, an oversharing post. The clue is hidden in the <i>details</i> of the scenario: one specific thing is the risk. Solving it is spotting which detail would actually get someone caught out.'
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
      var mine = lastTry[c.id];
      var useWalk = c.walk && c.walk.length;
      var steps = (useWalk ? c.walk : (c.hints || [])).map(function (h) { return '<li>' + h + '</li>'; }).join('');
      box.innerHTML = '<div class="hint-box answer-box"><div class="hint-warn">📖 Full walkthrough</div>' +
        clueBlock(c) +
        (steps ? '<p><b>' + (useWalk ? 'Thinking it through:' : 'Step by step:') + '</b></p><ol class="walk">' + steps + '</ol>' : '') +
        (c.sol ? '<p><b>Why it works:</b> ' + c.sol + '</p>' : '') +
        '<p class="flag-reveal">The flag is <code>' + esc(c.f) + '</code></p>' +
        (mine ? '<p>Your last answer was <code>' + esc(mine) + '</code> ' + (mine.toLowerCase() === c.f.toLowerCase() ? '<span class="ok-tick">✓ that matches</span>' : '✗ which does not match') + '</p>' : '') +
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
    var c = current; if (!c) return;
    var raw = $('#flagInput').value.trim(), msg = $('#flagMsg');
    if (!raw) return;
    var norm = raw.toLowerCase();
    lastTry[c.id] = raw;
    if (sha256(norm) === c.h) {
      if (!S.solved[c.id]) {
        var rv = S.revealed[c.id] ? 1 : 0;
        var firstTry = !(S.tries && S.tries[c.id]);
        S.solved[c.id] = { t: Date.now(), p: sha256(S.pid + '|' + norm).slice(0, 16), h: S.hints[c.id] || 0, r: rv };
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
      return;
    }
    S.wrong++; if (!S.tries) S.tries = {}; S.tries[c.id] = (S.tries[c.id] || 0) + 1; save();
    var tries = S.tries[c.id];
    msg.className = 'flag-msg bad';
    if (!/^flag\{.*\}$/i.test(raw) && !/^\w+\{/.test(raw) && sha256('flag{' + norm + '}') === c.h) {
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
  });
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
    $('#chalMeta').innerHTML = '<span class="tag">' + cat.icon + ' ' + esc(cat.name) + '</span><span class="tag tier">' + TIERS[c.tier].name +
      '</span><span class="tag pts">' + c.pts + ' pts</span><span class="tag">' + esc(c.id) + '</span><span class="tag done">✓ solved</span>';
  }

  // ---------- progress ----------
  function renderProgress() {
    var sc = score(), n = solvedCount(), hintsUsed = Object.keys(S.hints).reduce(function (s, k) { return s + S.hints[k]; }, 0), revCount = Object.keys(S.revealed || {}).length, tutCount = Object.keys(S.tut || {}).filter(function (id) { return BY_ID[id]; }).length;
    var tierDone = [0, 0, 0, 0, 0, 0];
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
      [1, 2, 3, 4, 5].map(function (t) {
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
    var payload = { app: 'MrButlersCTF', v: 1, pid: S.pid, name: S.name, exported: Date.now(), score: score(), solved: S.solved, hints: S.hints, revealed: S.revealed, tries: S.tries, tut: S.tut, wrong: S.wrong, created: S.created };
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
    save(); markSaved(); refreshHeader(); renderBoard(); renderProgress();
    try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (e) { }
    return added;
  }

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
    try { document.dispatchEvent(new CustomEvent('ctf:refresh')); } catch (e) { }
  });

  // ---------- teacher ----------
  var T = { rows: [], key: {}, sort: 'pts' };
  CH.forEach(function (c) { T.key[c.id] = c.f; });
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
  $('#teacherClear').addEventListener('click', function () { T.rows = []; renderTeacher(); $('#teacherMsg').hidden = true; });
  function rowStats(r) {
    var d = r.data, pts = 0, n = 0, unv = 0, tiers = [0, 0, 0, 0, 0, 0], last = 0;
    Object.keys(d.solved || {}).forEach(function (id) {
      var c = BY_ID[id]; if (!c) return;
      var s = d.solved[id], valid = true;
      if (T.key && T.key[id]) valid = !!s.p && sha256(d.pid + '|' + T.key[id].toLowerCase()).slice(0, 16) === s.p;
      if (!valid) { unv++; return; }
      if (!s.r) pts += c.pts; n++; tiers[c.tier]++; last = Math.max(last, s.t);
    });
    var hints = Object.keys(d.hints || {}).reduce(function (s, k) { return s + d.hints[k]; }, 0), rev = Object.keys(d.revealed || {}).length;
    var tutIds = Object.keys(d.tut || {}).filter(function (id) { return BY_ID[id]; });
    return { name: d.name || '(no name)', pts: pts, n: n, unv: unv, rev: rev, tiers: tiers, hints: hints, tut: tutIds.length, tutIds: tutIds, last: last, ok: r.ok, file: r.file };
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
    if (!T.rows.length) { box.innerHTML = '<p class="muted">No files loaded yet.</p>'; return; }
    var rows = T.rows.map(rowStats);
    var k = T.sort;
    rows.sort(function (a, b) { return k === 'name' ? a.name.localeCompare(b.name) : (b[k] - a[k]) || (a.last - b.last); });
    box.innerHTML = '<table class="lb"><thead><tr><th>#</th><th data-k="name">Name</th><th data-k="pts">Points</th><th data-k="n">Flags</th>' +
      [1, 2, 3, 4, 5].map(function (t) { return '<th>' + TIERS[t].name + '</th>'; }).join('') +
      '<th data-k="hints">Hints</th><th data-k="tut">Tutorials</th><th data-k="rev">Answers revealed</th><th>Last solve</th><th>File</th></tr></thead><tbody>' +
      rows.map(function (r, i) {
        return '<tr><td class="num">' + (i + 1) + '</td><td>' + esc(r.name) + '</td><td class="num">' + r.pts + '</td><td class="num">' + r.n + '</td>' +
          [1, 2, 3, 4, 5].map(function (t) { return '<td class="num">' + r.tiers[t] + '</td>'; }).join('') +
          '<td class="num">' + r.hints + '</td><td class="num' + (r.tut ? ' tut-cell' : '') + '">' + r.tut + '</td><td class="num">' + r.rev + '</td><td class="num">' + (r.last ? fmtDate(r.last) : '-') + '</td><td>' +
          (r.ok ? '<span class="badge good">ok</span>' : '<span class="badge bad">edited</span>') +
          (r.unv ? ' <span class="badge bad">' + r.unv + ' unverified</span>' : '') + '</td></tr>';
      }).join('') + '</tbody></table>' + struggleSummary();
    $$('th[data-k]', box).forEach(function (th) { th.addEventListener('click', function () { T.sort = th.dataset.k === 'pts' ? 'pts' : th.dataset.k; renderTeacher(); }); });
    T.lastRows = rows;
  }
  $('#teacherCsv').addEventListener('click', function () {
    if (!T.lastRows) return toast('Load some files first');
    var lines = [['Rank', 'Name', 'Points', 'Flags', 'Beginner', 'Easy', 'Medium', 'Hard', 'Expert', 'Hints', 'Tutorials used', 'Answers revealed', 'Unverified', 'Last solve'].join(',')];
    T.lastRows.forEach(function (r, i) {
      lines.push([i + 1, '"' + r.name.replace(/"/g, '""') + '"', r.pts, r.n, r.tiers[1], r.tiers[2], r.tiers[3], r.tiers[4], r.tiers[5], r.hints, r.tut, r.rev, r.unv, r.last ? new Date(r.last).toISOString() : ''].join(','));
    });
    download('MrButlersCTF-leaderboard.csv', lines.join('\n'), 'text/csv');
  });

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
