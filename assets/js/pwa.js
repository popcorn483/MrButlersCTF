/* PWA glue: register the service worker and wire the "Get the app" install flow. */
(function () {
  'use strict';
  // register the service worker (relative path → works under a GitHub Pages subpath)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline install just won't be available */ });
    });
  }

  var deferred = null;
  var oneTap = document.getElementById('installOneTap');
  var installBtn = document.getElementById('pwaInstallBtn');
  var getApp = document.getElementById('getAppBtn');

  // Android/Chrome: capture the install prompt so we can offer a one-tap button
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault(); deferred = e;
    if (oneTap) oneTap.hidden = false;
  });
  window.addEventListener('appinstalled', function () {
    deferred = null; if (oneTap) oneTap.hidden = true;
    if (window.CTFUtil && CTFUtil.toast) CTFUtil.toast('Installed! Look for the CTF icon on your home screen.');
  });

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  function openInstall() {
    if (isStandalone()) { if (window.CTFUtil && CTFUtil.toast) CTFUtil.toast('You are already using the installed app 🎉'); return; }
    if (window.CTFModal) window.CTFModal.open('#installModal');
  }
  if (getApp) getApp.addEventListener('click', openInstall);
  var homeInstall = document.getElementById('homeInstall');
  if (homeInstall) homeInstall.addEventListener('click', openInstall);

  if (installBtn) installBtn.addEventListener('click', function () {
    if (!deferred) return;
    deferred.prompt();
    deferred.userChoice.then(function () { deferred = null; if (oneTap) oneTap.hidden = true; });
  });
})();
