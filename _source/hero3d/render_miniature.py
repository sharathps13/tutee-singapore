"""The hero's "Singapore in miniature": Marina Bay as a museum-style model on a plinth, path-traced in Cycles and
rendered as a turntable of frames that the page scrubs through when it is dragged.

    blender -b _source/hero3d/marina-bay.blend --python _source/hero3d/render_miniature.py -- <mode> <outdir> [frames] [span] [width] [height] [samples] [only]

mode     day | night
outdir   where frame-NN.png (transparent) and, for day, labels.json are written
frames   turntable frames (default 25), spread over span degrees (default 60) around the home view (frame frames//2)
only     optional comma list of frame numbers, for quick tests

The model is the one build_marina_bay.py makes (marina-bay.blend). Camera and lights turn together around the plinth,
so it reads as the model turning on a turntable under fixed studio light. _source/hero3d/pack_miniature.py then
crops the frames to one common box, writes the WebP sets and the label positions the page uses.
"""
import bpy, bmesh, json, math, os, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
MODE = argv[0] if argv else 'day'
OUT = argv[1] if len(argv) > 1 else '//mini'
FRAMES = int(argv[2]) if len(argv) > 2 else 25
SPAN = float(argv[3]) if len(argv) > 3 else 60.
RES = (int(argv[4]), int(argv[5])) if len(argv) > 5 else (1500, 1290)
SAMPLES = int(argv[6]) if len(argv) > 6 else 96
ONLY = [int(x) for x in argv[7].split(',')] if len(argv) > 7 and argv[7] else None
NIGHT = MODE == 'night'
CX, CY, R = -4.0, -6.0, 50.0
os.makedirs(OUT, exist_ok=True)

scene = bpy.context.scene
for o in list(bpy.data.objects):
    if o.name in ('ground_far', 'islands', 'wider_city') or o.type != 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)

# ---------------- trim the city to a disc ----------------
def inside(v, r=R): return math.hypot(v.x - CX, v.y - CY) < r
_g = bpy.data.objects['ground']; _bm = bmesh.new(); _bm.from_mesh(_g.data); _bm.transform(_g.matrix_world)
GROUND = BVHTree.FromBMesh(_bm); _bm.free()
for o in list(bpy.data.objects):     # drop each loose part (a tower, a tree) whose centre is off the disc
    if o.name == 'ground': continue
    bm = bmesh.new(); bm.from_mesh(o.data); bm.verts.ensure_lookup_table()
    seen, kill = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        stack, part = [v], []; seen.add(v.index)
        while stack:
            a = stack.pop(); part.append(a)
            for e in a.link_edges:
                b = e.other_vert(a)
                if b.index not in seen: seen.add(b.index); stack.append(b)
        c = sum((o.matrix_world @ p.co for p in part), Vector()) / len(part)
        if not inside(c, R - 2.5): kill.extend(part)
        elif o.name == 'trees':      # a tree over the bay floor would be standing in the water
            hit = GROUND.ray_cast(Vector((c.x, c.y, 30)), Vector((0, 0, -1)))
            if hit[0] is None or hit[0].z < -.3: kill.extend(part)
    bmesh.ops.delete(bm, geom=list(set(kill)), context='VERTS')
    bm.to_mesh(o.data); bm.free()
    if not o.data.polygons: bpy.data.objects.remove(o, do_unlink=True)
g = bpy.data.objects['ground']        # an open sheet, so bisected by a ring of planes rather than a boolean
bm = bmesh.new(); bm.from_mesh(g.data); bm.transform(g.matrix_world)
for i in range(128):
    a = 2 * math.pi * i / 128; n = Vector((math.cos(a), math.sin(a), 0))
    bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((CX, CY, 0)) + n * R, plane_no=n, clear_outer=True)
bm.transform(g.matrix_world.inverted()); bm.to_mesh(g.data); bm.free()

def cyl(name, r, z0, z1, verts=192):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=z1 - z0, location=(CX, CY, (z0 + z1) / 2))
    o = bpy.context.object; o.name = name; return o
water = cyl('water', R - .05, -.6, -.08)
plinth = cyl('plinth', R + .6, -7.5, -.6)
rim = cyl('rim', R + .75, -1.1, -.75)
base = cyl('base', R + 2.2, -9.0, -7.5)
for o in (plinth, base, rim):
    bv = o.modifiers.new('bevel', 'BEVEL'); bv.width = .35; bv.segments = 4; bv.limit_method = 'ANGLE'
for o in bpy.data.objects:
    if o.type == 'MESH':
        for p in o.data.polygons: p.use_smooth = o.name in ('plinth', 'base', 'rim', 'water') and abs(p.normal.z) < .5

