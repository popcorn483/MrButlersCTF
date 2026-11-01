/* App updates — matches the Digital Technology app. Every deploy ships a new service worker and a
   version.json { version, date, notes }. A waiting worker shows "A new version is available" with
   Update now / Later; after updating, a one-time "What's new" popup lists the patch notes. Checks on
   launch, when the app becomes visible again, and every 30 minutes. */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator)) return;
  var APP_NAME = "Mr B's CTF Practice";
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var ss = function (k, v) { try { if (v === undefined) return sessionStorage.getItem(k); sessionStorage.setItem(k, v); } catch (e) { return null; } };
  var ls = function (k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  var icon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a8 8 0 11-2.34-5.66M20 4v4.5h-4.5"/></svg>';
  function toast(cls, html) { var old = document.querySelector('.upd'); if (old) old.remove(); var d = document.createElement('div'); d.className = 'upd ' + cls; d.setAttribute('role', 'status'); d.innerHTML = html; document.body.appendChild(d); return d; }

  navigator.serviceWorker.ready.then(function (reg) {
    if (window.__appUpd) return; window.__appUpd = true;
    var want = false, shown = null;
    function offer(w) {
      if (!w || ss('mbctf-upd-later') === '1' || shown === w) return; shown = w;
      var d = toast('upd-new', icon + '<div><b>A new version of ' + APP_NAME + ' is available</b><span>Update now to get the latest features and fixes.</span></div><button type="button" class="upd-go">Update now</button><button type="button" class="upd-later">Later</button>');
      d.querySelector('.upd-go').addEventListener('click', function () {
        want = true; ss('mbctf-upd-reloading', '1');
        var ww = reg.waiting || w;
        if (ww) ww.postMessage({ type: 'SKIP_WAITING' }); else location.reload();
        var go = d.querySelector('.upd-go'); go.disabled = true; go.textContent = 'Updating…';
        setTimeout(function () { if (want) location.reload(); }, 4000);
      });
      d.querySelector('.upd-later').addEventListener('click', function () { ss('mbctf-upd-later', '1'); d.remove(); });
    }
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', function () { var w = reg.installing; if (w) w.addEventListener('statechange', function () { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); }); });
    var reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (!want || reloaded) return; reloaded = true; want = false; location.reload(); });

    var vurl = new URL('version.json', location.href).href;
    function getV() { return fetch(vurl, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }); }
    function check() { reg.update().catch(function () { }); return getV(); }
    function running() {
      return new Promise(function (res) {
        var c = navigator.serviceWorker.controller; if (!c) return res(null);
        var t = setTimeout(function () { res(null); }, 3000);
        var on = function (ev) { if (ev.data && ev.data.type === 'VERSION') { clearTimeout(t); navigator.serviceWorker.removeEventListener('message', on); res(ev.data.version); } };
        navigator.serviceWorker.addEventListener('message', on); c.postMessage({ type: 'VERSION' });
      });
    }
    Promise.all([running(), getV()]).then(function (arr) {
      var run = arr[0], v = arr[1], ver = run || (v && v.version); if (!ver) return;
      window.__appVersion = ver;
      Array.prototype.forEach.call(document.querySelectorAll('[data-app-ver]'), function (e) { e.textContent = 'Version ' + ver.replace(/^mbctf-/, '') + (v && v.version === ver && v.date ? ' · ' + v.date : ''); });
      var seen = ls('mbctf-app-version');
      if (seen && seen !== ver && v && v.version === ver && v.notes && v.notes.length) {
        var d = toast('upd-wn', icon + "<div><b>What's new</b><ul>" + v.notes.slice(0, 5).map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul></div><button type="button" class="upd-later" aria-label="Close">Great!</button>');
        d.querySelector('.upd-later').addEventListener('click', function () { d.remove(); });
      }
      ls('mbctf-app-version', ver);
    });
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') check(); });
    setInterval(check, 30 * 60 * 1000);
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-app-check]'); if (!b) return;
      e.preventDefault(); var lab = b.querySelector('span') || b, was = lab.textContent; lab.textContent = 'Checking…';
      check().then(function () { setTimeout(function () { lab.textContent = reg.waiting ? 'Update available' : 'You have the latest version'; if (reg.waiting) offer(reg.waiting); setTimeout(function () { lab.textContent = was; }, 3000); }, 1000); });
    });
    window.__appReg = reg;
  });
})();
