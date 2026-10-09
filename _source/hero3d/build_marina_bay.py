"""Builds the Marina Bay hero scene, bakes ambient occlusion with Cycles, and exports it for the web.

Run headless (about 10-20 minutes on a 4-core CPU, most of it the AO bake):
    blender -b --factory-startup --python _source/hero3d/build_marina_bay.py -- [--no-bake] [--preview]

Writes:
    assets/3d/marina-bay.glb       geometry, quantized; UV0 = lightmap (facade UVs are built in the shader)
    assets/3d/ao-<group>.webp      baked sky occlusion per group (read through UV1)
    _source/hero3d/marina-bay.blend the scene, for hand edits and stills

Coordinates: x east, y north, z up, 1 Blender unit = 10 m. The glTF export turns this into three.js's
y-up frame (x east, y up, z south). Materials carry names only; sg-hero3d.js builds the real PBR materials.
"""
import bpy, bmesh, math, os, random, sys
from mathutils import Vector, Matrix

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
BAKE = '--no-bake' not in ARGS
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(ROOT, 'assets', '3d')
os.makedirs(OUT, exist_ok=True)
rnd = random.Random(20261008)

# --------------------------------------------------------------------------- scene reset
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'

MATS = {}
def mat(name, color=(0.8, 0.8, 0.8, 1)):
    if name not in MATS:
        m = bpy.data.materials.new(name)
        m.use_nodes = True
        m.diffuse_color = color
        bsdf = m.node_tree.nodes.get('Principled BSDF')
        if bsdf: bsdf.inputs['Base Color'].default_value = color
        MATS[name] = m
    return MATS[name]

def obj_from_bm(name, bm, material=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    scene.collection.objects.link(ob)
    if material: me.materials.append(mat(material))
    return ob

def add_mat_slot(ob, name):
    me = ob.data
    for i, m in enumerate(me.materials):
        if m and m.name == name: return i
    me.materials.append(mat(name)); return len(me.materials) - 1

# --------------------------------------------------------------------------- geometry helpers
def prism(bm, outline, z0, z1, fn=None):
    """Extrude a 2D outline (list of (x,y), counter-clockwise) from z0 to z1. Returns new faces."""
    bot = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((x, y, z1)) for x, y in outline]
    faces = [bm.faces.new(list(reversed(bot))), bm.faces.new(top)]
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        faces.append(bm.faces.new((bot[i], bot[j], top[j], top[i])))
    return faces

def box(bm, cx, cy, z0, sx, sy, sz):
    hx, hy = sx / 2, sy / 2
    return prism(bm, [(cx - hx, cy - hy), (cx + hx, cy - hy), (cx + hx, cy + hy), (cx - hx, cy + hy)], z0, z0 + sz)

def ngon(cx, cy, r, n, rot=0.0, sx=1.0, sy=1.0):
    return [(cx + math.cos(rot + i * 2 * math.pi / n) * r * sx, cy + math.sin(rot + i * 2 * math.pi / n) * r * sy) for i in range(n)]

def loft(bm, rings, close_ends=True):
    """Join a list of rings (equal-length vertex coordinate lists) into a tube."""
    vs = [[bm.verts.new(p) for p in ring] for ring in rings]
    n = len(rings[0])
    for a, b in zip(vs, vs[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    if close_ends:
        bm.faces.new(list(reversed(vs[0])))
        bm.faces.new(vs[-1])
    return vs

def tube_along(bm, pts, radius, sides=8):
    """A round tube following a polyline (for steel members)."""
    rings = []
    for i, p in enumerate(pts):
        p = Vector(p)
        t = (Vector(pts[min(i + 1, len(pts) - 1)]) - Vector(pts[max(i - 1, 0)])).normalized()
        a = Vector((0, 0, 1)) if abs(t.z) < .9 else Vector((1, 0, 0))
        u = t.cross(a).normalized(); v = t.cross(u).normalized()
        rings.append([p + (u * math.cos(k * 2 * math.pi / sides) + v * math.sin(k * 2 * math.pi / sides)) * radius for k in range(sides)])
    loft(bm, rings, close_ends=False)

def finish(ob, smooth_angle=None, bevel=0.0):
    if bevel:
        m = ob.modifiers.new('bevel', 'BEVEL'); m.width = bevel; m.segments = 1; m.limit_method = 'ANGLE'; m.angle_limit = math.radians(40)
    if smooth_angle is not None:
        for p in ob.data.polygons: p.use_smooth = True
        m = ob.modifiers.new('smooth', 'SMOOTH_BY_ANGLE') if hasattr(bpy.types, 'SmoothByAngleModifier') else None
        if m is None:
            try:
                bpy.context.view_layer.objects.active = ob; ob.select_set(True)
                bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth_angle))
            except Exception:
                pass
    return ob

def apply_mods(ob):
    bpy.context.view_layer.objects.active = ob
    for o in bpy.context.selected_objects: o.select_set(False)
    ob.select_set(True)
    for m in list(ob.modifiers):
        try: bpy.ops.object.modifier_apply(modifier=m.name)
        except Exception as e: print('modifier', m.name, e)

def join(objs, name):
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True); apply_mods(o)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.view_layer.objects.active
    ob.name = name; ob.data.name = name
    return ob

def set_color(ob, rgba_fn):
    """Per-vertex colour (COLOR_0) from a function of the world-space vertex position."""
    me = ob.data
    ca = me.color_attributes.get('Col') or me.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    mw = ob.matrix_world
    for poly in me.polygons:
        for li in poly.loop_indices:
            co = mw @ me.vertices[me.loops[li].vertex_index].co
            ca.data[li].color = rgba_fn(co, poly)
    me.color_attributes.active_color = ca

# =========================================================================== MARINA BAY SANDS
# Three 55-storey towers, ~194 m. Each is a straight west leg and an east leg that leans in and joins it
# about a third of the way up, the void between them the building's signature. The SkyPark (~340 m) sits on top,
# with a 67 m cantilever to the north.
MBS_H = 19.4
TOWER_Y = [10.4, 0.0, -10.4]
TOWER_W = 6.0

