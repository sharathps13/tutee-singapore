/**
 * Serverless enquiry handler — Netlify Functions (v2, ESM).
 *
 * A faithful port of the Vercel Python handler (`enquiry.py`). Netlify's
 * function runtime is JavaScript/TypeScript or Go — it does **not** run Python —
 * so moving the sites to Netlify forced this rewrite. Behaviour is deliberately
 * identical, with one addition: the lead is also written to Supabase, which is
 * now the system of record.
 *
 * Deployed at /.netlify/functions/enquiry and exposed as POST /api/enquiry by
 * the redirect in netlify.toml. Shared byte-for-byte by every country site;
 * the canonical copy lives in _tooling/serverless/ and is pushed out by
 * _tooling/install_netlify.py — edit it there, never in a country folder.
 *
 *   * No key of any kind is present in the frontend. GMAIL_APP_PASSWORD and
 *     SUPABASE_SERVICE_ROLE_KEY live only in the Netlify environment, are never
 *     echoed in a response, and never reach a log line.
 *   * The recipient cannot be tampered with by editing the page, because it is a
 *     hard-coded constant here (MAIL_TO) — not a form field and not an env var.
 *
 * Zero npm dependencies: Node 18+ fetch and node:tls only, so there is no package.json
 * to keep in step and Netlify needs no build step to deploy it.
 *
 * Environment variables (set in Netlify → Site settings → Environment variables):
 *
 *   GMAIL_USER                  required  Google Workspace address that sends, e.g. business@tuteeconnect.com
 *   GMAIL_APP_PASSWORD          required  16-letter app password for that account. Server-side only.
 *   SHEET_WEBHOOK_URL           optional  Apps Script web app URL (_source/google-sheet/Code.gs)
 *   SHEET_SECRET                optional  shared secret, the same value as SECRET in Code.gs
 *   SUPABASE_URL                optional  https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   optional  service_role key. Server-side ONLY —
 *                                         it bypasses RLS. Never ship to a browser.
 *   MAIL_FROM                   optional  From line; must be GMAIL_USER or a Gmail
 *                                         "Send mail as" alias of it.
 *   SITE_COUNTRY                optional  e.g. "France"; labels the subject line.
 *
 * If the Supabase vars are absent the handler still works exactly as before —
 * email only. That keeps a country site deployable before Supabase exists.
 */

// --------------------------------------------------------------- recipient
// Hard-coded on purpose. The brief requires exactly this address, and keeping it
// out of both the form and the environment means a tampered page or a mistyped
// env var cannot redirect enquiries somewhere else.
const MAIL_TO = 'business@tuteeconnect.com';

const fromAddr = () => (process.env.MAIL_FROM || `Tutee Connect Website <${(process.env.GMAIL_USER || 'business@tuteeconnect.com').trim()}>`).trim();

const MAX_BODY_BYTES = 16 * 1024;
const SEND_TIMEOUT_MS = 20000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The thirteen destination pages. Used only to label the subject line, and
// matched against a fixed list so that a tampered `destination` cannot put
// arbitrary text into a mail header. A country missing from here is not a
// security problem but it IS a routing one: its enquiries fall through to the
// unlabelled subject and nobody can tell which page they came from. Add the new
// country here in the same commit as the page.
const KNOWN_COUNTRIES = ['Australia', 'Canada', 'Finland', 'France', 'Germany',
  'Ireland', 'Malaysia', 'Mauritius', 'New Zealand',
  'Poland', 'Singapore', 'UAE', 'UK'];

