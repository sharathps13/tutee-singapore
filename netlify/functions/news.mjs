/**
 * Live news for the ticker between "Why Singapore" and "How it works": GET /api/news.
 *
 * Reads Google News' public RSS search for study-in-Singapore topics (universities, international students, the
 * Student's Pass, the Tuition Grant, work passes), keeps the newest headlines from the last 30 days, and returns them as JSON:
 *   { success: true, updated: ISO time, items: [{ title, source, link, date }] }
 * The page asks for it only once the visitor reaches the ticker. Netlify's CDN keeps each answer for 30 minutes, so
 * the news source is asked at most twice an hour however many people visit.
 *
 * No dependencies and no keys: the feed is public, and the RSS is read with a few regular expressions.
 */
const FEED = 'https://news.google.com/rss/search?q='
  + encodeURIComponent('Singapore (university OR universities OR "international students" OR "student\'s pass" OR "tuition grant" OR "employment pass" OR polytechnic OR NUS OR NTU OR SMU OR SUTD) -smuggle -arrested -court when:30d')
  + '&hl=en-SG&gl=SG&ceid=SG:en';
const MAX_ITEMS = 14;
const MAX_AGE_DAYS = 30;
const TIMEOUT_MS = 8000;

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') { const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return Number.isFinite(n) ? String.fromCodePoint(n) : m; }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

/** Parse the RSS into clean, de-duplicated, newest-first items. */
export function parseFeed(xml, now = Date.now()) {
  const seen = new Set();
  const items = [];
  for (const m of String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    let title = tag(block, 'title');
    const source = tag(block, 'source');
    const link = tag(block, 'link');
    const date = Date.parse(tag(block, 'pubDate'));
    // Google News titles end with " - Source": the source is shown separately
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, -(source.length + 3));
    if (!title || !/^https:\/\//.test(link)) continue;
    if (Number.isFinite(date) && now - date > MAX_AGE_DAYS * 864e5) continue;
    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').slice(0, 70);
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({ title: title.slice(0, 180), source: source.slice(0, 60), link, date: Number.isFinite(date) ? new Date(date).toISOString() : null });
  }
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return items.slice(0, MAX_ITEMS);
}

/** Shared by the Netlify handler and the local test server. Returns { status, payload, cache }. */
export async function getNews() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(FEED, { signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TuteeConnectNews/1.0)', Accept: 'application/rss+xml, application/xml, text/xml' } });
    if (!res.ok) throw new Error(`feed answered HTTP ${res.status}`);
    const items = parseFeed(await res.text());
    if (!items.length) throw new Error('feed had no usable items');
    return { status: 200, cache: true, payload: { success: true, updated: new Date().toISOString(), items } };
  } catch (exc) {
    console.error(`news: ${exc.message}`);
    // the page then shows its own links to the official news pages instead
    return { status: 502, cache: false, payload: { success: false, items: [] } };
  } finally {
    clearTimeout(timer);
  }
}

export default async function () {
  const { status, payload, cache } = await getNews();
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': cache ? 'public, max-age=600' : 'no-store',
      'Netlify-CDN-Cache-Control': cache ? 'public, s-maxage=1800, stale-while-revalidate=3600' : 'no-store',
    },
  });
}

export const config = { path: '/api/news' };