# ---------------- materials ----------------
def node(nt, kind, **kw):
    n = nt.nodes.new(kind)
    for k, v in kw.items(): setattr(n, k, v)
    return n
def math_(nt, op, a, b=None, clamp=False):
    n = node(nt, 'ShaderNodeMath', operation=op, use_clamp=clamp)
    for i, v in enumerate((a, b)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]
def mixc(nt, f, a, b):
    n = node(nt, 'ShaderNodeMix', data_type='RGBA')
    for sock, v in ((n.inputs['Factor'], f), (n.inputs[6], a), (n.inputs[7], b)):
        if isinstance(v, tuple): sock.default_value = v if len(v) == 4 else (*v, 1)
        elif isinstance(v, (int, float)): sock.default_value = v
        else: nt.links.new(v, sock)
    return n.outputs[2]

def mat(name, base, rough=.5, metal=0., emit=None, estr=0., transm=0., coat=0., attr=None, facade=None):
    """facade = dict(fz floors per unit, fh bays per unit, frame colour, lit share at night, warm colour)"""
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = node(nt, 'ShaderNodeOutputMaterial'); p = node(nt, 'ShaderNodeBsdfPrincipled')
    p.inputs['Base Color'].default_value = (*base, 1); p.inputs['Roughness'].default_value = rough
    p.inputs['Metallic'].default_value = metal; p.inputs['Transmission Weight'].default_value = transm
    p.inputs['Coat Weight'].default_value = coat * (.3 if NIGHT and facade else 1.)
    if emit: p.inputs['Emission Color'].default_value = (*emit, 1); p.inputs['Emission Strength'].default_value = estr
    col = (*base, 1)
    if attr:   # per-tower tint from the model's vertex colours, lifted so no tower goes black
        a = node(nt, 'ShaderNodeVertexColor', layer_name=attr)
        col = mixc(nt, 1., mixc(nt, .35, a.outputs['Color'], (.8, .82, .84)), (*base, 1))
        nt.nodes[-1].blend_type = 'MULTIPLY'
    if facade:
        geo = node(nt, 'ShaderNodeNewGeometry')
        P = node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Position'], P.inputs[0])
        N = node(nt, 'ShaderNodeSeparateXYZ'); nt.links.new(geo.outputs['Normal'], N.inputs[0])
        # along the facade: x on faces looking along y, y on faces looking along x
        h = math_(nt, 'ADD', math_(nt, 'MULTIPLY', P.outputs[0], math_(nt, 'ABSOLUTE', N.outputs[1])),
                  math_(nt, 'MULTIPLY', P.outputs[1], math_(nt, 'ABSOLUTE', N.outputs[0])))
        zf = math_(nt, 'MULTIPLY', P.outputs[2], facade['fz']); hf = math_(nt, 'MULTIPLY', h, facade['fh'])
        win = math_(nt, 'MULTIPLY', math_(nt, 'LESS_THAN', math_(nt, 'FRACT', zf), .8), math_(nt, 'LESS_THAN', math_(nt, 'FRACT', hf), .86))
        wall = math_(nt, 'LESS_THAN', math_(nt, 'ABSOLUTE', N.outputs[2]), .5)
        win = math_(nt, 'MULTIPLY', win, wall)
        frame = facade.get('frame', (.78, .8, .8))
        nt.links.new(mixc(nt, win, frame, col), p.inputs['Base Color'])
        nt.links.new(math_(nt, 'ADD', math_(nt, 'MULTIPLY', win, -.45), .52), p.inputs['Roughness'])
        if NIGHT:   # a share of the windows lit, cell by cell, in two warmths
            cell = node(nt, 'ShaderNodeCombineXYZ')
            nt.links.new(math_(nt, 'FLOOR', math_(nt, 'MULTIPLY', zf, 2)), cell.inputs[0]); nt.links.new(math_(nt, 'FLOOR', math_(nt, 'MULTIPLY', hf, 3)), cell.inputs[1])   # each panel: 2 floors x 3 windows
            nt.links.new(math_(nt, 'FLOOR', math_(nt, 'MULTIPLY', math_(nt, 'ADD', P.outputs[0], P.outputs[1]), .37)), cell.inputs[2])
            wn = node(nt, 'ShaderNodeTexWhiteNoise', noise_dimensions='3D'); nt.links.new(cell.outputs[0], wn.inputs['Vector'])
            lit = math_(nt, 'MULTIPLY', math_(nt, 'GREATER_THAN', wn.outputs['Value'], 1 - facade.get('lit', .3)), win)
            warm = mixc(nt, wn.outputs['Value'], facade.get('warm', (1., .58, .26)), (1., .78, .5))
            nt.links.new(warm, p.inputs['Emission Color'])
            nt.links.new(math_(nt, 'MULTIPLY', lit, facade.get('glow', .8)), p.inputs['Emission Strength'])
    elif not isinstance(col, tuple):
        nt.links.new(col, p.inputs['Base Color'])
    nt.links.new(p.outputs[0], out.inputs[0]); return m