const COUNTRY_ALIASES = {
  uk: 'UK', unitedkingdom: 'UK', britain: 'UK', gb: 'UK',
  canada: 'Canada', ca: 'Canada',
  germany: 'Germany', de: 'Germany', deutschland: 'Germany',
  ireland: 'Ireland', ie: 'Ireland',
  newzealand: 'New Zealand', nz: 'New Zealand',
  australia: 'Australia', au: 'Australia', aus: 'Australia',
  france: 'France', fr: 'France',
  finland: 'Finland', fi: 'Finland', fin: 'Finland', suomi: 'Finland',
  poland: 'Poland', pl: 'Poland', pol: 'Poland', polska: 'Poland',
  singapore: 'Singapore', sg: 'Singapore', sgp: 'Singapore',
  malaysia: 'Malaysia', my: 'Malaysia', mys: 'Malaysia',
  mauritius: 'Mauritius', mu: 'Mauritius', mus: 'Mauritius',
  maurice: 'Mauritius', ilemaurice: 'Mauritius',
  // the UAE page is marketed as Dubai, so SITE_COUNTRY may well be set to that
  // rather than to the country
  uae: 'UAE', ae: 'UAE', are: 'UAE', dubai: 'UAE',
  unitedarabemirates: 'UAE', emirates: 'UAE',
};

const FIELD_LIMITS = {
  name: 120, email: 200, phone: 40, destination: 600, subject: 200, from_name: 120,
};

// Fields this handler consumes by name. Anything else the form grows later is
// still forwarded, under its own row — the brief asks for *all* submitted
// information, and a field added to the markup should not silently vanish just
// because this file has not been updated to know about it.
const KNOWN_FIELDS = new Set(['name', 'email', 'phone', 'phone_number',
  'country_code', 'destination', 'from_name', 'page', 'botcheck',
  'access_key', 'subject']);
const MAX_EXTRA_FIELDS = 12;

/** Collapse whitespace and strip CR/LF.
 *
 * Stripping CR/LF is the important part: `name` and the country reach the
 * Subject and `email` reaches Reply-To, so a newline in any of them would let a
 * submitter inject extra headers. */
function clean(value, limit) {
  if (value === null || value === undefined) return '';
  const text = String(value).replace(/[\r\n]/g, ' ').replace(/\s+/g, ' ').trim();
  return text.slice(0, limit);
}

function slug(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

/** Which landing page this enquiry came from, for the subject line.
 *
 * Order: the SITE_COUNTRY env var (trustworthy, set per Netlify site), then the
 * submitted destination, then the request host. Every source is matched against
 * KNOWN_COUNTRIES rather than used verbatim, so the value that reaches a mail
 * header is always one of thirteen fixed strings. */
export function resolveCountry(destination, host) {
  const env = slug(process.env.SITE_COUNTRY);
  if (COUNTRY_ALIASES[env]) return COUNTRY_ALIASES[env];

  const dest = slug(destination);
  for (const country of KNOWN_COUNTRIES) {
    if (dest.includes(slug(country))) return country;
  }
  const hostSlug = slug(host);
  for (const country of KNOWN_COUNTRIES) {
    if (hostSlug.includes(slug(country))) return country;
  }
  return '';
}

/** Accept JSON or urlencoded, and either a combined `phone` or the
 * `country_code` + `phone_number` pair the markup actually submits. */
export function parsePayload(raw) {
  let data = {};
  const text = String(raw ?? '').trim();

  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
    } catch { data = {}; }
  }
  if (!Object.keys(data).length && text) {
    for (const [k, v] of new URLSearchParams(text)) {
      if (!(k in data)) data[k] = v;
    }
  }

  let phone = data.phone;
  if (!phone) phone = `${data.country_code ?? ''} ${data.phone_number ?? ''}`;

  const extras = [];
  for (const key of Object.keys(data).sort()) {
    if (KNOWN_FIELDS.has(key)) continue;
    // The university shortlist can name up to 12 institutions, so it gets more room.
    const value = clean(data[key], key === 'shortlist' ? 1200 : 300);
    if (value && extras.length < MAX_EXTRA_FIELDS) extras.push([clean(key, 60), value]);
  }

  return {
    name: clean(data.name, FIELD_LIMITS.name),
    email: clean(data.email, FIELD_LIMITS.email),
    phone: clean(phone, FIELD_LIMITS.phone),
    destination: clean(data.destination, FIELD_LIMITS.destination) || 'General Inquiry',
    from_name: clean(data.from_name, FIELD_LIMITS.from_name) || 'Tutee Connect Website',
    page: clean(data.page, 200),
    extras,
    botcheck: data.botcheck,
  };
}

