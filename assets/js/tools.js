/* Toolkit: decoder (CyberChef-style recipe), frequency analysis, hashes, hex viewer, image viewer, JS scratchpad, ASCII table */
(function () {
  'use strict';
  var U = window.CTFUtil, $ = U.$, $$ = U.$$, esc = U.esc;
  var panel = $('#toolPanel');
  var active = 'decoder', built = false;

  // ---------- decoder operations (strings of byte-chars, 0-255, or unicode text) ----------
  function bytesToStr(b) { var s = ''; for (var i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
  function strToBytes(s) { var u = new TextEncoder().encode(s); return u; }
  function shift(s, n) {
    return s.replace(/[a-z]/gi, function (c) {
      var base = c <= 'Z' ? 65 : 97; return String.fromCharCode((c.charCodeAt(0) - base + n + 2600) % 26 + base);
    });
  }
  var OPS = [
    ['Encodings'],
    { id: 'fromB64', name: 'From Base64', f: function (s) { return bytesToStr(Uint8Array.from(atob(s.replace(/\s+/g, '')), function (c) { return c.charCodeAt(0); })); } },
    { id: 'toB64', name: 'To Base64', f: function (s) { return btoa(bytesToStr(strToBytes(s))); } },
    { id: 'fromHex', name: 'From Hex', f: function (s) { var h = s.replace(/0x|[^0-9a-f]/gi, ''); var o = ''; for (var i = 0; i + 1 < h.length; i += 2) o += String.fromCharCode(parseInt(h.substr(i, 2), 16)); return o; } },
    { id: 'toHex', name: 'To Hex', f: function (s) { return Array.prototype.map.call(s, function (c) { return ('0' + c.charCodeAt(0).toString(16)).slice(-2); }).join(' '); } },
    { id: 'fromBin', name: 'From Binary', f: function (s) { return s.replace(/[^01]/g, '').match(/.{1,8}/g).map(function (b) { return String.fromCharCode(parseInt(b, 2)); }).join(''); } },
    { id: 'toBin', name: 'To Binary', f: function (s) { return Array.prototype.map.call(s, function (c) { return ('0000000' + c.charCodeAt(0).toString(2)).slice(-8); }).join(' '); } },
    { id: 'fromDec', name: 'From Decimal (ASCII codes)', f: function (s) { return s.split(/[^0-9]+/).filter(Boolean).map(function (n) { return String.fromCharCode(+n); }).join(''); } },
    { id: 'urlDec', name: 'URL Decode', f: function (s) { return decodeURIComponent(s.replace(/\+/g, ' ')); } },
    ['Ciphers'],
    { id: 'rot13', name: 'ROT13', f: function (s) { return shift(s, 13); } },
    { id: 'rotN', name: 'ROT / Caesar shift', arg: 'shift', def: '3', f: function (s, a) { return shift(s, parseInt(a, 10) || 0); } },
    { id: 'brute', name: 'Caesar brute force (all 25)', f: function (s) { var o = []; for (var n = 1; n < 26; n++) o.push(('0' + n).slice(-2) + ': ' + shift(s, n)); return o.join('\n'); } },
    { id: 'atbash', name: 'Atbash', f: function (s) { return s.replace(/[a-z]/gi, function (c) { var b = c <= 'Z' ? 65 : 97; return String.fromCharCode(25 - (c.charCodeAt(0) - b) + b); }); } },
    { id: 'xor', name: 'XOR with key', arg: 'key', def: 'key', f: function (s, k) { if (!k) return s; var o = ''; for (var i = 0; i < s.length; i++) o += String.fromCharCode(s.charCodeAt(i) ^ k.charCodeAt(i % k.length)); return o; } },
    ['Text'],
    { id: 'reverse', name: 'Reverse', f: function (s) { return Array.from(s).reverse().join(''); } },
    { id: 'upper', name: 'To upper case', f: function (s) { return s.toUpperCase(); } },
    { id: 'lower', name: 'To lower case', f: function (s) { return s.toLowerCase(); } },
    { id: 'nows', name: 'Remove whitespace', f: function (s) { return s.replace(/\s+/g, ''); } }
  ];
  var OP_BY = {}; OPS.forEach(function (o) { if (o.id) OP_BY[o.id] = o; });
  var recipe = [];

  function tool_decoder(payload) {
    panel.innerHTML = '<div class="tool-cols"><div><span class="field-label">Operations (click to add)</span><div class="ops" id="opsList">' +
      OPS.map(function (o) { return o.id ? '<button class="op-btn" data-op="' + o.id + '">' + o.name + '</button>' : '<div class="grp">' + o[0] + '</div>'; }).join('') +
      '</div></div><div><span class="field-label">Input</span><textarea class="io" id="decIn" spellcheck="false"></textarea>' +
      '<span class="field-label">Recipe</span><div class="recipe" id="recipe"></div>' +
      '<span class="field-label">Output</span><div class="out-box" id="decOut"></div>' +
      '<div class="row"><button class="btn small" id="decCopy">Copy output</button><button class="btn small" id="decMove">Output → Input</button><button class="btn small" id="decClear">Clear recipe</button></div></div></div>';
    if (typeof payload === 'string') $('#decIn').value = payload;
    $('#opsList').addEventListener('click', function (e) { var b = e.target.closest('[data-op]'); if (!b) return; var o = OP_BY[b.dataset.op]; recipe.push({ id: o.id, arg: o.def || '' }); drawRecipe(); });
    $('#decIn').addEventListener('input', runRecipe);
    $('#decCopy').addEventListener('click', function () { window.CTFCopy($('#decOut').textContent); });
    $('#decMove').addEventListener('click', function () { $('#decIn').value = $('#decOut').textContent; recipe = []; drawRecipe(); });
    $('#decClear').addEventListener('click', function () { recipe = []; drawRecipe(); });
    drawRecipe();
  }
  function drawRecipe() {
    var box = $('#recipe');
    if (!recipe.length) box.innerHTML = '<div class="recipe-empty">No operations yet. Click one on the left.</div>';
    else box.innerHTML = recipe.map(function (r, i) {
      var o = OP_BY[r.id];
      return '<div class="recipe-step"><b>' + (i + 1) + '. ' + o.name + '</b>' + (o.arg ? '<label>' + o.arg + ' <input data-i="' + i + '" value="' + esc(r.arg) + '"></label>' : '') + '<button data-x="' + i + '" title="Remove">✕</button></div>';
    }).join('');
    $$('input[data-i]', box).forEach(function (inp) { inp.addEventListener('input', function () { recipe[+inp.dataset.i].arg = inp.value; runRecipe(); }); });
    $$('button[data-x]', box).forEach(function (b) { b.addEventListener('click', function () { recipe.splice(+b.dataset.x, 1); drawRecipe(); }); });
    runRecipe();
  }
  function runRecipe() {
    var s = $('#decIn').value, out = $('#decOut');
    try {
      recipe.forEach(function (r) { s = OP_BY[r.id].f(s, r.arg); });
      out.style.borderColor = ''; out.textContent = s;
    } catch (e) { out.style.borderColor = 'var(--red)'; out.textContent = 'Error: that operation did not work on this input. (' + e.message + ')'; }
  }

  // ---------- frequency analysis ----------
  function tool_freq(payload) {
    panel.innerHTML = '<span class="field-label">Ciphertext</span><textarea class="io" id="fqIn" spellcheck="false"></textarea>' +
      '<span class="field-label">Letter counts (English: E T A O I N S H R are most common)</span><div class="bars" id="fqBars"></div>' +
      '<div class="sub-grid" id="fqMap"></div><span class="field-label">Your substitution so far</span><div class="out-box" id="fqOut"></div>';
    var map = {};
    var grid = $('#fqMap');
    grid.innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) { return '<div class="sub-cell"><label>' + L + '</label><input maxlength="1" data-l="' + L + '"></div>'; }).join('');
    $$('input', grid).forEach(function (i) { i.addEventListener('input', function () { map[i.dataset.l] = i.value.toUpperCase(); draw(); }); });
    $('#fqIn').addEventListener('input', draw);
    if (typeof payload === 'string') $('#fqIn').value = payload;
    function draw() {
      var t = $('#fqIn').value.toUpperCase(), cnt = {}, max = 1;
      for (var i = 0; i < t.length; i++) { var c = t[i]; if (c >= 'A' && c <= 'Z') { cnt[c] = (cnt[c] || 0) + 1; max = Math.max(max, cnt[c]); } }
      $('#fqBars').innerHTML = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(function (L) { return '<div style="height:' + ((cnt[L] || 0) / max * 100) + '%" title="' + L + ': ' + (cnt[L] || 0) + '"><span>' + L + '</span></div>'; }).join('');
      $('#fqOut').innerHTML = esc(t).replace(/[A-Z]/g, function (c) { return map[c] ? '<span style="color:var(--green)">' + map[c] + '</span>' : '<span class="muted">' + c.toLowerCase() + '</span>'; });
    }
    draw();
  }

  // ---------- hashes ----------
  function tool_hash() {
    panel.innerHTML = '<div class="tool-cols even"><div><span class="field-label">Text to hash</span><textarea class="io" id="hIn" spellcheck="false"></textarea><div class="out-box" id="hOut"></div></div>' +
      '<div><span class="field-label">Crack a hash with a wordlist</span><input class="io" id="hTarget" placeholder="paste an MD5 / SHA-1 / SHA-256 hash"><span class="field-label">Wordlist (one per line)</span><textarea class="io" id="hWords">password\n123456\nqwerty\nletmein\nfootball\ndragon\nmonkey\nsunshine\nprincess\nadmin\nwelcome\nshadow\nmaster\nhello\nfreedom</textarea><button class="btn primary" id="hGo">Try every word</button><div class="out-box" id="hRes"></div></div></div>';
    $('#hIn').addEventListener('input', function () { var s = this.value; $('#hOut').textContent = 'MD5:     ' + md5(s) + '\nSHA-1:   ' + sha1(s) + '\nSHA-256: ' + sha256(s); });
    $('#hGo').addEventListener('click', function () {
      var t = $('#hTarget').value.trim().toLowerCase(), words = $('#hWords').value.split(/\r?\n/), hit = null;
      words.some(function (w) { if ([md5(w), sha1(w), sha256(w)].indexOf(t) >= 0) { hit = w; return true; } });
      $('#hRes').textContent = hit !== null ? 'Found it! The word is: ' + hit : 'No match in ' + words.length + ' words. Try a bigger wordlist.';
    });
  }

  // ---------- hex viewer ----------
  var MAGIC = [['89504e47', 'PNG image'], ['ffd8ff', 'JPEG image'], ['47494638', 'GIF image'], ['25504446', 'PDF document'], ['504b0304', 'ZIP archive (also .docx/.xlsx)'], ['7f454c46', 'ELF program (Linux)'], ['4d5a', 'Windows .exe'], ['52494646', 'RIFF (WAV/AVI)']];
  function tool_hex(payload) {
    panel.innerHTML = '<div class="row"><label class="btn small" for="hexFile">Open a file from this computer</label><input type="file" id="hexFile" hidden><span class="muted small" id="hexName"></span></div>' +
      '<div id="hexType" class="notice" hidden></div><span class="field-label">Hex dump</span><div class="hexview" id="hexDump">Open a file, or use "Open in Hex viewer" on a challenge.</div>' +
      '<span class="field-label">Readable strings (4+ characters)</span><div class="out-box" id="hexStr"></div>';
    $('#hexFile').addEventListener('change', function () { var f = this.files[0]; if (f) f.arrayBuffer().then(function (b) { showBytes(f.name, new Uint8Array(b)); }); });
    if (payload && payload.file) {
      var f = payload.file;
      if (f.text !== undefined) showBytes(f.name, new TextEncoder().encode(f.text));
      else fetch(f.url).then(function (r) { return r.arrayBuffer(); }).then(function (b) { showBytes(f.name, new Uint8Array(b)); })
        .catch(function () { $('#hexDump').textContent = 'Could not load the file here. Click Download on the challenge, then open it with the button above.'; });
    }
  }
  function showBytes(name, b) {
    $('#hexName').textContent = name + ' (' + b.length + ' bytes)';
    var head = Array.prototype.map.call(b.slice(0, 8), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    var m = MAGIC.filter(function (x) { return head.indexOf(x[0]) === 0; })[0], t = $('#hexType');
    t.hidden = false; t.textContent = m ? 'Magic number says: ' + m[1] + ' (starts with ' + m[0].toUpperCase() + ')' : 'Magic number not recognised. Could be plain text or custom data.';
    var lines = [], max = Math.min(b.length, 16 * 400);
    for (var o = 0; o < max; o += 16) {
      var row = b.slice(o, o + 16), hx = '', as = '';
      for (var i = 0; i < 16; i++) { hx += i < row.length ? ('0' + row[i].toString(16)).slice(-2) + ' ' : '   '; as += i < row.length ? (row[i] >= 32 && row[i] < 127 ? String.fromCharCode(row[i]) : '.') : ''; }
      lines.push('<span class="off">' + ('0000000' + o.toString(16)).slice(-8) + '</span>  ' + hx + ' <span class="asc">' + esc(as) + '</span>');
    }
    if (b.length > max) lines.push('… (' + (b.length - max) + ' more bytes)');
    $('#hexDump').innerHTML = lines.join('\n');
    var strs = [], cur = '';
    for (var j = 0; j <= b.length; j++) { var c = b[j]; if (c >= 32 && c < 127) cur += String.fromCharCode(c); else { if (cur.length >= 4) strs.push(cur); cur = ''; } }
    $('#hexStr').textContent = strs.join('\n') || '(none found)';
  }

  // ---------- image viewer ----------
  function tool_image(payload) {
    panel.innerHTML = '<div class="row"><label class="btn small" for="imgFile">Open an image</label><input type="file" id="imgFile" accept="image/*" hidden>' +
      '<select class="io" id="imgMode" style="width:auto"><option value="n">Normal</option><option value="r">Red only</option><option value="g">Green only</option><option value="b">Blue only</option>' +
      '<option value="l0">Lowest bit (all channels)</option><option value="x">Exaggerate tiny differences</option></select><span class="muted small" id="imgPix">Click the image to read a pixel.</span></div>' +
      '<div class="canvas-wrap"><canvas id="imgCv"></canvas></div>';
    var img = new Image(), cv = $('#imgCv'), ctx = cv.getContext('2d'), orig = null;
    img.onload = function () { cv.width = img.width; cv.height = img.height; ctx.drawImage(img, 0, 0); orig = ctx.getImageData(0, 0, cv.width, cv.height); apply(); };
    $('#imgFile').addEventListener('change', function () { var f = this.files[0]; if (f) img.src = URL.createObjectURL(f); });
    $('#imgMode').addEventListener('change', apply);
    cv.addEventListener('click', function (e) {
      if (!orig) return; var r = cv.getBoundingClientRect(), x = Math.floor((e.clientX - r.left) * cv.width / r.width), y = Math.floor((e.clientY - r.top) * cv.height / r.height), i = (y * cv.width + x) * 4, d = orig.data;
      $('#imgPix').textContent = 'Pixel (' + x + ',' + y + '): R=' + d[i] + ' G=' + d[i + 1] + ' B=' + d[i + 2] + ' A=' + d[i + 3];
    });
    function apply() {
      if (!orig) return; var m = $('#imgMode').value, out = ctx.createImageData(orig.width, orig.height), s = orig.data, o = out.data;
      for (var i = 0; i < s.length; i += 4) {
        var r = s[i], g = s[i + 1], b = s[i + 2];
        if (m === 'r') { g = b = r; } else if (m === 'g') { r = b = g; } else if (m === 'b') { r = g = b; }
        else if (m === 'l0') { r = (r & 1) * 255; g = (g & 1) * 255; b = (b & 1) * 255; }
        else if (m === 'x') { r = (r * 37) % 256; g = (g * 37) % 256; b = (b * 37) % 256; }
        o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
      }
      ctx.putImageData(out, 0, 0);
    }
    if (payload && payload.file && payload.file.url) img.src = payload.file.url;
  }

  // ---------- JS scratchpad ----------
  function tool_scratch() {
    panel.innerHTML = '<p class="muted small">Write JavaScript and press Run. Use <code>print(…)</code> to show results.</p>' +
      '<textarea class="io" id="jsIn" spellcheck="false" style="min-height:200px">// Example: add up the numbers 1 to 100\nlet total = 0;\nfor (let i = 1; i <= 100; i++) {\n  total += i;\n}\nprint(total);</textarea>' +
      '<div class="row"><button class="btn primary" id="jsRun">Run</button></div><div class="out-box" id="jsOut"></div>';
    $('#jsRun').addEventListener('click', function () {
      var out = [];
      function print() { out.push(Array.prototype.map.call(arguments, function (a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ')); }
      try { new Function('print', $('#jsIn').value)(print); } catch (e) { out.push('Error: ' + e.message); }
      $('#jsOut').textContent = out.join('\n') || '(nothing printed)';
    });
  }

  // ---------- ASCII table ----------
  function tool_ascii() {
    var cells = [];
    for (var i = 32; i < 127; i++) cells.push('<div><b>' + esc(i === 32 ? 'space' : String.fromCharCode(i)) + '</b><span>' + i + ' · 0x' + i.toString(16) + ' · ' + ('0000000' + i.toString(2)).slice(-8) + '</span></div>');
    panel.innerHTML = '<p class="muted small">Character · decimal · hex · binary</p><div class="ascii-grid">' + cells.join('') + '</div>';
  }

  var TOOLS = { decoder: tool_decoder, freq: tool_freq, hash: tool_hash, hex: tool_hex, image: tool_image, scratch: tool_scratch, ascii: tool_ascii };
  function open(name, payload) {
    active = name; built = true;
    $$('.subtab').forEach(function (t) { t.classList.toggle('active', t.dataset.tool === name); });
    TOOLS[name](payload);
  }
  $$('.subtab').forEach(function (t) { t.addEventListener('click', function () { open(t.dataset.tool); }); });
  window.Toolkit = { open: open, ensure: function () { if (!built) open(active); } };
})();
