/* Share the app with students — a QR code to scan (works offline), a copyable link, and the
   native share sheet on phones. */
(function () {
  'use strict';
  function appUrl() { return location.origin + location.pathname; }
  function buildQR() {
    var box = document.getElementById('shareBox'); if (!box) return;
    try {
      var qr = qrcode(0, 'M'); qr.addData(appUrl()); qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 3, scalable: true });
    } catch (e) { box.innerHTML = '<p class="muted small">Couldn\'t draw a QR code here — use the link below.</p>'; }
  }
  function openShare() {
    buildQR();
    var u = document.getElementById('shareUrl'); if (u) u.textContent = appUrl();
    if (window.CTFModal) window.CTFModal.open('#shareModal');
  }
  var openers = ['homeShare'];
  openers.forEach(function (id) { var b = document.getElementById(id); if (b) b.addEventListener('click', openShare); });

  var copyBtn = document.getElementById('shareCopy');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    var url = appUrl(), done = function () { if (window.CTFUtil && CTFUtil.toast) CTFUtil.toast('Link copied — paste it into Teams or your board'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () {
      var t = document.getElementById('shareUrl'); if (t) { var r = document.createRange(); r.selectNodeContents(t); var s = getSelection(); s.removeAllRanges(); s.addRange(r); try { document.execCommand('copy'); } catch (e) { } }
      done();
    });
    else done();
  });
  var natBtn = document.getElementById('shareNative');
  if (natBtn) {
    if (!navigator.share) natBtn.hidden = true;
    else natBtn.addEventListener('click', function () {
      navigator.share({ title: "Mr B's CTF Practice", text: 'Practice capture-the-flag challenges for the competition.', url: appUrl() }).catch(function () { });
    });
  }
})();