/** Mirror of the client-side rules. The browser check is for UX; this one is the
 * check that actually counts, because a client can always be bypassed. */
export function validate(f) {
  if (f.botcheck) return 'Rejected.';                 // honeypot
  if (f.name.length < 2) return 'Please enter your full name.';
  if (!EMAIL_RE.test(f.email)) return 'Please enter a valid email address.';
  const digits = f.phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) {
    return 'Please enter a valid phone number (7-15 digits).';
  }
  return null;
}

function esc(text) {
  return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// How the form's own field names read in the email. Anything the form grows later
// that is not listed here still appears, under "Other details", with a tidied name.
const EXTRA_LABELS = {
  study_level: ['study', 'Interested in'],
  call_slot: ['study', 'Preferred call time'],
  origin_city: ['contact', 'Flying from'],
  shortlist: ['study', 'Institution shortlist'],
  description: ['note', 'Note from the student'],
};

function tidyLabel(key) {
  const words = String(key).replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** When the enquiry arrived, in India time (where the advisors work). */
function receivedAt(now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata', day: 'numeric', month: 'long', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }).format(now) + ' IST';
  } catch { return now.toISOString(); }
}

/** The message (sent through Gmail): a plain, professional notification with the
 * submitted details only (no images, no attachments). Returns a plain object,
 * ready to be JSON-encoded. */
export function buildEmail(f, country, now = new Date()) {
  const place = country || 'Website';
  const subject = `New consultation request: ${f.name || 'Website visitor'} (${place})`;

  // group the answers the way an advisor reads them
  const contact = [['Full name', f.name], ['Email', f.email], ['Phone', f.phone]];
  const study = [['Destination', f.destination]];
  const other = [];
  let note = '';
  let shortlist = [];
  for (const [key, value] of f.extras) {
    const known = EXTRA_LABELS[key];
    if (!known) { other.push([tidyLabel(key), value]); continue; }
    const [group, label] = known;
    if (key === 'description') { note = value; continue; }
    if (key === 'shortlist') {
      shortlist = value.split(/;\s*/).map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);
      continue;
    }
    (group === 'contact' ? contact : study).push([label, value]);
  }
  const ORDER = ['Destination', 'Interested in', 'Preferred call time'];
  study.sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]));
  const meta = [['Received', receivedAt(now)], ['Landing page', place]];
  if (f.page) meta.push(['Submitted from', f.page]);

  const digits = f.phone.replace(/\D/g, '');
  const who = f.name || 'the student';

  // ---------- plain text ----------
  const block = (title, rows) => [title.toUpperCase(), ...rows.map(([l, v]) => `  ${(l + ':').padEnd(24)}${v}`), ''];
  const plain = [
    'New consultation request from the Tutee Connect website', '',
    ...block('Contact details', contact),
    ...block('Study plans', study),
    ...(shortlist.length ? ['INSTITUTION SHORTLIST', ...shortlist.map((s, i) => `  ${i + 1}. ${s}`), ''] : []),
    ...(note ? ['NOTE FROM THE STUDENT', `  ${note}`, ''] : []),
    ...(other.length ? block('Other details', other) : []),
    ...block('Submission', meta),
    `Reply to this email to answer ${who} directly.`,
  ];

  // ---------- HTML: table layout and inline styles, so it renders the same in every mail client ----------
  const font = 'font-family:Segoe UI,Helvetica,Arial,sans-serif';
  const rowsHtml = (rows) => rows.map(([label, value]) =>
    '<tr>'
    + `<td style="padding:9px 0;width:170px;vertical-align:top;color:#5B6E72;font-size:13px;${font}">${esc(label)}</td>`
    + `<td style="padding:9px 0;vertical-align:top;color:#0F2930;font-size:14px;font-weight:600;${font}">${esc(value)}</td>`
    + '</tr>').join('');
  const section = (title, inner) =>
    '<tr><td style="padding:22px 32px 0">'
    + `<div style="${font};font-size:11px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;color:#A51D2A;`
    + `padding-bottom:6px;border-bottom:1px solid #E6ECEE">${esc(title)}</div>`
    + `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">${inner}</table>`
    + '</td></tr>';
  const button = (href, label, bg) =>
    `<a href="${esc(href)}" style="display:inline-block;margin:0 8px 8px 0;padding:10px 18px;border-radius:8px;background:${bg};`
    + `color:#ffffff;text-decoration:none;font-size:13px;font-weight:700;${font}">${esc(label)}</a>`;

  const actions = [
    EMAIL_RE.test(f.email) ? button(`mailto:${f.email}`, 'Reply by email', '#0F3E48') : '',
    digits.length >= 7 ? button(`tel:+${digits}`, 'Call', '#0F3E48') : '',
    digits.length >= 7 ? button(`https://wa.me/${digits}`, 'WhatsApp', '#1F8C5A') : '',
  ].join('');

  const html = '<!doctype html><html><body style="margin:0;padding:0;background:#F2F5F6">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F5F6;padding:28px 12px">'
    + '<tr><td align="center">'
    + '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;'
    + 'background:#ffffff;border-radius:12px;border:1px solid #E1E8EA;border-collapse:separate;overflow:hidden">'
    // header
    + '<tr><td style="background:#A51D2A;padding:22px 32px">'
    + `<div style="${font};font-size:12px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;color:#F6C9CD">Tutee Connect · ${esc(place)}</div>`
    + `<div style="${font};font-size:21px;font-weight:700;color:#ffffff;margin-top:6px">New consultation request</div>`
    + `<div style="${font};font-size:14px;color:#FBE4E6;margin-top:4px">${esc(f.name)} would like a free call with an advisor.</div>`
    + '</td></tr>'
    + `<tr><td style="padding:20px 32px 0">${actions}</td></tr>`
    + section('Contact details', rowsHtml(contact))
    + section('Study plans', rowsHtml(study))
    + (shortlist.length ? section('Institution shortlist', shortlist.map((s, i) =>
      `<tr><td style="padding:7px 0;${font};font-size:14px;color:#0F2930"><span style="color:#A51D2A;font-weight:700">${i + 1}.</span> ${esc(s)}</td></tr>`).join('')) : '')
    + (note ? section('Note from the student',
      `<tr><td style="padding:10px 0;${font};font-size:14px;line-height:1.55;color:#0F2930">${esc(note)}</td></tr>`) : '')
    + (other.length ? section('Other details', rowsHtml(other)) : '')
    + section('Submission', rowsHtml(meta))
    + `<tr><td style="padding:24px 32px 26px;${font};font-size:12px;line-height:1.5;color:#7A8B8E">`
    + `Replying to this email goes straight to ${esc(who)}. This message was sent automatically by the `
    + 'Tutee Connect website enquiry form.</td></tr>'
    + '</table></td></tr></table></body></html>';

  const payload = {
    from: fromAddr(),
    to: [MAIL_TO],
    subject,
    text: plain.join('\n'),
    html,
  };
  if (EMAIL_RE.test(f.email)) payload.reply_to = f.email;   // reply goes to the student
  return payload;
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Send the message through Google Workspace (Gmail SMTP, smtp.gmail.com:465,
 * implicit TLS, AUTH LOGIN with an app password). A minimal SMTP client on
 * node:tls keeps the function free of npm dependencies.
 *
 * The password is read here and nowhere else, and never appears in an error
 * message, a log line or a response body. */
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const mimeWord = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${b64(s)}?=`);
const wrap76 = (s) => s.replace(/.{1,76}/g, '$&\r\n');
const addrOf = (s) => (String(s).match(/<([^>]+)>/) || [, String(s)])[1].trim();
const displayAddr = (s) => {
  const m = String(s).match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  return m && m[1] ? `${mimeWord(m[1].replace(/^"|"$/g, ''))} <${m[2]}>` : addrOf(s);
};

function buildMime(p, user) {
  const boundary = `tc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  const domain = addrOf(user).split('@')[1] || 'localhost';
  const head = [
    `From: ${displayAddr(p.from)}`,
    `To: ${p.to.join(', ')}`,
    p.reply_to ? `Reply-To: ${p.reply_to}` : '',
    `Subject: ${mimeWord(p.subject)}`,
    `Date: ${new Date().toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${boundary}@${domain}>`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ].filter(Boolean);
  const part = (type, body) => [`--${boundary}`, `Content-Type: ${type}; charset=UTF-8`,
    'Content-Transfer-Encoding: base64', '', wrap76(b64(body))].join('\r\n');
  return [...head, '', part('text/plain', p.text), part('text/html', p.html), `--${boundary}--`, ''].join('\r\n');
}

