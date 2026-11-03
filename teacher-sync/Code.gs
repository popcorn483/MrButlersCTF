/**
 * Mr Butler's CTF — live progress collector (Google Apps Script)
 *
 * Paste this into Extensions → Apps Script on a Google Sheet you own,
 * set TEACHER_KEY below, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Pupils' browsers POST their signed progress here automatically.
 * The Teacher tab GETs it back (only with the teacher key).
 * One row per pupil — each new post overwrites that pupil's row.
 *
 * Pupils sign in with first name + surname, form class and a 4-digit PIN (like the
 * Digital Technology revision site). PINs are kept only as salted hashes on the
 * Pupils tab; five wrong tries locks that pupil for 15 minutes.
 */

// CHANGE THIS before deploying. Keep it out of the public GitHub repo.
var TEACHER_KEY = 'change-me-to-something-secret';

var SHEET_NAME = 'Progress';
var HEADER = ['Pupil ID', 'Name', 'Score', 'Flags', 'Last update', 'Data (do not edit)', 'Class'];
var MAX_JSON = 45000; // a Sheets cell holds 50,000 characters
// Forgotten password: 'Email it to me' on the site sends TEACHER_KEY here, and nowhere else.
// Leave empty to use the Google account that owns this script.
var RECOVERY_EMAIL = '';
// Pupil leaderboard: set to false to hide it from pupils. Names show as first name + surname initial.
var BOARD_PUBLIC = true;
var SITE_URL = 'https://popcorn483.github.io/MrButlersCTF/';   // the script reads the challenge list from here to check scores
var REMOVED_SHEET = 'Removed'; // pupil IDs the teacher deleted — their devices are ignored from then on

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADER);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
  }
  return sh;
}

// ---------- pupil sign-in (name + form class + PIN) ----------
var PUPILS_SHEET = 'Pupils';
function pupilsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(PUPILS_SHEET);
  if (!sh) { sh = ss.insertSheet(PUPILS_SHEET); sh.appendRow(['Pupil ID', 'Name', 'Class', 'PIN hash (not the PIN)', 'Registered']); sh.setFrozenRows(1); }
  return sh;
}
function pinSalt_() {
  var pr = PropertiesService.getScriptProperties(), s = pr.getProperty('PIN_SALT');
  if (!s) { s = Utilities.getUuid(); pr.setProperty('PIN_SALT', s); }
  return s;
}
function pinHash_(id, pin) {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'mbctf|' + id + '|' + pin + '|' + pinSalt_()));
}
function normWho_(name, cls) { return String(name || '').toLowerCase().replace(/\s+/g, ' ').trim() + '|' + String(cls || '').toUpperCase().replace(/\s+/g, ''); }
function progressJson_(id) {
  var sh = sheet_(), cell = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  return cell ? String(sh.getRange(cell.getRow(), 6).getValue() || '') : '';
}
/* The pupil with this name and class: with the right PIN, their ID and saved progress. A pupil with no PIN yet
   (reset by the teacher) takes this one. Nobody with that name and class: this device's ID becomes a new pupil. */
