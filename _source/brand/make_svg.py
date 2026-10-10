"""The site logo as an SVG (assets/img/brand/tc-logo.svg): the lettering is traced from the 2000 px master into vector
outlines, so "Tutee Connect" and "STUDY | IMMIGRATION" stay sharp at every size and screen density (a picture of text
that small always looks soft or jagged). The round mark, which is artwork rather than lettering, is embedded as a
high-resolution WebP inside the same file.

How the tracing works: the master's transparency is an anti-aliased coverage map, so each letter's edge is where it is
50% covered. Marching squares finds that edge to a fraction of a pixel, the outlines are joined into closed loops,
thinned with Ramer-Douglas-Peucker (tolerance 0.25 px at 2000 px wide, far below what any screen can show), and each
word is filled in the master's own colour, with even-odd filling so the holes in letters such as "e" and "o" stay open.
    blender -b --factory-startup --python _source/brand/make_svg.py -- <site root>
"""
import bpy, os, sys, base64
import numpy as np
root = sys.argv[sys.argv.index('--') + 1]
here = os.path.join(root, '_source', 'brand')
out_dir = os.path.join(root, 'assets', 'img', 'brand')

im = bpy.data.images.load(os.path.join(here, 'tutee-connect-logo-transparent.png'))
W, H = im.size
px = np.array(im.pixels[:], dtype=np.float64).reshape(H, W, 4)[::-1]           # top row first
rgb_lin, A = px[:, :, :3], px[:, :, 3]
rgb = rgb_lin                                                       # 8-bit images come back display-encoded already

# --- where the lettering is (measured on the master): the name, and the line beneath it ---------------------------
ys, xs = np.mgrid[0:H, 0:W]
name_box = (xs >= 640) & (ys >= 360) & (ys <= 525)
tag_box = (xs >= 890) & (ys >= 535) & (ys <= 680)
text_box = name_box | tag_box
cov = np.where(text_box, A, 0.0)

# --- marching squares on the coverage, at 50% --------------------------------------------------------------------
iso = 0.5
b = (cov > iso).astype(np.int32)
case = b[:-1, :-1] * 8 + b[:-1, 1:] * 4 + b[1:, 1:] * 2 + b[1:, :-1] * 1
def lerp(p, q, vp, vq):
    t = (iso - vp) / (vq - vp) if vq != vp else 0.5
    return p + t * (q - p)
segs = []
for y, x in zip(*np.nonzero((case > 0) & (case < 15))):
    c = case[y, x]
    tl, tr, br, bl = cov[y, x], cov[y, x + 1], cov[y + 1, x + 1], cov[y + 1, x]
    top = (lerp(x, x + 1, tl, tr), y); right = (x + 1, lerp(y, y + 1, tr, br))
    bottom = (lerp(x, x + 1, bl, br), y + 1); left = (x, lerp(y, y + 1, tl, bl))
    # edges for each case (corners: tl=8, tr=4, br=2, bl=1); saddles split by the centre value
    m = (tl + tr + br + bl) / 4
    E = {1: [(left, bottom)], 2: [(bottom, right)], 3: [(left, right)], 4: [(top, right)],
         5: [(left, top), (bottom, right)] if m > iso else [(left, bottom), (top, right)],
         6: [(top, bottom)], 7: [(left, top)], 8: [(top, left)], 9: [(top, bottom)],
         10: [(top, right), (bottom, left)] if m > iso else [(top, left), (bottom, right)],
         11: [(top, right)], 12: [(left, right)], 13: [(bottom, right)], 14: [(left, bottom)]}[c]
    segs.extend(E)

# --- join segments into closed loops -------------------------------------------------------------------------------
def key(p): return (round(p[0] * 1000), round(p[1] * 1000))
adj = {}
for a_, b_ in segs:
    adj.setdefault(key(a_), []).append((key(b_), b_)); adj.setdefault(key(b_), []).append((key(a_), a_))
