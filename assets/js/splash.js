/* Launch splash — styled to match the Digital Technology sister app: navy screen, circuit traces
   drawing in, the Lemon Milk wordmark, and a rainbow strip. Shown once per browser session and on
   every launch of the installed app; tap, click or any key skips it. The page loads underneath. */
(function () {
  'use strict';
  var mm = function (q) { try { return window.matchMedia(q).matches; } catch (e) { return false; } };
  var app = mm('(display-mode: standalone)') || navigator.standalone === true, nav = '';
  try { var ne = performance.getEntriesByType('navigation')[0]; nav = ne ? ne.type : ''; } catch (e) { }
  var launch = app && !document.referrer && nav !== 'reload' && nav !== 'back_forward', seen = false;
  try { seen = sessionStorage.getItem('mbctf-splash') === '1'; sessionStorage.setItem('mbctf-splash', '1'); } catch (e) { }
  if (seen && !launch) return;
  var rm = mm('(prefers-reduced-motion: reduce)');
  var HD = ['#1F5FBF', '#0B7A70', '#6A45C2', '#B5306A', '#A0560A', '#2B7A33', '#3F4FB0', '#00708A', '#BE3B12', '#8B3A9C'];
  var HL = ['#8AB6FF', '#4FD6C6', '#BDA2FF', '#FF8FBC', '#F5B25C', '#85D68C', '#A8B2FF', '#5CD3EE', '#FF9E78', '#E59AF2'];
  var port = (window.innerHeight || 1) > (window.innerWidth || 1), VB = port ? '0 0 300 400' : '0 0 400 300';
  var T = port ? [['M-10 70H50L80 100H120', 0], ['M310 48H240L210 78H180', 2], ['M90 -10V30L115 55', 8], ['M-10 330H52L82 300H125', 4],
    ['M310 352H246L216 322H176', 7], ['M215 410V372L190 347', 1], ['M-10 128H30', 5], ['M310 272H268', 9]]
    : [['M-10 70H70L100 100H150', 0], ['M410 52H330L300 82H262', 2], ['M-10 232H58L88 202H138', 4], ['M410 246H344L314 216H258', 7],
    ['M120 -10V30L150 60', 8], ['M286 310V272L256 242', 1], ['M-10 150H40', 5], ['M410 150H362', 9]];
  var svg = '<svg class="sp-c" viewBox="' + VB + '" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + T.map(function (t, i) {
    var cur = [0, 0];
    t[0].match(/[MHVL][^MHVL]*/g).forEach(function (s) { var c = s[0], v = s.slice(1).trim().split(/\s+/).map(Number); if (c === 'M' || c === 'L') cur = [v[0], v[1]]; else if (c === 'H') cur = [v[0], cur[1]]; else cur = [cur[0], v[0]]; });
    var x = cur[0], y = cur[1], dl = (i * 0.07).toFixed(2), c = HL[t[1]];
    return '<path d="' + t[0] + '" pathLength="1" stroke="' + c + '" style="animation-delay:' + dl + 's"/><circle cx="' + x + '" cy="' + y + '" r="4.2" stroke="' + c + '" style="animation-delay:' + (+dl + 0.8).toFixed(2) + 's"/>';
  }).join('') + '</svg>';
  var el = document.createElement('div');
  el.id = 'splash'; el.className = rm ? 'rm' : ''; el.setAttribute('aria-hidden', 'true');
  el.innerHTML = svg + '<div class="sp-lock"><span class="sp-flag" aria-hidden="true">⚑</span><span class="sp-mb">Mr Butler’s</span><span class="sp-dt">CTF Practice</span><span class="sp-strip">' + HD.map(function (c) { return '<i style="background:' + c + '"></i>'; }).join('') + '</span></div>';
  (document.body || document.documentElement).insertBefore(el, (document.body || document.documentElement).firstChild);
  var gone = false;
  function done() {
    if (gone) return; gone = true;
    window.removeEventListener('keydown', done, true);
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, rm ? 0 : 420);
  }
  el.addEventListener('pointerdown', function (e) { e.preventDefault(); done(); });
  el.addEventListener('click', done);
  window.addEventListener('keydown', done, true);
  setTimeout(done, rm ? 650 : 1550);
  window.__splash = { skip: done };
})();