def mbs_profile():
    """The tower's side profile in (x, z): west leg + leaning east leg + the joined upper block."""
    pts = [(-3.0, 0.0), (-1.05, 0.0)]
    apex = 7.6
    pts.append((-1.05, apex))
    # down the east leg's inner face to its foot
    n = 14
    for i in range(1, n + 1):
        t = i / n
        x = -1.05 + (1.45 - -1.05) * (t ** 1.55)
        pts.append((x, apex * (1 - t)))
    # foot of the east leg, then up its outer face, leaning in
    pts.append((3.25, 0.0))
    for i in range(1, n + 1):
        t = i / n
        x = 3.25 + (0.65 - 3.25) * (1 - (1 - t) ** 1.7)
        pts.append((x, 8.6 * t))
    pts += [(0.65, MBS_H), (-3.0, MBS_H)]
    return pts

def mbs_tower(y):
    bm = bmesh.new()
    prof = mbs_profile()
    a = [bm.verts.new((x, y - TOWER_W / 2, z)) for x, z in prof]
    b = [bm.verts.new((x, y + TOWER_W / 2, z)) for x, z in prof]
    bm.faces.new(a); bm.faces.new(list(reversed(b)))
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = obj_from_bm('mbs_tower', bm, 'mbs_glass')
    return finish(ob, bevel=0.06)

def mbs_skypark():
    bm = bmesh.new()
    y_s, y_n = -14.6, 21.0
    rings = []
    N = 46
    for i in range(N + 1):
        t = i / N
        y = y_s + (y_n - y_s) * t
        # plan: full width over the towers, a rounded bow on the cantilever
        bow = max(0.0, (y - 14.0) / (y_n - 14.0))
        hw = 1.95 * math.sqrt(max(0.02, 1 - bow ** 2.2))
        stern = max(0.0, (-13.2 - y) / 1.4)
        hw *= math.sqrt(max(0.05, 1 - stern ** 2))
        # section: flat deck, curved hull underneath that thins toward both ends
        depth = 0.55 + 0.75 * math.sin(math.pi * min(1, max(0, (y - y_s) / (y_n - y_s)))) ** .6
        cx = -1.2
        zt = MBS_H + 0.7
        ring = []
        for k in range(12):
            a = k / 12 * 2 * math.pi
            # superellipse cross-section: flat top, rounded hull
            c, s = math.cos(a), math.sin(a)
            px = cx + hw * math.copysign(abs(c) ** 0.35, c)
            if s >= 0:
                pz = zt + 0.05 * s
            else:
                pz = zt - depth * (abs(s) ** 0.7)
            ring.append((px, y, pz))
        rings.append(ring)
    loft(bm, rings)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    hull = obj_from_bm('mbs_skypark', bm, 'mbs_steel')
    for p in hull.data.polygons: p.use_smooth = True
    # infinity pool along the west edge, gardens and the observation deck on top
    bm = bmesh.new(); box(bm, -2.55, 0.0, MBS_H + 0.72, 0.9, 30.0, 0.06)
    pool = obj_from_bm('mbs_pool', bm, 'pool')
    bm = bmesh.new()
    for i in range(70):
        y = rnd.uniform(-13, 15); x = rnd.uniform(-1.4, -0.0)
        r = rnd.uniform(.25, .5)
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r, matrix=Matrix.Translation((x, y, MBS_H + 0.75 + r * .6)) @ Matrix.Diagonal((1, 1, .7, 1)))
    trees = obj_from_bm('mbs_deck_trees', bm, 'foliage')
    bm = bmesh.new()
    for x, y in [(-1.2, -6.5), (-1.2, 5.0)]:
        box(bm, x, y, MBS_H + 0.72, 2.2, 3.0, 0.7)
    deck = obj_from_bm('mbs_deck_rooms', bm, 'mbs_steel')
    return [hull, pool, trees, deck]

