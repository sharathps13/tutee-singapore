"""Sized copies of the round Tutee Connect icon for the site (assets/img/brand), made from the transparent masters that
make_logos.py writes. Each size is resampled with a Lanczos-3 filter on premultiplied colour (so transparent edges
never darken), then lightly sharpened (an unsharp mask on colour only), and saved as lossless WebP, so the icon
stays crisp at every size and screen density.
    blender -b --factory-startup --python _source/brand/make_sizes.py -- <site root>
"""
import bpy, os, sys
import numpy as np
root = sys.argv[sys.argv.index('--') + 1]
here = os.path.join(root, '_source', 'brand')
out_dir = os.path.join(root, 'assets', 'img', 'brand')
os.makedirs(out_dir, exist_ok=True)

def load(name):
    im = bpy.data.images.load(os.path.join(here, name))
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float64).reshape(h, w, 4)[::-1]          # top row first
    rgb = a[:, :, :3]
    rgb = np.where(rgb <= 0.0031308, rgb * 12.92, 1.055 * np.power(np.clip(rgb, 0, 1), 1 / 2.4) - 0.055)  # display values
    return np.dstack([rgb, a[:, :, 3]])

def lanczos_weights(n_in, n_out, a=3):
    scale = n_in / n_out
    support = a * max(scale, 1.0)
    W = np.zeros((n_out, n_in))
    for i in range(n_out):
        c = (i + 0.5) * scale - 0.5
        lo, hi = int(np.floor(c - support)), int(np.ceil(c + support))
        xs = np.arange(lo, hi + 1)
        t = (xs - c) / max(scale, 1.0)
        k = np.sinc(t) * np.sinc(t / a)
        k[np.abs(t) >= a] = 0
        xs = np.clip(xs, 0, n_in - 1)
        for x, v in zip(xs, k):
            W[i, x] += v
        W[i] /= W[i].sum()
    return W

def resize(img, w, h):
    # premultiply, filter rows then columns, un-premultiply
    pm = img.copy(); pm[:, :, :3] *= pm[:, :, 3:4]
    Wy = lanczos_weights(img.shape[0], h); Wx = lanczos_weights(img.shape[1], w)
    out = np.einsum('ij,jkc->ikc', Wy, pm)
    out = np.einsum('ij,kjc->kic', Wx, out)
    out = np.clip(out, 0, 1)
    al = out[:, :, 3:4]
    rgb = np.where(al > 1e-4, out[:, :, :3] / np.maximum(al, 1e-4), 0)
    return np.dstack([np.clip(rgb, 0, 1), al[:, :, 0]])

def sharpen(img, amount=0.45):
    # unsharp mask with a small 3x3 blur, on premultiplied colour only (the edges' transparency is left as filtered)
    pm = img[:, :, :3] * img[:, :, 3:4]
    p = np.pad(pm, ((1, 1), (1, 1), (0, 0)), mode='edge')
    k = np.array([[1, 2, 1], [2, 4, 2], [1, 2, 1]], float) / 16
    blur = sum(k[i, j] * p[i:i + pm.shape[0], j:j + pm.shape[1]] for i in range(3) for j in range(3))
    pm = np.clip(pm + amount * (pm - blur), 0, img[:, :, 3:4])
    al = img[:, :, 3:4]
    rgb = np.where(al > 1e-4, pm / np.maximum(al, 1e-4), 0)
    return np.dstack([np.clip(rgb, 0, 1), img[:, :, 3]])

def save(img, path):
    h, w = img.shape[:2]
    rgb = img[:, :, :3]
    lin = np.where(rgb <= 0.04045, rgb / 12.92, np.power((rgb + 0.055) / 1.055, 2.4))
    rgba = np.dstack([lin, img[:, :, 3]])[::-1].astype(np.float32)
    o = bpy.data.images.new('o', w, h, alpha=True)
    o.pixels.foreach_set(rgba.ravel())
    sc = bpy.context.scene
    sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
    st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGBA'; st.quality = 100   # 100 = lossless
    o.save_render(path, scene=sc)
    bpy.data.images.remove(o)

# the full logo is an SVG with traced lettering (make_svg.py); only the round icon needs sized pictures
icon = load('tutee-connect-icon-transparent.png')
for s in (48, 96, 144, 192):
    save(sharpen(resize(icon, s, s), 0.4), os.path.join(out_dir, f'tc-icon-{s}.webp'))
    print('icon', s)
