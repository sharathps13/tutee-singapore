"""Night grade for the hero's day photograph of Jewel (assets/img/sg-jewel-day.webp, 1680 x 1120), so dark mode
shows exactly the same frame as light mode: the glass roof goes to a night sky with its lattice catching the light,
the garden falls into shadow, the lamps glow warm, and the Rain Vortex is lit up in blue and violet as at its night
show, with its light spilling onto the pool and the foliage around it.

Used by make_welcome.py; on its own it writes a preview:
    blender -b --factory-startup --python _source/hero/night_grade.py -- <site root> <out.png>
"""
import numpy as np

# where things are in the 1680 x 1120 day photograph (pixels, from the top left)
VX, VTOP, VBOT = 838, 440, 760          # the vortex: centre line, the ring at its mouth, where it meets the pool
VW_TOP, VW_BOT = 66, 36                 # half-width of the falling water at the top and at the bottom
POOL = (828, 742, 150, 52)              # the pool: centre x, centre y, half-width, half-height
ROOF = 470                              # the glass roof is above this line


def smooth(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def blur(m, r):
    """Box blur, three passes (close to a gaussian), along both axes."""
    for _ in range(3):
        for ax in (0, 1):
            c = np.cumsum(np.pad(m, [(r + 1, r) if a == ax else (0, 0) for a in (0, 1)], mode='edge'), axis=ax)
            m = (np.take(c, range(2 * r + 1, c.shape[ax]), axis=ax) - np.take(c, range(0, c.shape[ax] - 2 * r - 1), axis=ax)) / (2 * r + 1)
    return m


def grade(rgb):
    """rgb: float array (h, w, 3), sRGB 0-1, top row first. Returns the night version."""
    h, w, _ = rgb.shape; s = w / 1680.0
    y, x = np.mgrid[0:h, 0:w].astype(np.float32)
    L = rgb @ np.array([.2126, .7152, .0722], np.float32)
    sat = rgb.max(2) - rgb.min(2)

    # 1. the garden in shadow, cooled to a blue night
    n = (rgb ** 1.3) * .43 * np.array([.62, .78, 1.12], np.float32)

    # 2. the roof: bright panes become night sky, the lattice catches the interior light
    roof = smooth(ROOF * s + 30 * s, ROOF * s - 40 * s, y)[..., None]
    pane = (smooth(.45, .8, L) * smooth(.22, .08, sat))[..., None]
    sky = np.array([.03, .055, .13], np.float32) + (1 - L)[..., None] * np.array([.10, .15, .26], np.float32) * .55
    sky = sky + (y / h)[..., None] * np.array([.02, .03, .06], np.float32)
    n = n * (1 - roof * pane) + sky * roof * pane

    # 3. the Rain Vortex lit up: the falling water keeps its brightness, tinted blue to violet down the fall
    t = np.clip((y - VTOP * s) / ((VBOT - VTOP) * s), 0, 1)
    half = (VW_TOP + (VW_BOT - VW_TOP) * t) * s
    col = smooth(half + 10 * s, half - 6 * s, np.abs(x - VX * s)) * smooth(VTOP * s - 6 * s, VTOP * s + 8 * s, y) * smooth(VBOT * s + 30 * s, VBOT * s - 10 * s, y)
    water = (col * smooth(.32, .7, L))[..., None]
    tint = np.stack([.62 + .3 * t, .66 - .08 * t, np.ones_like(t)], -1).astype(np.float32)
    lit = np.clip(rgb ** .9 * tint * 1.08, 0, 1)
    n = n * (1 - water) + lit * water

    # 4. the blue ring at the vortex's mouth
    ring = (smooth(14 * s, 4 * s, np.abs(y - (VTOP - 4) * s)) * smooth(VW_TOP * s + 26 * s, VW_TOP * s, np.abs(x - VX * s)))[..., None]
    n = n + ring * np.array([.10, .22, .75], np.float32)

    # 5. the pool glowing violet
    px, py, pw, ph = (v * s for v in POOL)
    pool = smooth(1.02, .15, np.sqrt(((x - px) / pw) ** 2 + ((y - py) / ph) ** 2))[..., None]
    n = n + pool * np.array([.17, .07, .28], np.float32) * (.35 + .9 * L[..., None])

    # 6. the lamps: warm, small and bright, outside the roof and the water
    lamp = (smooth(.62, .9, L) * smooth(.04, .14, rgb[..., 0] - rgb[..., 2]) * (1 - roof[..., 0]) * (1 - col))[..., None]
    n = n * (1 - lamp) + np.clip(rgb * np.array([1.2, .92, .62], np.float32), 0, 1) * lamp

    # 7. glow: the vortex, ring and pool light the air and leaves around them; the lamps get a small halo
    k = max(1, int(round(4 * s)))
    small = lambda m: m[:h - h % k, :w - w % k].reshape(h // k, k, w // k, k).mean((1, 3))
    big = lambda m: np.repeat(np.repeat(m, k, 0), k, 1)
    src = (water[..., 0] * L + ring[..., 0] + pool[..., 0] * .6)
    g = big(blur(small(src), int(30 / k * s) + 1))
    g2 = big(blur(small(src), int(110 / k * s) + 1))
    gl = np.zeros((h, w), np.float32); gl[:g.shape[0], :g.shape[1]] = g * .9 + g2 * 1.4
    n = n + gl[..., None] * np.array([.30, .30, .75], np.float32)
    lh = np.zeros((h, w), np.float32); lb = big(blur(small(lamp[..., 0]), int(8 / k * s) + 1)); lh[:lb.shape[0], :lb.shape[1]] = lb
    n = n + lh[..., None] * np.array([.7, .45, .16], np.float32)

    # 8. a soft vignette, and a gentle filmic roll-off so nothing clips harshly
    v = 1 - .35 * smooth(.45, 1.1, np.sqrt(((x - VX * s) / w) ** 2 * 2.2 + ((y - h * .5) / h) ** 2 * 1.6))
    n = n * v[..., None]
    n = 1 - np.exp(-n * 1.45)
    return np.clip(n / (1 - np.exp(-1.45)), 0, 1).astype(np.float32)


if __name__ == '__main__':
    import bpy, os, sys
    args = sys.argv[sys.argv.index('--') + 1:]
    root, out = args[0], args[1]
    sc = bpy.context.scene; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    st = sc.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGB'
    im = bpy.data.images.load(os.path.join(root, 'assets/img/sg-jewel-day.webp')); w, h = im.size
    a = np.array(im.pixels[:], np.float32).reshape(h, w, 4)[::-1]
    g = grade(a[..., :3])
    o = np.concatenate([g, np.ones((h, w, 1), np.float32)], 2)[::-1]
    img = bpy.data.images.new('n', w, h); img.pixels = o.ravel(); img.save_render(out, scene=sc)
    print('NIGHT', out)