N_ = NIGHT
M = {
    'mbs_glass': mat('mbs_glass', (.09, .15, .18) if not N_ else (.02, .03, .04), .06, 0., coat=.8, facade=dict(fz=1.3, fh=1.6, frame=(.74, .76, .76), lit=.34)),
    'mbs_steel': mat('mbs_steel', (.86, .87, .86), .3, .8, emit=(.75, .88, 1.) if N_ else None, estr=.6),
    'podium': mat('podium', (.82, .8, .76), .4, facade=dict(fz=1.1, fh=1.2, frame=(.84, .82, .78), lit=.7, glow=1.8)),
    'pool': mat('pool', (.1, .55, .7), .05, emit=(.2, .7, .9), estr=2.5 if N_ else .6),
    'foliage': mat('foliage', (.05, .19, .045), .75),
    'glass_clear': mat('glass_clear', (.8, .9, .92), .05, transm=.9),
    'artscience': mat('artscience', (.93, .92, .89), .35, coat=.3, emit=(1., .55, .85) if N_ else None, estr=.35),
    'helix_steel': mat('helix_steel', (.8, .82, .84), .22, 1., emit=(.6, .8, 1.) if N_ else None, estr=1.5),
    'supertree': mat('supertree', (.32, .16, .2), .55, emit=(.9, .3, .7) if N_ else None, estr=1.2),
    'supertree_canopy': mat('supertree_canopy', (.55, .2, .4), .5, emit=(1., .45, .75), estr=4. if N_ else .4),
    'dome_glass': mat('dome_glass', (.75, .9, .88), .06, transm=.85, emit=(.45, .95, .7) if N_ else None, estr=.25),
    'cbd_glass': mat('cbd_glass', (.2, .3, .36) if not N_ else (.03, .045, .06), .07, 0., attr='Col', coat=.8, facade=dict(fz=1.4, fh=1.7, frame=(.8, .82, .83), lit=.24, warm=(1., .8, .58))),
    'city_glass': mat('city_glass', (.16, .24, .28) if not N_ else (.03, .04, .05), .1, 0., coat=.6, facade=dict(fz=1.3, fh=1.5, frame=(.76, .78, .78), lit=.24)),
    'flyer_steel': mat('flyer_steel', (.85, .86, .88), .3, .9),
    'ground': mat('ground', (1., 1., 1.), .8, attr='Col'),
}
# the ground keeps its vertex colours as they are
gm = M['ground']; gnt = gm.node_tree
gp = [n for n in gnt.nodes if n.type == 'BSDF_PRINCIPLED'][0]; gv = [n for n in gnt.nodes if n.type == 'VERTEX_COLOR'][0]
gnt.links.new(gv.outputs['Color'], gp.inputs['Base Color'])
for o in bpy.data.objects:
    if o.type == 'MESH' and o.data.materials:
        for i, m in enumerate(o.data.materials):
            if m and m.name in M: o.data.materials[i] = M[m.name]
def setm(o, m): o.data.materials.clear(); o.data.materials.append(m)
setm(water, mat('water', (.03, .14, .17) if not N_ else (.01, .04, .06), .03, coat=1.))
setm(plinth, mat('plinth', (.03, .055, .08), .38, coat=.15))
setm(base, mat('base', (.02, .035, .05), .4))
setm(rim, mat('brass', (.95, .68, .38), .22, 1., emit=(1., .7, .4) if N_ else None, estr=.15))

# ---------------- light rig (turns with the camera, like a model on a turntable) ----------------
rig = bpy.data.objects.new('rig', None); scene.collection.objects.link(rig); rig.location = (CX, CY, 0)
w = bpy.data.worlds.new('w'); scene.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']
def light(kind, rot=None, loc=None, **kw):
    bpy.ops.object.light_add(type=kind, location=loc or (0, 0, 0)); o = bpy.context.object
    for k, v in kw.items(): setattr(o.data, k, v)
    if rot: o.rotation_euler = rot
    if loc: o.rotation_euler = (Vector((CX, CY, 0)) - o.location).to_track_quat('-Z', 'Y').to_euler()
    o.parent = rig; o.matrix_parent_inverse = rig.matrix_world.inverted(); return o
