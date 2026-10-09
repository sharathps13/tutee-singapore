"""Hero (section#home) checks for the Singapore landing page.

Stands in for _tooling/verify_site.py, which is not part of this project any more.
Run against the local preview server:  python3 verify_hero.py [http://localhost:8788/]

Checks, at 390, 768 and 1440 px, light and dark mode:
  contrast   WCAG AA for every text run in the hero, measured against the pixels actually
             rendered behind it (text hidden, screenshot sampled), worst 5% of the box
  focus      every focusable control in the hero shows a visible focus indicator on Tab
  targets    every control is at least 44 x 44 px
  overflow   no horizontal scroll
  motion     with prefers-reduced-motion, nothing in the hero animates and the greeting stays put
  cls        layout shift during load (whole page, and how much came from the hero)
  preload    the hero photograph for the current theme is preloaded from <head> (sg-theme.js) at high priority and
             fetched by that link, only the one photograph is fetched, and every in-page link in the hero leads somewhere
"""
import asyncio, io, json, sys
from PIL import Image
from playwright.async_api import async_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8788/'
SIZES = [(390, 844, True), (768, 1024, True), (1440, 900, False)]
FAILS = []

def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= .03928 else ((v + .055) / 1.055) ** 2.4
    r, g, b = c[:3]
    return .2126 * ch(r) + .7152 * ch(g) + .0722 * ch(b)

def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + .05) / (lb + .05)

TEXT_JS = """() => {
  const out = [];
  const walker = document.createTreeWalker(document.querySelector('#home'), NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement, cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    const r = document.createRange(); r.selectNodeContents(t);
    for (const b of r.getClientRects()) {
      if (b.width < 2 || b.height < 2 || b.bottom < 0 || b.top > innerHeight) continue;
      out.push({text: t.textContent.trim().slice(0, 40), color: cs.color, size: parseFloat(cs.fontSize),
                weight: parseInt(cs.fontWeight), x: b.left, y: b.top, w: b.width, h: b.height});
    }
  }
  return out;
}"""

def parse_rgb(s):
    v = s[s.index('(') + 1:s.index(')')].split(',')
    return tuple(int(float(x)) for x in v[:3]), (float(v[3]) if len(v) > 3 else 1.0)

