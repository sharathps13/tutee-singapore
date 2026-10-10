"""What we do, "Family migration" photo: Pexels 4173213 (mother and daughter with a suitcase at an airport, by
Gustavo Fring, Pexels licence), resized to 1600 px wide and saved as assets/img/services/sg-service-family.webp.
    blender -b --factory-startup --python _source/services/make_service9.py -- <site root>
"""
import bpy, os, sys
root = sys.argv[sys.argv.index('--') + 1]
sc = bpy.context.scene
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
st = sc.render.image_settings; st.file_format = 'WEBP'; st.color_mode = 'RGB'; st.quality = 80
im = bpy.data.images.load(os.path.join(root, '_source', 'services', 'family-migration-pexels-4173213.jpg'))
W, H = im.size
if W > 1600: im.scale(1600, round(H * 1600 / W))
im.save_render(os.path.join(root, 'assets', 'img', 'services', 'sg-service-family.webp'), scene=sc)
print('saved', im.size[:])

