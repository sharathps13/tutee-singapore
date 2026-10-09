"""The "Relocating with family" slideshow photos, from Wikimedia Commons (credited in the footer):
    fam-gardens      20190819 Gardens by the Bay Supertree Grove-3.jpg, Balon Greyjoy, CC0
    fam-jurong-lake  View of Jurong Lake from Moon Bridge 202409.jpg, FN-082, CC BY-SA 4.0
    fam-mbfc         Singapore Marina Bay Financial Centre 1.jpg, Zairon, CC BY-SA 4.0
    fam-east-coast   East Coast Park Picnic Area.jpg, Xradicon, CC BY-SA 4.0
    fam-cbd-night    Cavenagh Bridge and the Central Business District skyline, Singapore, at night - 20120629-01.jpg,
                     Allie Caulfield, CC BY 2.0
    fam-fireworks    Marina Barrage, Singapore (Unsplash).jpg, Shubhankar Sharma, CC0
The sources here are Commons' 3840 px renditions of the originals. Each is only resized (never upscaled) to
assets/img/family/<name>-2400.webp and -1600.webp.
    blender -b --factory-startup --python _source/family/make_family.py -- <site root>
"""
import bpy, os, sys
root = sys.argv[sys.argv.index('--') + 1]
src, out = os.path.join(root, '_source', 'family'), os.path.join(root, 'assets', 'img', 'family')
os.makedirs(out, exist_ok=True)
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGB'
for f in sorted(os.listdir(src)):
    if not f.endswith('-2400.jpg'): continue
    name = f[:-len('-2400.jpg')]
    for w, q in ((2400, 78), (1600, 80)):
        im = bpy.data.images.load(os.path.join(src, f)); W, H = im.size
        if w < W: im.scale(w, round(H * w / W))
        st.quality = q; p = os.path.join(out, '%s-%d.webp' % (name, w))
        im.save_render(p, scene=sc); print('FAMILY', os.path.basename(p), im.size[0], 'x', im.size[1], os.path.getsize(p) // 1024, 'KB')
        bpy.data.images.remove(im)
