/**
 * Local form test server: the site plus the real enquiry function, so the consultation form can be tested end to
 * end (a real email to business@tuteeconnect.com, sent through Google Workspace) before the site is deployed.
 *
 *   node _source/dev/form-test-server.mjs          then open http://localhost:8888
 *
 * Put the Workspace login in a file called .env.local in the site's root folder (that file is ignored by Git, so
 * the password never reaches GitHub):
 *
 *   GMAIL_USER=business@tuteeconnect.com
 *   GMAIL_APP_PASSWORD=abcd efgh ijkl mnop
 *   SITE_COUNTRY=Singapore
 *
 * Supabase is skipped unless SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are also set.
 * For testing only: it is not part of the site (Netlify serves nothing under /_source).
 */
import http from 'node:http';
import { readFileSync, existsSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createGzip } from 'node:zlib';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.argv[2]) || 8888;

// load .env.local (simple KEY=VALUE lines) into process.env, without overriding what is already set
const envFile = join(ROOT, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const { handle, health } = await import(pathToFileURL(join(ROOT, 'netlify', 'functions', 'enquiry.mjs')).href);
const { getNews } = await import(pathToFileURL(join(ROOT, 'netlify', 'functions', 'news.mjs')).href);

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.txt': 'text/plain' };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/api/news') { const { status, payload } = await getNews(); res.writeHead(status, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(payload)); }
  if (url.pathname === '/api/enquiry') {
    if (req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(health(), null, 2)); }
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    let body = '';
    for await (const chunk of req) { body += chunk; if (body.length > 16384) break; }
    const { status, payload } = await handle(body, { host: req.headers.host || '' });
    console.log(`  form submitted -> ${status} ${payload.success ? 'sent' : payload.message}`);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(payload));
  }
  let path = normalize(decodeURIComponent(url.pathname)).replace(/^([\\/])+/, '');
  if (!path || path.endsWith('/') || path.endsWith('\\')) path = join(path, 'index.html');
  const file = join(ROOT, path);
  if (!file.startsWith(ROOT) || !existsSync(file) || !statSync(file).isFile() || /^_source|^\.env/.test(path)) {
    res.writeHead(404); return res.end('Not found');
  }
  // text files are gzipped, as Netlify does, so page-load tests here match the live site
  const type = TYPES[extname(file).toLowerCase()] || 'application/octet-stream';
  const zip = /text|javascript|json|svg/.test(type) && /gzip/.test(req.headers['accept-encoding'] || '');
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store', ...(zip ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}) });
  (zip ? createReadStream(file).pipe(createGzip()) : createReadStream(file)).pipe(res);
});

server.listen(PORT, () => {
  const h = health();
  console.log(`\n  Tutee Connect form test server: http://localhost:${PORT}`);
  console.log(`  Emails go to: ${h.recipient}   from: ${h.from}`);
  console.log(`  Google Workspace login loaded: ${h.gmail_configured ? 'yes' : 'NO - add GMAIL_USER and GMAIL_APP_PASSWORD to .env.local'}`);
  console.log(`  Google Sheet: ${h.sheet_configured ? 'on' : 'off - add SHEET_WEBHOOK_URL and SHEET_SECRET to .env.local'}`);
  console.log(`  Supabase: ${h.supabase_configured ? 'on' : 'off (email only)'}\n  Press Ctrl+C to stop.\n`);
});