async function sendViaGmail(payload) {
  const user = (process.env.GMAIL_USER || '').trim();
  const pass = (process.env.GMAIL_APP_PASSWORD || '').replace(/\s+/g, '');
  if (!user || !pass) throw new Error('server email is not configured (missing GMAIL_USER or GMAIL_APP_PASSWORD)');
  const { connect } = await import('node:tls');

  const sock = connect({ host: 'smtp.gmail.com', port: 465, servername: 'smtp.gmail.com' });
  sock.setEncoding('utf8');
  let buf = '';
  const waiters = [];
  const failAll = (err) => { while (waiters.length) waiters.shift().reject(err); };
  sock.on('data', (d) => {
    buf += d;
    // a full reply ends with a line "NNN text" (a space, not a dash, after the code)
    let m;
    while ((m = buf.match(/^(?:\d{3}-[^\n]*\n)*(\d{3}) [^\n]*\n/))) {
      buf = buf.slice(m[0].length);
      const w = waiters.shift();
      if (w) w.resolve({ code: Number(m[1]), text: m[0].trim() });
    }
  });
  sock.on('error', failAll);
  sock.on('close', () => failAll(new Error('gmail closed the connection')));
  const timer = setTimeout(() => { failAll(new Error('gmail timed out')); sock.destroy(); }, SEND_TIMEOUT_MS);
  const reply = () => new Promise((resolve, reject) => waiters.push({ resolve, reject }));
  const step = async (cmd, ok, what) => {
    const r = reply();
    if (cmd !== null) sock.write(cmd + '\r\n');
    const res = await r;
    if (res.code !== ok) throw new Error(`gmail refused ${what}: ${res.text.slice(0, 300)}`);
    return res;
  };

  try {
    await step(null, 220, 'the connection');
    await step('EHLO tuteeconnect.com', 250, 'EHLO');
    await step('AUTH LOGIN', 334, 'AUTH');
    await step(b64(user), 334, 'the username');
    await step(b64(pass), 235, 'the login (check GMAIL_USER and the app password)');
    await step(`MAIL FROM:<${addrOf(user)}>`, 250, 'the sender');
    for (const to of payload.to) await step(`RCPT TO:<${addrOf(to)}>`, 250, 'the recipient');
    await step('DATA', 354, 'DATA');
    const mime = buildMime(payload, user).replace(/\r\n\./g, '\r\n..');
    const res = await step(mime + '\r\n.', 250, 'the message');
    sock.write('QUIT\r\n');
    return (res.text.match(/OK\s+(\S+)/) || [])[1] || 'sent';
  } finally {
    clearTimeout(timer);
    setTimeout(() => sock.destroy(), 200);
  }
}

