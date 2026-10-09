"""The hero's postcards: 5:4 crops of the site's own Singapore photos (credited in the page footer), in two sizes.

    blender -b --factory-startup --python _source/hero/make_postcards.py -- <site root>

Blender is used only as an image tool here (crop, resize, WebP); any editor gives the same result.
Writes assets/img/hero/pc-<name>-720.webp (desktop) and pc-<name>-440.webp (phones).
"""
import bpy, os, sys, numpy as np

root = sys.argv[sys.argv.index('--') + 1]
SRC = {   # name: (source, left edge of the crop as a share of the spare width: 0 = left, .5 = centre, 1 = right, quality step)
    'mbs': ('assets/img/sg-mbs.webp', .5, 0),
    'jewel': ('assets/img/hero/jewel-1600.webp', .5, -10),   # dense foliage: a lower quality costs nothing visible
    'cbd': ('assets/img/fam-cbd-night.webp', 1., 0),
    'gardens': ('assets/img/sg-gardens.webp', .3, 0),
}
SIZES = ((720, 576, 76), (440, 352, 74))
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGB'
for name, (src, bias, dq) in SRC.items():
    im = bpy.data.images.load(os.path.join(root, src)); w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)
    cw, ch = min(w, round(h * 5 / 4)), min(h, round(w * 4 / 5))
    x0 = round((w - cw) * bias); y0 = (h - ch) // 2
    crop = a[y0:y0 + ch, x0:x0 + cw].copy()
    for ow, oh, q in SIZES:
        out = bpy.data.images.new('pc', cw, ch); out.pixels = crop.ravel(); out.scale(ow, oh)
        st.quality = q + dq; p = os.path.join(root, 'assets', 'img', 'hero', 'pc-%s-%d.webp' % (name, ow))
        out.save_render(p, scene=sc); bpy.data.images.remove(out)
        print('POSTCARD', os.path.basename(p), os.path.getsize(p) // 1024, 'KB')
    bpy.data.images.remove(im)