function whois_(name, cls, pin, devId) {
  name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  cls = String(cls || '').toUpperCase().replace(/\s+/g, '').slice(0, 12);
  if (name.split(' ').length < 2 || !/^[A-Z0-9]{1,12}$/.test(cls)) return { ok: false, error: 'bad name' };
  if (!/^\d{4}$/.test(String(pin || ''))) return { ok: false, error: 'pin' };
  var want = normWho_(name, cls), sh = pupilsSheet_(), n = sh.getLastRow() - 1;
  var rows = n > 0 ? sh.getRange(2, 1, n, 4).getValues() : [];
  var at = -1;
  for (var i = 0; i < rows.length; i++) if (normWho_(rows[i][1], rows[i][2]) === want) { at = i; break; }
  if (at < 0) {
    if (!/^[0-9a-f]{16}$/.test(String(devId))) return { ok: false, error: 'bad id' };
    if (isRemoved_(String(devId))) return { ok: false, error: 'removed' };
    var lock = LockService.getScriptLock(); lock.waitLock(15000);
    try { sh.appendRow([String(devId), safeText_(name), cls, pinHash_(String(devId), pin), new Date()]); } finally { lock.releaseLock(); }
    return { ok: true, id: String(devId), name: name, cls: cls, fresh: true };
  }
  var id = String(rows[at][0]), had = String(rows[at][3] || ''), cache = CacheService.getScriptCache(), fk = 'fail:' + id, fails = +(cache.get(fk) || 0);
  if (fails >= 5) return { ok: false, error: 'locked' };
  if (had && had !== pinHash_(id, pin)) { cache.put(fk, String(fails + 1), 900); return { ok: false, error: 'pin', left: 4 - fails }; }
  if (!had) sh.getRange(at + 2, 4).setValue(pinHash_(id, pin));
  cache.remove(fk);
  var kept = resolve_(id), nm = String(rows[at][1]).replace(/^'/, ''), cl = String(rows[at][2]);
  if (kept !== id) for (var j = 0; j < rows.length; j++) if (String(rows[j][0]) === kept) { nm = String(rows[j][1]).replace(/^'/, ''); cl = String(rows[j][2]); break; }
  return { ok: true, id: kept, name: nm, cls: cl, json: progressJson_(kept) };
}

/* Forgotten password: email the key to the fixed recovery address (never to an address the site supplies).
   At most one email every 10 minutes, so the button can't be used to flood your inbox. */
function forgot_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('forgot')) return { ok: true, sent: false, wait: true };
  var to = RECOVERY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return { ok: false, error: 'no recovery email' };
  MailApp.sendEmail({
    to: to,
    subject: "Mr Butler's CTF: your teacher password",
    body: "Someone pressed 'Email it to me' on the Teacher access screen of Mr Butler's CTF.\n\n" +
          'Teacher password / live view key: ' + TEACHER_KEY + '\n\n' +
          "If that wasn't you, nothing has changed: this email only ever comes to you.\n" +
          'To change the password, edit TEACHER_KEY in the Apps Script (and ask Claude to re-lock the answer book with the same password).',
    name: "Mr Butler's CTF"
  });
  cache.put('forgot', '1', 600);
  var at = to.indexOf('@');
  return { ok: true, sent: true, to: to.charAt(0) + '•••' + (at > 0 ? to.slice(at) : '') };
}

// ---------- teacher-confirmed flags ("Mark completed") ----------
var AWARDS_SHEET = 'Marked complete';
function awardsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(AWARDS_SHEET);
  if (!sh) { sh = ss.insertSheet(AWARDS_SHEET); sh.appendRow(['Pupil ID', 'Challenge', 'Marked']); sh.setFrozenRows(1); }
  return sh;
}
function awards_(onlyPid) {   // { pupilId: { challengeId: time } }
  var sh = awardsSheet_(), n = sh.getLastRow() - 1, out = {};
  if (n < 1) return out;
  sh.getRange(2, 1, n, 3).getValues().forEach(function (r) {
    var pid = String(r[0]), cid = String(r[1]); if (!pid || !cid || (onlyPid && pid !== onlyPid)) return;
    (out[pid] = out[pid] || {})[cid] = r[2] instanceof Date ? r[2].getTime() : Date.now();
  });
  return out;
}
function setAward_(pid, cid, on) {
  if (!/^[0-9a-f]{16}$/.test(String(pid)) || !/^[a-z0-9-]{2,20}$/.test(String(cid))) return { ok: false, error: 'bad request' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = awardsSheet_(), n = sh.getLastRow() - 1, rows = n > 0 ? sh.getRange(2, 1, n, 2).getValues() : [];
    for (var i = rows.length - 1; i >= 0; i--) if (String(rows[i][0]) === pid && String(rows[i][1]) === cid) sh.deleteRow(i + 2);
    if (on) sh.appendRow([pid, cid, new Date()]);
  } finally { lock.releaseLock(); }
  return { ok: true, awarded: !!on, pid: pid, cid: cid };
}