/** Write the lead to Postgres. Supabase is the system of record, so this runs
 * before the email: if the send later fails, the enquiry still exists and the
 * dashboard shows it. Returns the row id, or null when Supabase is unconfigured. */
async function storeInSupabase(f, country) {
  const url = (process.env.SUPABASE_URL || '').trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!url || !key) return null;                  // not configured yet — email only

  const row = {
    country: country || null,
    name: f.name,
    email: f.email,
    phone: f.phone,
    destination: f.destination,
    source: f.from_name,
    page: f.page || null,
    extras: Object.fromEntries(f.extras),
  };

  const res = await postJson(`${url}/rest/v1/leads`,
    { apikey: key, Authorization: `Bearer ${key}`, Prefer: 'return=representation' },
    row, SEND_TIMEOUT_MS);

  if (!res.ok) {
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
    throw new Error(`supabase rejected the insert: HTTP ${res.status} ${detail}`);
  }
  try {
    const parsed = await res.json();
    return Array.isArray(parsed) ? (parsed[0]?.id ?? null) : (parsed?.id ?? null);
  } catch { return null; }
}

/** Add the lead as a row in the Google Sheet, through the Apps Script web app in
 * _source/google-sheet/Code.gs. Its URL and shared secret live only in the
 * Netlify environment, so the browser never sees them. Returns true when the row
 * was written, null when the Sheet is not configured. */
