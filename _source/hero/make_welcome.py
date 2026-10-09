"""The hero's photographs: the Merlion with Marina Bay Sands behind it, two real photographs taken from Merlion Park.

    light mode  "Merlion Park during daytime", Zhu Hongzhi (Unsplash, Canon EOS 80D, 6000 x 4000)
                _source/hero/src/merlion-day-zhu-hongzhi.jpg
    dark mode   Merlion and Marina Bay Sands at night, Diana Krotova (Unsplash, 7008 x 4672)
                _source/hero/src/merlion-night-diana-krotova.jpg

Nothing is painted or generated: each photograph is only cropped and resized. The two were taken from slightly
different spots, so the night photograph is cropped and scaled to sit on the day one as closely as one scale and
one offset allow, fitted by least squares to the landmarks the eye compares (the two ends of the SkyPark, the top of the
Merlion's head and its snout; its base, also measured, sits low in the frame where the photo fades out). The Merlion and the left of Marina Bay Sands land within about 3% of
the frame's width; the SkyPark looks a little narrower at night (the photographer stood further back).

The frame is cropped to the two landmarks with a little room around them (about 1.41:1), and made at:
    welcome-<day|night>-2400.webp  large and high-density screens
    welcome-<day|night>-1600.webp  desktops
    welcome-<day|night>-1100.webp  tablets and phones
All are downscaled from the originals; nothing is upscaled.

    blender -b --factory-startup --python _source/hero/make_welcome.py -- <site root>
Blender is used only as an image tool here (crop, resize, WebP); any editor gives the same result.
"""
import bpy, os, sys, numpy as np

root = sys.argv[sys.argv.index('--') + 1]
DAY = '_source/hero/src/merlion-day-zhu-hongzhi.jpg'
NIGHT = '_source/hero/src/merlion-night-diana-krotova.jpg'

# landmarks, as shares of each photograph's width (x across, y down): SkyPark left tip, SkyPark right end,
# top of the Merlion's head, its snout, the base of its body
LM_DAY = [(.122, .330), (.603, .341), (.759, .0447), (.606, .181), (.763, .650)]
LM_NIGHT = [(.226, .315), (.478, .328), (.719, .0613), (.6075, .156), (.731, .447)]
FRAME = (.10, .00, .96, .61)          # the crop, in the day photograph's width units: left, top, right, bottom
SIZES = ((2400, 72), (1600, 74), (1100, 76))

sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGB'


def fit(src, dst):
    """One scale and one offset (no rotation) taking src points onto dst points, by least squares."""
    s, d = np.array(src), np.array(dst); sm, dm = s.mean(0), d.mean(0)
    k = ((s - sm) * (d - dm)).sum() / ((s - sm) ** 2).sum()
    return k, dm - k * sm


def load(path):
    im = bpy.data.images.load(os.path.join(root, path)); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]       # top row first
    bpy.data.images.remove(im); return a


def save(a, name):
    h, w = a.shape[:2]
    for ow, q in SIZES:
        out = bpy.data.images.new('w', w, h); out.pixels = np.ascontiguousarray(a[::-1]).ravel()
        out.scale(ow, round(h * ow / w)); st.quality = q
        p = os.path.join(root, 'assets', 'img', 'hero', 'welcome-%s-%d.webp' % (name, ow))
        out.save_render(p, scene=sc); bpy.data.images.remove(out)
        print('WELCOME', os.path.basename(p), out.size[:] if False else '', os.path.getsize(p) // 1024, 'KB')


USE = [0, 1, 2, 3]   # fitted on the SkyPark and the Merlion's head: what the eye compares; its base is cropped low
k, t = fit([LM_NIGHT[i] for i in USE], [LM_DAY[i] for i in USE])
err = [np.hypot(*(k * np.array(n) + t - np.array(d))) for n, d in zip(LM_NIGHT, LM_DAY)]
print('FIT scale %.4f offset (%.4f, %.4f); landmark error, share of width: %s' % (k, t[0], t[1], ', '.join('%.3f' % e for e in err)))

day = load(DAY); dh, dw = day.shape[:2]
l, tp, r, b = FRAME
save(day[round(tp * dw):round(b * dw), round(l * dw):round(r * dw)], 'day')
print('DAY crop', round((r - l) * dw), 'x', round((b - tp) * dw))
del day

night = load(NIGHT); nh, nw = night.shape[:2]
# the same frame in the night photograph: undo the fit (day = k * night + t)
nl, nt = (l - t[0]) / k, (tp - t[1]) / k; nr, nb = (r - t[0]) / k, (b - t[1]) / k
assert nl >= 0 and nt >= 0 and nr <= 1 and nb * nw <= nh, 'the night photograph does not cover the frame'
crop = night[round(nt * nw):round(nb * nw), round(nl * nw):round(nr * nw)]
print('NIGHT crop', crop.shape[1], 'x', crop.shape[0])
save(crop, 'night')
