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
 *   * No key of any kind is present in the frontend. RESEND_API_KEY and
 *     SUPABASE_SERVICE_ROLE_KEY live only in the Netlify environment, are never
 *     echoed in a response, and never reach a log line.
 *   * The recipient cannot be tampered with by editing the page, because it is a
 *     hard-coded constant here (MAIL_TO) — not a form field and not an env var.
 *
 * Zero npm dependencies: Node 18+ global fetch only, so there is no package.json
 * to keep in step and Netlify needs no build step to deploy it.
 *
 * Environment variables (set in Netlify → Site settings → Environment variables):
 *
 *   RESEND_API_KEY              required  Resend key, starts `re_`. Server-side only.
 *   SUPABASE_URL                optional  https://<ref>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY   optional  service_role key. Server-side ONLY —
 *                                         it bypasses RLS. Never ship to a browser.
 *   MAIL_FROM                   optional  From address; its domain must be
 *                                         verified in Resend or the send is rejected.
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

const RESEND_ENDPOINT = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'Tutee Connect Website <enquiries@tuteeconnect.com>';

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
    const value = clean(data[key], 300);
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

/** The Resend request body. Returns a plain object, ready to be JSON-encoded. */
export function buildEmail(f, country) {
  const subject = country
    ? `New Enquiry – ${country} Landing Page`
    : 'New Enquiry – Tutee Connect Landing Page';

  const rows = [
    ['Full Name', f.name],
    ['Phone Number', f.phone],
    ['Email Address', f.email],
    ['Enquiry Type / Country', f.destination],
  ];
  if (country) rows.push(['Landing Page', country]);
  if (f.page) rows.push(['Submitted From', f.page]);
  rows.push(...f.extras);
  rows.push(['Source', f.from_name]);

  const who = f.name || 'the enquirer';
  const plain = ['New enquiry from the Tutee Connect website', '']
    .concat(rows.map(([label, value]) => `${(label + ':').padEnd(25)} ${value}`))
    .concat(['', `Reply to this email to answer ${who} directly.`]);

  const cells = rows.map(([label, value]) =>
    '<tr>'
    + '<td style="padding:8px 14px;border:1px solid #e5e7eb;background:#f9fafb;'
    + `font-weight:600;white-space:nowrap">${esc(label)}</td>`
    + `<td style="padding:8px 14px;border:1px solid #e5e7eb">${esc(value)}</td>`
    + '</tr>').join('');

  const html = '<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;color:#111827">'
    + '<h2 style="margin:0 0 14px;font-size:18px">New enquiry from the Tutee '
    + 'Connect website</h2>'
    + `<table style="border-collapse:collapse;font-size:14px">${cells}</table>`
    + '<p style="margin:16px 0 0;font-size:12px;color:#6b7280">Reply to this '
    + `email to answer ${esc(who)} directly.</p>`
    + '</div>';

  const payload = {
    from: (process.env.MAIL_FROM || DEFAULT_FROM).trim(),
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

/** POST the message to Resend, returning the message id.
 *
 * The key is read here and nowhere else, and never appears in an error message,
 * a log line or a response body. */
async function sendViaResend(payload) {
  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) throw new Error('server email is not configured (missing RESEND_API_KEY)');

  const res = await postJson(RESEND_ENDPOINT, { Authorization: `Bearer ${key}` },
    payload, SEND_TIMEOUT_MS);

  if (!res.ok) {
    // Resend explains refusals in the body — an unverified From domain, a
    // revoked key, a rate limit. That detail belongs in the function log,
    // never in the browser response.
    let detail = '';
    try { detail = (await res.text()).slice(0, 400); } catch { /* ignore */ }
    throw new Error(`resend rejected the send: HTTP ${res.status} ${detail}`);
  }
  try {
    const parsed = await res.json();
    return parsed?.id || '';
  } catch { return ''; }
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

  // 2. notify the business inbox
  let messageId = '';
  let emailed = false;
  try {
    messageId = await sendViaResend(buildEmail(fields, country));
    emailed = true;
  } catch (exc) {
    console.error(`enquiry: send refused: ${exc.message}`);
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
    console.error('enquiry: STORED BUT NOT EMAILED — check RESEND_API_KEY and the '
      + `verified From domain (lead=${leadId})`);
  }

  console.log(`enquiry: country=${country || '-'} destination=${fields.destination} `
    + `stored=${stored ? leadId : 'no'} emailed=${emailed ? (messageId || 'yes') : 'no'}`);

  return { status: 200, payload: { success: true, message: OK_MESSAGE } };
}

/** What the GET probe reports: whether config is present, never what it is. */
export function health() {
  return {
    success: true,
    endpoint: 'enquiry',
    recipient: MAIL_TO,
    provider: 'resend',
    runtime: 'netlify-functions',
    resend_configured: Boolean((process.env.RESEND_API_KEY || '').trim()),
    supabase_configured: Boolean((process.env.SUPABASE_URL || '').trim()
      && (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()),
    from: (process.env.MAIL_FROM || DEFAULT_FROM).trim(),
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
