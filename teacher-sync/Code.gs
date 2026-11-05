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
var SITE_URL = 'https://popcorn483.github.io/MrButlersCTF/';   // your site's address (used in emails)
var REQUIRE_APPROVAL = true;   // new pupils wait until you approve them on the Teacher tab › Awaiting approval (false: anyone can sign up)
var EMAIL_SIGNINS = true;      // email you when a new pupil signs up (at most 90 a day); set to false to stop them
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
    if (REQUIRE_APPROVAL) setAccess_(String(devId), 'pending', name, cls);
    notify_('New sign-up', name, cls, REQUIRE_APPROVAL ? 'A new pupil is waiting for you to approve them: Teacher tab › Awaiting approval.' : 'A new pupil has signed up.');
    return { ok: true, id: String(devId), name: name, cls: cls, fresh: true, status: statusOf_(String(devId)) };
  }
  var id = String(rows[at][0]), had = String(rows[at][3] || ''), cache = CacheService.getScriptCache(), fk = 'fail:' + id, fails = +(cache.get(fk) || 0);
  if (fails >= 5) return { ok: false, error: 'locked' };
  if (had && had !== pinHash_(id, pin)) { cache.put(fk, String(fails + 1), 900); return { ok: false, error: 'pin', left: 4 - fails }; }
  if (!had) sh.getRange(at + 2, 4).setValue(pinHash_(id, pin));
  cache.remove(fk);
  var kept = resolve_(id), nm = String(rows[at][1]).replace(/^'/, ''), cl = String(rows[at][2]);
  if (kept !== id) for (var j = 0; j < rows.length; j++) if (String(rows[j][0]) === kept) { nm = String(rows[j][1]).replace(/^'/, ''); cl = String(rows[j][2]); break; }
  return { ok: true, id: kept, name: nm, cls: cl, json: progressJson_(kept), status: statusOf_(kept) };
}

// ---------- access approval (as in the revision app) ----------
/* Access tab: [Pupil ID, Status (pending / approved / declined), Name, Class, Requested, Decided].
   Pupils from before approvals were switched on (no row) count as approved. */
function acc_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Access');
  if (!sh) { sh = ss.insertSheet('Access'); sh.appendRow(['Pupil ID', 'Status', 'Name', 'Class', 'Requested', 'Decided']); sh.setFrozenRows(1); }
  return sh;
}
function accRows_() { var sh = acc_(), n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 6).getValues() : []; }
function statusOf_(id) {
  if (!REQUIRE_APPROVAL) return 'approved';
  var r = accRows_().filter(function (x) { return String(x[0]) === id; })[0];
  return r ? String(r[1]) : 'approved';
}
function setAccess_(id, status, name, cls) {
  var sh = acc_(), rows = accRows_(), now = new Date(), i = -1;
  for (var k = 0; k < rows.length; k++) if (String(rows[k][0]) === id) { i = k; break; }
  if (i >= 0) { sh.getRange(i + 2, 2).setValue(status); if (status !== 'pending') sh.getRange(i + 2, 6).setValue(now); }
  else sh.appendRow([id, status, safeText_(name || ''), String(cls || '').toUpperCase().slice(0, 12), now, status === 'pending' ? '' : now]);
}
function dropAccess_(ids) { var sh = acc_(), rows = accRows_(); for (var i = rows.length - 1; i >= 0; i--) if (ids.indexOf(String(rows[i][0])) >= 0) sh.deleteRow(i + 2); }
function pending_() {
  return accRows_().filter(function (r) { var v = String(r[1]); return v === 'pending' || v === 'declined'; }).map(function (r) {
    return { pid: String(r[0]), status: String(r[1]), name: String(r[2]).replace(/^'/, ''), cls: String(r[3]), at: r[4] instanceof Date ? r[4].getTime() : 0 };
  });
}
/* Approved pupils who haven't sent any progress yet, so they show on the Teacher tab straight away (as "not started"). */
function joined_(progressIds) {
  var ps = pupilsSheet_(), n = ps.getLastRow() - 1; if (n < 1) return [];
  var acc = {}; accRows_().forEach(function (r) { acc[String(r[0])] = String(r[1]); });
  var rm = {}, rs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(REMOVED_SHEET);
  if (rs && rs.getLastRow() > 1) rs.getRange(2, 1, rs.getLastRow() - 1, 1).getValues().forEach(function (r) { rm[String(r[0])] = 1; });
  var A = aliases_(), out = [];
  ps.getRange(2, 1, n, 5).getValues().forEach(function (r) {
    var id = String(r[0]); if (!/^[0-9a-f]{16}$/.test(id) || rm[id] || A[id] || progressIds[id]) return;
    if (REQUIRE_APPROVAL && acc[id] && acc[id] !== 'approved') return;   // still waiting, or declined
    out.push({ pid: id, name: String(r[1]).replace(/^'/, ''), cls: String(r[2]), at: r[4] instanceof Date ? r[4].getTime() : 0 });
  });
  return out;
}
function decide_(pids, status) {
  var lock = LockService.getScriptLock(); lock.waitLock(15000); var done = 0;
  try { String(pids || '').split(',').forEach(function (x) { if (/^[0-9a-f]{16}$/.test(x)) { setAccess_(x, status); done++; } }); } finally { lock.releaseLock(); }
  return { ok: true, access: status, done: done };
}
/* ---------- emails: one branded HTML layout (with a plain-text copy for mail apps that want it) ---------- */
function esc_(t) { return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
/* o: { preheader, tag, heading, intro, rows: [[label, value]], code, button: { text, url }, note, footer } */
function mailHtml_(o) {
  var F = "font-family:'Segoe UI',Helvetica,Arial,sans-serif;";
  var rows = (o.rows || []).map(function (r, i) {
    return '<tr><td style="' + F + 'padding:10px 14px;font-size:13px;color:#64748b;width:38%;border-top:' + (i ? '1px solid #e2e8f0' : '0') + ';">' + esc_(r[0]) + '</td>' +
      '<td style="' + F + 'padding:10px 14px;font-size:14px;color:#0f172a;font-weight:600;border-top:' + (i ? '1px solid #e2e8f0' : '0') + ';">' + esc_(r[1]) + '</td></tr>';
  }).join('');
  return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
    '<body style="margin:0;padding:0;background:#eef2f7;">' +
    '<div style="display:none;max-height:0;overflow:hidden;opacity:0;">' + esc_(o.preheader || '') + '</div>' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2f7;"><tr><td align="center" style="padding:28px 12px;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #dbe3ee;">' +
    // header band
    '<tr><td style="background:#0b1220;padding:20px 28px;border-bottom:4px solid #4ade80;">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="' + F + 'color:#ffffff;font-size:17px;font-weight:700;letter-spacing:.5px;"><span style="color:#4ade80;">&#9873;</span>&nbsp; MR BUTLER&#8217;S CTF</td>' +
      '<td align="right" style="' + F + 'color:#94a3b8;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">' + esc_(o.tag || 'Teacher notice') + '</td>' +
      '</tr></table></td></tr>' +
    // body
    '<tr><td style="padding:30px 28px 8px;">' +
      '<h1 style="' + F + 'margin:0 0 12px;font-size:21px;line-height:1.3;color:#0f172a;">' + esc_(o.heading) + '</h1>' +
      (o.intro ? '<p style="' + F + 'margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">' + o.intro + '</p>' : '') +
      (rows ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin:0 0 22px;">' + rows + '</table>' : '') +
      (o.code ? '<div style="' + F + 'margin:0 0 22px;padding:16px;text-align:center;background:#f0fdf4;border:1px dashed #22c55e;border-radius:8px;"><span style="font-family:Consolas,Menlo,monospace;font-size:22px;letter-spacing:2px;color:#14532d;font-weight:700;">' + esc_(o.code) + '</span></div>' : '') +
      (o.button ? '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr><td style="border-radius:8px;background:#16a34a;">' +
        '<a href="' + esc_(o.button.url) + '" style="' + F + 'display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">' + esc_(o.button.text) + ' &rarr;</a></td></tr></table>' : '') +
      (o.note ? '<p style="' + F + 'margin:0 0 22px;font-size:13px;line-height:1.6;color:#64748b;">' + o.note + '</p>' : '') +
    '</td></tr>' +
    // footer
    '<tr><td style="' + F + 'padding:16px 28px 22px;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.6;color:#94a3b8;">' +
      (o.footer || '') + (o.footer ? '<br>' : '') + 'Sent automatically by your Mr Butler&#8217;s CTF Google script &middot; ' + esc_(Utilities.formatDate(new Date(), 'Europe/London', 'd MMM yyyy, HH:mm')) +
      '<br><a href="' + esc_(SITE_URL) + '" style="color:#16a34a;text-decoration:none;">' + esc_(SITE_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')) + '</a>' +
    '</td></tr></table></td></tr></table></body></html>';
}
function mailText_(o) {
  return [o.heading, '', String(o.intro || '').replace(/<[^>]+>/g, '')].concat((o.rows || []).map(function (r) { return r[0] + ': ' + r[1]; }))
    .concat(o.code ? ['', o.code] : []).concat(o.button ? ['', o.button.text + ': ' + o.button.url] : []).concat(o.note ? ['', String(o.note).replace(/<[^>]+>/g, '')] : [])
    .concat(['', '— Mr Butler’s CTF', SITE_URL]).join('\n');
}
function sendMail_(to, subject, o) {
  MailApp.sendEmail({ to: to, subject: subject, name: "Mr Butler's CTF", body: mailText_(o), htmlBody: mailHtml_(o) });
}

/* one email per new sign-up, as in the revision app (never more than 90 a day) */
function notify_(what, name, cls, more) {
  if (!EMAIL_SIGNINS) return;
  try {
    var pr = PropertiesService.getScriptProperties(), day = Utilities.formatDate(new Date(), 'Europe/London', 'yyyy-MM-dd');
    var n = +(pr.getProperty('mails:' + day) || 0); if (n >= 90 || MailApp.getRemainingDailyQuota() < 5) return;
    var to = RECOVERY_EMAIL || Session.getEffectiveUser().getEmail(); if (!to) return;
    var nm = String(name || '').replace(/^'/, ''), c = String(cls || '').replace(/^'/, '').toUpperCase(), waiting = 0;
    try { waiting = pending_().filter(function (r) { return r.status === 'pending'; }).length; } catch (x) { }
    sendMail_(to, (REQUIRE_APPROVAL ? 'Approval needed: ' : 'New sign-up: ') + nm + ' (' + c + ')', {
      preheader: nm + ' (' + c + ') ' + (REQUIRE_APPROVAL ? 'is waiting for you to approve them.' : 'has signed up.'),
      tag: REQUIRE_APPROVAL ? 'Access request' : 'New sign-up',
      heading: REQUIRE_APPROVAL ? 'A pupil is waiting for approval' : 'A new pupil has signed up',
      intro: REQUIRE_APPROVAL ? 'A pupil has signed up to Mr Butler&#8217;s CTF and can&#8217;t see any challenges until you approve them.' : esc_(more),
      rows: [['Pupil', nm], ['Form class', c], ['Requested', Utilities.formatDate(new Date(), 'Europe/London', 'EEEE d MMMM, HH:mm')]].concat(REQUIRE_APPROVAL && waiting ? [['Waiting in total', String(waiting)]] : []),
      button: { text: REQUIRE_APPROVAL ? 'Review requests' : 'Open the Teacher tab', url: SITE_URL },
      note: REQUIRE_APPROVAL ? 'Open the site on a teacher PC, then go to <b>Teacher</b> &rsaquo; <b>Awaiting approval</b> to approve or decline. The pupil&#8217;s screen opens by itself within 20 seconds of approval.' : '',
      footer: 'To stop these emails, set <code>EMAIL_SIGNINS</code> to <code>false</code> in the Apps Script.'
    });
    pr.setProperty('mails:' + day, String(n + 1)); pr.deleteProperty('mailError');
  } catch (e) { try { PropertiesService.getScriptProperties().setProperty('mailError', new Date().toLocaleString('en-GB') + ': ' + String(e && e.message || e).slice(0, 200)); } catch (x) { } }
}
/* Teacher tab › Send test email: proves emails work and shows where they go. Also runnable from the editor. */
function testEmail() {
  var to = RECOVERY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return { ok: false, error: 'This script can’t see an email address to send to. Set RECOVERY_EMAIL at the top of the script.' };
  try {
    sendMail_(to, "Mr Butler's CTF: test email", {
      preheader: 'Emails from your CTF script are working.', tag: 'Test email',
      heading: 'Emails are working',
      intro: 'This is a test from your Mr Butler&#8217;s CTF Google script. Notifications will arrive at this address.',
      rows: [['Sent to', to], ['Sign-up emails', EMAIL_SIGNINS ? 'On' : 'Off (EMAIL_SIGNINS is false)'], ['Pupil approval', REQUIRE_APPROVAL ? 'Required' : 'Off (REQUIRE_APPROVAL is false)'], ['Answers installed', installed_() ? 'Yes' : 'Not yet: sign in on the site as a teacher']],
      button: { text: 'Open Mr Butler’s CTF', url: SITE_URL }
    });
    PropertiesService.getScriptProperties().deleteProperty('mailError');
    Logger.log('Test email sent to ' + to);
    return { ok: true, sent: true, to: to, quota: MailApp.getRemainingDailyQuota(), signins: EMAIL_SIGNINS, approval: REQUIRE_APPROVAL };
  } catch (e) { return { ok: false, error: String(e && e.message || e).slice(0, 250) }; }
}

/* Forgotten password: email the key to the fixed recovery address (never to an address the site supplies).
   At most one email every 10 minutes, so the button can't be used to flood your inbox. */
function forgot_() {
  var cache = CacheService.getScriptCache();
  if (cache.get('forgot')) return { ok: true, sent: false, wait: true };
  var to = RECOVERY_EMAIL || Session.getEffectiveUser().getEmail();
  if (!to) return { ok: false, error: 'no recovery email' };
  sendMail_(to, "Mr Butler's CTF: your teacher password", {
    preheader: 'The Teacher login password you asked for.', tag: 'Password reminder',
    heading: 'Your teacher password',
    intro: 'Someone pressed <b>Email it to me</b> on the Teacher login screen. Here is the password for Teacher login and the live class view:',
    code: TEACHER_KEY,
    button: { text: 'Go to Teacher login', url: SITE_URL },
    note: 'If that wasn&#8217;t you, nothing has changed. This email is only ever sent to this address, at most once every 10 minutes.',
    footer: 'To change the password, edit <code>TEACHER_KEY</code> in the Apps Script and have the answer book re-locked with the same password.'
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
    if (statusOf_(to) !== 'approved' && statusOf_(from) === 'approved') setAccess_(to, 'approved');
    dropAccess_([from]);
    var aw = awardsSheet_(), n = aw.getLastRow() - 1;   // the old login's teacher marks move across
    if (n > 0) { var ids = aw.getRange(2, 1, n, 1).getValues(); ids.forEach(function (r, i) { if (String(r[0]) === from) aw.getRange(i + 2, 1).setValue(to); }); }
    CacheService.getScriptCache().remove('fail:' + from);
    return { ok: true, merged: true, from: from, to: to };
  } finally { lock.releaseLock(); }
}

/* Run this ONCE from the Apps Script editor (choose 'authorise' in the function menu, press Run) after pasting in a new version.
   Google then asks for every permission the script needs: the Sheet, and sending you emails. */
function authorise() {
  sheet_();
  MailApp.getRemainingDailyQuota();
  Logger.log('All set. Answers installed for ' + Object.keys(answers_()).length + ' challenges' + (installed_() ? '' : ' — none yet: on the site press Teacher tab › 🔐 Install answers'));
}

// ---------- pupil leaderboard: scores the script has checked itself ----------
function short_(id) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'board|' + id, Utilities.Charset.UTF_8)).slice(0, 10); }
function board_() {
  if (!BOARD_PUBLIC) return { ok: false, error: 'off' };
  var cache = CacheService.getScriptCache(), hit = cache.get('board');
  if (hit) return JSON.parse(hit);
  if (!installed_()) return { ok: false, error: 'setup' };
  var F = answers_(), A = aliases_(), olds = {}, AW = awards_(), sh = sheet_(), n = sh.getLastRow() - 1, out = [];
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

// ---------- secure content: flags, solutions and the content key live ONLY here (never on the public site) ----------
/* The Answers tab and the key are installed from the Teacher tab (› 🔐 Install answers), which reads them from the
   password-protected answer book. Pupils' computers never receive a flag unless they choose to reveal one. */
function ansSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName('Answers');
  if (!sh) { sh = ss.insertSheet('Answers'); sh.appendRow(['Challenge', 'Flag', 'Points', 'Solution']); sh.setFrozenRows(1); }
  return sh;
}
function answers_() {   // { cid: [flag (lower case), points] } — cached for 6 hours
  var cache = CacheService.getScriptCache(), hit = cache.get('ans2');
  if (hit) return JSON.parse(hit);
  var sh = ansSheet_(), n = sh.getLastRow() - 1, out = {};
  if (n > 0) sh.getRange(2, 1, n, 3).getValues().forEach(function (r) { if (r[0]) out[String(r[0])] = [String(r[1]).toLowerCase(), +r[2] || 0]; });
  try { cache.put('ans2', JSON.stringify(out), 21600); } catch (e) { }
  return out;
}
function solution_(cid) {
  var sh = ansSheet_(), c = sh.getRange('A:A').createTextFinder(cid).matchEntireCell(true).findNext();
  if (!c) return null;
  var v = sh.getRange(c.getRow(), 1, 1, 4).getValues()[0], sol = String(v[3]), walk = [];
  try { var j = JSON.parse(sol); sol = String(j.s || ''); walk = j.w || []; } catch (e) { }
  return { f: String(v[1]), sol: sol, walk: walk };
}
function installed_() { return PropertiesService.getScriptProperties().getProperty('contentVer') || ''; }
function proof_(id, flag) { return hex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, id + '|' + flag, Utilities.Charset.UTF_8)).slice(0, 16); }
function oldIds_(id, A) { var out = []; Object.keys(A).forEach(function (o) { if (resolve_(o, A) === id) out.push(o); }); return out; }
/* keep only solves this script can prove: right proof for this pupil (or a login merged into them, or a computer they
   used before), or marked by the teacher. Stored proofs are rewritten for the pupil's own ID. */
function cleanSolves_(id, d, ANS, A, AW) {
  if (!d || !d.solved) return d;
  var ids = [id].concat(oldIds_(id, A)).concat((d.prevPids || []).filter(function (x) { return /^[0-9a-f]{16}$/.test(x); }).slice(0, 10)), aw = (AW || {})[id] || {};
  Object.keys(d.solved).forEach(function (cid) {
    var s = d.solved[cid], f = ANS[cid];
    if (!f) { delete d.solved[cid]; return; }
    if (aw[cid] && s.a) return;
    var ok = false;
    for (var i = 0; i < ids.length && !ok; i++) ok = !!s.p && proof_(ids[i], f[0]) === s.p;
    if (!ok) { delete d.solved[cid]; return; }
    s.p = proof_(id, f[0]);
  });
  if (d.test && d.test.proofs) Object.keys(d.test.proofs).forEach(function (cid) {
    var f = ANS[cid]; if (!f || proof_(String(d.test.pid), f[0]) !== d.test.proofs[cid]) { delete d.test.proofs[cid]; d.test.solvedIds = (d.test.solvedIds || []).filter(function (x) { return x !== cid; }); }
  });
  delete d.prevPids;
  return d;
}
/* strict check for anything that unlocks content or records a solve: the pupil must have signed in (be on the Pupils
   tab) and, with approvals on, be approved on the Access tab. A made-up ID gets nothing. */
function trusted_(id) {
  if (isRemoved_(id)) return false;
  var r = accRows_().filter(function (x) { return String(x[0]) === id; })[0];
  if (r) return String(r[1]) === 'approved' || !REQUIRE_APPROVAL;
  return !!pupilsSheet_().getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();   // signed up before approvals began
}
function approvedId_(raw) {
  if (!/^[0-9a-f]{16}$/.test(String(raw))) return null;
  var id = resolve_(String(raw)); return trusted_(id) ? id : null;
}
function pupilInfo_(id) {
  var ps = pupilsSheet_(), c = ps.getRange('A:A').createTextFinder(id).matchEntireCell(true).findNext();
  return c ? { name: String(ps.getRange(c.getRow(), 2).getValue()).replace(/^'/, ''), cls: String(ps.getRange(c.getRow(), 3).getValue()) } : { name: '', cls: '' };
}
function updateRow_(id, fn) {   // read, change and re-sign one pupil's stored progress
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = sheet_(), r = rowFor_(sh, id), d;
    if (r) { try { d = JSON.parse(String(sh.getRange(r, 6).getValue())).data; } catch (e) { } }
    if (!d) { var pi = pupilInfo_(id); d = { app: 'MrButlersCTF', v: 1, pid: id, name: pi.name, cls: pi.cls, exported: Date.now(), score: 0, solved: {}, hints: {}, revealed: {}, tries: {}, tut: {}, wrong: 0, created: Date.now() }; }
    d.solved = d.solved || {}; d.revealed = d.revealed || {};
    fn(d); d.exported = Date.now();
    var json = JSON.stringify(sign_(d));
    var row = [id, safeText_(d.name), Number(d.score) || 0, Object.keys(d.solved).length, new Date(), json, safeText_(String(d.cls || '')).slice(0, 12)];
    if (r) sh.getRange(r, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
}
function submit_(q) {
  var ANS = answers_(), cid = String(q.cid || ''), f = ANS[cid];
  if (!installed_() || !f) return { ok: false, error: 'setup' };
  var test = q.mode === 'test', id = test ? null : approvedId_(q.id);
  if (!test && !id) return { ok: false, error: 'access' };
  if (test && !(/^[0-9a-f]{12}$/.test(String(q.tid)) && approvedId_(q.id))) return { ok: false, error: 'access' };
  var cache = CacheService.getScriptCache(), rk = 'sub:' + (q.id || ''), n = +(cache.get(rk) || 0);
  if (n >= 30) return { ok: false, error: 'slow' };   // at most 30 guesses a minute per pupil
  cache.put(rk, String(n + 1), 60);
  var g = String(q.flag || '').trim().toLowerCase().slice(0, 200);
  if (g !== f[0]) return { ok: true, correct: false, close: !/^\w+\{/.test(g) && ('flag{' + g + '}') === f[0] };
  if (test) return { ok: true, correct: true, p: proof_(String(q.tid), f[0]), pts: f[1] };
  var p = proof_(id, f[0]);
  updateRow_(id, function (d) { if (!d.solved[cid]) d.solved[cid] = { t: Date.now(), p: p, h: +q.h || 0, r: d.revealed[cid] ? 1 : 0 }; });
  return { ok: true, correct: true, p: p, pts: f[1], id: id };
}
function reveal_(q) {
  var id = approvedId_(q.id), cid = String(q.cid || '');
  if (!id) return { ok: false, error: 'access' };
  var a = solution_(cid); if (!installed_() || !a) return { ok: false, error: 'setup' };
  updateRow_(id, function (d) { if (!d.revealed[cid]) d.revealed[cid] = Date.now(); });
  return { ok: true, f: a.f, sol: a.sol, walk: a.walk };
}
function ckey_(q) {   // the content key: only for approved pupils and teachers
  var k = PropertiesService.getScriptProperties().getProperty('contentKey');
  if (!k) return { ok: false, error: 'setup' };
  if (q.key === TEACHER_KEY || approvedId_(q.id)) return { ok: true, k: k, ver: installed_() };
  return { ok: false, error: 'access' };
}
function install_(b) {
  if (b.key !== TEACHER_KEY) return { ok: false, error: 'key' };
  var ans = b.answers || {}, ids = Object.keys(ans);
  if (!ids.length || !/^[A-Za-z0-9+/=]{40,}$/.test(String(b.k || ''))) return { ok: false, error: 'bad request' };
  var sh = ansSheet_();
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 4).clearContent();
  sh.getRange(2, 1, ids.length, 4).setValues(ids.map(function (cid) { var a = ans[cid]; return [cid, "'" + String(a[0]), +a[1] || 0, "'" + String(a[2] || '').slice(0, 40000)]; }));
  var pr = PropertiesService.getScriptProperties();
  pr.setProperty('contentKey', String(b.k)); pr.setProperty('contentVer', String(b.ver || '')); if (b.testpw) pr.setProperty('testPassword', String(b.testpw));
  CacheService.getScriptCache().removeAll(['ans2', 'board', 'flags']);
  // clean every stored row once: anything that can't be proved is dropped
  var ANS = answers_(), A = aliases_(), AW = awards_(), ps = sheet_(), n = ps.getLastRow() - 1, cleaned = 0;
  if (n > 0) ps.getRange(2, 1, n, 7).getValues().forEach(function (r, i) {
    if (!r[5]) return; var d; try { d = JSON.parse(String(r[5])).data; } catch (e) { return; }
    var before = Object.keys(d.solved || {}).length; cleanSolves_(String(r[0]), d, ANS, A, AW);
    if (Object.keys(d.solved || {}).length !== before) cleaned++;
    ps.getRange(i + 2, 4, 1, 3).setValues([[Object.keys(d.solved || {}).length, r[4], JSON.stringify(sign_(d))]]);
  });
  return { ok: true, installed: ids.length, ver: installed_(), cleaned: cleaned };
}
/* Test area passwords: each paper (p1, p2, p3) can have its own, set on the Teacher tab › Test passwords.
   A paper with none of its own uses the one from the answer book (installed with the answers). */
var TEST_PAPERS = ['p1', 'p2', 'p3'];
function testpwFor_(paper) {
  var pr = PropertiesService.getScriptProperties();
  return (TEST_PAPERS.indexOf(paper) >= 0 && pr.getProperty('testPassword_' + paper)) || pr.getProperty('testPassword') || '';
}
function testpass_(q) {
  var pw = testpwFor_(String(q.paper || ''));
  if (!pw) return { ok: false, error: 'setup' };
  return { ok: true, pass: String(q.pw || '').trim() === pw };
}
function testpws_() {
  var pr = PropertiesService.getScriptProperties(), out = {};
  TEST_PAPERS.forEach(function (p) { out[p] = pr.getProperty('testPassword_' + p) || ''; });
  return { ok: true, papers: out, fallback: pr.getProperty('testPassword') || '' };
}
function setTestpw_(paper, pw) {
  if (TEST_PAPERS.indexOf(paper) < 0) return { ok: false, error: 'bad paper' };
  pw = String(pw || '').trim();
  if (pw.length > 40) return { ok: false, error: 'too long' };
  var pr = PropertiesService.getScriptProperties();
  if (pw) pr.setProperty('testPassword_' + paper, pw); else pr.deleteProperty('testPassword_' + paper);   // blank: back to the answer-book one
  return testpws_();
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
  if (body && body.kind === 'install') return out_(install_(body));   // teacher › Install answers
  var d = body && body.data;
  if (!d || d.app !== 'MrButlersCTF' || !/^[0-9a-f]{16}$/.test(String(d.pid)) || typeof body.check !== 'string') {
    return out_({ ok: false, error: 'not ctf progress' });
  }
  if (isRemoved_(d.pid)) return out_({ ok: true, removed: true });
  if (REQUIRE_APPROVAL && statusOf_(resolve_(String(d.pid))) !== 'approved') return out_({ ok: true, waiting: true });
  if (installed_() && !approvedId_(d.pid)) return out_({ ok: true, waiting: true, unknown: true });   // never signed in: not saved
  if (JSON.stringify(body).length > MAX_JSON) return out_({ ok: false, error: 'too large' });

  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = sheet_(), id = resolve_(String(d.pid)), r = rowFor_(sh, id), merged = id !== String(d.pid);
    // combine with what's already on the sheet (another computer, or a merged login), so solves are never lost
    if (r) { try { var prev = JSON.parse(String(sh.getRange(r, 6).getValue()) || '{}').data; if (prev) d = union_(prev, d); } catch (x) { } }
    if (merged) { d.pid = id; if (r) { d.name = String(sh.getRange(r, 2).getValue()).replace(/^'/, ''); d.cls = String(sh.getRange(r, 7).getValue()); } }
    if (installed_()) { d = cleanSolves_(id, d, answers_(), aliases_(), awards_()); merged = true; }   // only provable solves are kept
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
  if (p.action === 'submit') return out_(submit_(p));     // a pupil submitting a flag: checked here, never on their computer
  if (p.action === 'reveal') return out_(reveal_(p));     // a pupil choosing to see the answer (scores 0)
  if (p.action === 'ckey') return out_(ckey_(p));         // the key that unlocks the challenges (approved pupils and teachers only)
  if (p.action === 'testpass') return out_(testpass_(p)); // the Test area password
  if (p.action === 'access' || p.action === 'status') { if (!/^[0-9a-f]{16}$/.test(String(p.id))) return out_({ ok: false }); var sid = resolve_(String(p.id)), st = statusOf_(sid); return out_({ ok: true, status: st === 'approved' && !trusted_(sid) ? 'unknown' : st }); }   // a pupil's device: approved yet?
  if (p.action === 'board') {   // pupils' leaderboard: checked scores only, no proofs or IDs
    try { return out_(board_()); } catch (err) { return out_({ ok: false, error: 'script', detail: String(err && err.message || err).slice(0, 200) }); }
  }
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
  if (p.action === 'testmail') return out_(testEmail());
  if (p.action === 'testpws') return out_(testpws_());                                   // Teacher tab › Test passwords
  if (p.action === 'settestpw') return out_(setTestpw_(String(p.paper || ''), p.pw));
  if (p.action === 'answer') { var a = solution_(String(p.cid || '')); return out_(a ? { ok: true, f: a.f, sol: a.sol, walk: a.walk } : { ok: false, error: 'setup' }); }
  if (p.action === 'approve' || p.action === 'decline') return out_(decide_(p.pids, p.action === 'approve' ? 'approved' : 'declined'));   // the teacher answers sign-up requests
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
      dropAccess_([String(p.pid)]);
    } finally {
      lock.releaseLock();
    }
    return out_({ ok: true, deleted: p.pid });
  }
  if (p.action === 'clear') {
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
    return out_({ ok: true, cleared: true });
  }

  var rows = [], ids = {};
  var n = sh.getLastRow() - 1;
  if (n > 0) {
    sh.getRange(2, 1, n, HEADER.length).getValues().forEach(function (r) {
      if (r[0]) ids[String(r[0])] = 1;
      if (!r[5]) return;
      rows.push({ seen: r[4] instanceof Date ? r[4].getTime() : 0, json: r[5] });
    });
  }
  return out_({ ok: true, now: Date.now(), rows: rows, awards: awards_(), aliases: aliases_(), pending: pending_(), joined: joined_(ids), approval: REQUIRE_APPROVAL, mail: { on: EMAIL_SIGNINS, error: PropertiesService.getScriptProperties().getProperty('mailError') || '' }, installed: installed_() });
}
