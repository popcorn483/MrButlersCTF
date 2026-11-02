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
  return { ok: true, id: id, name: String(rows[at][1]).replace(/^'/, ''), cls: String(rows[at][2]), json: progressJson_(id) };
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
  var json = JSON.stringify(body);
  if (json.length > MAX_JSON) return out_({ ok: false, error: 'too large' });

  var flags = Object.keys(d.solved || {}).length;
  var row = [d.pid, safeText_(d.name), Number(d.score) || 0, flags, new Date(), json, safeText_(String(d.cls || '')).slice(0, 12)];

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_();
    var found = sh.getRange('A:A').createTextFinder(d.pid).matchEntireCell(true).findNext();
    if (found) sh.getRange(found.getRow(), 1, 1, row.length).setValues([row]);
    else sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  return out_({ ok: true });
}

/** The Teacher tab reads everyone's progress (or clears it) with the teacher key. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'whois') return out_(whois_(p.name, p.cls, p.pin, p.id));   // pupils signing in (no key)
  if (p.key !== TEACHER_KEY) return out_({ ok: false, error: 'key' });

  var sh = sheet_();
  if (sh.getRange(1, 7).getValue() !== 'Class') sh.getRange(1, 7).setValue('Class');
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
  return out_({ ok: true, now: Date.now(), rows: rows });
}