if not NIGHT:   # late afternoon: a warm low sun from behind-left and a cool sky fill
    bg.inputs[0].default_value = (.55, .68, .85, 1); bg.inputs[1].default_value = .7
    light('SUN', rot=(math.radians(71), 0, math.radians(-122)), energy=3.8, color=(1., .84, .66), angle=math.radians(2.5))
    light('AREA', loc=(CX + 60, CY + 80, 70), energy=60000, size=60, color=(.65, .8, 1.))
else:           # blue hour: a dim moonlit sky, the city's own light, and a soft gallery key on the model
    bg.inputs[0].default_value = (.05, .07, .16, 1); bg.inputs[1].default_value = .7
    light('SUN', rot=(math.radians(58), 0, math.radians(-100)), energy=.25, color=(.55, .65, 1.), angle=math.radians(4))
    light('AREA', loc=(CX - 170, CY + 90, 150), energy=100000, size=90, color=(.55, .66, 1.))
    light('AREA', loc=(CX - 40, CY - 160, 40), energy=45000, size=50, color=(1., .72, .5))

# ---------------- camera: three-quarter aerial, long lens (reads as a miniature) ----------------
HOME = math.radians(153.5); el = math.radians(31); dist = 330
tgt = Vector((CX - 2, CY - 4, -1.5))
loc = tgt + Vector((math.cos(HOME) * math.cos(el), math.sin(HOME) * math.cos(el), math.sin(el))) * dist
bpy.ops.object.camera_add(location=loc); cam = bpy.context.object
cam.rotation_euler = (tgt - loc).to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 92; cam.data.dof.use_dof = True; cam.data.dof.focus_distance = (tgt - loc).length; cam.data.dof.aperture_fstop = 1.6
cam.parent = rig; cam.matrix_parent_inverse = rig.matrix_world.inverted()
scene.camera = cam

scene.render.engine = 'CYCLES'; scene.cycles.device = 'CPU'
scene.cycles.samples = SAMPLES; scene.cycles.use_denoising = True; scene.cycles.use_adaptive_sampling = True
scene.cycles.max_bounces = 6
scene.render.film_transparent = True
scene.render.resolution_x, scene.render.resolution_y = RES; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'; scene.view_settings.look = 'AgX - Medium High Contrast'
scene.render.image_settings.file_format = 'PNG'; scene.render.image_settings.color_mode = 'RGBA'

# ---------------- landmarks the page labels (where they land in each frame, and whether a tower hides them) ----------------
def top_of(name, pick=None):
    o = bpy.data.objects[name]; vs = [o.matrix_world @ v.co for v in o.data.vertices]
    if pick: vs = [v for v in vs if pick(v)]
    return max(vs, key=lambda v: v.z)
def crown(name):   # the middle of a landmark's footprint, at its highest point
    o = bpy.data.objects[name]; vs = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector(((min(v.x for v in vs) + max(v.x for v in vs)) / 2, (min(v.y for v in vs) + max(v.y for v in vs)) / 2, max(v.z for v in vs)))
LANDMARKS = {
    'why': crown('mbs'),                  # the SkyPark
    'universities': crown('artscience'),  # above the lotus's centre
    'pathway': top_of('cbd'),
}
labels = []
idx = ONLY if ONLY is not None else range(FRAMES)
for i in range(FRAMES):
    rig.rotation_euler = (0, 0, math.radians(-SPAN / 2 + SPAN * i / max(1, FRAMES - 1)))
    bpy.context.view_layer.update()
    if not NIGHT:
        dg = bpy.context.evaluated_depsgraph_get(); co = cam.matrix_world.translation; f = {}
        for k, p in LANDMARKS.items():
            s = world_to_camera_view(scene, cam, p)
            d = (p - co); hit = scene.ray_cast(dg, co, d.normalized(), distance=d.length - .8)
            f[k] = [round(s.x, 5), round(1 - s.y, 5), 0 if hit[0] else 1]
        labels.append(f)
    if i in idx:
        scene.render.filepath = os.path.join(OUT, 'frame-%02d.png' % i)
        bpy.ops.render.render(write_still=True)
        print('RENDERED', MODE, i, flush=True)
if not NIGHT:
    json.dump({'frames': FRAMES, 'span': SPAN, 'home': FRAMES // 2, 'res': RES, 'labels': labels}, open(os.path.join(OUT, 'labels.json'), 'w'))
print('DONE', MODE)
