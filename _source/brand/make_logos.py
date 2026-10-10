"""Tutee Connect logos, built from the two master files in this folder:
    tutee-connect-logo-master.webp   the full logo (mark + "Tutee Connect / STUDY | IMMIGRATION"), 2000 x 814
    tutee-connect-icon-master.png    the round mark alone, 640 x 640
The full logo master is already transparent and is kept as it is. The icon master sits on white: the white around and inside the mark (everything connected to the edge of the picture) is
made transparent, with soft edges: a pixel that is part white keeps only its coloured part (colour "un-blended" from
white), so there is no white fringe or jagged edge on any background. Writes _source/brand/*-transparent.png; the
site's sized copies are made from those by make_sizes.ps1.
    blender -b --factory-startup --python _source/brand/make_logos.py -- <site root>
"""
import bpy, os, sys
import numpy as np
root = sys.argv[sys.argv.index('--') + 1]
here = os.path.join(root, '_source', 'brand')

def transparent(src, out):
    im = bpy.data.images.load(os.path.join(here, src))
    w, h = im.size
    full = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, im.channels)
    if im.channels == 4 and full[:, :, 3].min() < 0.5:
        # the master is already transparent (the full logo is): keep its own edges exactly, only re-save as PNG
        return save(full, w, h, out, (full[:, :, 3] < .5).mean())
    a = full[:, :, :3]
    # work in display values (Blender gives linear floats for 8-bit images it treats as sRGB)
    a = np.where(a <= 0.0031308, a * 12.92, 1.055 * np.power(np.clip(a, 0, 1), 1 / 2.4) - 0.055)
    lo = a.min(axis=2)
    near = lo > 0.80                       # whitish: candidates for background
    bg = np.zeros_like(near)
    bg[0, :] = near[0, :]; bg[-1, :] = near[-1, :]; bg[:, 0] = near[:, 0]; bg[:, -1] = near[:, -1]
    while True:                            # flood fill from the edges through whitish pixels
        g = bg.copy()
        g[1:, :] |= bg[:-1, :]; g[:-1, :] |= bg[1:, :]; g[:, 1:] |= bg[:, :-1]; g[:, :-1] |= bg[:, 1:]
        g &= near
        if (g == bg).all(): break
        bg = g
    # the soft rim: pixels touching the background, out to 3 px, are un-blended too
    rim = bg.copy()
    for _ in range(3):
        r = rim.copy(); r[1:, :] |= rim[:-1, :]; r[:-1, :] |= rim[1:, :]; r[:, 1:] |= rim[:, :-1]; r[:, :-1] |= rim[:, 1:]; rim = r
    alpha = np.ones((h, w), np.float32)
    un = 1.0 - lo                          # how far from white the pixel is
    alpha[rim] = np.clip(un[rim] / 0.92, 0, 1)
    alpha[bg & (lo > 0.97)] = 0.0
    col = a.copy()
    k = alpha > 0.004
    col[k] = np.clip((a[k] - (1 - alpha[k])[:, None]) / alpha[k][:, None], 0, 1)
    col[~k] = 0
    # back to linear for saving
    lin = np.where(col <= 0.04045, col / 12.92, np.power((col + 0.055) / 1.055, 2.4))
    save(np.dstack([lin, alpha]).astype(np.float32), w, h, out, (alpha < .5).mean())

def save(rgba, w, h, out, share):
    o = bpy.data.images.new('o', w, h, alpha=True)
    o.pixels.foreach_set(rgba.ravel())
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    st = sc.render.image_settings; st.file_format = 'PNG'; st.color_mode = 'RGBA'; st.color_depth = '8'; st.compression = 90
    o.save_render(os.path.join(here, out), scene=sc)
    print('saved', out, w, h, 'transparent share %.2f' % share)

transparent('tutee-connect-logo-master.webp', 'tutee-connect-logo-transparent.png')
transparent('tutee-connect-icon-master.png', 'tutee-connect-icon-transparent.png')