def mbs_podium():
    """The Shoppes and Expo along the promenade: a long block under a row of rolling, lily-pad roofs."""
    bm = bmesh.new()
    x0, x1, y0, y1 = -10.6, -4.2, -15.5, 15.5
    ny, nx = 64, 6
    def zroof(x, y):
        wave = abs(math.sin((y - y0) / (y1 - y0) * math.pi * 5))
        return 2.2 + 1.0 * wave ** .7 * (0.6 + 0.4 * math.sin((x - x0) / (x1 - x0) * math.pi))
    grid = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, zroof(x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny))) for j in range(ny + 1)] for i in range(nx + 1)]
    for i in range(nx):
        for j in range(ny):
            bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    # walls down to the ground
    def wall(vs):
        bot = [bm.verts.new((v.co.x, v.co.y, 0.2)) for v in vs]
        for a, b, c, d in zip(vs, vs[1:], bot[1:], bot):
            bm.faces.new((d, c, b, a))
    wall([grid[0][j] for j in range(ny + 1)][::-1])
    wall([grid[nx][j] for j in range(ny + 1)])
    wall([grid[i][0] for i in range(nx + 1)])
    wall([grid[i][ny] for i in range(nx + 1)][::-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = obj_from_bm('mbs_podium', bm, 'podium')
    for p in ob.data.polygons: p.use_smooth = abs(p.normal.z) > .3
    # the two Crystal Pavilions out on the water
    bm = bmesh.new()
    for cx, cy, s in [(-15.2, 6.5, 2.4), (-15.2, -4.0, 2.1)]:
        ring = [(cx + math.cos(a) * s, cy + math.sin(a) * s * .7) for a in [0, 1.2, 2.5, 3.4, 4.6, 5.5]]
        vb = [bm.verts.new((x, y, 0.15)) for x, y in ring]
        apex1 = bm.verts.new((cx - s * .2, cy + s * .2, 2.4)); apex2 = bm.verts.new((cx + s * .3, cy - s * .15, 1.9))
        for i in range(len(vb)):
            j = (i + 1) % len(vb)
            bm.faces.new((vb[i], vb[j], apex1 if i % 2 == 0 else apex2))
        bm.faces.new((apex1, apex2, vb[1])); bm.faces.new((apex2, apex1, vb[4]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    pav = obj_from_bm('mbs_pavilions', bm, 'glass_clear')
    return [ob, pav]

towers = [mbs_tower(y) for y in TOWER_Y]
sky = mbs_skypark()
pod = mbs_podium()
MBS = join(towers + sky + pod, 'mbs')

# =========================================================================== ARTSCIENCE MUSEUM
# Ten "fingers" of a lotus, of different lengths, rising out of a reflecting pond; a bowl at the centre.
def artscience():
    cx, cy = -11.0, 30.5
    bm = bmesh.new()
    lengths = [4.6, 5.6, 6.2, 5.2, 4.2, 3.6, 3.4, 3.8, 4.0, 4.3]
    for k in range(10):
        a = k / 10 * 2 * math.pi + 0.25
        dirv = Vector((math.cos(a), math.sin(a), 0))
        side = Vector((-dirv.y, dirv.x, 0))
        L = lengths[k]
        rings = []
        M = 16
        for i in range(M + 1):
            t = i / M
            # the petal rises steeply, then bends outward
            r = 1.0 + L * (0.15 * t + 0.85 * t ** 1.8)
            z = 0.6 + L * 1.05 * (1 - (1 - t) ** 1.6)
            w = 1.35 * (1 - t) ** .55 + 0.12
            th = 0.42 * (1 - t) + 0.08
            c = Vector((cx, cy, 0)) + dirv * r + Vector((0, 0, z))
            # outward-leaning normal for the cross-section
            up = Vector((0, 0, 1)) * math.cos(0.9 * t) + dirv * math.sin(0.9 * t)
            ring = []
            for s in range(10):
                ang = s / 10 * 2 * math.pi
                # cupped crescent: wide across, thin through
                ring.append(c + side * (math.cos(ang) * w) + up.cross(side).normalized() * (math.sin(ang) * th + 0.18 * (math.cos(ang) ** 2) * w))
            rings.append(ring)
        loft(bm, rings)
    # central bowl
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=10, radius=2.4, matrix=Matrix.Translation((cx, cy, 0.4)) @ Matrix.Diagonal((1, 1, .55, 1)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = obj_from_bm('artscience', bm, 'artscience')
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# =========================================================================== HELIX BRIDGE
def helix_bridge():
    p0, p1 = Vector((-14.5, 34.0, 1.0)), Vector((-26.0, 60.0, 1.0))
    axis = (p1 - p0); L = axis.length; d = axis.normalized()
    side = Vector((-d.y, d.x, 0)); up = Vector((0, 0, 1))
    bm = bmesh.new()
    # deck
    deck = []
    for i in range(41):
        c = p0 + d * (L * i / 40) + up * (0.4 * math.sin(math.pi * i / 40))
        deck.append((c + side * 0.55, c - side * 0.55))
    for (a, b), (c_, e) in zip(deck, deck[1:]):
        va = [bm.verts.new(a), bm.verts.new(b), bm.verts.new(e), bm.verts.new(c_)]
        bm.faces.new(va)
    # the double helix: two steel spirals of opposite hand
    for R, hand, ph in [(1.05, 1, 0.0), (0.82, -1, 1.3)]:
        pts = []
        for i in range(201):
            t = i / 200
            c = p0 + d * (L * t) + up * (0.4 * math.sin(math.pi * t) + 0.95)
            ang = hand * t * L / 3.4 * 2 * math.pi + ph
            pts.append(c + side * (math.cos(ang) * R) + up * (math.sin(ang) * R))
        tube_along(bm, pts, 0.06 if hand > 0 else 0.045, sides=6)
    # struts tying the spirals together
    for i in range(0, 201, 8):
        t = i / 200
        c = p0 + d * (L * t) + up * (0.4 * math.sin(math.pi * t) + 0.95)
        a1 = t * L / 3.4 * 2 * math.pi; a2 = -t * L / 3.4 * 2 * math.pi + 1.3
        q1 = c + side * (math.cos(a1) * 1.05) + up * (math.sin(a1) * 1.05)
        q2 = c + side * (math.cos(a2) * .82) + up * (math.sin(a2) * .82)
        tube_along(bm, [q1, q2], 0.025, sides=4)
    ob = obj_from_bm('helix', bm, 'helix_steel')
    for p in ob.data.polygons: p.use_smooth = True
    return ob

# =========================================================================== GARDENS BY THE BAY
def supertree(bm, bmc, x, y, h, rnd_):
    """Trunk: a flared, tapering core. Canopy: an open inverted cone; its steel lattice is drawn by the shader
    (the 'supertree_canopy' material), which costs ~50 vertices a tree instead of thousands of tiny tubes."""
    rings = []
    for i in range(9):
        t = i / 8
        r = 0.55 * (1 - t) ** 1.3 + 0.22 + 0.25 * max(0, 1 - t * 6)
        rings.append([(x + math.cos(a) * r, y + math.sin(a) * r, h * 0.82 * t) for a in [k / 10 * 2 * math.pi for k in range(10)]])
    loft(bm, rings, close_ends=False)
    z0, z1, r0, r1 = h * 0.8, h, 0.35, 0.18 * h + 0.9
    rings = []
    for j in range(4):
        tt = j / 3; r = r0 + (r1 - r0) * tt; z = z0 + (z1 - z0) * tt
        rings.append([(x + math.cos(a) * r, y + math.sin(a) * r, z) for a in [k / 16 * 2 * math.pi for k in range(16)]])
    loft(bmc, rings, close_ends=False)
def gardens():
    bm = bmesh.new(); bmc = bmesh.new()
    grove = [(17.0, -15.0, 5.0), (20.5, -12.0, 4.6), (14.0, -11.5, 4.2), (22.5, -16.5, 3.4), (18.5, -19.0, 3.0), (12.5, -16.5, 2.8),
             (15.5, -7.8, 2.6), (24.5, -10.0, 2.6), (21.0, -21.0, 2.5), (10.5, -12.0, 2.6), (13.0, -20.5, 2.5), (26.0, -14.0, 2.4)]
    for x, y, h in grove: supertree(bm, bmc, x, y, h, rnd)
    # OCBC Skyway between the tall trees
    pts = [(17.0, -15.0, 2.3), (18.8, -13.5, 2.35), (20.5, -12.0, 2.3)]
    tube_along(bm, [(14.0, -11.5, 2.3), (15.5, -13.2, 2.35), (17.0, -15.0, 2.3)] + pts[1:], 0.12, sides=6)
    trees = obj_from_bm('supertrees', bm, 'supertree')
    for p in trees.data.polygons: p.use_smooth = True
    canopy = obj_from_bm('canopies', bmc, 'supertree_canopy')
    for p in canopy.data.polygons: p.use_smooth = True
    # the two cooled conservatories: glass gridshells like upturned shells
    domes = []
    for name, cx, cy, ax, ay, h, rot in [('flower_dome', 30.0, 2.0, 8.5, 4.6, 3.8, 0.35), ('cloud_forest', 24.0, 11.0, 6.0, 4.2, 5.8, -0.2)]:
        bm = bmesh.new()
        bmesh.ops.create_uvsphere(bm, u_segments=30, v_segments=10, radius=1.0)
        for v in bm.verts:
            if v.co.z < 0: v.co.z = 0
            # asymmetric shell: higher at one end, like the real domes
            lean = 1.0 + 0.35 * v.co.x
            v.co = Vector((v.co.x * ax, v.co.y * ay, v.co.z * h * lean))
            v.co = Matrix.Rotation(rot, 3, 'Z') @ v.co + Vector((cx, cy, 0.3))
        bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.001)
        shell = obj_from_bm(name, bm, 'dome_glass')
        for p in shell.data.polygons: p.use_smooth = True
        domes.append(shell)   # the gridshell ribs are drawn by the dome_glass shader
    return [trees, canopy] + domes

# =========================================================================== CBD AND THE NORTH SHORE
def tower_shape(bm, x, y, w, d, h, kind, rnd_):
    if kind == 'box':
        box(bm, x, y, 0.2, w, d, h)
        if rnd_.random() < .6:  # setback crown
            box(bm, x, y, 0.2 + h, w * .7, d * .7, rnd_.uniform(.8, 2.0))
    elif kind == 'chamfer':
        r = max(w, d) / 2
        prism(bm, ngon(x, y, r, 8, math.pi / 8, 1, d / w), 0.2, 0.2 + h)
    elif kind == 'round':
        prism(bm, ngon(x, y, w / 2, 20), 0.2, 0.2 + h)
        prism(bm, ngon(x, y, w / 2 * .82, 20), 0.2 + h, 0.2 + h + .6)
    elif kind == 'slant':
        out = [(x - w / 2, y - d / 2), (x + w / 2, y - d / 2), (x + w / 2, y + d / 2), (x - w / 2, y + d / 2)]
        f = prism(bm, out, 0.2, 0.2 + h)
        top = f[1]
        for v in top.verts:
            if v.co.x > x: v.co.z += min(w, 3.0) * .9
    elif kind == 'stepped':
        z = 0.2
        for k, s in enumerate([1.0, .82, .64]):
            hh = h * [0.55, 0.3, 0.15][k]
            box(bm, x, y, z, w * s, d * s, hh); z += hh
    elif kind == 'twin':
        box(bm, x - w * .3, y, 0.2, w * .45, d, h)
        box(bm, x + w * .3, y, 0.2, w * .45, d, h * .88)

def cbd():
    bm = bmesh.new()
    spots = []
    # Marina Bay Financial Centre and the CBD skyline, south-west of the bay
    for gx in range(6):
        for gy in range(5):
            if rnd.random() < .18: continue
            x = -40 + gx * 5.4 + rnd.uniform(-1, 1); y = -50 + gy * 5.2 + rnd.uniform(-1, 1)
            dist = math.hypot(x + 22, y + 34)
            h = max(6.0, 27.0 - dist * 0.55 + rnd.uniform(-5, 4))
            spots.append((x, y, h))
    kinds = ['box', 'box', 'chamfer', 'round', 'slant', 'stepped', 'twin']
    for x, y, h in spots:
        w = rnd.uniform(3.0, 4.4); d = rnd.uniform(3.0, 4.2)
        kind = rnd.choice(kinds)
        tower_shape(bm, x, y, w, d, h, kind, rnd)
        box(bm, x, y, 0.2, w * 1.35, d * 1.3, rnd.uniform(1.0, 1.8))           # podium
        if kind in ('box', 'chamfer', 'round', 'stepped'):                         # plant room, and now and then a mast
            box(bm, x + w * .12, y - d * .1, 0.2 + h, w * .32, d * .28, .55)
            if rnd.random() < .35: box(bm, x - w * .15, y + d * .12, 0.2 + h, .12, .12, rnd.uniform(2.0, 3.5))
    ob = obj_from_bm('cbd', bm, 'cbd_glass')
    # a tint per building, in COLOR_0: r,g,b = glass tint, a = lit-window seed
    seeds = {}
    def col(co, poly):
        key = (round(poly.center.x / 2.7), round(poly.center.y / 2.6))
        if key not in seeds:
            t = rnd.random()
            tint = [(0.55, 0.68, 0.78), (0.62, 0.72, 0.70), (0.72, 0.74, 0.76), (0.5, 0.6, 0.72), (0.78, 0.74, 0.66)][int(t * 5)]
            seeds[key] = (*tint, rnd.random())
        return seeds[key]
    set_color(ob, col)
    return ob

def north_shore():
    bm = bmesh.new()
    # Singapore Flyer: 150 m wheel on a terminal building
    cx, cy, cz, R = 22.0, 64.0, 9.2, 7.5
    rim = [(cx + math.cos(a) * R * 0.28, cy + math.sin(a) * R * 0.96, cz + math.sin(a + math.pi / 2) * R) for a in [k / 64 * 2 * math.pi for k in range(65)]]
    rot = Matrix.Rotation(0.5, 3, 'Z')
    def r3(p): return rot @ (Vector(p) - Vector((cx, cy, 0))) + Vector((cx, cy, 0))
    ring = [r3((cx, cy + math.cos(a) * R, cz + math.sin(a) * R)) for a in [k / 64 * 2 * math.pi for k in range(65)]]
    tube_along(bm, ring, 0.12, sides=6)
    for k in range(28):
        a = k / 28 * 2 * math.pi
        tube_along(bm, [r3((cx, cy, cz)), r3((cx, cy + math.cos(a) * R, cz + math.sin(a) * R))], 0.025, sides=3)
        if k % 1 == 0:
            p = r3((cx, cy + math.cos(a) * (R + .35), cz + math.sin(a) * (R + .35)))
            bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=5, radius=.28, matrix=Matrix.Translation(p) @ Matrix.Diagonal((1.6, 1, 1, 1)))
    for s in (-1, 1):
        tube_along(bm, [r3((cx + s * 1.6, cy - 2.5, 0.2)), r3((cx, cy, cz))], 0.18, sides=6)
        tube_along(bm, [r3((cx + s * 1.6, cy + 2.5, 0.2)), r3((cx, cy, cz))], 0.18, sides=6)
    box(bm, cx, cy - 4, 0.2, 9, 3, 1.4)
    flyer = obj_from_bm('flyer', bm, 'flyer_steel')
    for p in flyer.data.polygons: p.use_smooth = True
    # Marina Centre and the Esplanade side: hotels and low towers along the north shore
    bm = bmesh.new()
    for i in range(16):
        x = rnd.uniform(-20, 36); y = rnd.uniform(54, 76)   # east of the default camera's line of sight
        if math.hypot(x - -26, y - 60) < 6: continue
        h = rnd.uniform(3, 16)
        tower_shape(bm, x, y, rnd.uniform(3, 6), rnd.uniform(3, 6), h, rnd.choice(['box', 'chamfer', 'stepped', 'round']), rnd)
    # the Esplanade's two "durians": spiky domes on the waterfront
    for ex, ey, r in [(-31, 50, 4.2), (-23.5, 48, 3.4)]:
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r, matrix=Matrix.Translation((ex, ey, 0.2)) @ Matrix.Diagonal((1.25, 1, .62, 1)))
    city = obj_from_bm('city', bm, 'city_glass')
    return [flyer, city]

# =========================================================================== LAND, WATERFRONT AND TREES
LAND = [  # (x0, y0, x1, y1): non-overlapping slabs, so no two tops share a plane
    (-12.5, -26, 60, 23.5),    # Bayfront: Marina Bay Sands to Gardens by the Bay
    (-16.5, 23.5, -5.5, 37),   # the ArtScience Museum's corner
    (-48, -62, -8, -28),       # CBD, south-west of the bay
    (-8, -62, 60, -30),        # Marina South, joining the CBD to the Gardens
    (-62, 46, 40, 82),         # Marina Centre and the Esplanade, north shore
]
def land(rects=None, name='ground', cell=2.4):
    """Each slab: a gridded top (so paint and baked contact shadows have vertices) and sea walls."""
    bm = bmesh.new()
    for x0, y0, x1, y1 in (rects or LAND):
        nx = max(2, int((x1 - x0) / cell)); ny = max(2, int((y1 - y0) / cell))
        g = [[bm.verts.new((x0 + (x1 - x0) * i / nx, y0 + (y1 - y0) * j / ny, 0.2)) for j in range(ny + 1)] for i in range(nx + 1)]
        for i in range(nx):
            for j in range(ny):
                bm.faces.new((g[i][j], g[i + 1][j], g[i + 1][j + 1], g[i][j + 1]))
        edge = [g[i][0] for i in range(nx + 1)] + [g[nx][j] for j in range(1, ny + 1)] + [g[i][ny] for i in range(nx - 1, -1, -1)] + [g[0][j] for j in range(ny - 1, 0, -1)]
        low = [bm.verts.new((v.co.x, v.co.y, -1.0)) for v in edge]
        for k in range(len(edge)):
            m = (k + 1) % len(edge)
            bm.faces.new((edge[k], low[k], low[m], edge[m]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    ob = obj_from_bm(name, bm, 'ground')
    return ob

def is_land(x, y, inset=0.0):
    return any(x0 + inset <= x <= x1 - inset and y0 + inset <= y <= y1 - inset for x0, y0, x1, y1 in LAND + FAR_LAND)

def blocked(x, y):
    if -11 <= x <= 4 and -15.5 <= y <= 22: return True            # Marina Bay Sands
    if math.hypot(x + 11, y - 30.5) < 7.5: return True              # ArtScience
    if 9 <= x <= 28 and -23 <= y <= -6: return True                 # Supertree Grove (its own trees)
    if math.hypot(x - 30, y - 2) < 9.5 or math.hypot(x - 24, y - 11) < 7: return True  # domes
    if -46 <= x <= -9 and -60 <= y <= -29: return True               # CBD blocks
    if math.hypot(x - 22, y - 64) < 9: return True                  # Flyer
    if math.hypot(x - 100, y - 100) < 19: return True               # National Stadium
    return any(math.hypot(x - fx, y - fy) < fr + 1.2 for fx, fy, fr in FOOT)   # the wider city's buildings

# =========================================================================== THE WIDER CITY
# Marina Bay sits in the middle of a dense city, not in open water: the Downtown Core and Tanjong Pagar to the
# west, City Hall and Bugis to the north, Kallang and the Tanjong Rhu condos to the north-east, Gardens by the Bay
# East and the East Coast to the east, and the Strait to the south, with islands on the horizon (the anchored ships
# are added in the browser). Far enough out that sky light alone reads right, so none of this is AO-baked.
FAR_LAND = [
    (-130, -150, -48, 20),   # Downtown Core, Tanjong Pagar
    (-48, -95, 60, -62),     # Marina South piers and the cruise centre
    (-200, 82, 40, 170),     # City Hall, Bugis
    (40, 46, 210, 140),      # Kallang, Tanjong Rhu
    (60, -45, 150, 46),      # Gardens by the Bay East, Marina East
    (150, -20, 340, 46),     # East Coast
]
FOOT = []   # building footprints (x, y, radius), so trees keep clear of them
# The wider city is not geometry in the .glb: it is a list of boxes, octagonal prisms and cylinders
# (shape, residential?, x, base, y, width, depth, height) that the browser draws as GPU instances (city.json).
# Hundreds of buildings then cost a few kilobytes and six draw calls.
CITY_INST = []
def prim(shape, res, x, y, z0, w, d, h):
    CITY_INST.append((shape, 1 if res else 0, x, y, z0, w, d, h))

def city_tower(res, x, y, w, d, h, kind):
    if kind in ('box', 'slant'):
        prim(0, res, x, y, 0.2, w, d, h)
        if kind == 'box' and rnd.random() < .6: prim(0, res, x, y, 0.2 + h, w * .7, d * .7, rnd.uniform(.8, 2.0))
    elif kind == 'chamfer': prim(1, res, x, y, 0.2, w, d, h)
    elif kind == 'round':
        prim(2, res, x, y, 0.2, w, w, h); prim(2, res, x, y, 0.2 + h, w * .82, w * .82, .6)
    elif kind == 'stepped':
        z = 0.2
        for s, fr in ((1.0, .55), (.82, .3), (.64, .15)):
            prim(0, res, x, y, z, w * s, d * s, h * fr); z += h * fr
    elif kind == 'twin':
        prim(0, res, x - w * .3, y, 0.2, w * .45, d, h); prim(0, res, x + w * .3, y, 0.2, w * .45, d, h * .88)

def far_city():
    def scatter(x0, y0, x1, y1, n, hmin, hmax, kinds, res=False, keep=None):
        tries = made = 0
        while made < n and tries < n * 40:
            tries += 1
            x = rnd.uniform(x0 + 3, x1 - 3); y = rnd.uniform(y0 + 3, y1 - 3)
            if keep and not keep(x, y): continue
            w = rnd.uniform(3, 6); d = rnd.uniform(3, 6)
            slab = res and rnd.random() < .45
            if slab:   # HDB-style slab block: long and thin
                w, d = rnd.uniform(9, 14), rnd.uniform(2.2, 2.8)
                if rnd.random() < .5: w, d = d, w
            r = math.hypot(w, d) * .55
            if any(math.hypot(x - fx, y - fy) < fr + r + .8 for fx, fy, fr in FOOT): continue
            h = rnd.uniform(hmin, hmax) * (rnd.uniform(.45, .7) if slab else 1)
            if slab: prim(0, True, x, y, 0.2, w, d, h)
            else: city_tower(res, x, y, w, d, h, rnd.choice(kinds))
            FOOT.append((x, y, r)); made += 1
    # keep everything tall well away from the default camera, which sits north-west of the bay
    clear = lambda x, y: math.hypot(x + 93, y - 42) > 58
    scatter(-130, -150, -48, 20, 75, 12, 29, ['box', 'chamfer', 'slant', 'stepped', 'round', 'twin'], keep=clear)
    scatter(-48, -95, 60, -62, 16, 8, 24, ['box', 'chamfer', 'stepped'])
    scatter(-200, 82, 40, 170, 65, 5, 18, ['box', 'stepped', 'chamfer', 'round'], keep=clear)
    scatter(40, 46, 210, 140, 75, 6, 22, ['box', 'chamfer', 'round'], res=True, keep=lambda x, y: math.hypot(x - 100, y - 100) > 22)
    scatter(150, -20, 340, 46, 70, 6, 18, ['box', 'chamfer'], res=True)
    scatter(60, -45, 150, 46, 7, 2.5, 7, ['box', 'round'])   # a few pavilions in the eastern gardens
    # the National Stadium: a 310 m retractable-roof dome in Kallang
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=12, radius=1.0)
    for v in bm.verts:
        if v.co.z < 0: v.co.z = 0
        v.co = Vector((100 + v.co.x * 15.5, 100 + v.co.y * 15.5, 0.2 + v.co.z * 8.2))
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.001)
    stadium = obj_from_bm('stadium', bm, 'stadium')
    for p in stadium.data.polygons: p.use_smooth = True
    FOOT.append((100, 100, 17))
    stadium.name = stadium.data.name = 'wider_city'
    return stadium

def islands():
    """Low wooded islands across the Strait, hazy on the horizon."""
    bm = bmesh.new()
    for cx, cy, L, W, H in [(-260, -560, 160, 40, 9), (-40, -610, 220, 55, 12), (230, -580, 180, 45, 8), (430, -640, 200, 50, 11), (120, -720, 260, 60, 14)]:
        nu, nv = 40, 10
        grid = []
        for i in range(nu + 1):
            row = []
            for j in range(nv + 1):
                u = i / nu * 2 - 1; v = j / nv * 2 - 1
                r2 = min(1.0, u * u + v * v)
                z = H * (1 - r2) ** 1.4 * (0.75 + 0.25 * math.sin(u * 7.3 + cx) * math.cos(v * 3.1 + cy)) - 0.5
                row.append(bm.verts.new((cx + u * L / 2, cy + v * W / 2, z)))
            grid.append(row)
        for i in range(nu):
            for j in range(nv):
                bm.faces.new((grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]))
    ob = obj_from_bm('islands', bm, 'island')
    for p in ob.data.polygons: p.use_smooth = True
    return ob

TREE_PTS = []
def trees():
    """Rain trees on the lawns. Baked as occluders (they shade the ground); in the browser they are GPU instances."""
    bm = bmesh.new()
    count = 0
    tries = 0
    while count < 1250 and tries < 60000:
        tries += 1
        # the first 520 around the bay itself, the rest spread across the wider city
        if count < 520: x = rnd.uniform(-60, 58); y = rnd.uniform(-60, 80)
        else: x = rnd.uniform(-200, 340); y = rnd.uniform(-150, 170)
        if not is_land(x, y, 1.2) or blocked(x, y): continue
        # rain trees: broad, flat crowns
        s = rnd.uniform(.38, .66)   # crowns 10-17 m across
        TREE_PTS.append((round(x, 2), round(y, 2), round(s, 2)))
        bmesh.ops.create_cone(bm, cap_ends=False, segments=5, radius1=.12 * s, radius2=.08 * s, depth=1.0 * s, matrix=Matrix.Translation((x, y, .2 + .5 * s)))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0 * s, matrix=Matrix.Translation((x, y, .2 + 1.25 * s)) @ Matrix.Diagonal((1.25, 1.25, .62, 1)))
        count += 1
    ob = obj_from_bm('trees', bm, 'foliage')
    def col(co, poly):
        g = rnd.uniform(.75, 1.0)
        dark = max(0.0, min(1.0, (co.z - .2) / 2.0))
        return (0.18 * g, (0.32 + 0.12 * dark) * g, 0.12 * g, 1.0)
    set_color(ob, col)
    return ob

