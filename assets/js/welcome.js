/* First-run welcome tour: a friendly orientation shown the very first time a pupil opens the site.
   Stored in localStorage so it only appears once; can be replayed from Getting started. */
(function () {
  'use strict';
  var KEY = 'mbctf-welcomed-v1';
  var STEPS = [
    { icon: '👋', title: "Welcome to Mr Butler's CTF!", body:
      "This is your training ground for the cyber security competition. It is friendly, you cannot break anything, and getting stuck is completely normal. Let's take 30 seconds to show you around." },
    { icon: '🚩', title: 'Everything is about finding a flag', body:
      "Each challenge hides a secret called a <b>flag</b>, written like <code>flag{like_this}</code>. Your job is to find it and type it in. When you do, you score points. That is the whole game!" },
    { icon: '🎯', title: 'The Challenge board', body:
      "Challenges are grouped into categories and get harder left to right. You never have to guess where to begin — the board always shows a <b>“Start here”</b> card pointing to a good next challenge for you." },
    { icon: '💡', title: 'Stuck? That is fine', body:
      "Every challenge has <b>hints</b> you can reveal one at a time, and if you are really stuck, a full <b>walkthrough</b> that talks you through it step by step. Use them to learn — that is exactly what they are for." },
    { icon: '🧰', title: 'Your Toolkit', body:
      "School PCs block some tools, so this site has its own. The <b>Decoder</b> cracks codes and ciphers, the <b>Hex viewer</b> opens files, and more. Each challenge tells you which tool to reach for." },
    { icon: '📚', title: 'Learn and save your progress', body:
      "The <b>Learn</b> menu has lessons that teach each skill from scratch. And before you log off, open <b>My progress</b> and copy your <b>resume code</b> (or download your file) — paste it back next time to carry on exactly where you left off, so nothing is lost." },
    { icon: '🔒', title: 'The Test area', body:
      "When you feel ready, the <b>Test area</b> is a timed mock with no hints — just like the real event. You will need a password from your teacher to start it." },
    { icon: '🚀', title: 'Ready to go!', body:
      "That is everything. The best way to learn is to dive in — shall we grab your very first flag together?", last: true }
  ];
  var i = 0, el = null;

  function build() {
    el = document.createElement('div');
    el.className = 'welcome-overlay'; el.id = 'welcomeOverlay';
    el.innerHTML =
      '<div class="welcome-card" role="dialog" aria-modal="true" aria-labelledby="wcTitle">' +
      '<button class="welcome-skip" id="wcSkip">Skip tour ✕</button>' +
      '<div class="welcome-icon" id="wcIcon"></div>' +
      '<h2 id="wcTitle"></h2>' +
      '<div class="welcome-body" id="wcBody"></div>' +
      '<div class="welcome-dots" id="wcDots"></div>' +
      '<div class="welcome-nav">' +
      '<button class="btn" id="wcBack">Back</button>' +
      '<button class="btn primary" id="wcNext">Next</button>' +
      '</div></div>';
    document.body.appendChild(el);
    el.querySelector('#wcSkip').addEventListener('click', finish);
    el.querySelector('#wcBack').addEventListener('click', function () { if (i > 0) { i--; render(); } });
    el.querySelector('#wcNext').addEventListener('click', next);
    el.addEventListener('click', function (e) { if (e.target === el) { /* keep focus; don't dismiss on backdrop */ } });
    document.addEventListener('keydown', onKey);
  }
  function onKey(e) {
    if (!el || el.hidden) return;
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') next();
    else if (e.key === 'ArrowLeft' && i > 0) { i--; render(); }
  }
  function render() {
    var s = STEPS[i];
    el.querySelector('#wcIcon').textContent = s.icon;
    el.querySelector('#wcTitle').innerHTML = s.title;
    el.querySelector('#wcBody').innerHTML = s.body;
    el.querySelector('#wcBack').style.visibility = i === 0 ? 'hidden' : 'visible';
    el.querySelector('#wcNext').textContent = s.last ? '🚩 Start my first challenge' : 'Next →';
    el.querySelector('#wcDots').innerHTML = STEPS.map(function (_, k) {
      return '<span class="wc-dot' + (k === i ? ' on' : '') + '"></span>';
    }).join('');
  }
  function next() {
    if (i < STEPS.length - 1) { i++; render(); return; }
    finish(true);
  }
  function finish(startFirst) {
    try { localStorage.setItem(KEY, '1'); } catch (e) { }
    document.removeEventListener('keydown', onKey);
    if (el) { el.remove(); el = null; }
    if (startFirst === true) {
      if (window.CTFShow) window.CTFShow('board');
      setTimeout(function () {
        var first = (window.CTF && window.CTF.BY_ID['warm-01']) ? 'warm-01' : null;
        if (first && window.CTFOpenChal) window.CTFOpenChal(first);
      }, 150);
    }
  }
  function open() { i = 0; if (!el) build(); el.hidden = false; render(); }
  window.CTFWelcome = { open: open };

  // replay link handler (Getting started page)
  document.addEventListener('click', function (e) {
    if (e.target.closest('[data-action="welcome"]')) { e.preventDefault(); open(); }
  });

  // show on first ever load
  var seen = false;
  try { seen = !!localStorage.getItem(KEY); } catch (e) { }
  if (!seen) setTimeout(open, 350);
})();
