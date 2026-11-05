/* Shared by the recon easter-egg pages: marks an egg as found so the main site celebrates it. */
window.mbEgg = function (id) {
  try { var k = 'mbctf-eggs-v1', s = JSON.parse(localStorage.getItem(k) || '{}') || {}; if (!s[id]) { s[id] = { t: Date.now(), n: 1 }; localStorage.setItem(k, JSON.stringify(s)); } } catch (e) { }
};
window.mbHome = function () { var p = location.pathname.split('/').filter(Boolean)[0]; return (p && /mrbutlersctf/i.test(p)) ? '/' + p + '/' : '/'; };
