/**
 * Mr Butler's CTF — live progress collector (Google Apps Script)
 *
 * Paste this into Extensions → Apps Script on a Google Sheet you own,
 * set TEACHER_KEY below, then Deploy → New deployment → Web app
 * (Execute as: Me, Who has access: Anyone). See SETUP.md.
 *
 * Pupils' browsers POST their signed progress here automatically.
 * The Teacher tab GETs it back (only with the teacher key).
 * One row per pupil device — each new post overwrites that pupil's row.
 */

// CHANGE THIS before deploying. Keep it out of the public GitHub repo.
var TEACHER_KEY = 'change-me-to-something-secret';

var SHEET_NAME = 'Progress';
var HEADER = ['Pupil ID', 'Name', 'Score', 'Flags', 'Last update', 'Data (do not edit)'];
var MAX_JSON = 45000; // a Sheets cell holds 50,000 characters

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
  var json = JSON.stringify(body);
  if (json.length > MAX_JSON) return out_({ ok: false, error: 'too large' });

  var flags = Object.keys(d.solved || {}).length;
  var row = [d.pid, safeText_(d.name), Number(d.score) || 0, flags, new Date(), json];

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
  if (p.key !== TEACHER_KEY) return out_({ ok: false, error: 'key' });

  var sh = sheet_();
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