ART = artscience()
HELIX = helix_bridge()
GARDENS = join(gardens(), 'gardens')
CBD = cbd()
NORTH = join(north_shore(), 'northshore')
GROUND = land()
CITY = far_city()
FARGROUND = land(FAR_LAND, 'ground_far', 6.0)
set_color(FARGROUND, lambda co, poly: (0.22, 0.22, 0.21, 1) if poly.normal.z < .5 else
          ((0.12, 0.25, 0.09, 1) if math.sin(co.x * .09) * math.sin(co.y * .11) + .35 * math.sin(co.x * .31 + co.y * .17) > .15 else (0.34, 0.34, 0.32, 1)))
ISLANDS = islands()
TREES = trees()

# ground paint in COLOR_0: lawn in the parks, paving along the edges and around the buildings
def ground_col(co, poly):
    if poly.normal.z < .5: return (0.22, 0.22, 0.21, 1)   # granite sea walls
    park = 0.0 if blocked(co.x, co.y) else 1.0
    edge = 1.0
    for x0, y0, x1, y1 in LAND:
        if x0 <= co.x <= x1 and y0 <= co.y <= y1:
            edge = min(co.x - x0, x1 - co.x, co.y - y0, y1 - co.y)
    park *= max(0.0, min(1.0, (edge - 2.0) / 2.0))
    g = 0.85 + 0.15 * math.sin(co.x * .7) * math.sin(co.y * .53)
    return tuple([0.36 * (1 - park) + 0.11 * park * g, 0.36 * (1 - park) + 0.24 * park * g, 0.34 * (1 - park) + 0.08 * park * g, 1.0])