pts = {}
for a_, b_ in segs: pts[key(a_)] = a_; pts[key(b_)] = b_
used = set(); loops = []
for k0 in list(adj):
    for k1, _ in adj[k0]:
        e = tuple(sorted((k0, k1)))
        if e in used: continue
        loop = [k0]; prev, cur = k0, k1; used.add(e)
        while cur != k0:
            loop.append(cur)
            nxt = [n for n, _ in adj[cur] if tuple(sorted((cur, n))) not in used]
            if not nxt: break
            used.add(tuple(sorted((cur, nxt[0])))); prev, cur = cur, nxt[0]
        if len(loop) > 4: loops.append([pts[k] for k in loop])

def rdp(P, eps):
    P = np.asarray(P)
    if len(P) < 3: return P
    a_, b_ = P[0], P[-1]; d = b_ - a_; n = np.hypot(*d)
    v = P - a_
    dist = np.abs(d[0] * v[:, 1] - d[1] * v[:, 0]) / n if n else np.hypot(v[:, 0], v[:, 1])
    i = int(np.argmax(dist))
    if dist[i] > eps: return np.vstack([rdp(P[:i + 1], eps)[:-1], rdp(P[i:], eps)])
    return np.vstack([a_, b_])
def simplify_closed(L, eps=0.25):
    P = np.asarray(L); i = int(np.argmax(P[:, 0]))            # split at the rightmost point so the seam is stable
    P = np.vstack([P[i:], P[:i], P[i:i + 1]])
    return rdp(P, eps)[:-1]

# --- colour each loop by the master's colour inside it, grouped into the three coloured words ----------------------
def group_of(L):
    P = np.asarray(L); cx, cy = P[:, 0].mean(), P[:, 1].mean()
    if cy > 530: return 'tag'
    return 'tutee' if cx < 1150 else 'connect'
groups = {'tutee': [], 'connect': [], 'tag': []}
for L in loops: groups[group_of(L)].append(simplify_closed(L))
def colour(mask):
    sel = mask & (A > 0.95)
    c = np.median(rgb[sel], axis=0)
    return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)
cols = {'tutee': colour(name_box & (xs < 1150)), 'connect': colour(name_box & (xs >= 1150)), 'tag': colour(tag_box)}

def path_d(polys):
    out = []
    for P in polys:
        out.append('M' + ' '.join('%.2f %.2f' % (x, y) for x, y in P) + 'Z')
    return ''.join(out)

# --- the mark: everything outside the lettering, cropped and embedded as a high-resolution WebP ---------------------
mark_w = 780
mark = px[:, :mark_w].copy()
mark[:, :, 3] = np.where(text_box[:, :mark_w], 0.0, mark[:, :, 3])
mh_out = 330                                                       # 330 px tall: sharp up to 4x at the largest size used
mw_out = round(mark_w * mh_out / H)
img = bpy.data.images.new('m', mark_w, H, alpha=True)
img.pixels.foreach_set(mark[::-1].astype(np.float32).ravel())
img.scale(mw_out, mh_out)
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGBA'; st.quality = 92
tmp = os.path.join(here, '_mark.webp')
img.save_render(tmp, scene=sc)
b64 = base64.b64encode(open(tmp, 'rb').read()).decode()
os.remove(tmp)

svg = ('<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 %d %d" '
       'width="%d" height="%d" role="img" aria-label="Tutee Connect, Study and Immigration">' % (W, H, W, H)
       + '<image width="%d" height="%d" preserveAspectRatio="none" href="data:image/webp;base64,%s"/>' % (mark_w, H, b64)
       + ''.join('<path fill="%s" fill-rule="evenodd" d="%s"/>' % (cols[g], path_d(groups[g])) for g in ('tutee', 'connect', 'tag'))
       + '</svg>')
open(os.path.join(out_dir, 'tc-logo.svg'), 'w', encoding='utf-8').write(svg)
print('SVG', len(svg) // 1024, 'KB', {g: len(v) for g, v in groups.items()}, cols, 'mark', mw_out, mh_out)