async function storeInSheet(f, country, mail = null, now = new Date()) {
  const url = (process.env.SHEET_WEBHOOK_URL || '').trim();
  const secret = (process.env.SHEET_SECRET || '').trim();
  if (!url || !secret) return null;
  const ex = Object.fromEntries(f.extras);
  const row = {
    secret,
    received: receivedAt(now),
    name: f.name, email: f.email, phone: f.phone,
    flying_from: ex.origin_city || '',
    destination: f.destination || country || '',
    interested_in: ex.study_level || '',
    call_time: ex.call_slot || '',
    shortlist: (ex.shortlist || '').split(/;\s*/).filter(Boolean).join('\n'),
    note: ex.description || '',
    page: f.page || '',
  };
  // no Gmail app password set: the script sends the email too, as the Sheet's owner
  if (mail) row.mail = { to: mail.to.join(','), subject: mail.subject, html: mail.html, text: mail.text,
    reply_to: mail.reply_to || '', name: 'Tutee Connect Website' };
  // Apps Script answers a POST with a redirect to the result; fetch follows it
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(row), redirect: 'follow', signal: controller.signal });
    const text = await res.text();
    let out = {};
    try { out = JSON.parse(text); } catch { /* not JSON */ }
    if (!res.ok || !out.ok) throw new Error(`sheet refused the row: HTTP ${res.status} ${(out.error || text).slice(0, 200)}`);
    if (mail && !out.mailed) console.error(`enquiry: sheet row written but the script did not send the email: ${out.mail_error || ''}`);
    return { mailed: Boolean(mail && out.mailed) };
  } finally {
    clearTimeout(timer);
  }
}

const OK_MESSAGE = 'Profile submitted successfully! We will contact you soon.';

/** Core logic, shared by the Netlify handler and the local dev server.
 * Returns { status, payload }. */