set_color(GROUND, ground_col)

EXPORT = [MBS, ART, HELIX, GARDENS, CBD, NORTH, GROUND, CITY, FARGROUND, ISLANDS]

# =========================================================================== LIGHTMAP UVs + AO BAKE
GROUPS = {  # object -> AO atlas size
    'mbs': 1024, 'artscience': 512, 'helix': 256, 'gardens': 512, 'cbd': 1024, 'northshore': 512, 'ground': 1024,
}
def lightmap_uvs(ob):
    me = ob.data
    lm = me.uv_layers.get('Lightmap') or me.uv_layers.new(name='Lightmap')
    me.uv_layers.active = lm
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.004, area_weight=1.0, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    lm.active_render = True

for name in GROUPS:
    lightmap_uvs(bpy.data.objects[name])

def bake_ao(ob, size):
    img = bpy.data.images.new('ao_' + ob.name, size, size, alpha=False, float_buffer=False)
    img.colorspace_settings.name = 'Non-Color'
    for m in ob.data.materials:
        nt = m.node_tree
        node = nt.nodes.new('ShaderNodeTexImage'); node.image = img; node.name = 'BAKE'
        uvn = nt.nodes.new('ShaderNodeUVMap'); uvn.uv_map = 'Lightmap'
        nt.links.new(uvn.outputs['UV'], node.inputs['Vector'])
        for n in nt.nodes: n.select = False
        node.select = True; nt.nodes.active = node
    ob.data.uv_layers.active = ob.data.uv_layers['Lightmap']
    for o in bpy.context.selected_objects: o.select_set(False)
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.bake(type='AO', margin=6, use_clear=True)
    # light denoise: two small box passes (inside the 6 px bake margin, so islands don't bleed together).
    # Smoother contact shadows, and the WebP shrinks by half.
    import numpy as np
    px = np.empty(size * size * 4, np.float32); img.pixels.foreach_get(px); a = px.reshape(size, size, 4)
    for _ in range(2):
        c = a[..., :3]
        a[..., :3] = (np.roll(c, 1, 0) + np.roll(c, -1, 0) + np.roll(c, 1, 1) + np.roll(c, -1, 1) + 2 * c) / 6
    img.pixels.foreach_set(a.reshape(-1)); img.update()
    path = os.path.join(OUT, 'ao-%s.webp' % ob.name)
    scene.render.image_settings.file_format = 'WEBP'
    scene.render.image_settings.quality = 76
    scene.render.image_settings.color_mode = 'RGB'
    img.save_render(path, scene=scene)
    # remove the bake nodes so the export carries names only
    for m in ob.data.materials:
        nt = m.node_tree
        for n in [n for n in nt.nodes if n.name.startswith('BAKE') or n.type == 'UVMAP']: nt.nodes.remove(n)
    print('baked', path)

