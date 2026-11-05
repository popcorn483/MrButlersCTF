/* Easter eggs for Mr B's CTF Practice.
   Just for fun: nothing here touches flags, scores or progress. Found eggs are kept in this browser only.
   Curious? Good. That's the whole point of a CTF. 🥚 */
(function () {
  'use strict';
  var KEY = 'mbctf-eggs-v1';
  var R = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- the collection ----------
  var EGGS = [
    ['konami', '🎮', 'Cheat code', 'Old games had a famous button combo. Arrow keys might help.'],
    ['matrix', '🟩', 'Follow the white rabbit', 'Type the name of a famous hacker film.'],
    ['hackerman', '💻', 'Hackerman', 'Type what every pupil secretly wants to be called.'],
    ['terminal', '⌨️', 'Root shell (sort of)', 'A key in the top-left corner opens something.'],
    ['catsecret', '📄', 'Read the secret', 'Inside the shell, some files are worth reading.'],
    ['dotfile', '🫥', 'Hidden files', 'Inside the shell, list everything — even the hidden stuff.'],
    ['sudo', '🚨', 'Not in the sudoers file', 'Ask nicely, as root.'],
    ['xss', '🛡️', 'Script kiddie', 'Try a classic cross-site scripting payload in a flag box.'],
    ['sqli', '🧑‍🍳', 'Little Bobby Tables', 'Try a classic SQL injection in a flag box.'],
    ['traversal', '📂', 'Dot dot slash', 'Try climbing out of the folder in a flag box.'],
    ['ssti', '🧮', 'Template maths', 'Some template engines do sums inside double curly brackets.'],
    ['cmdi', '🐚', 'Command injection', 'Try chaining a shell command in a flag box.'],
    ['jndi', '🧊', 'Blast from 2021', 'A famous logging bug started with a dollar sign.'],
    ['overflow', '💥', 'Buffer overflow', 'What happens if you just hold down A?'],
    ['rmrf', '🔥', 'Please don’t', 'The most dangerous Linux command there is.'],
    ['teapot', '🫖', 'HTTP 418', 'Type your teacher’s favourite drink.'],
    ['cookie', '🍪', 'Cookie monster', 'Websites love these. Type one.'],
    ['duck', '🦆', 'Rubber duck debugging', 'A clue is hidden in this page’s HTML, in ROT13.'],
    ['sourcerer', '🧙', 'Sourcerer', 'A clue is hidden in this page’s HTML, in hex.'],
    ['fakeflag', '🚩', 'Free flag?!', 'Type the thing you’re hunting for.'],
    ['answer', '🌌', 'Life, the universe and everything', 'Type the answer.'],
    ['xyzzy', '🕳️', 'Nothing happens', 'A magic word from the oldest adventure game.'],
    ['barrel', '🌀', 'Barrel roll', 'Type an instruction a pilot might hear.'],
    ['gravity', '🍎', 'Gravity', 'Type what Newton discovered.'],
    ['snow', '❄️', 'Let it snow', 'Type something cold and white.'],
    ['fireworks', '🎆', 'Boom', 'Type the sound fireworks make.'],
    ['logo', '⚑', 'Flag waver', 'Click the flag in the top-left corner. A lot.'],
    ['credits', '🎬', 'Roll the credits', 'Triple-click the version number at the bottom.'],
    ['screensaver', '📺', 'Screensaver', 'Leave the site alone for a few minutes.'],
    ['corner', '🎯', 'The perfect corner', 'Wait for the screensaver to hit a corner.'],
    ['leet', '🕐', 'Leet o’clock', 'Be on the site at a very hacker time of day.'],
    ['tabaway', '👀', 'Come back!', 'Switch to another tab for a bit, then come back.'],
    ['seasonal', '📅', 'Special occasion', 'Visit on a special day of the year.'],
    ['console', '🖥️', 'Console cowboy', 'Developers have a hidden place to type commands.'],
    ['privesc', '👑', 'Privilege escalation', 'This site sets a cookie. What if it said something else?'],
    ['robots', '🤖', 'Beep boop', 'Good recon starts with a file robots read.'],
    ['secret', '🗝️', 'The secret page', 'Robots were told not to look somewhere.'],
    ['admin', '🔐', 'Admin panel', 'Most sites have one. Guess the address.'],
    ['weakpw', '🤦', 'Worst password ever', 'On the admin page, try the most common password.'],
    ['lost', '🧭', 'Lost in cyberspace', 'Try visiting a page that doesn’t exist, like flag.txt.'],
    ['disclosure', '📮', 'Responsible disclosure', 'Security researchers read a special file in .well-known.']
  ];
  var BY = {}; EGGS.forEach(function (e) { BY[e[0]] = e; });
  function store() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { } }
  function count() { var s = store(); return EGGS.filter(function (e) { return s[e[0]]; }).length; }
  function award(id) {
    var s = store(), e = BY[id]; if (!e) return;
    if (s[id] && !s[id].n) return;
    s[id] = { t: (s[id] && s[id].t) || Date.now() }; save(s);
    eggToast(e[1] + ' <b>Easter egg found!</b> ' + esc(e[2]) + '<span class="egg-n">' + count() + ' / ' + EGGS.length + '</span>');
  }
  function esc(t) { return String(t).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function once(k) { var d = new Date().toISOString().slice(0, 10), kk = 'mbctf-egg-once-' + k; try { if (localStorage.getItem(kk) === d) return false; localStorage.setItem(kk, d); } catch (e) { } return true; }

  // ---------- toasts ----------
  var tray;
  function eggToast(html, ms) {
    if (!tray) { tray = document.createElement('div'); tray.className = 'egg-tray'; tray.setAttribute('aria-live', 'polite'); document.body.appendChild(tray); }
    var t = document.createElement('div'); t.className = 'egg-toast'; t.innerHTML = html; tray.appendChild(t);
    t.addEventListener('click', function () { t.remove(); });
    setTimeout(function () { t.classList.add('out'); setTimeout(function () { t.remove(); }, 400); }, ms || 4200);
  }
  // ---------- overlays ----------
  var open = 0;
  function layer(cls, html, ms, onClose) {
    var d = document.createElement('div'); d.className = 'egg-layer ' + (cls || ''); d.innerHTML = html; document.body.appendChild(d); open++;
    var done = false;
    function close() { if (done) return; done = true; open--; d.classList.add('out'); document.removeEventListener('keydown', k, true); setTimeout(function () { d.remove(); }, 350); if (onClose) onClose(); }
    function k(e) { if (e.key === 'Escape') { e.stopPropagation(); close(); } }
    document.addEventListener('keydown', k, true);
    d.addEventListener('click', function (e) { if (e.target === d || e.target.closest('[data-egg-x]')) close(); });
    if (ms) setTimeout(close, ms);
    d.close = close; return d;
  }
  function msg(cls, icon, title, body, ms) {
    return layer('egg-center ' + (cls || ''), '<div class="egg-card"><div class="egg-big">' + icon + '</div><h3>' + title + '</h3>' + (body ? '<p>' + body + '</p>' : '') + '<button class="egg-x" data-egg-x>Close</button></div>', ms || 6000);
  }
  function typeLines(lines, title, cls, ms) {
    var d = layer('egg-center', '<div class="egg-term ' + (cls || '') + '"><div class="egg-bar"><i></i><i></i><i></i><span>' + esc(title || 'bash') + '</span><button class="egg-bx" data-egg-x aria-label="Close">✕</button></div><pre></pre></div>', ms || 9000);
    var pre = d.querySelector('pre'), i = 0;
    (function step() { if (i >= lines.length || !d.isConnected) return; pre.innerHTML += lines[i++] + '\n'; pre.scrollTop = 1e6; setTimeout(step, R ? 0 : 110 + Math.random() * 120); })();
    return d;
  }

  // ---------- particles (confetti, fireworks, emoji rain, snow) ----------
  var FX = { c: null, x: null, p: [], on: false };
  var COLS = ['#52E6A3', '#8AB6FF', '#F5B25C', '#FF8FBC', '#BDA2FF', '#5CD3EE', '#FFD45C', '#FF9E78'];
  function fx() {
    if (!FX.c) {
      FX.c = document.createElement('canvas'); FX.c.className = 'egg-fx'; FX.c.setAttribute('aria-hidden', 'true'); document.body.appendChild(FX.c); FX.x = FX.c.getContext('2d');
      var rs = function () { var r = window.devicePixelRatio || 1; FX.c.width = innerWidth * r; FX.c.height = innerHeight * r; FX.x.setTransform(r, 0, 0, r, 0, 0); };
      rs(); addEventListener('resize', rs);
    }
    if (!FX.on) { FX.on = true; requestAnimationFrame(loop); }
  }
  function loop() {
    var x = FX.x; x.clearRect(0, 0, innerWidth, innerHeight);
    FX.p = FX.p.filter(function (p) {
      p.vx *= p.d; p.vy = p.vy * p.d + p.g; p.x += p.vx + (p.sw ? Math.sin(p.life / 18 + p.ph) * p.sw : 0); p.y += p.vy; p.r += p.vr; p.life--;
      if (p.life <= 0 || p.y > innerHeight + 60) return false;
      x.save(); x.globalAlpha = Math.min(1, p.life / 30); x.translate(p.x, p.y); x.rotate(p.r);
      if (p.ch) { x.font = p.s + 'px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(p.ch, 0, 0); }
      else if (p.dot) { x.fillStyle = p.c; x.beginPath(); x.arc(0, 0, p.s, 0, 7); x.fill(); }
      else { x.fillStyle = p.c; x.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
      x.restore(); return true;
    });
    if (FX.p.length) requestAnimationFrame(loop); else { FX.on = false; x.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function add(p) { FX.p.push(Object.assign({ vx: 0, vy: 0, g: 0, d: 1, r: 0, vr: 0, life: 200, s: 8, c: pick(COLS), sw: 0, ph: Math.random() * 6 }, p)); }
  function confetti(x, y, n) {
    if (R) return; fx(); x = x == null ? innerWidth / 2 : x; y = y == null ? innerHeight / 3 : y;
    for (var i = 0; i < (n || 140); i++) add({ x: x, y: y, vx: rnd(-9, 9), vy: rnd(-14, -3), g: .32, d: .985, vr: rnd(-.3, .3), life: rnd(110, 200), s: rnd(7, 12) });
  }
  function burst(x, y) {
    var c = pick(COLS);
    for (var i = 0; i < 70; i++) { var a = Math.random() * 6.283, v = rnd(1.5, 6); add({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: .05, d: .975, life: rnd(60, 100), s: rnd(1.6, 2.8), c: Math.random() < .2 ? '#fff' : c, dot: 1 }); }
  }
  function fireworks(n) {
    if (R) return; fx(); n = n || 8;
    for (var i = 0; i < n; i++) setTimeout(function () { burst(rnd(innerWidth * .15, innerWidth * .85), rnd(innerHeight * .12, innerHeight * .5)); }, i * 380 + rnd(0, 200));
  }
  function rain(chars, n, dur) {
    if (R) return; fx(); dur = dur || 3500;
    for (var i = 0; i < n; i++) setTimeout(function () { add({ ch: pick(chars), x: rnd(0, innerWidth), y: -30, vx: rnd(-.6, .6), vy: rnd(2, 4.5), g: .03, vr: rnd(-.05, .05), life: 600, s: rnd(22, 38) }); }, Math.random() * dur);
  }
  function snow(dur) {
    if (R) return; fx(); dur = dur || 8000;
    var n = Math.min(260, innerWidth / 5);
    for (var i = 0; i < n; i++) setTimeout(function () { add({ x: rnd(0, innerWidth), y: -10, vy: rnd(.6, 1.8), sw: rnd(.3, 1), life: 900, s: rnd(1.2, 3.4), c: 'rgba(255,255,255,.9)', dot: 1 }); }, Math.random() * dur);
  }

  // ---------- big effects ----------
  function matrix(ms) {
    award('matrix');
    if (R) return msg('', '🟩', 'Wake up, Neo…', 'The Matrix has you. (Animations are off on this device.)');
    var c = document.createElement('canvas'); c.className = 'egg-matrix'; document.body.appendChild(c);
    var x = c.getContext('2d'), w = c.width = innerWidth, h = c.height = innerHeight, fs = 16, cols = Math.ceil(w / fs), y = [];
    for (var i = 0; i < cols; i++) y[i] = Math.random() * -50;
    var ch = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉ0123456789ABCDEF{}<>/$#'.split(''), end = Date.now() + (ms || 7000), stop = false;
    var lbl = document.createElement('div'); lbl.className = 'egg-matrix-lbl'; lbl.textContent = 'Wake up, Neo…'; document.body.appendChild(lbl);
    function kill() { stop = true; c.classList.add('out'); lbl.remove(); setTimeout(function () { c.remove(); }, 600); removeEventListener('keydown', kk); }
    function kk(e) { if (e.key === 'Escape') kill(); }
    addEventListener('keydown', kk); c.addEventListener('click', kill);
    (function f() {
      if (stop) return; if (Date.now() > end) return kill();
      x.fillStyle = 'rgba(0,0,0,.08)'; x.fillRect(0, 0, w, h); x.font = fs + 'px monospace';
      for (var i = 0; i < cols; i++) { x.fillStyle = Math.random() < .03 ? '#d6ffe9' : '#33ff99'; x.fillText(pick(ch), i * fs, y[i] * fs); if (y[i] * fs > h && Math.random() > .975) y[i] = 0; y[i]++; }
      requestAnimationFrame(f);
    })();
  }
  function barrel() { award('barrel'); if (R) return eggToast('🌀 Do a barrel roll! (Animations are off on this device.)'); var h = document.documentElement; h.classList.remove('egg-roll'); void h.offsetWidth; h.classList.add('egg-roll'); setTimeout(function () { h.classList.remove('egg-roll'); }, 1600); }
  function glitch(ms) { if (R) return; var b = document.body; b.classList.add('egg-glitch'); setTimeout(function () { b.classList.remove('egg-glitch'); }, ms || 1200); }
  function gravity() {
    award('gravity');
    if (R) return eggToast('🍎 Gravity: everything would have fallen down. (Animations are off on this device.)');
    var view = document.querySelector('.view.active') || document.querySelector('main') || document.body;
    var els = Array.prototype.slice.call(view.querySelectorAll('h1,h2,h3,p,.btn,button,li,table,img,.callout,[class*="card"],[class*="tile"]')).filter(function (el) {
      var r = el.getBoundingClientRect(); return r.width && r.height && r.bottom > 0 && r.top < innerHeight && !el.closest('.egg-layer');
    }).slice(0, 90);
    els.forEach(function (el) {
      var r = el.getBoundingClientRect(), dy = innerHeight - r.bottom + rnd(-20, 0), d = rnd(.6, 1.2);
      el.dataset.eggT = el.style.transform || ''; el.style.transition = 'transform ' + d + 's cubic-bezier(.5,0,.75,0)';
      el.style.transform = 'translateY(' + Math.max(0, dy) + 'px) rotate(' + rnd(-25, 25) + 'deg)';
    });
    eggToast('🍎 What goes up must come down…', 3000);
    setTimeout(function () {
      els.forEach(function (el) { el.style.transition = 'transform .9s cubic-bezier(.2,1.4,.4,1)'; el.style.transform = el.dataset.eggT; });
      setTimeout(function () { els.forEach(function (el) { el.style.transition = ''; delete el.dataset.eggT; }); }, 1000);
    }, 2600);
  }
  function hackerman() {
    award('hackerman');
    var code = ('// mr-butler-mainframe.c — totally real hacking, definitely\n#include <stdio.h>\n#include "firewall.h"\n\nint bypass_firewall(struct node *n) {\n    for (int port = 1; port < 65536; port++) {\n        if (probe(n->ip, port) == OPEN) {\n            log("[+] open port %d", port);\n            inject(n, payload_new(PAYLOAD_SNEAKY));\n        }\n    }\n    return decrypt_mainframe(n->key ^ 0xC0FFEE);\n}\n\nvoid enhance(image_t *img) {\n    while (!img->readable) img = zoom(img, 2.0); /* enhance. ENHANCE. */\n}\n\nint main(void) {\n    struct node *target = resolve("mainframe.mrbutler.local");\n    printf("Tracing IP... %s\\n", gui_visual_basic());\n    hack_the_planet(target);\n    rotate_encryption_keys(target, ROT13 * 2);  /* double secure */\n    download_more_ram(16384);\n    if (bypass_firewall(target)) puts("I\'m in.");\n    return 1337;\n}\n').split('');
    var d = layer('egg-hacker', '<div class="egg-hk-top">HACKERMAN v13.37 — mash any keys · Esc to stop</div><pre></pre><div class="egg-hk-grant" hidden>ACCESS GRANTED</div>');
    var pre = d.querySelector('pre'), i = 0, keys = 0, done = false;
    function more() {
      if (!d.isConnected) return document.removeEventListener('keydown', kd, true);
      for (var k = 0; k < 4; k++) { pre.textContent += code[i % code.length]; i++; }
      pre.scrollTop = 1e6;
      if (++keys > 70 && !done) { done = true; var g = d.querySelector('.egg-hk-grant'); g.hidden = false; confetti(innerWidth / 2, innerHeight / 2, 100); setTimeout(function () { if (d.isConnected) d.close(); }, 2600); }
    }
    function kd(e) { if (e.key === 'Escape') return; e.preventDefault(); e.stopPropagation(); more(); }
    document.addEventListener('keydown', kd, true);
    d.addEventListener('click', more); d.addEventListener('touchstart', more, { passive: true });
  }
  function ducks() {
    award('duck');
    var row = document.createElement('div'); row.className = 'egg-ducks'; row.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 7; i++) { var s = document.createElement('span'); s.textContent = '🦆'; s.style.animationDelay = (i * .35) + 's, ' + (i * .1) + 's'; row.appendChild(s); }
    var q = document.createElement('b'); q.textContent = 'Quack! Explain your code to us. We’ll listen. 🦆'; row.appendChild(q);
    document.body.appendChild(row); setTimeout(function () { row.remove(); }, R ? 4000 : 9000);
  }
  function fakeFlag() {
    award('fakeflag');
    var t = 'flag{n1ce_try_th1s_1s_n0t_a_fl4g}', html = t.split('').map(function (c, i) { return '<span style="animation-delay:' + (i * .05) + 's">' + esc(c) + '</span>'; }).join('');
    layer('egg-center', '<div class="egg-card"><div class="egg-big">🚩</div><h3>A free flag!</h3><div class="egg-wave">' + html + '</div><p>…sadly it isn’t worth any points. Real flags are checked by Mr Butler’s server, so there are none hiding in your browser.</p><button class="egg-x" data-egg-x>Close</button></div>', 7000);
  }
  function credits() {
    award('credits');
    var c = ['MR B’S CTF', 'a Mr Butler production', '', 'Directed by — Mr Butler', 'Flags hidden by — Mr Butler', 'Server written by — Mr Butler', 'Coffee supplied by — the staffroom', 'Tested by — the brave pupils of ERGS', 'Firewall — C2k (it blocked right-click, so we built a View HTML button)', 'Tools — CyberChef, by GCHQ', '', 'No flags were harmed in the making of this website.', '', 'Thanks for playing.', 'Now go get some flags. ⚑'];
    layer('egg-credits', '<div class="egg-roll-txt">' + c.map(function (l) { return '<p>' + (l ? esc(l) : '&nbsp;') + '</p>'; }).join('') + '</div><button class="egg-x egg-x-fixed" data-egg-x>Close</button>', R ? 8000 : 21000);
  }
  function teapot() {
    award('teapot');
    msg('egg-teapot', '<span class="egg-pour">🫖</span>', 'HTTP 418: I’m a teapot', 'The server refuses to brew coffee because it is, permanently, a teapot. This is a real status code — an April Fools’ joke from 1998 that never went away.');
  }
  function cookies() { award('cookie'); rain(['🍪', '🍪', '🍪', '🥛'], 60, 3000); eggToast('🍪 Websites use cookies to remember you. This one remembers your easter eggs. Om nom.', 5000); }
  function answer() { award('answer'); msg('', '<span class="egg-spin">🌌</span>', '42', 'The answer to the ultimate question of life, the universe and everything. Nobody is quite sure what the question was.'); }
  function xyzzy() { award('xyzzy'); var d = document.createElement('div'); d.className = 'egg-xyzzy'; d.textContent = 'Nothing happens.'; document.body.appendChild(d); setTimeout(function () { d.remove(); }, 3200); }
  function snowNow() { award('snow'); snow(9000); if (R) eggToast('❄️ Let it snow! (Animations are off on this device.)'); }
  function boom() { award('fireworks'); fireworks(10); if (R) eggToast('🎆 Boom! (Animations are off on this device.)'); }

  // ---------- payloads typed into the site's own boxes ----------
  function sirens() { if (R) return; var s = document.createElement('div'); s.className = 'egg-siren'; document.body.appendChild(s); setTimeout(function () { s.remove(); }, 3200); }
  var PAY = [
    ['rmrf', /\brm\s+-(rf|fr)\b/i, function () {
      var f = ['index.html', 'assets/js/app.js', 'flags.txt', 'mr_butler_homework_marking/', 'pupil_reports_2026/', 'cat_pictures/', 'System32 (wait, wrong OS)', 'the_internet.zip'];
      var lines = ['<span class="g">$</span> rm -rf /'].concat(f.map(function (x) { return '<span class="r">removed</span> ' + esc(x); }));
      glitch(1600);
      var d = typeLines(lines.concat(['', '<span class="y">…just kidding. Nothing was deleted 😅</span>', 'rm -rf / deletes EVERYTHING on a real Linux computer. Never run it on a machine you care about.']), 'very-bad-idea.sh', '', 11000);
      return d;
    }],
    ['jndi', /\$\{\s*jndi\s*:/i, function () { msg('egg-ice', '🧊', '${jndi:…} detected', 'That’s Log4Shell — the 2021 bug where one line of text in a log file let attackers take over servers. Patched here, because there’s no Java in sight.'); }],
    ['xss', /<\s*\/?\s*script|on(error|load|mouseover|click|focus)\s*=|javascript\s*:|<\s*(img|svg|iframe|body)\b|alert\s*\(|document\.cookie/i, function () {
      layer('egg-center', '<div class="egg-alert"><div class="egg-alert-bar">This page says</div><p><b>alert(1)</b> 😏</p><p>Nice XSS attempt! But your text is shown as text, not run as code. Escaping user input like this is exactly how real sites stop cross-site scripting.</p><button class="egg-x" data-egg-x>OK</button></div>', 9000);
    }],
    ['sqli', /('|")\s*(or|and)\s+['"]?\w+['"]?\s*=\s*['"]?\w+|\bunion\b[\s\S]*\bselect\b|\bdrop\s+table\b|('|")\s*;?\s*--|\bor\s+1\s*=\s*1\b/i, function () {
      var rows = ['Aoife', 'Conor', 'Ella', 'Finn', 'Grace', 'Oisín'].map(function (n, i) { return '<tr style="animation-delay:' + (i * .12) + 's"><td>' + (i + 1) + '</td><td>' + n + '</td><td>' + pick(['11R', '12B', '11G', '12Y']) + '</td></tr>'; }).join('');
      layer('egg-center', '<div class="egg-card"><div class="egg-big">🧑‍🍳</div><h3>Hello, Little Bobby Tables</h3><table class="egg-tbl' + (R ? '' : ' fall') + '"><tr><th>id</th><th>pupil</th><th>class</th></tr>' + rows + '</table><p><code>DROP TABLE pupils;</code> … rolled back. 😌 There’s no database behind this box, and real sites stop SQL injection by using <b>parameterised queries</b> instead of gluing your text into SQL.</p><button class="egg-x" data-egg-x>Close</button></div>', 10000);
    }],
    ['traversal', /\.\.[\/\\]|\/etc\/(passwd|shadow)|c:\\windows/i, function () {
      typeLines(['<span class="g">$</span> cat ../../../../etc/passwd', 'root:x:0:0:Mr Butler:/root:/bin/bash', 'daemon:x:1:1:the C2k firewall:/usr/sbin:/usr/sbin/nologin', 'coffee:x:418:418:teapot:/staffroom:/bin/false', 'pupil:x:1000:1000:a very curious pupil:/home/pupil:/bin/bash', 'flag:x:1337:1337:nope, not here:/dev/null:/bin/false', '', '<span class="y">Path traversal: using ../ to escape the folder a site meant to keep you in.</span>', 'Real servers block it by checking the full path is still inside the allowed folder.'], '/etc/passwd (fake!)');
    }],
    ['ssti', /\{\{\s*[\d\s+\-*\/().]+\s*\}\}|\$\{\s*[\d\s+\-*\/().]+\s*\}/, function (v) {
      var m = v.match(/[{]\s*([\d\s+\-*\/().]+)\s*\}/), n = '?';
      try { if (m && /^[\d\s+\-*\/().]{1,40}$/.test(m[1])) n = String(Function('return (' + m[1] + ')')()); } catch (e) { }
      msg('', '<span class="egg-pop">' + esc(n) + '</span>', 'Server-side template injection?', 'If a website ever shows <b>' + esc(n) + '</b> back to you for that, its template engine is running your input as code — a serious bug. This one just did the sum to be friendly.');
    }],
    ['cmdi', /(;|&&|\|\|?|`|\$\()\s*(ls|cat|whoami|id|pwd|uname|nc|curl|wget|ping|echo)\b/i, function () {
      typeLines(['<span class="g">$</span> ping 127.0.0.1; whoami', 'PING 127.0.0.1: 56 data bytes — reply from localhost, it’s fine', '<span class="g">$</span> whoami', 'a-very-curious-pupil', '<span class="g">$</span> id', 'uid=1000(pupil) gid=1000(ergs) groups=1000(ergs),42(future-hackers)', '', '<span class="y">Command injection: sneaking an extra command after ; or &&.</span>', 'Real sites stop it by never passing your text to a shell.'], 'shell');
    }],
    ['sudo', /^\s*sudo\b/i, function () { sudo(); }],
    ['overflow', /(.)\1{39,}|^[\s\S]{220,}$/, function () {
      glitch(1500);
      typeLines(['<span class="g">$</span> ./flag_checker AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA…', 'Checking flag…', '<span class="r">*** stack smashing detected ***: terminated</span>', '<span class="r">Segmentation fault (core dumped)</span>', '', '<span class="y">A buffer overflow writes past the end of a box in memory.</span>', 'Old C programs could be taken over this way. This box is fine — it’s JavaScript.'], 'core.dump');
    }]
  ];
  function sudo() {
    award('sudo'); sirens();
    typeLines(['<span class="g">$</span> sudo make-me-a-sandwich', '[sudo] password for pupil: ********', '<span class="r">pupil is not in the sudoers file. This incident will be reported.</span>', '', '…reported to Mr Butler. 🚨', '(Not really. But nice try.)'], 'sudo', 'egg-red');
  }
  function checkPayload(v, el) {
    v = String(v || ''); if (!v || v.length > 5000) return false;
    if (el && el.id === 'flagInput' && /^\s*flag\{[^}]*\}\s*$/i.test(v)) return false;   // a real-looking flag: leave it alone
    for (var i = 0; i < PAY.length; i++) if (PAY[i][1].test(v)) { award(PAY[i][0]); PAY[i][2](v); return true; }
    return false;
  }
  function inToolkit(el) { return !!(el && el.closest && el.closest('#view-toolkit, .egg-layer, [data-no-eggs]')); }
  document.addEventListener('submit', function (e) {
    var f = e.target, inp = f && f.querySelector && f.querySelector('input:not([type=hidden]):not([type=password]), textarea');
    if (inp && !inToolkit(inp)) checkPayload(inp.value, inp);
  }, true);

  // ---------- typed words (anywhere, when you're not typing in a box) ----------
  var buf = '', KON = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'], kpos = 0;
  var WORDS = [
    ['hackerman', hackerman], ['matrix', function () { matrix(); }], ['doabarrelroll', barrel], ['barrelroll', barrel], ['gravity', gravity],
    ['coffee', teapot], ['cookie', cookies], ['rubberduck', ducks], ['sourcerer', sourcerer], ['beepboop', robots], ['responsible', disclosure],
    ['xyzzy', xyzzy], ['snow', snowNow], ['boom', boom], ['fireworks', boom], ['flag', fakeFlag], ['42', answer], ['sudo', sudo], ['eggs', panel], ['easteregg', panel]
  ];
  function typing(el) { return el && (/^(input|textarea|select)$/i.test(el.tagName) || el.isContentEditable); }
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target) || open) return;
    var k = String(e.key || '').toLowerCase();
    if (k === KON[kpos]) { kpos++; if (kpos === KON.length) { kpos = 0; konami(); return; } } else kpos = k === KON[0] ? 1 : 0;
    if (e.key === '`') { e.preventDefault(); terminal(); return; }
    if (k.length !== 1) return;
    buf = (buf + k).replace(/\s+/g, '').slice(-24);
    for (var i = 0; i < WORDS.length; i++) if (buf.slice(-WORDS[i][0].length) === WORDS[i][0]) { buf = ''; WORDS[i][1](); return; }
  });
  function konami() {
    award('konami'); confetti(innerWidth / 2, innerHeight / 2, 220);
    msg('egg-konami', '🎮', 'Cheat code accepted', '↑ ↑ ↓ ↓ ← → ← → B A<br>+30 lives. Sadly, +0 points.', 5000);
  }
  function sourcerer() { award('sourcerer'); msg('', '<span class="egg-spin">🧙</span>', 'You decoded the hex!', 'Reading the page’s HTML and spotting an encoded message is real CTF skill. Hex turns each character into two digits from 0–9 and a–f.'); confetti(); }
  function robots() { award('robots'); msg('', '<span class="egg-bob">🤖</span>', 'Beep boop!', 'You read <b>robots.txt</b>. It tells search engines what not to look at — which means it’s often the first place a hacker looks. Did you visit what it’s hiding?'); }
  function disclosure() { award('disclosure'); msg('', '📮', 'Responsible disclosure', 'You found <b>security.txt</b>. Ethical hackers use it to find who to tell when they discover a bug — privately, so it can be fixed before anyone gets hurt. That’s the right way to hack.'); confetti(); }

  // ---------- the fake shell ----------
  var FILES = {
    'readme.txt': 'Welcome to the Mr B’s CTF shell.\nThis is a pretend terminal. Nothing you type here can break anything.\nTry: ls -la, cat, whoami, nmap, fortune, eggs',
    'secret.txt': 'VGhlIGR1Y2sga25vd3MgdGhpbmdzLiBUeXBlOiBydWJiZXJkdWNr\n(hint: it ends in = signs when it’s padded… try: base64 -d <that text>)',
    'todo.txt': '- mark Year 12 homework\n- buy more coffee\n- hide flags better\n- remove /secret/ from robots.txt (oops)',
    '.hidden/flag.txt': 'flag{d0tf1l3s_ar3_h1dd3n_n0t_s3cr3t}\n…not a real flag, sorry. But in Linux, files starting with a dot are only HIDDEN, not protected. Always try ls -la.'
  };
  var FORTUNES = ['Never reuse a password. Not even a really good one.', 'If it’s free and asks for your password, you are the product.', 'Base64 is encoding, not encryption.', 'The S in IoT stands for security.', 'Read the source. Then read it again.', 'A strong password is long more than it is weird.', 'Always check the URL before you log in.', 'Hackers don’t break in. They log in.'];
  function terminal() {
    award('terminal');
    var d = layer('egg-center', '<div class="egg-term egg-shell"><div class="egg-bar"><i></i><i></i><i></i><span>pupil@mrbutlers-ctf: ~</span><button class="egg-bx" data-egg-x aria-label="Close">✕</button></div><pre></pre><form class="egg-prompt"><span class="g">pupil@ctf</span>:<span class="b">~</span>$ <input autocomplete="off" spellcheck="false" aria-label="Command"></form></div>');
    var pre = d.querySelector('pre'), inp = d.querySelector('input'), hist = [], hi = 0;
    function out(t) { pre.innerHTML += t + '\n'; pre.scrollTop = 1e6; }
    out('Mr B’s CTF shell v1.0 — type <span class="y">help</span> to begin, <span class="y">exit</span> to leave.');
    setTimeout(function () { inp.focus(); }, 50);
    d.querySelector('form').addEventListener('submit', function (e) {
      e.preventDefault(); e.stopPropagation();
      var line = inp.value; inp.value = ''; if (line.trim()) { hist.push(line); hi = hist.length; }
      out('<span class="g">pupil@ctf</span>:<span class="b">~</span>$ ' + esc(line));
      run(line.trim());
    });
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowUp' && hi > 0) { inp.value = hist[--hi]; e.preventDefault(); }
      else if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); inp.value = hist[hi] || ''; e.preventDefault(); }
    });
    function run(line) {
      var a = line.split(/\s+/), c = (a[0] || '').toLowerCase(), rest = line.slice(a[0].length).trim();
      if (!c) return;
      if (/\brm\s+-(rf|fr)\b/.test(line)) { award('rmrf'); glitch(1200); out('<span class="r">rm: it is dangerous to operate recursively on ‘/’</span>\n<span class="y">Nice try. Nothing deleted 😅</span>'); return; }
      switch (c) {
        case 'help': out('Commands: <span class="y">ls, ls -la, cat &lt;file&gt;, whoami, id, pwd, date, uname -a, echo, base64 [-d] &lt;text&gt;, rot13 &lt;text&gt;, nmap, ping, ssh, sudo, fortune, hint, eggs, matrix, hack, history, clear, exit</span>'); break;
        case 'ls': out(/-\w*a/.test(rest) ? 'drwxr-xr-x  .\ndrwxr-xr-x  ..\ndrwx------  <span class="b">.hidden/</span>\n-rw-r--r--  readme.txt\n-rw-r--r--  secret.txt\n-rw-r--r--  todo.txt' : 'readme.txt  secret.txt  todo.txt'); break;
        case 'cat': case 'less': case 'more': {
          var f = rest.replace(/^\.\//, '');
          if (/^\.hidden\/?$/.test(f)) { out('cat: .hidden: Is a directory — try ls .hidden'); break; }
          if (FILES[f] !== undefined) { out(esc(FILES[f])); if (f === 'secret.txt') award('catsecret'); if (f === '.hidden/flag.txt') { award('dotfile'); confetti(); } }
          else if (/passwd|shadow/.test(f)) { award('traversal'); out('root:x:0:0:Mr Butler:/root:/bin/bash\npupil:x:1000:1000:a very curious pupil:/home/pupil:/bin/bash'); }
          else out('cat: ' + esc(f || '') + ': No such file or directory'); break;
        }
        case 'whoami': out('a-very-curious-pupil'); break;
        case 'id': out('uid=1000(pupil) gid=1000(ergs) groups=1000(ergs),42(future-hackers)'); break;
        case 'pwd': out('/home/pupil'); break;
        case 'date': out(new Date().toString()); break;
        case 'uname': out('CTF-OS 13.37 mrbutlers-ctf x86_64 Totally/Real/Linux'); break;
        case 'echo': out(esc(rest)); checkPayload(rest); break;
        case 'history': out(hist.map(function (h, i) { return '  ' + (i + 1) + '  ' + esc(h); }).join('\n')); break;
        case 'clear': pre.innerHTML = ''; break;
        case 'exit': case 'logout': case 'quit': d.close(); break;
        case 'fortune': out('🥠 ' + esc(pick(FORTUNES))); break;
        case 'matrix': d.close(); matrix(); break;
        case 'hack': case 'hackerman': d.close(); hackerman(); break;
        case 'eggs': d.close(); panel(); break;
        case 'sudo': award('sudo'); sirens(); out('[sudo] password for pupil: \n<span class="r">pupil is not in the sudoers file. This incident will be reported.</span>'); break;
        case 'su': out('su: Authentication failure (the password is not “password”)'); break;
        case 'ssh': out('ssh: connect to host ' + esc(a[1] || 'mrbutler') + ' port 22: Permission denied (publickey, coffee).'); break;
        case 'ping': out('PING ' + esc(a[1] || 'localhost') + ': 64 bytes, time=0.042 ms\n64 bytes, time=0.041 ms\n--- yes, it’s alive ---'); break;
        case 'nmap': out('Starting Nmap 7.94 ( pretend edition )\nPORT     STATE  SERVICE\n22/tcp   closed ssh\n80/tcp   open   http\n418/tcp  open   teapot\n1337/tcp open   leet\n\nOnly scan computers you have permission to scan. Seriously.'); break;
        case 'base64': {
          var dec = /^-d\b/.test(rest), txt = rest.replace(/^-d\s*/, '');
          try { out(esc(dec ? decodeURIComponent(escape(atob(txt))) : btoa(unescape(encodeURIComponent(txt))))); } catch (e) { out('base64: invalid input'); } break;
        }
        case 'rot13': out(esc(rest.replace(/[a-z]/gi, function (ch) { var b = ch <= 'Z' ? 65 : 97; return String.fromCharCode((ch.charCodeAt(0) - b + 13) % 26 + b); }))); break;
        case 'hint': { var s = store(), left = EGGS.filter(function (e) { return !s[e[0]]; }); out(left.length ? '💡 ' + esc(pick(left)[3]) : '🏆 You’ve found every egg. Legend.'); break; }
        case 'rubberduck': d.close(); ducks(); break;
        case 'cd': out(rest && rest !== '~' && rest !== '.hidden' ? 'cd: ' + esc(rest) + ': Permission denied' : ''); break;
        case 'vim': case 'vi': case 'nano': out('You are now trapped in ' + esc(c) + ' forever. (Type exit to escape — the real one is :q!)'); break;
        default: if (!checkPayload(line)) out(esc(c) + ': command not found. Try <span class="y">help</span>.');
      }
    }
  }

  // ---------- the collection panel ----------
  function panel() {
    var s = store(), n = count();
    var tiles = EGGS.map(function (e) {
      var f = s[e[0]];
      return '<div class="egg-tile' + (f ? ' got' : '') + '" title="' + esc(f ? e[2] : 'Hint: ' + e[3]) + '"><span>' + (f ? e[1] : '🥚') + '</span><b>' + esc(f ? e[2] : '???') + '</b>' + (f ? '' : '<small>' + esc(e[3]) + '</small>') + '</div>';
    }).join('');
    layer('egg-center', '<div class="egg-card egg-panel"><h3>🥚 Easter eggs <span class="egg-n">' + n + ' / ' + EGGS.length + '</span></h3><div class="egg-meter"><i style="width:' + Math.round(n / EGGS.length * 100) + '%"></i></div><p class="egg-sub">Just for fun — they’re not worth points. Kept on this device only.</p><div class="egg-grid">' + tiles + '</div><button class="egg-x" data-egg-x>Close</button></div>');
    if (n === EGGS.length) confetti(innerWidth / 2, 80, 250);
  }

  // ---------- clicks ----------
  var flagEl = document.querySelector('.brand-flag'), clicks = [];
  if (flagEl) {
    flagEl.addEventListener('click', function (e) {
      var now = Date.now(); clicks = clicks.filter(function (t) { return now - t < 2500; }); clicks.push(now);
      if (clicks.length >= 5) {
        clicks = []; award('logo'); var r = flagEl.getBoundingClientRect();
        flagEl.classList.remove('egg-wave-flag'); void flagEl.offsetWidth; flagEl.classList.add('egg-wave-flag');
        confetti(r.left + r.width / 2, r.top + r.height / 2, 90);
      }
    });
    var lp; flagEl.addEventListener('touchstart', function () { lp = setTimeout(terminal, 900); }, { passive: true });   // long-press: the shell on phones
    flagEl.addEventListener('touchend', function () { clearTimeout(lp); });
  }
  document.addEventListener('click', function (e) { if (e.detail === 3 && e.target.closest && e.target.closest('.app-ver')) credits(); });

  // ---------- screensaver ----------
  var last = Date.now(), saver = null;
  ['mousemove', 'keydown', 'touchstart', 'scroll', 'click', 'wheel'].forEach(function (ev) { addEventListener(ev, function () { last = Date.now(); if (saver) stopSaver(); }, { passive: true, capture: true }); });
  function busy() {
    if (open || document.hidden) return true;
    if (document.querySelector('.modal:not([hidden]), #waitModal, #eventScreen:not([hidden]), .who-card')) return true;
    var tv = document.getElementById('view-test'); if (tv && tv.classList.contains('active')) return true;
    return !!document.fullscreenElement;
  }
  setInterval(function () { if (!saver && Date.now() - last > 4 * 60000 && !busy()) startSaver(); }, 5000);
  function startSaver() {
    award('screensaver');
    var d = document.createElement('div'); d.className = 'egg-saver'; d.innerHTML = '<div class="egg-dvd">⚑ MR B’S CTF</div>'; document.body.appendChild(d);
    var b = d.firstChild, x = rnd(0, innerWidth - 220), y = rnd(0, innerHeight - 60), vx = 2, vy = 1.6, hue = 140;
    saver = { d: d, on: true };
    (function step() {
      if (!saver || !saver.on) return;
      var w = b.offsetWidth, h = b.offsetHeight, hx = false, hy = false;
      x += vx; y += vy;
      if (x <= 0 || x + w >= innerWidth) { vx = -vx; x = Math.max(0, Math.min(x, innerWidth - w)); hx = true; }
      if (y <= 0 || y + h >= innerHeight) { vy = -vy; y = Math.max(0, Math.min(y, innerHeight - h)); hy = true; }
      if (hx || hy) { hue = (hue + 67) % 360; b.style.color = 'hsl(' + hue + ',85%,65%)'; }
      if (hx && hy) { award('corner'); confetti(x + w / 2, y + h / 2, 120); }
      b.style.transform = 'translate(' + x + 'px,' + y + 'px)';
      requestAnimationFrame(step);
    })();
  }
  function stopSaver() { if (!saver) return; saver.on = false; var d = saver.d; saver = null; d.classList.add('out'); setTimeout(function () { d.remove(); }, 400); }

  // ---------- tab away ----------
  var hidAt = 0, oldTitle = '';
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { hidAt = Date.now(); oldTitle = document.title; document.title = '👀 Come back… the flags miss you'; }
    else if (hidAt) { if (document.title.indexOf('👀') === 0) document.title = oldTitle; if (Date.now() - hidAt > 8000) award('tabaway'); hidAt = 0; }
  });

  // ---------- time and date ----------
  function clock() {
    var d = new Date(), h = d.getHours(), m = d.getMinutes();
    if (h % 12 === 1 && m === 37 && once('leet' + h)) { award('leet'); eggToast('🕐 It’s 13:37 — <b>leet o’clock</b>. 1337 is hacker for “elite”.', 6000); glitch(800); }
  }
  setInterval(clock, 20000);
  setTimeout(function () {
    clock();
    var d = new Date(), M = d.getMonth() + 1, D = d.getDate(), wd = d.getDay(), h = d.getHours();
    function season(k, fn) { if (once(k)) { award('seasonal'); fn(); } }
    if (M === 11 && D === 5) season('bonfire', function () { fireworks(14); eggToast('🎆 Remember, remember, the fifth of November! Happy Bonfire Night.', 6500); });
    else if (M === 10 && D === 31) season('halloween', function () { rain(['🦇', '🎃', '👻', '🕷️'], 40, 3500); eggToast('🎃 Happy Halloween! Beware of phishing emails dressed up as something else.', 6500); });
    else if (M === 12 && D >= 1 && D <= 25) season('xmas', function () { snow(10000); eggToast('🎄 It’s December! Don’t click on “free gift card” links.', 6500); });
    else if (M === 1 && D === 1) season('newyear', function () { fireworks(12); eggToast('🥳 Happy New Year! New year, new (long, unique) passwords.', 6500); });
    else if (M === 3 && D === 14) season('pi', function () { rain(['π', '🥧'], 40, 3000); eggToast('🥧 Happy Pi Day! 3.14159265358979…', 6500); });
    else if (M === 4 && D === 1) season('aprilfools', function () { document.documentElement.classList.add('egg-fools'); eggToast('🙃 Something looks a bit… off today.', 6500); });
    else if (M === 2 && D === 14) season('valentine', function () { rain(['💖', '💌'], 40, 3000); eggToast('💌 Happy Valentine’s! Romance scams are real — never send money to someone you’ve only met online.', 7000); });
    else if (wd === 5 && h >= 15) season('friday', function () { eggToast('🎉 Friday afternoon detected. <b>weekend.exe</b> is loading… ▓▓▓▓▓▓▓░░░ 72%', 6500); });
  }, 2500);

  // ---------- the cookie ----------
  (function () {
    var m = document.cookie.match(/(?:^|;\s*)mbctf_role=([^;]*)/), v = m ? decodeURIComponent(m[1]).toLowerCase() : '';
    function set(r) { document.cookie = 'mbctf_role=' + r + '; path=/; max-age=31536000; SameSite=Lax'; }
    if (!v) { set('pupil'); return; }
    if (v !== 'pupil') setTimeout(function () {
      award('privesc'); sirens(); glitch(900);
      msg('egg-red', '👑', 'PRIVILEGE ESCALATION DETECTED', 'Your cookie says you’re <b>' + esc(v) + '</b>. Bold! But this site never trusts cookies for anything important — the server checks who you really are. Real sites that trust cookies like this get hacked. Your cookie has been put back to <code>pupil</code>. 😉', 11000);
      set('pupil');
    }, 1500);
  })();

  // ---------- eggs from the recon pages (secret, admin, 404) ----------
  setTimeout(function () {
    var s = store(), ids = Object.keys(s).filter(function (k) { return s[k] && s[k].n && BY[k]; });
    ids.forEach(function (k, i) { setTimeout(function () { award(k); }, i * 900); });
  }, 3500);

  // ---------- the console ----------
  window.mrb = {
    help: function () { award('console'); console.log('%cmrb.help()%c\n  mrb.eggs()    your easter egg collection\n  mrb.flag()    a free flag (honest)\n  mrb.hack()    become hackerman\n  mrb.matrix()  wake up, Neo\n  mrb.shell()   the pretend terminal\n  mrb.hint()    a clue for an egg you haven’t found', 'color:#52E6A3;font-weight:bold;font-size:14px', 'color:inherit'); return '🥚 ' + count() + ' / ' + EGGS.length + ' found'; },
    eggs: function () { award('console'); panel(); return count() + ' / ' + EGGS.length; },
    flag: function () { award('console'); fakeFlag(); return 'flag{c0ns0l3_c0wb0y_n0t_4_r34l_fl4g}'; },
    hack: function () { award('console'); hackerman(); return 'I’m in.'; },
    matrix: function () { award('console'); matrix(); return 'There is no spoon.'; },
    shell: function () { award('console'); terminal(); return 'opened'; },
    hint: function () { award('console'); var s = store(), left = EGGS.filter(function (e) { return !s[e[0]]; }); return left.length ? '💡 ' + pick(left)[3] : '🏆 All found!'; }
  };
  try {
    console.log('%c⚑ MR B’S CTF', 'font:700 28px sans-serif;color:#52E6A3;text-shadow:0 0 12px rgba(82,230,163,.6)');
    console.log('%c👀 Looking under the hood? That’s the spirit.\nThe flags aren’t in here — they’re checked on Mr Butler’s server.\nBut there ARE easter eggs. Type %cmrb.help()%c to start.', 'color:#8AB6FF;font-size:13px', 'color:#F5B25C;font-weight:bold;font-size:13px', 'color:#8AB6FF;font-size:13px');
  } catch (e) { }

  window.MBEggs = { award: award, panel: panel, confetti: confetti, fireworks: fireworks, terminal: terminal, matrix: matrix };
})();
