"""Packs the turntable frames from render_miniature.py for the page.

    blender -b --factory-startup --python _source/hero3d/pack_miniature.py -- <render dir with day/ and night/> <site root>

Crops every frame (day and night) to one shared box, so the model never shifts between frames, and writes
    assets/hero/{day,night}-NN.webp     desktop frames (the crop's full width)
    assets/hero/{day,night}-NN-m.webp   phone frames (720 px wide)
    assets/hero/frames.json             frame count, home frame, size, and per frame where each labelled
                                                 landmark sits (fractions of the frame) and whether it is in view
It prints the home frame's label positions and the frame size, which index.html carries inline so the hero is
complete before any script runs.
"""
import bpy, json, os, sys, numpy as np

src, root = sys.argv[sys.argv.index('--') + 1:][:2]
dst = os.path.join(root, 'assets', 'hero'); os.makedirs(dst, exist_ok=True)
meta = json.load(open(os.path.join(src, 'day', 'labels.json')))
N, (RW, RH) = meta['frames'], meta['res']
PHONE_W, Q_DESK, Q_PHONE = 720, 80, 78

def load(path):
    im = bpy.data.images.load(path); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4); bpy.data.images.remove(im); return a

# one crop box for all frames: the union of what is opaque in any of them
frames = {m: [os.path.join(src, m, 'frame-%02d.png' % i) for i in range(N)] for m in ('day', 'night')}
x0, y0, x1, y1 = RW, RH, 0, 0
for m in frames:
    for f in frames[m]:
        a = load(f); ys, xs = np.where(a[:, :, 3] > .01)
        x0, x1 = min(x0, xs.min()), max(x1, xs.max() + 1); y0, y1 = min(y0, ys.min()), max(y1, ys.max() + 1)
pad = 6
x0, y0 = max(0, x0 - pad), max(0, y0 - pad); x1, y1 = min(RW, x1 + pad), min(RH, y1 + pad)
cw, ch = int(x1 - x0), int(y1 - y0)
if cw % 2: cw -= 1
if ch % 2: ch -= 1
ph = round(ch * PHONE_W / cw)

sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
s = sc.render.image_settings; s.file_format = 'WEBP'; s.color_mode = 'RGBA'
def save(arr, path, w, h, q):
    im = bpy.data.images.new('o', arr.shape[1], arr.shape[0], alpha=True)
    im.pixels = arr.ravel()
    if (w, h) != (arr.shape[1], arr.shape[0]): im.scale(w, h)
    s.quality = q; im.save_render(path, scene=sc); bpy.data.images.remove(im)
total = {'desk': 0, 'phone': 0}
for m in frames:
    for i, f in enumerate(frames[m]):
        a = load(f)[y0:y0 + ch, x0:x0 + cw].copy()      # rows are bottom-up in Blender
        a[:, :, :3] *= (a[:, :, 3:] > 0)                  # no colour left in fully clear pixels (smaller files)
        for suffix, w, h, q, k in (('', cw, ch, Q_DESK, 'desk'), ('-m', PHONE_W, ph, Q_PHONE, 'phone')):
            p = os.path.join(dst, '%s-%02d%s.webp' % (m, i, suffix)); save(a, p, w, h, q); total[k] += os.path.getsize(p)

# label positions: the renderer's view coordinates (0..1 over the full render, y down) mapped into the crop.
# Blender's row 0 is the bottom, so the crop's top edge in y-down terms is RH - (y0 + ch).
top = RH - (y0 + ch)
labels = []
for f in meta['labels']:
    labels.append({k: [round((v[0] * RW - x0) / cw, 4), round((v[1] * RH - top) / ch, 4), v[2]] for k, v in f.items()})
out = {'frames': N, 'home': meta['home'], 'span': meta['span'], 'w': cw, 'h': ch, 'pw': PHONE_W, 'ph': ph, 'labels': labels}
json.dump(out, open(os.path.join(dst, 'frames.json'), 'w'), separators=(',', ':'))
print('PACKED', N, 'frames per mode;', 'desktop %dx%d' % (cw, ch), 'phone %dx%d' % (PHONE_W, ph))
print('SIZES desktop %.0f KB per mode, phone %.0f KB per mode' % (total['desk'] / 2048, total['phone'] / 2048))
print('HOME', json.dumps(labels[meta['home']]))