if BAKE:
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 96
    scene.view_settings.view_transform = 'Standard'   # save the AO values as baked, with no tone curve
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('sky'); scene.world = world
    world.light_settings.distance = 6.0
    for name, size in GROUPS.items():
        bake_ao(bpy.data.objects[name], size)

# =========================================================================== EXPORT
for o in bpy.context.selected_objects: o.select_set(False)
for ob in EXPORT:
    for m in list(ob.modifiers): apply_mods(ob)
    ob.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(OUT, 'marina-bay.glb'), export_format='GLB', use_selection=True,
    export_texcoords=True, export_normals=True, export_materials='EXPORT', export_vertex_color='ACTIVE',
    export_apply=True, export_yup=True, export_cameras=False, export_lights=False)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'marina-bay.blend'))

# tree instances, in three.js axes (x east, y up, z south): [x, z, scale] per tree
import json
with open(os.path.join(OUT, 'trees.json'), 'w') as fh:
    json.dump([[x, -y, s] for x, y, s in TREE_PTS], fh, separators=(',', ':'))
# the wider city, in three.js axes: [shape (0 box, 1 octagon, 2 cylinder), residential, x, base, z, width, height, depth]
with open(os.path.join(OUT, 'city.json'), 'w') as fh:
    json.dump([[s, r, round(x, 2), round(z0, 2), round(-y, 2), round(w, 2), round(h, 2), round(d, 2)] for s, r, x, y, z0, w, d, h in CITY_INST], fh, separators=(',', ':'))

