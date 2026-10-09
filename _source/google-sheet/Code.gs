/**
 * Tutee Connect: website enquiries -> Google Sheet.
 *
 * Paste this into the Google Sheet's Apps Script editor (Extensions, then Apps Script), set SECRET below to a long
 * random value, and deploy it as a web app (Deploy, then New deployment, type "Web app", Execute as "Me",
 * Who has access "Anyone"). Put the web app URL in Netlify as SHEET_WEBHOOK_URL and the same secret as SHEET_SECRET.
 *
 * Only the website's server function knows the URL and the secret; a request without the secret is refused.
 */
var SECRET = 'PASTE-A-LONG-RANDOM-SECRET-HERE';
var SHEET_NAME = 'Enquiries';
var MAIL_TO = 'business@tuteeconnect.com';   // fixed here, so a request can never send mail anywhere else
var HEADERS = ['Received (IST)', 'Full name', 'Email', 'Phone', 'Flying from', 'Destination', 'Interested in',
  'Preferred call time', 'Institution shortlist', 'Note from the student', 'Submitted from'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    if (!d || d.secret !== SECRET) return reply({ ok: false, error: 'unauthorised' });

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
      if (sh.getLastRow() === 0) {
        sh.appendRow(HEADERS);
        sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold').setBackground('#A51D2A').setFontColor('#ffffff');
        sh.setFrozenRows(1);
      }
      // a leading = + - @ would make Sheets treat the text as a formula
      var safe = function (v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; };
      sh.appendRow([d.received, d.name, d.email, d.phone, d.flying_from, d.destination, d.interested_in,
        d.call_time, d.shortlist, d.note, d.page].map(safe));
    } finally {
      lock.releaseLock();
    }
    // the website's email, sent from this Google account (when the site has no Gmail app password of its own)
    if (d.mail) {
      try {
        var opts = { to: MAIL_TO, subject: d.mail.subject, body: d.mail.text, htmlBody: d.mail.html, name: d.mail.name };
        if (d.mail.reply_to) opts.replyTo = d.mail.reply_to;
        MailApp.sendEmail(opts);
        return reply({ ok: true, mailed: true });
      } catch (mailErr) {
        return reply({ ok: true, mailed: false, mail_error: String(mailErr).slice(0, 200) });
      }
    }
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err).slice(0, 200) });
  }
}

function reply(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