export async function handle(rawBody, headers = {}) {
  const fields = parsePayload(rawBody);

  const problem = validate(fields);
  if (problem) return { status: 400, payload: { success: false, message: problem } };

  const host = headers['x-forwarded-host'] || headers['host'] || '';
  const country = resolveCountry(fields.destination, host);

  // 1. system of record first, so a lead survives an email outage
  let leadId = null;
  let stored = false;
  try {
    leadId = await storeInSupabase(fields, country);
    stored = leadId !== null;
  } catch (exc) {
    console.error(`enquiry: supabase insert failed: ${exc.message}`);
  }
  // 2. the Google Sheet row; without a Gmail app password the Sheet's script also sends the email
  const viaGmail = Boolean((process.env.GMAIL_USER || '').trim() && (process.env.GMAIL_APP_PASSWORD || '').trim());
  const mail = buildEmail(fields, country);
  let sheeted = false;
  let messageId = '';
  let emailed = false;
  try {
    const r = await storeInSheet(fields, country, viaGmail ? null : mail);
    if (r) { sheeted = true; stored = true; if (r.mailed) { emailed = true; messageId = 'apps-script'; } }
  } catch (exc) {
    console.error(`enquiry: google sheet failed: ${exc.message}`);
  }

  // 3. notify the business inbox through Gmail SMTP, when an app password is set
  if (viaGmail) {
    try {
      messageId = await sendViaGmail(mail);
      emailed = true;
    } catch (exc) {
      console.error(`enquiry: send refused: ${exc.message}`);
    }
  }

  if (!stored && !emailed) {
    // nothing captured the enquiry anywhere — this is the only real failure
    return {
      status: 502,
      payload: {
        success: false,
        message: 'We could not send your enquiry right now. Please try again, '
          + 'or email business@tuteeconnect.com.',
      },
    };
  }

  if (!emailed) {
    // The lead is safe in Postgres, so telling the student it failed would only
    // produce a duplicate submission. Succeed for them, shout in the log.
    console.error('enquiry: STORED BUT NOT EMAILED — check GMAIL_USER and '
      + `GMAIL_APP_PASSWORD (lead=${leadId})`);
  }

  console.log(`enquiry: country=${country || '-'} destination=${fields.destination} `
    + `supabase=${leadId ?? 'no'} sheet=${sheeted ? 'yes' : 'no'} emailed=${emailed ? (messageId || 'yes') : 'no'}`);

  return { status: 200, payload: { success: true, message: OK_MESSAGE } };
}

/** What the GET probe reports: whether config is present, never what it is. */
export function health() {
  return {
    success: true,
    endpoint: 'enquiry',
    recipient: MAIL_TO,
    provider: 'google-workspace',
    runtime: 'netlify-functions',
    sheet_configured: Boolean((process.env.SHEET_WEBHOOK_URL || '').trim() && (process.env.SHEET_SECRET || '').trim()),
    gmail_configured: Boolean((process.env.GMAIL_USER || '').trim() && (process.env.GMAIL_APP_PASSWORD || '').trim()),
    supabase_configured: Boolean((process.env.SUPABASE_URL || '').trim()
      && (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
    from: fromAddr(),
    country: resolveCountry('') || '(inferred per request)',
  };
}

function json(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

/** Netlify Functions v2 entry point. */
export default async function (req) {
  if (req.method === 'GET') return json(200, health());

  if (req.method !== 'POST') {
    return json(405, { success: false, message: 'Method not allowed.' });
  }

  const declared = Number(req.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) {
    return json(413, { success: false, message: 'Submission too large.' });
  }

  let raw = '';
  try {
    raw = await req.text();
  } catch {
    return json(400, { success: false, message: 'Could not read the submission.' });
  }
  if (raw.length > MAX_BODY_BYTES) {          // chunked requests declare no length
    return json(413, { success: false, message: 'Submission too large.' });
  }

  const headers = {
    host: req.headers.get('host') || '',
    'x-forwarded-host': req.headers.get('x-forwarded-host') || '',
  };

  try {
    const { status, payload } = await handle(raw, headers);
    return json(status, payload);
  } catch (exc) {
    // never leak a key, an endpoint or provider detail to the browser
    console.error(`enquiry: unhandled: ${exc?.name}: ${exc?.message}`);
    return json(500, {
      success: false,
      message: 'We could not send your enquiry right now. Please email '
        + 'business@tuteeconnect.com directly.',
    });
  }
}

export const config = { path: '/api/enquiry' };