# =========================================================================== SHRINK THE GLB
# KHR_mesh_quantization (read natively by three.js, no decoder, so the CSP stays as it is):
# positions -> int16 with the node's scale/translation undoing it, normals -> int8, lightmap UVs -> uint16,
# colours -> uint8. There are no facade UVs at all: they are a function of position and normal, so the shader
# builds them, and leaving them out also saves the vertex splits their seams would cause.
import struct, numpy as np
def shrink_glb(path):
    raw = open(path, 'rb').read()
    jl = struct.unpack_from('<I', raw, 12)[0]
    gj = json.loads(raw[20:20 + jl])
    b0 = 20 + jl
    bl = struct.unpack_from('<I', raw, b0)[0]
    BIN = raw[b0 + 8:b0 + 8 + bl]
    CT = {5120: np.int8, 5121: np.uint8, 5122: np.int16, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
    NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def read(ai):
        a = gj['accessors'][ai]; v = gj['bufferViews'][a['bufferView']]
        dt = np.dtype(CT[a['componentType']]); n = NC[a['type']]
        off = v.get('byteOffset', 0) + a.get('byteOffset', 0)
        stride = v.get('byteStride', dt.itemsize * n)
        buf = np.frombuffer(BIN, dtype=np.uint8, count=stride * (a['count'] - 1) + dt.itemsize * n, offset=off)
        out = np.lib.stride_tricks.as_strided(buf, shape=(a['count'], dt.itemsize * n), strides=(stride, 1)).copy().view(dt).reshape(a['count'], n)
        if a.get('normalized'):
            out = out.astype(np.float32) / float(np.iinfo(dt).max)
        return out.astype(np.float32) if dt != np.float32 and not a.get('normalized') and a['type'] != 'SCALAR' else out
    out = bytearray(); views = []; accs = []
    def put(arr, ct, typ, normalized=False, stride=None, target=None, minmax=False):
        while len(out) % 4: out.append(0)
        data = np.ascontiguousarray(arr).tobytes()
        v = {'buffer': 0, 'byteOffset': len(out), 'byteLength': len(data)}
        if stride: v['byteStride'] = stride
        if target: v['target'] = target
        out.extend(data); views.append(v)
        a = {'bufferView': len(views) - 1, 'componentType': ct, 'count': int(arr.shape[0]), 'type': typ}
        if normalized: a['normalized'] = True
        if minmax:
            n = NC[typ]; flat = np.asarray(arr)[:, :n]
            a['min'] = [int(x) for x in flat.min(0)]; a['max'] = [int(x) for x in flat.max(0)]
        accs.append(a); return len(accs) - 1
    for mi, mesh in enumerate(gj['meshes']):
        pos_all = np.concatenate([read(p['attributes']['POSITION']) for p in mesh['primitives']])
        lo, hi = pos_all.min(0), pos_all.max(0); c = (lo + hi) / 2; e = float((hi - lo).max() / 2) or 1.0
        for node in gj['nodes']:
            if node.get('mesh') == mi:
                node['translation'] = [float(x) for x in c]; node['scale'] = [e, e, e]; node.pop('rotation', None)
        for p in mesh['primitives']:
            at = p['attributes']; na = {}
            q = np.round((read(at['POSITION']) - c) / e * 32767).clip(-32767, 32767).astype(np.int16)
            na['POSITION'] = put(np.hstack([q, np.zeros((len(q), 1), np.int16)]), 5122, 'VEC3', True, 8, 34962, True)
            if 'NORMAL' in at:
                nrm = np.round(read(at['NORMAL']) * 127).clip(-127, 127).astype(np.int8)
                na['NORMAL'] = put(np.hstack([nrm, np.zeros((len(nrm), 1), np.int8)]), 5120, 'VEC3', True, 4, 34962)
            if 'TEXCOORD_0' in at:   # the lightmap UVs (the only UV set)
                uv = np.round(np.clip(read(at['TEXCOORD_0']), 0, 1) * 65535).astype(np.uint16)
                na['TEXCOORD_0'] = put(uv, 5123, 'VEC2', True, None, 34962)
            if 'COLOR_0' in at:
                col = read(at['COLOR_0'])
                if col.shape[1] == 3: col = np.hstack([col, np.ones((len(col), 1), np.float32)])
                na['COLOR_0'] = put(np.round(np.clip(col, 0, 1) * 255).astype(np.uint8), 5121, 'VEC4', True, None, 34962)
            if 'indices' in p:
                ia = gj['accessors'][p['indices']]; idx = read(p['indices']).reshape(-1)
                ct = 5123 if idx.max() < 65535 else 5125
                p['indices'] = put(idx.astype(np.uint16 if ct == 5123 else np.uint32).reshape(-1, 1), ct, 'SCALAR', target=34963)
            p['attributes'] = na
    gj['accessors'] = accs; gj['bufferViews'] = views
    gj['buffers'] = [{'byteLength': len(out)}]
    for k in ('extensionsUsed', 'extensionsRequired'):
        gj[k] = sorted(set(gj.get(k, [])) | {'KHR_mesh_quantization'})
    js = json.dumps(gj, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    while len(out) % 4: out.append(0)
    blob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(out)) + b'BIN\x00' + bytes(out)
    open(path, 'wb').write(blob)

glb = os.path.join(OUT, 'marina-bay.glb')
before = os.path.getsize(glb)
shrink_glb(glb)
# a gzipped copy: hosts don't compress .glb, and the browser inflates it natively (DecompressionStream)
import gzip
with open(glb, 'rb') as src, gzip.open(glb + '.gz', 'wb', compresslevel=9) as dst: dst.write(src.read())
tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in EXPORT)
print('EXPORTED', before, '->', os.path.getsize(glb), 'bytes, gz', os.path.getsize(glb + '.gz'), ',', tris, 'triangles,', len(TREE_PTS), 'trees,', len(CITY_INST), 'city blocks')
