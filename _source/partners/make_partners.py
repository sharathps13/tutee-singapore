"""Loan partner tiles for Tata Capital and Poonawalla Fincorp, matching the other partner logos (160 x 64, white,
logo centred). Sources (Wikimedia Commons, CC BY-SA 4.0): Tata_Capital_Logo-01.jpg (wordmark and bar, without the
small tagline) and PFincorp-logo.png, resized with bicubic filtering into _source/partners/*-tile.png; this script
only saves those tiles as WebP:
    blender -b --factory-startup --python _source/partners/make_partners.py -- <site root>
"""
import bpy, os, sys
root = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGB'; st.quality = 92
for name in ('tata-capital', 'poonawalla-fincorp'):
    im = bpy.data.images.load(os.path.join(root, '_source', 'partners', name + '-tile.png'))
    im.save_render(os.path.join(root, 'assets', 'img', 'partners', name + '.webp'), scene=sc)
    print('saved', name, im.size[:])