// ---------- merging a pupil's second login into their first ----------
var ALIAS_SHEET = 'Merged logins', SALT = 'mbctf-progress-v1';
function aliasSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ALIAS_SHEET);
  if (!sh) { sh = ss.insertSheet(ALIAS_SHEET); sh.appendRow(['Old login ID', 'Merged into', 'Old name', 'When']); sh.setFrozenRows(1); }
  return sh;
}
function aliases_() { var sh = aliasSheet_(), n = sh.getLastRow() - 1, m = {}; if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(function (r) { if (r[0]) m[String(r[0])] = String(r[1]); }); return m; }
function resolve_(id, A) { A = A || aliases_(); var k = 0; while (A[id] && k++ < 20) id = A[id]; return id; }
function hex_(bytes) { return bytes.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function sign_(data) { return { data: data, check: hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(data) + SALT, Utilities.Charset.UTF_8)) }; }
function rowFor_(sh, id) { var c = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext(); return c ? c.getRow() : 0; }
/* add everything in `old` that `cur` is missing (solves, hints, tutorials…). Teacher marks (a:1) are left to the Marked complete tab. */
function union_(old, cur) {
  ['solved', 'hints', 'tries', 'tut', 'revealed'].forEach(function (f) { cur[f] = cur[f] || {}; });
  Object.keys(old.solved || {}).forEach(function (k) {
    var o = old.solved[k], c = cur.solved[k]; if (!o || o.a) return;
    if (!c || (c.r && !o.r) || (c.a && !o.a)) cur.solved[k] = o;
  });
  ['hints', 'tries', 'tut'].forEach(function (f) { Object.keys(old[f] || {}).forEach(function (k) { cur[f][k] = Math.max(+cur[f][k] || 0, +old[f][k] || 0); }); });
  Object.keys(old.revealed || {}).forEach(function (k) { if (!cur.revealed[k]) cur.revealed[k] = old.revealed[k]; });
  cur.wrong = Math.max(+cur.wrong || 0, +old.wrong || 0);
  if (old.created && (!cur.created || old.created < cur.created)) cur.created = old.created;
  return cur;
}
function merge_(from, to) {
  if (!/^[0-9a-f]{16}$/.test(from) || !/^[0-9a-f]{16}$/.test(to) || from === to) return { ok: false, error: 'bad request' };
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var A = aliases_(); to = resolve_(to, A); if (resolve_(from, A) === to) return { ok: true, merged: true };
    var sh = sheet_(), rf = rowFor_(sh, from), rt = rowFor_(sh, to);
    if (!rt) return { ok: false, error: 'keep pupil not found' };
    var keep = JSON.parse(String(sh.getRange(rt, 6).getValue()) || '{}').data, oldName = '';
    if (rf) {
      var gone = JSON.parse(String(sh.getRange(rf, 6).getValue()) || '{}').data || {}; oldName = gone.name || '';
      keep = union_(gone, keep); keep.exported = Date.now();
      var body = JSON.stringify(sign_(keep));
      sh.getRange(rt, 1, 1, 7).setValues([[to, sh.getRange(rt, 2).getValue(), sh.getRange(rt, 3).getValue(), Object.keys(keep.solved || {}).length, new Date(), body, sh.getRange(rt, 7).getValue()]]);
      sh.deleteRow(rf);
    }
    aliasSheet_().appendRow([from, to, safeText_(oldName), new Date()]);
    var aw = awardsSheet_(), n = aw.getLastRow() - 1;   // the old login's teacher marks move across
    if (n > 0) { var ids = aw.getRange(2, 1, n, 1).getValues(); ids.forEach(function (r, i) { if (String(r[0]) === from) aw.getRange(i + 2, 1).setValue(to); }); }
    CacheService.getScriptCache().remove('fail:' + from);
    return { ok: true, merged: true, from: from, to: to };
  } finally { lock.releaseLock(); }
}

