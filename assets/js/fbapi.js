/* Mr Butler's CTF — Firebase back end (free Spark plan, no server code).
   The site was written to talk to a Google Apps Script. This file answers those same requests itself, using
   Firestore and Firebase sign-in, so the rest of the site is unchanged: any fetch() to CTF_CONFIG.syncUrl is
   handled here and never leaves the browser. Who may do what is enforced by firebase/firestore.rules.

   Pupils: one Firebase account per pupil (email <pid>x<n>@pupils.ergs-ctf.firebaseapp.com, password = their PIN,
   padded). Firebase itself slows down repeated wrong PINs. A teacher setting a new PIN makes account n+1.
   Teachers: Google sign-in (see CTF_CONFIG.teachers / the Firestore "staff" collection).
   Flags: stored only as SHA-256(challenge + flag) document IDs, so a pupil can test a guess but never list them. */
(function () {
  'use strict';
  var CFG = window.CTF_CONFIG || {};
  if (!CFG.firebase || !CFG.apiUrl || CFG.syncUrl !== CFG.apiUrl || !window.fetch) return;   // switched off: the old Google Sheet is in use
  var API = CFG.apiUrl, LEGACY = CFG.legacyUrl || '';
  var V = '10.14.1', CDN = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var DOMAIN = '@pupils.ergs-ctf.firebaseapp.com';
  var SALT = 'mbctf-progress-v1';
  var TEACHERS = (CFG.teachers || []).map(function (e) { return String(e).toLowerCase(); });

  // ---------- small helpers ----------
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  function sha(s) { return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)).then(hex); }
  function rand16() { var a = new Uint8Array(8); crypto.getRandomValues(a); return hex(a); }
  function now() { return Date.now(); }
  function okPid(x) { return /^[0-9a-f]{16}$/.test(String(x || '')); }
  function PW(pin) { return 'mbctf-' + pin + '-pin'; }
  function emailFor(pid, gen) { return pid + 'x' + gen + DOMAIN; }
  function genOf(email) { var m = /x(\d+)@/.exec(String(email || '')); return m ? +m[1] : 0; }
  function pidOfEmail(email) { var m = /^([0-9a-f]{16})x\d+@pupils\.ergs-ctf\.firebaseapp\.com$/.exec(String(email || '').toLowerCase()); return m ? m[1] : ''; }
  function normWho(name, cls) { return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + String(cls || '').toUpperCase().replace(/\s+/g, ''); }
  function nameKey(name, cls) { return sha('mbctf-who|' + normWho(name, cls)).then(function (h) { return 'n:' + h.slice(0, 40); }); }
  function normUser(u) { return String(u || '').toLowerCase().replace(/\s+/g, '').slice(0, 20); }
  function okUser(u) { return /^[a-z0-9][a-z0-9._-]{2,19}$/.test(u); }
  function flagId(cid, flag) { return sha('mbctf-flag|' + cid + '|' + String(flag).trim().toLowerCase()); }
  function tpId(paper, pw) { return sha('mbctf-tp|' + paper + '|' + String(pw || '').trim()); }
  function sign(d) { var body = JSON.stringify(d); return sha(body + SALT).then(function (c) { return { data: d, check: c }; }); }
  function code(e) { return (e && (e.code || e.message)) || String(e); }
  function denied(e) { return /permission|PERMISSION_DENIED|insufficient/i.test(code(e)); }
  function isTeacherDevice() { try { return !!localStorage.getItem('mbctf-teacher-livekey-v1') || localStorage.getItem('mbctf-teacher-pc-v1') === '1'; } catch (e) { return false; } }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  // ---------- load Firebase (from Google's CDN) ----------
  var FB = Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js'), import(CDN + 'firebase-firestore.js')]).then(function (m) {
    var A = m[0], AU = m[1], FS = m[2];
    var app = A.initializeApp(CFG.firebase);
    var auth = AU.getAuth(app);
    var db = FS.getFirestore(app);
    var o = { A: A, AU: AU, FS: FS, app: app, auth: auth, db: db };
    o.ready = new Promise(function (res) { var un = AU.onAuthStateChanged(auth, function (u) { un(); res(u); }); });
    AU.onAuthStateChanged(auth, function () { onAuth(o); });
    return o;
  });
  FB.catch(function (e) { console.warn('[mbctf] Firebase did not load', e); });
  function ready() { return FB.then(function (o) { return o.ready.then(function () { return o; }); }); }
  function d(o, path) { return o.FS.doc.apply(null, [o.db].concat(path.split('/'))); }
  function get(o, path) { return o.FS.getDoc(d(o, path)); }
  function user(o) { return o.auth.currentUser; }
  function teacherUser(o) {
    var u = user(o); if (!u || !u.email) return false;
    var p = (u.providerData || []).some(function (x) { return x.providerId === 'google.com'; });
    return p && (TEACHERS.indexOf(u.email.toLowerCase()) >= 0 || STAFF_OK === u.email);
  }
  var STAFF_OK = '';
  function pupilUser(o) { var u = user(o); return u && pidOfEmail(u.email) ? u : null; }

  // ---------- the signed-in pupil's own record (kept up to date by a listener: 1 read per change) ----------
  var ME = { pid: '', doc: null, un: null, tdoc: null, tun: null, ready: null };
  function onAuth(o) {
    var u = pupilUser(o), pid = u ? pidOfEmail(u.email) : '';
    if (pid === ME.pid) return;
    if (ME.un) ME.un(); if (ME.tun) ME.tun(); ME = { pid: pid, doc: null, un: null, tdoc: null, tun: null, ready: null };
    if (!pid) return;
    ME.ready = new Promise(function (res) {
      ME.un = o.FS.onSnapshot(d(o, 'pupils/' + pid), function (s) {
        ME.doc = s.exists() ? s.data() : false; watchTarget(o); res();
      }, function () { ME.doc = false; res(); });
    });
    renderTeacherBar();
  }
  function watchTarget(o) {   // a merged login: also watch the pupil it now belongs to
    var t = ME.doc && ME.doc.mergedInto;
    if (!t) { if (ME.tun) { ME.tun(); ME.tun = null; } ME.tdoc = null; return; }
    if (ME.tun && ME.tid === t) return;
    if (ME.tun) ME.tun(); ME.tid = t;
    ME.tun = o.FS.onSnapshot(d(o, 'pupils/' + t), function (s) { ME.tdoc = s.exists() ? s.data() : null; }, function () { ME.tdoc = null; });
  }
  function meNow(o) {   // -> { pid, doc, target pid, tdoc } for the signed-in pupil, or null
    var u = pupilUser(o); if (!u) return Promise.resolve(null);
    var p = ME.ready || Promise.resolve();
    return p.then(function () {
      if (!ME.doc || ME.doc.email !== u.email.toLowerCase()) return null;
      var t = ME.doc.mergedInto || ME.pid;
      if (t === ME.pid) return { pid: ME.pid, doc: ME.doc, tid: t, tdoc: ME.doc };
      if (ME.tdoc) return { pid: ME.pid, doc: ME.doc, tid: t, tdoc: ME.tdoc };
      return get(o, 'pupils/' + t).then(function (s) { return { pid: ME.pid, doc: ME.doc, tid: t, tdoc: s.exists() ? s.data() : {} }; });
    });
  }
  var PUB = { at: 0, v: null };
  function pubConfig(o) {
    if (PUB.v && now() - PUB.at < 10 * 60000) return Promise.resolve(PUB.v);
    return get(o, 'config/public').then(function (s) { PUB.v = s.exists() ? s.data() : {}; PUB.at = now(); return PUB.v; }).catch(function () { return PUB.v || {}; });
  }

  // ---------- pupils signing in ----------
  function welcome(o, pid) {
    return meNow(o).then(function (m) {
      if (!m) return { ok: false, error: 'pin' };
      var t = m.tid, td = m.tdoc || {};
      var st = m.doc.mergedInto ? (td.status || 'approved') : m.doc.status;
      return Promise.all([
        get(o, 'progress/' + t).then(function (s) { return s.exists() ? (s.data().json || '') : ''; }).catch(function () { return ''; }),
        st === 'approved' ? get(o, 'secret/key').then(function (s) { return s.exists() ? s.data().k : null; }).catch(function () { return null; }) : null
      ]).then(function (r) {
        return { ok: true, id: t, name: td.name || m.doc.name, cls: td.cls || m.doc.cls, json: r[0], status: st, k: r[1] || undefined, user: m.doc.user || '' };
      });
    });
  }
  function signInAs(o, email, pin) {
    return o.AU.signInWithEmailAndPassword(o.auth, email, PW(pin)).then(function () { onAuth(o); return true; }, function (e) {
      var c = code(e);
      if (/too-many-requests/.test(c)) return { ok: false, error: 'locked' };
      if (/network/.test(c)) return { ok: false, error: 'offline' };
      return { ok: false, error: 'pin' };
    });
  }
  // a fresh account for this pupil (new PIN). Returns its email.
  function makeAccount(o, pid, gen, pin, viaTeacher) {
    var tries = 0;
    function attempt(g) {
      var email = emailFor(pid, g);
      if (!viaTeacher) return o.AU.createUserWithEmailAndPassword(o.auth, email, PW(pin)).then(function () { onAuth(o); return email; }, function (e) {
        if (/email-already-in-use/.test(code(e)) && tries++ < 6) return attempt(g + 1);
        throw e;
      });
      return creator(o).then(function (a2) {
        return o.AU.createUserWithEmailAndPassword(a2, email, PW(pin)).then(function () { return o.AU.signOut(a2).then(function () { return email; }); }, function (e) {
          if (/email-already-in-use/.test(code(e)) && tries++ < 6) return attempt(g + 1);
          throw e;
        });
      });
    }
    return attempt(gen);
  }
  var A2 = null;   // a second, invisible Firebase app the teacher uses to create pupils' accounts (so the teacher stays signed in)
  function creator(o) {
    if (!A2) { var app2 = o.A.initializeApp(CFG.firebase, 'mbctf-creator'), a = o.AU.getAuth(app2); A2 = o.AU.setPersistence(a, o.AU.inMemoryPersistence).then(function () { return a; }); }
    return A2;
  }
  function whois(o, q) {
    var name = String(q.name || '').replace(/\s+/g, ' ').trim().slice(0, 40), cls = String(q.cls || '').toUpperCase().replace(/\s+/g, '').slice(0, 12), pin = String(q.pin || '');
    if (name.split(' ').length < 2 || !/^[A-Z0-9]{1,12}$/.test(cls)) return { ok: false, error: 'bad name' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
    return nameKey(name, cls).then(function (key) {
      return get(o, 'logins/' + key).then(function (s) {
        if (s.exists()) {
          var l = s.data();
          if (l.m) return bridge(o, 'whois', { name: name, cls: cls, pin: pin, id: q.id }, key);
          if (l.r) return resetClaim(o, l, pin);
          return signInAs(o, l.email, pin).then(function (r) { return r === true ? welcome(o, l.pid) : r; });
        }
        return register(o, name, cls, pin, q.id, key);
      });
    });
  }
  function login(o, q) {
    var u = normUser(q.u), pin = String(q.pin || '');
    if (!okUser(u)) return { ok: false, error: 'nouser' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
    return get(o, 'logins/u:' + u).then(function (s) {
      if (!s.exists()) return { ok: false, error: 'nouser' };
      var l = s.data();
      if (l.m) return bridge(o, 'login', { u: u, pin: pin, id: q.id }, 'u:' + u);
      if (l.r) return resetClaim(o, l, pin);
      return signInAs(o, l.email, pin).then(function (r) { return r === true ? welcome(o, l.pid) : r; });
    });
  }
  function register(o, name, cls, pin, devId, key) {
    var pid = okPid(devId) ? devId : rand16();
    return o.AU.createUserWithEmailAndPassword(o.auth, emailFor(pid, 1), PW(pin)).then(function () {
      var email = emailFor(pid, 1);
      return o.FS.setDoc(d(o, 'pupils/' + pid), { name: name, cls: cls, who: normWho(name, cls), status: 'pending', at: now(), email: email, gen: 1, user: '', lk: key })
        .then(function () { onAuth(o); return o.FS.setDoc(d(o, 'logins/' + key), { pid: pid, email: email }); })
        .then(function () { notifyLegacy(name, cls); return { ok: true, id: pid, name: name, cls: cls, fresh: true, status: 'pending' }; });
    }, function (e) {
      if (/email-already-in-use/.test(code(e))) return { ok: false, error: 'removed' };   // this computer's old ID was used before: the site picks a new one
      if (/too-many-requests/.test(code(e))) return { ok: false, error: 'locked' };
      throw e;
    });
  }
  // first sign-in after the move: the old Google script checks the PIN it knows, then the pupil gets a Firebase account with it
  function bridge(o, action, params, key) {
    if (!LEGACY) return { ok: false, error: 'pin' };
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k] == null ? '' : params[k]); }).join('&');
    return realFetch(LEGACY + '?action=' + action + '&' + qs + '&t=' + now(), { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok || !okPid(j.id)) return j && j.error ? j : { ok: false, error: 'pin' };
      if (j.fresh) return { ok: false, error: 'pin' };
      var pid = j.id, pin = params.pin;
      return makeAccount(o, pid, 1, pin, false).then(function (email) {
        return o.FS.updateDoc(d(o, 'pupils/' + pid), { email: email, gen: genOf(email) }).then(function () {
          return (ME.ready || Promise.resolve()).then(function () { return relink(o, pid, email); });
        });
      }, function (e) {
        // an account already exists with this ID (a half-finished earlier try): sign in with the same PIN
        return signInAs(o, emailFor(pid, 1), pin).then(function (r) { if (r !== true) throw e; return o.FS.updateDoc(d(o, 'pupils/' + pid), { email: emailFor(pid, 1), gen: 1 }).catch(function () { }).then(function () { return relink(o, pid, emailFor(pid, 1)); }); });
      }).then(function () { return welcome(o, pid); });
    });
  }
  function relink(o, pid, email) {   // point this pupil's sign-in lookups at their current account
    return get(o, 'pupils/' + pid).then(function (s) {
      var p = s.data() || {}, keys = [p.lk].concat(p.user ? ['u:' + p.user] : []).filter(Boolean);
      return Promise.all(keys.map(function (k) { return o.FS.setDoc(d(o, 'logins/' + k), { pid: pid, email: email }).catch(function (e) { console.warn('[mbctf] relink', k, e); }); }));
    });
  }
  function resetClaim(o, l, pin) {   // the teacher pressed "Reset PIN": whatever the pupil types now becomes their PIN
    var pid = l.pid;
    return makeAccount(o, pid, genOf(l.email) + 1, pin, false).then(function (email) {
      return o.FS.updateDoc(d(o, 'pupils/' + pid), { email: email, gen: genOf(email), resetPin: false })
        .then(function () { onAuth(o); return (ME.ready || Promise.resolve()); })
        .then(function () { return relink(o, pid, email); })
        .then(function () { return welcome(o, pid); });
    });
  }
  function notifyLegacy(name, cls) { void name; void cls; }   // (sign-up emails need server code, which the free plan doesn't have)

  // ---------- pupils using the site ----------
  function access(o, q) {
    return meNow(o).then(function (m) {
      return pubConfig(o).then(function (pub) {
        if (!m) return { ok: true, status: 'unknown', season: pub.season || 0 };
        var td = m.tdoc || {}, st = m.doc.mergedInto ? (td.status || 'approved') : m.doc.status;
        return { ok: true, status: st, season: pub.season || 0, name: td.name || m.doc.name, cls: td.cls || m.doc.cls, user: m.doc.user || undefined };
      });
    });
  }
  function ckey(o, q) {
    return get(o, 'secret/key').then(function (s) { return s.exists() ? { ok: true, k: s.data().k, ver: s.data().ver } : { ok: false, error: 'setup' }; },
      function (e) { return { ok: false, error: denied(e) ? 'access' : 'offline' }; });
  }
  function submit(o, q) {
    var cid = String(q.cid || ''), g = String(q.flag || '').trim().toLowerCase().slice(0, 200), test = q.mode === 'test';
    if (!/^[a-z0-9-]{2,20}$/.test(cid)) return { ok: false, error: 'setup' };
    return meNow(o).then(function (m) {
      if (!m && !teacherUser(o)) return { ok: false, error: 'access' };
      var pid = m ? m.tid : '';
      return flagId(cid, g).then(function (h) { return get(o, 'flags/' + h); }).then(function (s) {
        if (s.exists() && s.data().c === cid) {
          return sha((test ? String(q.tid) : pid) + '|' + g).then(function (p) { return { ok: true, correct: true, p: p.slice(0, 16), pts: s.data().p, id: pid || undefined }; });
        }
        if (/^\w+\{/.test(g) || !g) return { ok: true, correct: false, close: false };
        return flagId(cid, 'flag{' + g + '}').then(function (h2) { return get(o, 'flags/' + h2); }).then(function (s2) { return { ok: true, correct: false, close: s2.exists() }; });
      });
    }).catch(function (e) { return { ok: false, error: denied(e) ? 'access' : 'offline' }; });
  }
  function reveal(o, q) {
    var cid = String(q.cid || '');
    return meNow(o).then(function (m) {
      if (!m) return { ok: false, error: 'access' };
      var rev = {}; rev[cid] = now();
      return o.FS.setDoc(d(o, 'progress/' + m.tid), { rev: rev }, { merge: true }).then(function () { return answer(o, cid); });
    }).catch(function (e) { return { ok: false, error: denied(e) ? 'access' : 'offline' }; });
  }
  function answer(o, cid) {
    return get(o, 'answers/' + cid).then(function (s) {
      if (!s.exists()) return { ok: false, error: 'setup' };
      var a = s.data(), sol = String(a.s || ''), walk = [];
      try { var j = JSON.parse(sol); sol = String(j.s || ''); walk = j.w || []; } catch (e) { }
      return { ok: true, f: a.f, sol: sol, walk: walk };
    });
  }
  function testpass(o, q) {
    var paper = String(q.paper || '');
    return tpId(paper, q.pw).then(function (h) { return get(o, 'testpw/' + h); }).then(function (s) { return { ok: true, pass: s.exists() && s.data().p === paper }; });
  }
  function testresets(o, q) {
    var out = {}, tids = String(q.tids || '').split(',').slice(0, 10).filter(function (t) { return /^[0-9a-z]{6,24}$/.test(t); });
    return Promise.all(tids.map(function (t) { return get(o, 'testresets/' + t).then(function (s) { if (s.exists()) out[t] = s.data().at; }).catch(function () { }); }))
      .then(function () { return { ok: true, resets: out }; });
  }
  function board(o) {
    return get(o, 'board/current').then(function (s) {
      if (!s.exists()) return { ok: true, at: now(), rows: [] };
      var b = s.data(); if (b.off) return { ok: false, error: 'off' };
      return { ok: true, at: b.at, rows: b.rows || [] };
    });
  }
  function myawards(o, q) {
    return meNow(o).then(function (m) {
      if (!m) return { ok: true, awards: {} };
      var res = { ok: true, awards: (m.tdoc && m.tdoc.aw) || {} };
      if (m.tid !== m.pid) { res.movedTo = m.tid; res.name = m.tdoc.name; res.cls = m.tdoc.cls; }
      return get(o, 'progress/' + m.tid).then(function (s) { res.json = s.exists() ? (s.data().json || '') : ''; return res; }, function () { return res; });
    });
  }
  // progress from a pupil's computer: combined with what's already saved (another computer), so solves are never lost
  function union(old, cur) {
    ['solved', 'hints', 'tries', 'tut', 'revealed'].forEach(function (f) { cur[f] = cur[f] || {}; });
    Object.keys(old.solved || {}).forEach(function (k) {
      var a = old.solved[k], c = cur.solved[k]; if (!a || a.a) return;
      if (!c || (c.r && !a.r) || (c.a && !a.a)) cur.solved[k] = a;
    });
    ['hints', 'tries', 'tut'].forEach(function (f) { Object.keys(old[f] || {}).forEach(function (k) { cur[f][k] = Math.max(+cur[f][k] || 0, +old[f][k] || 0); }); });
    Object.keys(old.revealed || {}).forEach(function (k) { if (!cur.revealed[k]) cur.revealed[k] = old.revealed[k]; });
    cur.wrong = Math.max(+cur.wrong || 0, +old.wrong || 0);
    if (old.created && (!cur.created || old.created < cur.created)) cur.created = old.created;
    if (old.prevPids) cur.prevPids = (cur.prevPids || []).concat(old.prevPids.filter(function (x) { return (cur.prevPids || []).indexOf(x) < 0; })).slice(-10);
    return cur;
  }
  var SYNCQ = Promise.resolve();
  function sync(o, body) {
    var dd = body && body.data;
    if (!dd || dd.app !== 'MrButlersCTF' || !okPid(dd.pid)) return Promise.resolve({ ok: false, error: 'not ctf progress' });
    SYNCQ = SYNCQ.then(function () {
      return meNow(o).then(function (m) {
        if (!m) return { ok: true, waiting: true, unknown: true };
        var td = m.tdoc || {}, st = m.doc.mergedInto ? (td.status || 'approved') : m.doc.status;
        if (st !== 'approved') return { ok: true, waiting: true };
        if (dd.pid !== m.tid && dd.pid !== m.pid) return { ok: false, error: 'not this pupil' };
        var ref = d(o, 'progress/' + m.tid);
        return o.FS.getDoc(ref).then(function (s) {
          var prev = null; if (s.exists() && s.data().json) { try { prev = JSON.parse(s.data().json).data; } catch (e) { } }
          if (prev) dd = union(prev, dd);
          dd.pid = m.tid; if (td.name) { dd.name = td.name; dd.cls = td.cls; }
          dd.exported = now();
          return sign(dd).then(function (signed) {
            if (body.test) signed.test = body.test;
            var json = JSON.stringify(signed);
            return o.FS.setDoc(ref, { json: json, seen: now(), name: dd.name || '', cls: dd.cls || '', n: Object.keys(dd.solved || {}).length, score: Number(dd.score) || 0 }, { merge: true })
              .then(function () { return { ok: true }; });
          });
        });
      });
    }).catch(function (e) { console.warn('[mbctf] sync', e); return { ok: false, error: denied(e) ? 'access' : 'offline' }; });
    return SYNCQ;
  }

  // ---------- teacher: live class data (two listeners, so a refresh every 20 s costs nothing) ----------
  var LV = { pupils: null, progress: null, unP: null, unG: null, ready: null };
  function startLive(o) {
    if (LV.ready) return LV.ready;
    var a, b;
    LV.ready = new Promise(function (res, rej) {
      var got = 0; function one() { if (++got === 2) res(); }
      LV.unP = o.FS.onSnapshot(o.FS.collection(o.db, 'pupils'), function (s) { var m = {}; s.forEach(function (x) { m[x.id] = x.data(); }); LV.pupils = m; if (!a) { a = 1; one(); } }, function (e) { LV.ready = null; rej(e); });
      LV.unG = o.FS.onSnapshot(o.FS.collection(o.db, 'progress'), function (s) { var m = {}; s.forEach(function (x) { m[x.id] = x.data(); }); LV.progress = m; if (!b) { b = 1; one(); } }, function (e) { LV.ready = null; rej(e); });
    });
    return LV.ready;
  }
  function stopLive() { if (LV.unP) LV.unP(); if (LV.unG) LV.unG(); LV = { pupils: null, progress: null, unP: null, unG: null, ready: null }; }
  var AUTO = { at: 0, busy: false };
  function autoCopy() {
    if (!LEGACY || AUTO.busy || now() - AUTO.at < 3 * 60000) return;
    var key = ''; try { key = localStorage.getItem('mbctf-teacher-livekey-v1') || ''; } catch (e) { }
    if (!key) return;
    AUTO.busy = true; AUTO.at = now();
    migrate(key, null, true).then(function (r) { AUTO.busy = false; if (r && r.wrote) console.info('[mbctf] copied ' + r.wrote + ' new record(s) from the Google Sheet'); }, function (e) { AUTO.busy = false; console.warn('[mbctf] auto-copy', e); });
  }
  function live(o) {
    autoCopy();
    return Promise.all([startLive(o), pubConfig(o)]).then(function (r) {
      var P = LV.pupils || {}, G = LV.progress || {}, pub = r[1] || {};
      var rows = [], awards = {}, aliases = {}, pending = [], joined = [];
      Object.keys(G).forEach(function (pid) {
        var g = G[pid]; if (!g.json) return;
        rows.push({ seen: g.seen || 0, json: g.json });
        try { (JSON.parse(g.json).data.prevPids || []).forEach(function (old) { if (okPid(old) && old !== pid && !aliases[old]) aliases[old] = pid; }); } catch (e) { }
      });
      Object.keys(P).forEach(function (pid) {
        var p = P[pid];
        if (p.aw && Object.keys(p.aw).length) awards[pid] = p.aw;
        if (p.mergedInto) { aliases[pid] = p.mergedInto; return; }
        if (p.status === 'pending' || p.status === 'declined') pending.push({ pid: pid, status: p.status, name: p.name, cls: p.cls, at: p.at || 0 });
        else if (!G[pid] || !G[pid].json) joined.push({ pid: pid, name: p.name, cls: p.cls, at: p.at || 0 });
      });
      return { ok: true, now: now(), rows: rows, awards: awards, aliases: aliases, pending: pending, joined: joined, approval: true, mail: { on: false, error: '' }, installed: pub.ver || '' };
    });
  }
  function P(pid) { return (LV.pupils || {})[pid]; }
  function pupilsList(o) {
    return startLive(o).then(function () {
      var out = [];
      Object.keys(LV.pupils || {}).forEach(function (pid) {
        var p = LV.pupils[pid]; if (p.mergedInto) return;
        out.push({ pid: pid, name: p.name || '', cls: p.cls || '', pin: !!(p.email || p.mig), user: p.user || '', locked: false, fails: 0, status: p.status || 'approved', at: p.at || 0, waiting: !p.email && !!p.mig });
      });
      out.sort(function (a, b) { return a.cls.localeCompare(b.cls) || a.name.localeCompare(b.name); });
      return { ok: true, pupils: out, approval: true };
    });
  }
  function fresh(o, pid) { return get(o, 'pupils/' + pid).then(function (s) { return s.exists() ? s.data() : null; }); }
  // the teacher gives a pupil a new PIN: a new account, and the lookups point at it
  function newPin(o, pid, p, pin) {
    return makeAccount(o, pid, (p.gen || 0) + 1, pin, true).then(function (email) {
      return { email: email, gen: genOf(email) };
    });
  }
  function setLookups(o, pid, p, email, oldUser) {
    var b = o.FS.writeBatch(o.db);
    if (p.lk) b.set(d(o, 'logins/' + p.lk), { pid: pid, email: email });
    if (oldUser && oldUser !== p.user) b.delete(d(o, 'logins/u:' + oldUser));
    if (p.user) b.set(d(o, 'logins/u:' + p.user), { pid: pid, email: email });
    return b.commit();
  }
  function userTaken(o, u, pid) { return get(o, 'logins/u:' + u).then(function (s) { return s.exists() && s.data().pid !== pid; }); }
  function setpin(o, q) {
    var pid = String(q.pid || ''), pin = String(q.pin || '');
    if (!okPid(pid)) return { ok: false, error: 'bad id' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
    return fresh(o, pid).then(function (p) {
      if (!p) return { ok: false, error: 'not registered' };
      return newPin(o, pid, p, pin).then(function (a) {
        return o.FS.updateDoc(d(o, 'pupils/' + pid), { email: a.email, gen: a.gen, resetPin: false, mig: false })
          .then(function () { return setLookups(o, pid, p, a.email); }).then(function () { return { ok: true, set: pid }; });
      });
    });
  }
  function setlogin(o, q) {
    var pid = String(q.pid || ''), u = normUser(q.u), pin = String(q.pin || '');
    if (!okPid(pid)) return { ok: false, error: 'bad id' };
    if (!okUser(u)) return { ok: false, error: 'username' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
    return fresh(o, pid).then(function (p) {
      if (!p) return { ok: false, error: 'not registered' };
      return userTaken(o, u, pid).then(function (t) {
        if (t) return { ok: false, error: 'taken' };
        return newPin(o, pid, p, pin).then(function (a) {
          var old = p.user; p.user = u;
          return o.FS.updateDoc(d(o, 'pupils/' + pid), { email: a.email, gen: a.gen, user: u, status: 'approved', resetPin: false, mig: false })
            .then(function () { return setLookups(o, pid, p, a.email, old); }).then(function () { return { ok: true, pid: pid, user: u }; });
        });
      });
    });
  }
  function addpupil(o, q) {
    var name = String(q.name || '').replace(/\s+/g, ' ').trim().slice(0, 40), cls = String(q.cls || '').toUpperCase().replace(/\s+/g, '').slice(0, 12), u = normUser(q.u), pin = String(q.pin || '');
    if (name.split(' ').length < 2) return { ok: false, error: 'name' };
    if (!/^[A-Z0-9]{1,12}$/.test(cls)) return { ok: false, error: 'class' };
    if (!okUser(u)) return { ok: false, error: 'username' };
    if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
    return nameKey(name, cls).then(function (lk) {
      return get(o, 'logins/' + lk).then(function (s) {
        if (s.exists()) return { ok: false, error: 'exists', pid: s.data().pid };
        return userTaken(o, u, '').then(function (t) {
          if (t) return { ok: false, error: 'taken' };
          var pid = rand16(), p = { name: name, cls: cls, who: normWho(name, cls), status: 'approved', at: now(), user: u, lk: lk, gen: 0 };
          return newPin(o, pid, p, pin).then(function (a) {
            p.email = a.email; p.gen = a.gen;
            return o.FS.setDoc(d(o, 'pupils/' + pid), p).then(function () { return setLookups(o, pid, p, a.email); })
              .then(function () { return { ok: true, pid: pid, user: u, name: name, cls: cls }; });
          });
        });
      });
    });
  }
  function autologins(o, q) {
    var all = q.all === '1';
    return startLive(o).then(function () {
      var used = {}, todo = [], out = [];
      Object.keys(LV.pupils).forEach(function (pid) { var p = LV.pupils[pid]; if (p.user && !all) used[p.user] = 1; });
      Object.keys(LV.pupils).forEach(function (pid) {
        var p = LV.pupils[pid]; if (!okPid(pid) || p.mergedInto || p.status === 'declined') return;
        if (!all && p.user) return;
        var parts = String(p.name || '').toLowerCase().replace(/[^a-z ]/g, '').trim().split(/\s+/);
        var base = ((parts[0] || 'p').charAt(0) + (parts[parts.length - 1] || 'pupil')).slice(0, 16), u = base, k = 2;
        if (base.length < 3) base = u = base + 'ctf';
        while (used[u]) u = base + (k++);
        used[u] = 1; todo.push({ pid: pid, p: p, u: u, pin: String(1000 + Math.floor(Math.random() * 9000)) });
      });
      // one at a time (Firebase allows about 100 new accounts an hour from one school connection)
      return todo.reduce(function (pr, x) {
        return pr.then(function () {
          return newPin(o, x.pid, x.p, x.pin).then(function (a) {
            var old = x.p.user, p = Object.assign({}, x.p, { user: x.u });
            return o.FS.updateDoc(d(o, 'pupils/' + x.pid), { email: a.email, gen: a.gen, user: x.u, status: 'approved', resetPin: false, mig: false })
              .then(function () { return setLookups(o, x.pid, p, a.email, old); })
              .then(function () { out.push({ pid: x.pid, name: x.p.name, cls: x.p.cls, user: x.u, pin: x.pin }); });
          });
        });
      }, Promise.resolve()).then(function () { return { ok: true, logins: out }; }, function (e) {
        return { ok: out.length > 0, logins: out, error: /too-many/.test(code(e)) ? 'Firebase paused new accounts for this connection (about 100 an hour). Press the button again later for the rest.' : code(e) };
      });
    });
  }
  function editpupil(o, q) {
    var pid = String(q.pid || '');
    if (!okPid(pid)) return { ok: false, error: 'bad id' };
    return fresh(o, pid).then(function (cur) {
      if (!cur) return { ok: false, error: 'not registered' };
      var name = q.name != null && String(q.name).trim() ? String(q.name).replace(/\s+/g, ' ').trim().slice(0, 40) : cur.name;
      var cls = q.cls != null && String(q.cls).trim() ? String(q.cls).toUpperCase().replace(/\s+/g, '').slice(0, 12) : cur.cls;
      var u = q.u != null ? normUser(q.u) : (cur.user || ''), pin = q.pin != null ? String(q.pin) : '';
      if (name.split(' ').length < 2) return { ok: false, error: 'name' };
      if (!/^[A-Z0-9]{1,12}$/.test(cls)) return { ok: false, error: 'class' };
      if (u && !okUser(u)) return { ok: false, error: 'username' };
      if (pin && !/^\d{4}$/.test(pin)) return { ok: false, error: 'pin' };
      var renamed = normWho(name, cls) !== normWho(cur.name, cur.cls);
      return Promise.all([u ? userTaken(o, u, pid) : false, nameKey(name, cls)]).then(function (r) {
        if (r[0]) return { ok: false, error: 'taken' };
        var lk = r[1];
        return (renamed ? get(o, 'logins/' + lk).then(function (s) { return s.exists() && s.data().pid !== pid; }) : Promise.resolve(false)).then(function (clash) {
          if (clash) return { ok: false, error: 'exists' };
          return (pin ? newPin(o, pid, cur, pin) : Promise.resolve(null)).then(function (a) {
            var upd = { name: name, cls: cls, who: normWho(name, cls), user: u, lk: lk };
            if (a) { upd.email = a.email; upd.gen = a.gen; upd.resetPin = false; upd.mig = false; if (cur.status !== 'approved') upd.status = 'approved'; }
            var email = a ? a.email : cur.email;
            var b = o.FS.writeBatch(o.db);
            b.update(d(o, 'pupils/' + pid), upd);
            if (cur.lk && cur.lk !== lk) b.delete(d(o, 'logins/' + cur.lk));
            if (cur.user && cur.user !== u) b.delete(d(o, 'logins/u:' + cur.user));
            var look = email ? { pid: pid, email: email } : { m: 1 };
            b.set(d(o, 'logins/' + lk), look);
            if (u) b.set(d(o, 'logins/u:' + u), look);
            return b.commit().then(function () { return renamed ? reSign(o, pid, function (dd) { dd.name = name; dd.cls = cls; }) : null; })
              .then(function () { return { ok: true, pid: pid, name: name, cls: cls, user: u, pinSet: !!a }; });
          });
        });
      });
    });
  }
  function reSign(o, pid, fn) {   // change a pupil's stored progress (rename, merge) and sign it again
    return get(o, 'progress/' + pid).then(function (s) {
      if (!s.exists() || !s.data().json) return null;
      var raw = JSON.parse(s.data().json), dd = raw.data; fn(dd); dd.exported = now();
      return sign(dd).then(function (sg) { if (raw.test) sg.test = raw.test; return o.FS.updateDoc(d(o, 'progress/' + pid), { json: JSON.stringify(sg), name: dd.name || '', cls: dd.cls || '', n: Object.keys(dd.solved || {}).length }); });
    });
  }
  function decide(o, q, status) {
    var ids = String(q.pids || '').split(',').filter(okPid), b = o.FS.writeBatch(o.db);
    ids.forEach(function (pid) { b.update(d(o, 'pupils/' + pid), { status: status, decided: now() }); });
    return b.commit().then(function () {
      var key = ''; try { key = localStorage.getItem('mbctf-teacher-livekey-v1') || ''; } catch (e) { }
      if (LEGACY && key && ids.length) realFetch(LEGACY + '?key=' + encodeURIComponent(key) + '&action=' + (status === 'approved' ? 'approve' : 'decline') + '&pids=' + ids.join(',') + '&t=' + now(), { cache: 'no-store' }).catch(function () { });
      return { ok: true, access: status, done: ids.length };
    });
  }
  function award(o, q, on) {
    var pid = String(q.pid || ''), cid = String(q.cid || ''), u = {};
    if (!okPid(pid) || !/^[a-z0-9-]{2,20}$/.test(cid)) return { ok: false, error: 'bad request' };
    u['aw.' + cid] = on ? now() : o.FS.deleteField();
    return o.FS.updateDoc(d(o, 'pupils/' + pid), u).then(function () { return { ok: true, awarded: !!on, pid: pid, cid: cid }; });
  }
  function resolve(pid) { var k = 0; while (P(pid) && P(pid).mergedInto && k++ < 20) pid = P(pid).mergedInto; return pid; }
  function merge(o, q) {
    var from = String(q.from || ''), to = String(q.to || '');
    if (!okPid(from) || !okPid(to) || from === to) return { ok: false, error: 'bad request' };
    return startLive(o).then(function () {
      to = resolve(to); if (resolve(from) === to) return { ok: true, merged: true };
      return Promise.all([get(o, 'progress/' + from), get(o, 'progress/' + to)]).then(function (r) {
        var gone = r[0].exists() && r[0].data().json ? JSON.parse(r[0].data().json).data : null;
        var keep = r[1].exists() && r[1].data().json ? JSON.parse(r[1].data().json) : null;
        var b = o.FS.writeBatch(o.db), pf = P(from) || {}, pt = P(to) || {};
        var after = function () { return { ok: true, merged: true, from: from, to: to }; };
        var upd = { mergedInto: to, status: 'approved' };
        b.set(d(o, 'pupils/' + from), upd, { merge: true });
        var aw = Object.assign({}, pf.aw || {}, pt.aw || {}), tu = { aw: aw };
        if (pt.status !== 'approved' && (pf.status || 'approved') === 'approved') tu.status = 'approved';
        b.set(d(o, 'pupils/' + to), tu, { merge: true });
        if (r[0].exists()) b.delete(d(o, 'progress/' + from));
        if (!gone) return b.commit().then(after);
        var dd = keep ? union(gone, keep.data) : gone; dd.pid = to; if (pt.name) { dd.name = pt.name; dd.cls = pt.cls; } dd.exported = now();
        return sign(dd).then(function (sg) {
          if (keep && keep.test) sg.test = keep.test;
          b.set(d(o, 'progress/' + to), { json: JSON.stringify(sg), seen: (r[1].exists() && r[1].data().seen) || now(), name: dd.name || '', cls: dd.cls || '', n: Object.keys(dd.solved || {}).length }, { merge: true });
          return b.commit().then(after);
        });
      });
    });
  }
  function resetpin(o, q) {
    var pid = String(q.pid || '');
    return fresh(o, pid).then(function (p) {
      if (!p) return { ok: false, error: 'not registered' };
      var b = o.FS.writeBatch(o.db);
      b.update(d(o, 'pupils/' + pid), { resetPin: true });
      var look = p.email ? { pid: pid, email: p.email, r: 1 } : { m: 1 };
      if (p.lk) b.set(d(o, 'logins/' + p.lk), look);
      if (p.user) b.set(d(o, 'logins/u:' + p.user), look);
      return b.commit().then(function () { return { ok: true, reset: pid }; });
    });
  }
  function del(o, q) {
    var pid = String(q.pid || '');
    if (!okPid(pid)) return { ok: false, error: 'bad pid' };
    return fresh(o, pid).then(function (p) {
      var b = o.FS.writeBatch(o.db);
      b.delete(d(o, 'progress/' + pid)); b.delete(d(o, 'pupils/' + pid));
      if (p && p.lk) b.delete(d(o, 'logins/' + p.lk));
      if (p && p.user) b.delete(d(o, 'logins/u:' + p.user));
      return b.commit().then(function () { return { ok: true, deleted: pid }; });
    });
  }
  function eachDoc(o, coll, fn) { return o.FS.getDocs(o.FS.collection(o.db, coll)).then(function (s) { var a = []; s.forEach(function (x) { a.push(x); }); return a.map(fn); }); }
  function wipe(o, coll) {
    return o.FS.getDocs(o.FS.collection(o.db, coll)).then(function (s) {
      var refs = []; s.forEach(function (x) { refs.push(x.ref); });
      var chunks = []; for (var i = 0; i < refs.length; i += 400) chunks.push(refs.slice(i, i + 400));
      return chunks.reduce(function (pr, c) { return pr.then(function () { var b = o.FS.writeBatch(o.db); c.forEach(function (r) { b.delete(r); }); return b.commit(); }); }, Promise.resolve()).then(function () { return refs.length; });
    });
  }
  function cleardown(o, q) {
    if (q.confirm !== 'DELETE') return { ok: false, error: 'confirm' };
    var backup = null;
    var first = q.backup === '1' ? Promise.all([eachDoc(o, 'pupils', function (x) { return [x.id, x.data()]; }), eachDoc(o, 'progress', function (x) { return [x.id, x.data()]; })]).then(function (r) {
      var stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
      var blob = new Blob([JSON.stringify({ when: stamp, pupils: r[0], progress: r[1] }, null, 1)], { type: 'application/json' });
      backup = { name: 'MrButlersCTF backup ' + stamp + '.json', url: URL.createObjectURL(blob) };
      try { var a = document.createElement('a'); a.href = backup.url; a.download = backup.name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) { }
    }) : Promise.resolve();
    return first.then(function () {
      var names = ['progress', 'pupils', 'logins', 'testresets', 'board'];
      return names.reduce(function (pr, n) { return pr.then(function () { return wipe(o, n); }); }, Promise.resolve()).then(function () {
        return o.FS.setDoc(d(o, 'config/public'), { season: now() }, { merge: true });
      }).then(function () { PUB.v = null; return { ok: true, cleared: ['Progress', 'Pupils', 'Sign-in lookups', 'Test resits', 'Leaderboard'], backup: backup }; });
    });
  }
  // Test area passwords: each paper's (or the answer book's) password is stored as hash(paper + password)
  var PAPERS = ['p1', 'p2', 'p3'];
  function tconf(o) { return get(o, 'config/teacher').then(function (s) { return s.exists() ? s.data() : {}; }); }
  function testpws(o) { return tconf(o).then(function (c) { var out = {}; PAPERS.forEach(function (p) { out[p] = (c.papers || {})[p] || ''; }); return { ok: true, papers: out, fallback: c.fallback || '' }; }); }
  function writeTestpw(o, c) {
    return Promise.all(PAPERS.map(function (p) { var pw = (c.papers || {})[p] || c.fallback || ''; return pw ? tpId(p, pw).then(function (h) { return [p, h]; }) : null; })).then(function (ids) {
      var b = o.FS.writeBatch(o.db), keep = {};
      ids.filter(Boolean).forEach(function (x) { keep[x[1]] = x[0]; });
      (c.tpIds || []).forEach(function (h) { if (!keep[h]) b.delete(d(o, 'testpw/' + h)); });
      Object.keys(keep).forEach(function (h) { b.set(d(o, 'testpw/' + h), { p: keep[h] }); });
      c.tpIds = Object.keys(keep);
      b.set(d(o, 'config/teacher'), c);
      return b.commit();
    });
  }
  function settestpw(o, q) {
    var paper = String(q.paper || ''), pw = String(q.pw || '').trim();
    if (PAPERS.indexOf(paper) < 0) return { ok: false, error: 'bad paper' };
    if (pw.length > 40) return { ok: false, error: 'too long' };
    return tconf(o).then(function (c) { c.papers = c.papers || {}; if (pw) c.papers[paper] = pw; else delete c.papers[paper]; return writeTestpw(o, c); }).then(function () { return testpws(o); });
  }
  // install the answers from the answer book (Teacher tab does this by itself when the challenges change)
  function install(o, b) {
    var ans = b.answers || {}, ids = Object.keys(ans);
    if (!ids.length || !/^[A-Za-z0-9+/=]{40,}$/.test(String(b.k || ''))) return Promise.resolve({ ok: false, error: 'bad request' });
    return Promise.all(ids.map(function (cid) { return flagId(cid, ans[cid][0]).then(function (h) { return [h, cid]; }); })).then(function (fl) {
      return o.FS.getDocs(o.FS.collection(o.db, 'flags')).then(function (s) {
        var have = {}; s.forEach(function (x) { have[x.id] = x.data(); });
        var want = {}; fl.forEach(function (x) { want[x[0]] = { c: x[1], p: +ans[x[1]][1] || 0 }; });
        var ops = [];
        Object.keys(have).forEach(function (h) { if (!want[h]) ops.push(['del', 'flags/' + h]); });
        Object.keys(want).forEach(function (h) { if (!have[h] || have[h].c !== want[h].c || have[h].p !== want[h].p) ops.push(['set', 'flags/' + h, want[h]]); });
        ids.forEach(function (cid) { ops.push(['set', 'answers/' + cid, { f: String(ans[cid][0]), s: String(ans[cid][2] || '').slice(0, 200000) }]); });
        ops.push(['set', 'secret/key', { k: String(b.k), ver: String(b.ver || '') }]);
        var chunks = []; for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
        return chunks.reduce(function (pr, c) {
          return pr.then(function () { var w = o.FS.writeBatch(o.db); c.forEach(function (x) { if (x[0] === 'del') w.delete(d(o, x[1])); else w.set(d(o, x[1]), x[2]); }); return w.commit(); });
        }, Promise.resolve());
      });
    }).then(function () {
      return tconf(o).then(function (c) { if (b.testpw) c.fallback = String(b.testpw); return writeTestpw(o, c); });
    }).then(function () {
      return o.FS.setDoc(d(o, 'config/public'), { ver: String(b.ver || '') }, { merge: true });
    }).then(function () { PUB.v = null; return { ok: true, installed: ids.length, ver: String(b.ver || ''), cleaned: 0 }; });
  }
  // the pupils' leaderboard: the teacher's screen works it out (it can check every proof) and saves it, at most once a minute
  var BOARD = { at: 0, last: '' };
  function publishBoard(rows) {
    var s = JSON.stringify(rows); if (s === BOARD.last || now() - BOARD.at < 60000) return;
    FB.then(function (o) {
      if (!teacherUser(o)) return;
      BOARD.at = now();
      return o.FS.setDoc(d(o, 'board/current'), { at: now(), rows: rows }).then(function () { BOARD.last = s; });
    }).catch(function () { });
  }

  // ---------- one-off: copy everything across from the Google Sheet (Teacher tab › ⋯ › Move data to Firebase) ----------
  function migrate(key, log, quiet) {
    log = log || function () { };
    function lg(u) { return realFetch(LEGACY + '?key=' + encodeURIComponent(key) + u + '&t=' + now(), { cache: 'no-store' }).then(function (r) { return r.json(); }); }
    return ready().then(function (o) {
      if (!teacherUser(o)) throw new Error('Sign in with Google first (the bar at the top of the Teacher tab).');
      log('Reading the Google Sheet…');
      return Promise.all([lg(''), lg('&action=pupils'), lg('&action=testpws').catch(function () { return {}; })]).then(function (r) {
        var live = r[0], pl = r[1], tp = r[2] || {};
        if (!live.ok) throw new Error('The Google script said: ' + (live.error || 'error') + (live.error === 'key' ? ' (wrong teacher password)' : ''));
        if (!pl.ok) throw new Error('The Google script needs its latest version for this (Pupil logins).');
        var pupils = pl.pupils || [], aliases = live.aliases || {}, awards = live.awards || {};
        log('Found ' + pupils.length + ' pupils, ' + (live.rows || []).length + ' progress records, ' + Object.keys(aliases).length + ' merged logins.');
        var anyId = pupils.length ? pupils[0].pid : '';
        return (anyId ? realFetch(LEGACY + '?action=access&id=' + anyId + '&t=' + now(), { cache: 'no-store', credentials: 'omit' }).then(function (x) { return x.json(); }).catch(function () { return {}; }) : Promise.resolve({})).then(function (acc) {
          // safe to run again later: pupils who already have their Firebase account keep it, and progress is combined, never replaced
          return Promise.all([eachDoc(o, 'pupils', function (x) { return [x.id, x.data()]; }), eachDoc(o, 'progress', function (x) { return [x.id, x.data()]; })]).then(function (ex) {
            var EP = {}, EG = {}; ex[0].forEach(function (x) { EP[x[0]] = x[1]; }); ex[1].forEach(function (x) { EG[x[0]] = x[1]; });
            return Promise.all(pupils.map(function (p) { return nameKey(p.name, p.cls).then(function (lk) { p.lk = lk; return p; }); })).then(function () {
            var ops = [], signs = [], sheetSt = {};
            (live.pending || []).forEach(function (x) { sheetSt[x.pid] = x.status; });   // the Access tab: pending / declined
            function same(a, b) { return JSON.stringify(a || {}) === JSON.stringify(b || {}); }
            pupils.forEach(function (p) {
              var had = EP[p.pid], st = sheetSt[p.pid] || p.status || 'approved', aw = awards[p.pid] || {};
              if (had && had.email) {   // already has their Firebase account: only add new teacher marks
                var aw2 = Object.assign({}, aw, had.aw || {});
                if (!same(aw2, had.aw)) ops.push(['pupils/' + p.pid, { aw: aw2 }, true]);
                return;
              }
              // never undo a decision made in Firebase: only a pupil still pending there takes the sheet's status
              if (had && had.status && had.status !== 'pending') st = had.status;
              var rec = { name: p.name, cls: p.cls, who: normWho(p.name, p.cls), status: st, at: p.at || now(), email: null, gen: 0, user: normUser(p.user || ''), lk: p.lk, mig: true, aw: Object.assign({}, aw, (had && had.aw) || {}) };
              if (had && had.name === rec.name && had.cls === rec.cls && had.status === rec.status && had.user === rec.user && had.lk === rec.lk && same(had.aw, rec.aw)) return;
              ops.push(['pupils/' + p.pid, rec]);
              if (!had || had.lk !== p.lk) ops.push(['logins/' + p.lk, { m: 1 }]);
              if (p.user && (!had || had.user !== rec.user)) ops.push(['logins/u:' + normUser(p.user), { m: 1 }]);
            });
            Object.keys(aliases).forEach(function (from) {
              if (!okPid(from) || (EP[from] && (EP[from].email || EP[from].mergedInto === aliases[from]))) return;
              ops.push(['pupils/' + from, { name: '(merged login)', cls: '', status: 'approved', at: now(), email: null, gen: 0, user: '', mergedInto: aliases[from], mig: true }]);
            });
            function core(x) { return JSON.stringify([x.solved || {}, x.hints || {}, x.tries || {}, x.tut || {}, x.revealed || {}, x.wrong || 0]); }
            (live.rows || []).forEach(function (x) {
              try {
                var raw = JSON.parse(x.json), dd = raw.data; if (!dd || !okPid(dd.pid)) return;
                var cur = EG[dd.pid];
                if (cur && cur.json) {   // already in Firebase: add anything new from the sheet (and only write if there is some)
                  var c = JSON.parse(cur.json), before = core(c.data), md = union(dd, JSON.parse(JSON.stringify(c.data)));
                  if (core(md) === before) return;
                  md.exported = now();
                  signs.push(sign(md).then(function (sg) { if (c.test) sg.test = c.test; ops.push(['progress/' + dd.pid, { json: JSON.stringify(sg), name: md.name || '', cls: md.cls || '', n: Object.keys(md.solved || {}).length, score: Number(md.score) || 0, seen: Math.max(cur.seen || 0, x.seen || 0) }, true]); }));
                  return;
                }
                ops.push(['progress/' + dd.pid, { json: x.json, seen: x.seen || now(), name: dd.name || '', cls: dd.cls || '', n: Object.keys(dd.solved || {}).length, score: Number(dd.score) || 0 }]);
              } catch (e) { }
            });
            if (acc && acc.season && !(PUB.v && PUB.v.season === acc.season)) ops.push(['config/public', { season: acc.season }, true]);
            return Promise.all(signs).then(function () {
            var chunks = []; for (var i = 0; i < ops.length; i += 400) chunks.push(ops.slice(i, i + 400));
            log('Writing ' + ops.length + ' records to Firebase…');
            return chunks.reduce(function (pr, c) {
              return pr.then(function () { var b = o.FS.writeBatch(o.db); c.forEach(function (x) { if (x[2]) b.set(d(o, x[0]), x[1], { merge: true }); else b.set(d(o, x[0]), x[1]); }); return b.commit(); });
            }, Promise.resolve()).then(function () {
              if (!tp.ok || quiet) return null;
              return tconf(o).then(function (c) { c.papers = {}; PAPERS.forEach(function (p) { if ((tp.papers || {})[p]) c.papers[p] = tp.papers[p]; }); if (tp.fallback) c.fallback = tp.fallback; return writeTestpw(o, c); });
            }).then(function () {
              PUB.v = null;
              log('Done: ' + pupils.length + ' pupils and their progress are in Firebase. Each pupil keeps their PIN: the first time they sign in, the old script checks it and their Firebase account is made.');
              return { ok: true, pupils: pupils.length, rows: (live.rows || []).length, wrote: ops.length };
            });
            });
            });
          });
        });
      });
    });
  }

  // ---------- teacher sign-in (Google) ----------
  function teacherSignIn() {
    return FB.then(function (o) {
      var prov = new o.AU.GoogleAuthProvider(); prov.setCustomParameters({ prompt: 'select_account' });
      return o.AU.signInWithPopup(o.auth, prov).then(function (cr) {
        var em = (cr.user.email || '').toLowerCase();
        if (TEACHERS.indexOf(em) >= 0) return true;
        return get(o, 'staff/' + em).then(function (s) { if (s.exists()) { STAFF_OK = cr.user.email; return true; } throw new Error('not staff'); })
          .catch(function () { return o.AU.signOut(o.auth).then(function () { throw new Error(em + ' isn’t a teacher account for this site.'); }); });
      });
    }).then(function (x) { renderTeacherBar(); try { if (window.CTFLiveNow) window.CTFLiveNow(); } catch (e) { } return x; });
  }
  function renderTeacherBar() {
    FB.then(function (o) { return o.ready.then(function () { return o; }); }).catch(function () { return null; }).then(function (o) {
      if (!o) return;
      var bar = document.getElementById('fbTeacherBar');
      var need = isTeacherDevice() && !teacherUser(o);
      if (!need) { if (bar) bar.remove(); return; }
      if (!bar) {
        bar = document.createElement('div'); bar.id = 'fbTeacherBar'; bar.className = 'fb-teacher-bar';
        bar.innerHTML = '<span>🔐 Connect this teacher screen to the class data:</span> <button type="button" class="btn small primary" id="fbTeacherGo">Sign in with Google</button> <span class="fb-tb-msg small"></span>';
        document.body.appendChild(bar);
        bar.querySelector('#fbTeacherGo').addEventListener('click', function () {
          var m = bar.querySelector('.fb-tb-msg'); m.textContent = 'Opening Google…';
          teacherSignIn().then(function () { m.textContent = ''; }, function (e) { m.textContent = /popup/.test(code(e)) ? 'The pop-up was blocked: allow pop-ups for this site and try again.' : (e && e.message) || code(e); });
        });
      }
    });
  }
  document.addEventListener('DOMContentLoaded', function () { renderTeacherBar(); setInterval(renderTeacherBar, 4000); });

  // ---------- the request router ----------
  var TEACHER_ACTIONS = { testmail: 1, testpws: 1, settestpw: 1, testreset: 1, cleardown: 1, answer: 1, approve: 1, decline: 1, merge: 1, award: 1, unaward: 1, pupils: 1, setpin: 1, setlogin: 1, addpupil: 1, autologins: 1, editpupil: 1, unlockpin: 1, resetpin: 1, 'delete': 1, clear: 1 };
  function route(q, body) {
    return ready().then(function (o) {
      if (body) {
        if (body.kind === 'install') return teacherUser(o) ? install(o, body) : { ok: false, error: 'fbauth' };
        return sync(o, body);
      }
      var a = q.action || '';
      if (a === 'ping') return { ok: true };
      if (a === 'forgot') return LEGACY ? realFetch(LEGACY + '?action=forgot&t=' + now(), { cache: 'no-store', credentials: 'omit' }).then(function (r) { return r.json(); }) : { ok: false, error: 'no recovery email' };
      if (a === 'whois') return whois(o, q);
      if (a === 'login') return login(o, q);
      if (a === 'access' || a === 'status') return access(o, q);
      if (a === 'ckey') return ckey(o, q);
      if (a === 'submit') return submit(o, q);
      if (a === 'reveal') return reveal(o, q);
      if (a === 'testpass') return testpass(o, q);
      if (a === 'testresets') return testresets(o, q);
      if (a === 'board') return board(o);
      if (a === 'myawards') return myawards(o, q);
      // everything else is the teacher's
      if (!teacherUser(o)) { renderTeacherBar(); return { ok: false, error: 'fbauth' }; }
      if (!a) return live(o);
      if (!TEACHER_ACTIONS[a]) return { ok: false, error: 'unknown action' };
      if (a === 'testmail') return { ok: false, error: 'Emails need server code, which the free Firebase plan doesn’t include. New sign-ups show on the Teacher tab instead.' };
      if (a === 'testpws') return testpws(o);
      if (a === 'settestpw') return settestpw(o, q);
      if (a === 'testreset') { var tid = String(q.tid || ''); if (!/^[0-9a-z]{6,24}$/.test(tid)) return { ok: false, error: 'bad id' }; return o.FS.setDoc(d(o, 'testresets/' + tid), { at: now() }).then(function () { return { ok: true, reset: tid }; }); }
      if (a === 'cleardown') return cleardown(o, q);
      if (a === 'answer') return answer(o, String(q.cid || ''));
      if (a === 'approve' || a === 'decline') return decide(o, q, a === 'approve' ? 'approved' : 'declined');
      if (a === 'merge') return merge(o, q);
      if (a === 'award' || a === 'unaward') return award(o, q, a === 'award');
      if (a === 'pupils') return pupilsList(o);
      if (a === 'setpin') return setpin(o, q);
      if (a === 'setlogin') return setlogin(o, q);
      if (a === 'addpupil') return addpupil(o, q);
      if (a === 'autologins') return autologins(o, q);
      if (a === 'editpupil') return editpupil(o, q);
      if (a === 'unlockpin') return { ok: true, unlocked: String(q.pid || '') };
      if (a === 'resetpin') return resetpin(o, q);
      if (a === 'delete') return del(o, q);
      if (a === 'clear') return wipe(o, 'progress').then(function () { return { ok: true, cleared: true }; });
      return { ok: false, error: 'unknown action' };
    }).then(null, function (e) {
      console.warn('[mbctf]', q && q.action, e);
      var c = code(e);
      if (denied(e)) { renderTeacherBar(); return { ok: false, error: q && !q.action && !body ? 'fbauth' : 'access' }; }
      if (/unavailable|offline|network|Failed to fetch/i.test(c)) return { ok: false, error: 'offline' };
      return { ok: false, error: c };
    });
  }
  function parse(url) {
    var q = {}, i = url.indexOf('?');
    if (i >= 0) url.slice(i + 1).split('&').forEach(function (kv) { if (!kv) return; var j = kv.indexOf('='), k = decodeURIComponent((j < 0 ? kv : kv.slice(0, j)).replace(/\+/g, ' ')); q[k] = j < 0 ? '' : decodeURIComponent(kv.slice(j + 1).replace(/\+/g, ' ')); });
    return q;
  }
  var realFetch = window.fetch.bind(window);
  function bodyOf(b) {
    if (b == null) return Promise.resolve(null);
    if (typeof b === 'string') return Promise.resolve(b);
    if (b instanceof Blob) return b.text();
    return Promise.resolve(String(b));
  }
  function handle(url, init) {
    var q = parse(url), post = init && init.method && /post/i.test(init.method);
    return (post ? bodyOf(init.body) : Promise.resolve(null)).then(function (txt) {
      var body = null; if (txt) { try { body = JSON.parse(txt); } catch (e) { return { ok: false, error: 'bad json' }; } }
      return route(q, body);
    }).then(function (j) { return new Response(JSON.stringify(j), { status: 200, headers: { 'Content-Type': 'application/json' } }); });
  }
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf(API) === 0) return handle(url, init);
    return realFetch(input, init);
  };
  if (navigator.sendBeacon) {
    var realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (String(url).indexOf(API) === 0) { handle(String(url), { method: 'POST', body: data }); return true; }
      return realBeacon(url, data);
    };
  }
  window.FBAPI = {
    publishBoard: publishBoard, migrate: migrate, teacherSignIn: teacherSignIn,
    signOut: function () { stopLive(); return FB.then(function (o) { return o.AU.signOut(o.auth); }).then(renderTeacherBar); },
    whoami: function () { return FB.then(function (o) { var u = user(o); return u ? { email: u.email, teacher: teacherUser(o), pupil: pidOfEmail(u.email) } : null; }); }
  };
})();