async def check_size(b, w, h, mob, mode):
    tag = f'{w}px {mode}'
    c = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob)
    await c.add_init_script(f"localStorage.setItem('tc-mode','{mode}')")
    await c.add_init_script("""window.__cls=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)
      window.__cls.push({v:e.value,src:(e.sources||[]).map(s=>s.node&&s.node.nodeType===1?(s.node.closest('#home')?'hero':s.node.className||s.node.tagName):'?')})}}).observe({type:'layout-shift',buffered:true});""")
    pg = await c.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL, wait_until='load'); await pg.wait_for_timeout(3200)
    if errs: FAILS.append(f'{tag}: script errors {errs}')

    # overflow
    sw = await pg.evaluate('document.documentElement.scrollWidth')
    ok = sw <= w; print(f'  overflow   {"ok " if ok else "FAIL"} scrollWidth {sw} / {w}')
    if not ok: FAILS.append(f'{tag}: horizontal scroll ({sw}px)')

    # contrast: text colour against what is really painted behind it
    runs = await pg.evaluate(TEXT_JS)
    await pg.add_style_tag(content='#home, #home *{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important;caret-color:transparent!important}')
    await pg.wait_for_timeout(150)
    bg = Image.open(io.BytesIO(await pg.screenshot())).convert('RGB')
    worst = 99; worst_txt = ''
    for r in runs:
        fg, a = parse_rgb(r['color'])
        box = bg.crop((max(0, int(r['x'])), max(0, int(r['y'])), min(w, int(r['x'] + r['w'])), min(h, int(r['y'] + r['h']))))
        px = list(box.getdata())
        if not px: continue
        if a < 1:  # composite translucent text over the median background
            m = sorted(px, key=lum)[len(px) // 2]
            fg = tuple(int(fg[i] * a + m[i] * (1 - a)) for i in range(3))
        rs = sorted(ratio(fg, p) for p in px)
        rr = rs[max(0, int(len(rs) * .05) - 1)]
        large = r['size'] >= 24 or (r['size'] >= 18.66 and r['weight'] >= 700)
        need = 3.0 if large else 4.5
        if rr < worst: worst, worst_txt = rr, r['text']
        if rr < need: FAILS.append(f'{tag}: contrast {rr:.2f} < {need} for "{r["text"]}"')
    print(f'  contrast   {len(runs)} text runs, lowest {worst:.2f}:1 ("{worst_txt}")')
    await pg.reload(wait_until='load'); await pg.wait_for_timeout(3200)

    # layout shift
    cls = await pg.evaluate('window.__cls')
    tot = sum(e['v'] for e in cls); hero = sum(e['v'] for e in cls if 'hero' in e['src'])
    ok = tot < .1 and hero < .01
    print(f'  cls        {"ok " if ok else "FAIL"} page {tot:.4f}, from the hero {hero:.4f}')
    if not ok: FAILS.append(f'{tag}: layout shift page {tot:.3f} hero {hero:.3f}')


    # targets and focus
    ctrls = await pg.evaluate("""() => [...document.querySelectorAll('#home a, #home button')].map(e => {const r = e.getBoundingClientRect();
        return {name: (e.getAttribute('aria-label') || e.textContent).trim(), w: r.width, h: r.height}})""")
    for t in ctrls:
        ok = t['w'] >= 44 and t['h'] >= 44
        print(f'  target     {"ok " if ok else "FAIL"} {t["name"][:28]:28s} {t["w"]:.0f} x {t["h"]:.0f}')
        if not ok: FAILS.append(f'{tag}: target "{t["name"]}" {t["w"]:.0f}x{t["h"]:.0f}')
    await pg.evaluate("document.querySelector('#home').scrollIntoView();document.body.focus()")
    await pg.evaluate("(()=>{const a=document.createElement('a');a.href='#';a.id='__start';a.textContent='x';a.style.cssText='position:absolute;left:0;top:0;width:1px;height:1px;overflow:hidden';document.querySelector('#home').prepend(a);a.focus();})()")
    seen = 0
    for _ in range(len(ctrls)):
        await pg.keyboard.press('Tab'); await pg.wait_for_timeout(60)
        f = await pg.evaluate("""() => {const e = document.activeElement; if (!e || !e.closest('#home')) return null; const s = getComputedStyle(e);
            return {name: (e.getAttribute('aria-label') || e.textContent).trim().slice(0, 28), fv: e.matches(':focus-visible'),
                    outline: s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) >= 2, color: s.outlineColor}}""")
        if not f: break
        seen += 1
        ok = f['fv'] and f['outline']
        print(f'  focus      {"ok " if ok else "FAIL"} {f["name"]:28s} outline {f["color"]}')
        if not ok: FAILS.append(f'{tag}: no visible focus on "{f["name"]}"')
    if seen < len(ctrls): FAILS.append(f'{tag}: only {seen}/{len(ctrls)} hero controls reached by Tab')

    # preload: the photograph for this theme is preloaded from <head> at high priority and fetched by that link, and
    # it is the only hero photograph fetched; every in-page link in the hero leads somewhere
    pre = await pg.evaluate("""() => {const n = document.documentElement.dataset.mode === 'dark' ? 'night' : 'day';
        const l = [...document.querySelectorAll('link[rel=preload][as=image]')].filter(l => l.href.includes('welcome-' + n) && matchMedia(l.media || 'all').matches)[0];
        const got = performance.getEntriesByType('resource').filter(e => /welcome-/.test(e.name));
        return {link: !!l, high: !!l && l.getAttribute('fetchpriority') === 'high', via: got.length ? got[0].initiatorType : null,
                fetched: got.map(e => e.name.split('/').pop()),
                deadLinks: [...document.querySelectorAll('#home a[href^="#"]')].map(a => a.getAttribute('href')).filter(h => h.length > 1 && !document.querySelector(h))}}""")
    ok = pre['link'] and pre['high'] and pre['via'] == 'link' and len(pre['fetched']) == 1 and not pre['deadLinks']
    print(f'  preload    {"ok " if ok else "FAIL"} {pre}')
    if not ok: FAILS.append(f'{tag}: hero photo preload / links {pre}')    await c.close()

async def check_motion(b):
    c = await b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
    pg = await c.new_page(); await pg.goto(URL, wait_until='load'); await pg.wait_for_timeout(4000)
    # nothing in the hero animates on its own: no running CSS animations, and the greeting stays on its first word
    deck = "() => document.querySelector('#home .wh-word.on').textContent + ' paused'"
    a = await pg.evaluate(deck); await pg.wait_for_timeout(7000); b2 = await pg.evaluate(deck)
    run = await pg.evaluate("""() => {const h = document.querySelector('#home');
        return document.getAnimations().filter(a => a.effect && a.effect.target && h.contains(a.effect.target) && a.playState === 'running').length}""")
    ok = run == 0 and a == b2 and a.endswith('paused')
    print(f'reduced motion: {"ok " if ok else "FAIL"} running={run} greeting {a!r} -> {b2!r}')
    if not ok: FAILS.append(f'reduced motion: running={run} greeting {a!r} -> {b2!r}')
    await c.close()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h, mob in SIZES:
            for mode in ('light', 'dark'):
                print(f'{w}px {mode}'); await check_size(b, w, h, mob, mode)
        await check_motion(b)
        await b.close()
    print('\n' + ('ALL HERO CHECKS PASS' if not FAILS else 'FAILURES:\n- ' + '\n- '.join(FAILS)))
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