// ---------- pupil leaderboard: scores the script has checked itself ----------
/* Read the challenge list from the live site (cached for 6 hours) so every solve can be checked against its proof code. */
function flagTable_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('flags');
  if (hit) return JSON.parse(hit);
  var js = UrlFetchApp.fetch(SITE_URL + 'assets/js/challenges.js?t=' + Date.now(), { muteHttpExceptions: true }).getContentText();
  var key = /CTF_KEY="([^"]+)"/.exec(js)[1], b = Utilities.base64Decode(/CTF_BUNDLE="([^"]+)"/.exec(js)[1]);
  for (var i = 0; i < b.length; i++) b[i] = b[i] ^ key.charCodeAt(i % key.length);
  var data = JSON.parse(Utilities.newBlob(b).getDataAsString('UTF-8')), t = {};
  data.challenges.forEach(function (c) { t[c.id] = [String(c.f).toLowerCase(), c.pts]; });
  try { cache.put('flags', JSON.stringify(t), 21600); } catch (x) { }
  return t;
}
function short_(id) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'board|' + id, Utilities.Charset.UTF_8)).slice(0, 10); }
function board_() {
  if (!BOARD_PUBLIC) return { ok: false, error: 'off' };
  var cache = CacheService.getScriptCache(), hit = cache.get('board');
  if (hit) return JSON.parse(hit);
  var F = flagTable_(), A = aliases_(), olds = {}, AW = awards_(), sh = sheet_(), n = sh.getLastRow() - 1, out = [];
  Object.keys(A).forEach(function (o) { var k = resolve_(o, A); (olds[k] = olds[k] || []).push(o); });
  if (n > 0) sh.getRange(2, 1, n, 7).getValues().forEach(function (r) {
    var id = String(r[0]); if (!id || !r[5]) return;
    var d; try { d = JSON.parse(String(r[5])).data; } catch (x) { return; }
    var ids = [id].concat(olds[id] || []), pts = 0, flags = 0, last = 0, aw = AW[id] || {};
    Object.keys(d.solved || {}).forEach(function (cid) {
      var s = d.solved[cid], f = F[cid]; if (!f) return;
      var ok = !!aw[cid];
      if (!ok && s.p) for (var i = 0; i < ids.length && !ok; i++) ok = hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, ids[i] + '|' + f[0], Utilities.Charset.UTF_8)).slice(0, 16) === s.p;
      if (!ok) return;
      flags++; if (!s.r || aw[cid]) pts += f[1]; last = Math.max(last, +s.t || 0);
    });
    Object.keys(aw).forEach(function (cid) { if (F[cid] && !(d.solved || {})[cid]) { flags++; pts += F[cid][1]; last = Math.max(last, aw[cid]); } });
    var nm = String(d.name || r[1] || '').replace(/^'/, '').trim().split(/\s+/);
    out.push({ n: nm[0] + (nm.length > 1 ? ' ' + nm[nm.length - 1].charAt(0) + '.' : ''), c: String(d.cls || r[6] || ''), p: pts, f: flags, t: last, k: short_(id) });
  });
  out.sort(function (a, b) { return (b.p - a.p) || (a.t - b.t); });
  var res = { ok: true, at: Date.now(), rows: out };
  try { cache.put('board', JSON.stringify(res), 60); } catch (x) { }
  return res;
}

function removedSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(REMOVED_SHEET);
  if (!sh) { sh = ss.insertSheet(REMOVED_SHEET); sh.appendRow(['Pupil ID', 'Name', 'Removed']); sh.setFrozenRows(1); }
  return sh;
}
function isRemoved_(pid) {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REMOVED_SHEET);
  return !!(sh && sh.getRange('A:A').createTextFinder(pid).matchEntireCell(true).findNext());
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// stop a pupil name like "=IMPORTXML(...)" being treated as a formula
function safeText_(s) {
  s = String(s || '').slice(0, 40);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/** Pupils' browsers send their progress here. */
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad json' }); }
  var d = body && body.data;
  if (!d || d.app !== 'MrButlersCTF' || !/^[0-9a-f]{16}$/.test(String(d.pid)) || typeof body.check !== 'string') {
    return out_({ ok: false, error: 'not ctf progress' });
  }
  if (isRemoved_(d.pid)) return out_({ ok: true, removed: true });
  if (JSON.stringify(body).length > MAX_JSON) return out_({ ok: false, error: 'too large' });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_(), id = resolve_(String(d.pid)), r = rowFor_(sh, id), merged = id !== String(d.pid);
    // combine with what's already on the sheet (another computer, or a merged login), so solves are never lost
    if (r) { try { var prev = JSON.parse(String(sh.getRange(r, 6).getValue()) || '{}').data; if (prev) d = union_(prev, d); } catch (x) { } }
    if (merged) { d.pid = id; if (r) { d.name = String(sh.getRange(r, 2).getValue()).replace(/^'/, ''); d.cls = String(sh.getRange(r, 7).getValue()); } }
    var json = (r || merged) ? JSON.stringify(sign_(d)) : JSON.stringify(body);
    if (json.length > MAX_JSON) return out_({ ok: false, error: 'too large' });
    var row = [id, safeText_(d.name), Number(d.score) || 0, Object.keys(d.solved || {}).length, new Date(), json, safeText_(String(d.cls || '')).slice(0, 12)];
    if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return out_({ ok: true });
}

/** The Teacher tab reads everyone's progress (or clears it) with the teacher key. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'whois') return out_(whois_(p.name, p.cls, p.pin, p.id));   // pupils signing in (no key)
  if (p.action === 'forgot') return out_(forgot_());
  if (p.action === 'board') return out_(board_());   // pupils' leaderboard: checked scores only, no proofs or IDs
  if (p.action === 'myawards') {   // a pupil's own teacher-marked flags (+ where a merged login now lives)
    if (!/^[0-9a-f]{16}$/.test(String(p.id))) return out_({ ok: true, awards: {} });
    var me = String(p.id), kid = resolve_(me), o = { ok: true, awards: awards_(kid)[kid] || {} };
    if (kid !== me) { o.movedTo = kid; var s0 = sheet_(), rr = rowFor_(s0, kid); if (rr) { o.name = String(s0.getRange(rr, 2).getValue()).replace(/^'/, ''); o.cls = String(s0.getRange(rr, 7).getValue()); } }
    o.json = progressJson_(kid);
    return out_(o);
  }   // emails the key to RECOVERY_EMAIL only
  if (p.key !== TEACHER_KEY) return out_({ ok: false, error: 'key' });

  var sh = sheet_();
  if (sh.getRange(1, 7).getValue() !== 'Class') sh.getRange(1, 7).setValue('Class');
  if (p.action === 'merge') return out_(merge_(String(p.from), String(p.to)));
  if (p.action === 'award' || p.action === 'unaward') return out_(setAward_(String(p.pid), String(p.cid), p.action === 'award'));
  if (p.action === 'resetpin') {   // the pupil chooses a new PIN next time they sign in
    var ps = pupilsSheet_(), c = ps.getRange('A:A').createTextFinder(String(p.pid)).matchEntireCell(true).findNext();
    if (!c) return out_({ ok: false, error: 'not registered' });
    ps.getRange(c.getRow(), 4).setValue('');
    CacheService.getScriptCache().remove('fail:' + p.pid);
    return out_({ ok: true, reset: p.pid });
  }
  if (p.action === 'delete') {
    if (!/^[0-9a-f]{16}$/.test(String(p.pid))) return out_({ ok: false, error: 'bad pid' });
    var lock = LockService.getScriptLock();
    lock.waitLock(15000);
    try {
      var cell = sh.getRange('A:A').createTextFinder(p.pid).matchEntireCell(true).findNext();
      var name = cell ? sh.getRange(cell.getRow(), 2).getValue() : '';
      if (cell) sh.deleteRow(cell.getRow());
      if (!isRemoved_(p.pid)) removedSheet_().appendRow([p.pid, name, new Date()]);
      var ps = pupilsSheet_(), pc = ps.getRange('A:A').createTextFinder(String(p.pid)).matchEntireCell(true).findNext();
      if (pc) ps.deleteRow(pc.getRow());   // frees the name: they can sign in again as a new pupil
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true, deleted: p.pid });
  }
  if (p.action === 'clear') {
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    return out_({ ok: true, cleared: true });
  }

  var rows = [];
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    sh.getRange(2, 1, n, HEADER.length).getValues().forEach(function (r) {
      if (!r[5]) return;
      rows.push({ seen: r[4] instanceof Date ? r[4].getTime() : 0, json: r[5] });
    });
  }
  return out_({ ok: true, now: Date.now(), rows: rows, awards: awards_(), aliases: aliases_() });
}
