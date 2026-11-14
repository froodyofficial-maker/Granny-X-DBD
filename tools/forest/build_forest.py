# Slendrina: The Forest map (1.4.3): converts the owner's Unity build of "Slendrina The Forest" (level1 + sharedassets1)
# into public/models/forest_map.glb (the trees, rocks and lamps as prototypes, the landmark buildings as groups) and
# public/js/forestdata.js (where every tree stands, the landmark groups and their collision footprints).
#   pip install UnityPy numpy pillow
#   python3 build_forest.py <folder with level1, sharedassets1.assets, sharedassets1.assets.resS> <repo root>
# Space: the Unity scene is converted to three.js by mirroring X (UnityPy's OBJ export already mirrors the meshes).
import sys, json, io, struct, math
import numpy as np, UnityPy
from PIL import Image

SRC, ROOT = sys.argv[1], sys.argv[2]
env = UnityPy.load(f'{SRC}/level1', f'{SRC}/sharedassets1.assets', f'{SRC}/sharedassets1.assets.resS')
F = np.diag([-1.0, 1.0, 1.0, 1.0])
Y0 = 0.79  # the Unity terrain sits at y = -0.79: lift everything so the ground is y = 0

def quat_mat(q):
    x, y, z, w = q.x, q.y, q.z, q.w
    return np.array([[1-2*(y*y+z*z), 2*(x*y-z*w), 2*(x*z+y*w)], [2*(x*y+z*w), 1-2*(x*x+z*z), 2*(y*z-x*w)], [2*(x*z-y*w), 2*(y*z+x*w), 1-2*(x*x+y*y)]])
tr = {o.path_id: o.read() for o in env.objects if o.type.name == 'Transform'}
cache = {}
def world(pid):
    if pid in cache: return cache[pid]
    t = tr[pid]; M = np.eye(4)
    M[:3, :3] = quat_mat(t.m_LocalRotation) * np.array([t.m_LocalScale.x, t.m_LocalScale.y, t.m_LocalScale.z])
    M[:3, 3] = [t.m_LocalPosition.x, t.m_LocalPosition.y, t.m_LocalPosition.z]
    if t.m_Father and t.m_Father.path_id: M = world(t.m_Father.path_id) @ M
    cache[pid] = M; return M

def active(go_reader, tpid):
    # a GameObject is shown only if it and all its parents are active
    t = tr.get(tpid)
    while t is not None:
        try:
            if not t.m_GameObject.read().m_IsActive: return False
        except Exception: return False
        t = tr.get(t.m_Father.path_id) if t.m_Father and t.m_Father.path_id else None
    return True

meshes, mats, inst = {}, {}, []
seen = set()
for obj in env.objects:
    if obj.type.name != 'MeshFilter': continue
    mf = obj.read()
    try: mesh = mf.m_Mesh.read()
    except Exception: continue
    go = mf.m_GameObject.read()
    tpid, rend = None, None
    for c in go.m_Component:
        cc = c.component if hasattr(c, 'component') else c
        try: o = cc.read()
        except Exception: continue
        tn = o.object_reader.type.name if hasattr(o, 'object_reader') else type(o).__name__
        if tn == 'Transform': tpid = cc.path_id
        if tn == 'MeshRenderer': rend = o
    if tpid is None or rend is None or not rend.m_Enabled or not active(go, tpid): continue
    W = F @ world(tpid) @ F
    W[1, 3] += Y0
    key = (mesh.m_Name, tuple(np.round(W[:3, 3], 2)))
    if key in seen: continue
    seen.add(key)
    ml = []
    for m in rend.m_Materials:
        try: mm = m.read(); ml.append(mm.m_Name); mats.setdefault(mm.m_Name, mm)
        except Exception: ml.append(None)
    meshes.setdefault(mesh.m_Name, mesh)
    inst.append({'mesh': mesh.m_Name, 'mat': ml[0], 'W': W})
print('instances', len(inst))

def parse_obj(txt):
    V, N, T, Fc = [], [], [], []
    for line in txt.splitlines():
        p = line.split()
        if not p: continue
        if p[0] == 'v': V.append([float(x) for x in p[1:4]])
        elif p[0] == 'vn': N.append([float(x) for x in p[1:4]])
        elif p[0] == 'vt': T.append([float(x) for x in p[1:3]])
        elif p[0] == 'f': Fc.append([int(q.split('/')[0]) - 1 for q in p[1:4]])
    return np.array(V, 'f4'), (np.array(N, 'f4') if N else None), (np.array(T, 'f4') if T else None), np.array(Fc, 'u4')
geo = {}
def geom(name):
    if name not in geo: geo[name] = parse_obj(meshes[name].export())
    return geo[name]

# ---------- what goes where ----------
ANCHOR = {  # landmark groups: Unity (x, z) of the building, radius of what belongs to it
    'house': ((244.6, 113.9), 13), 'stall': ((261.0, 167.3), 11), 'oldhouse': ((256.3, 16.1), 13),
    'shelter': ((112.0, 155.0), 7), 'car': ((82.6, 23.7), 5),
}
def to_game(ux, uz): return (-ux, uz)
CX, CZ = to_game(244.6, 113.9)  # the big house is the middle of the map
PROTO = {'Stam', 'Grenar', 'RockMesh', 'Utelykta'}
groups = {g: [] for g in ANCHOR}
trees, rocks, lamps, branches = [], [], [], []
for e in inst:
    x, z = e['W'][0, 3], e['W'][2, 3]
    g = None
    for name, ((ax, az), r) in ANCHOR.items():
        gx, gz = to_game(ax, az)
        if math.hypot(x - gx, z - gz) < r and e['mesh'] not in ('Stam', 'Grenar', 'RockMesh', 'Golv'): g = name; break
    if g: groups[g].append(e); continue
    if e['mesh'] == 'Stam': trees.append(e)
    elif e['mesh'] == 'Grenar': branches.append(e)
    elif e['mesh'] == 'RockMesh': rocks.append(e)
    elif e['mesh'] == 'Utelykta': lamps.append(e)
# pair every trunk with its crown
pairs = []
bx = np.array([[b['W'][0, 3], b['W'][2, 3]] for b in branches])
used = set()
for t in trees:
    d = np.hypot(bx[:, 0] - t['W'][0, 3], bx[:, 1] - t['W'][2, 3]); k = int(d.argmin())
    pairs.append((t, branches[k] if d[k] < 2.0 and k not in used else None)); used.add(k)

# ---------- collision footprints of the landmark groups (0.5 m cells, holes inside filled) ----------
CELL = 0.5
def footprint(items, gx, gz):
    occ = set()
    for e in items:
        V, N, T, Fc = geom(e['mesh'])
        P = (np.c_[V, np.ones(len(V))] @ e['W'].T)[:, :3]
        P[:, 0] -= gx; P[:, 2] -= gz
        for a, b, c in Fc:
            tri = P[[a, b, c]]
            if tri[:, 1].max() < 0.25 or tri[:, 1].min() > 1.9: continue
            # sample the triangle and mark the cells it crosses at body height
            for u in np.linspace(0, 1, 7):
                for v in np.linspace(0, 1 - u, max(2, int(7 * (1 - u)))):
                    p = tri[0] + (tri[1] - tri[0]) * u + (tri[2] - tri[0]) * v
                    if 0.25 <= p[1] <= 1.9: occ.add((int(math.floor(p[0] / CELL)), int(math.floor(p[2] / CELL))))
    if not occ: return []
    xs = [c[0] for c in occ]; zs = [c[1] for c in occ]
    x0, x1, z0, z1 = min(xs) - 1, max(xs) + 1, min(zs) - 1, max(zs) + 1
    # flood the outside; whatever it can't reach is inside the building: solid
    out = set(); st = [(x0, z0)]
    while st:
        c = st.pop()
        if c in out or c in occ or not (x0 <= c[0] <= x1 and z0 <= c[1] <= z1): continue
        out.add(c); st += [(c[0] + 1, c[1]), (c[0] - 1, c[1]), (c[0], c[1] + 1), (c[0], c[1] - 1)]
    solid = {(i, j) for i in range(x0, x1 + 1) for j in range(z0, z1 + 1) if (i, j) not in out}
    # merge into boxes: runs along x, then stack equal runs along z
    runs = {}
    for j in range(z0, z1 + 1):
        i = x0
        while i <= x1:
            if (i, j) in solid:
                k = i
                while (k + 1, j) in solid: k += 1
                runs.setdefault((i, k), []).append(j); i = k + 1
            else: i += 1
    boxes = []
    for (i, k), js in runs.items():
        js.sort(); s = js[0]; p = js[0]
        for j in js[1:] + [None]:
            if j is not None and j == p + 1: p = j; continue
            boxes.append([round((i + k + 1) / 2 * CELL, 3), round((s + p + 1) / 2 * CELL, 3), round((k - i + 1) * CELL / 2, 3), round((p - s + 1) * CELL / 2, 3)])
            if j is not None: s = p = j
    return boxes

# ---------- textures & materials ----------
def tex_of(mat):
    if mat is None: return None
    for k, v in mat.m_SavedProperties.m_TexEnvs:
        if k == '_MainTex' and v.m_Texture and v.m_Texture.path_id:
            try:
                t = v.m_Texture.read(); return t.m_Name, t.image, (v.m_Scale.x, v.m_Scale.y)
            except Exception: return None
    return None
def color_of(mat):
    try:
        for k, v in mat.m_SavedProperties.m_Colors:
            if k == '_Color': return [v.r, v.g, v.b, 1.0]
    except Exception: pass
    return [1, 1, 1, 1]

# ---------- GLB writer ----------
class GLB:
    def __init__(self): self.j = {'asset': {'version': '2.0', 'generator': 'granny-x-dbd forest'}, 'scenes': [{'nodes': []}], 'scene': 0, 'nodes': [], 'meshes': [], 'materials': [], 'textures': [], 'images': [], 'samplers': [{'wrapS': 10497, 'wrapT': 10497, 'minFilter': 9987, 'magFilter': 9729}], 'accessors': [], 'bufferViews': [], 'buffers': [{'byteLength': 0}]}; self.bin = bytearray(); self.matid = {}; self.meshid = {}
    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin += b'\0'
        off = len(self.bin); self.bin += data
        v = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: v['target'] = target
        self.j['bufferViews'].append(v); return len(self.j['bufferViews']) - 1
    def acc(self, arr, ctype, typ, target=None, minmax=False):
        a = {'bufferView': self.view(arr.tobytes(), target), 'componentType': ctype, 'count': len(arr), 'type': typ}
        if minmax: a['min'] = arr.min(0).tolist(); a['max'] = arr.max(0).tolist()
        self.j['accessors'].append(a); return len(self.j['accessors']) - 1
    def material(self, name, mat):
        if name in self.matid: return self.matid[name]
        t = tex_of(mat); m = {'name': name or 'mat', 'pbrMetallicRoughness': {'metallicFactor': 0, 'roughnessFactor': 0.9, 'baseColorFactor': color_of(mat)}, 'doubleSided': name == 'fa5_opacity'}
        if t and t[1] is not None:
            # only cut-out / transparent shaders use the alpha channel as see-through (elsewhere Unity keeps gloss in it)
            try: shader = mat.m_Shader.read().m_ParsedForm.m_Name
            except Exception: shader = ''
            cut = 'opacity' in (name or '').lower() or any(k in shader for k in ('Cutout', 'Transparent'))
            img = t[1]; alpha = cut and img.mode in ('RGBA', 'LA') and np.array(img.convert('RGBA'))[:, :, 3].min() < 250
            mx = 512 if alpha else 1024
            if max(img.size) > mx: img = img.resize((mx, max(1, round(img.size[1] * mx / img.size[0]))) if img.size[0] >= img.size[1] else (max(1, round(img.size[0] * mx / img.size[1])), mx), Image.LANCZOS)
            b = io.BytesIO()
            if alpha: img.convert('RGBA').save(b, 'PNG', optimize=True); mime = 'image/png'
            else: img.convert('RGB').save(b, 'JPEG', quality=82); mime = 'image/jpeg'
            self.j['images'].append({'bufferView': self.view(b.getvalue()), 'mimeType': mime, 'name': t[0]})
            self.j['textures'].append({'source': len(self.j['images']) - 1, 'sampler': 0})
            m['pbrMetallicRoughness']['baseColorTexture'] = {'index': len(self.j['textures']) - 1}
            if t[2] and (abs(t[2][0] - 1) > 1e-3 or abs(t[2][1] - 1) > 1e-3):
                m['pbrMetallicRoughness']['baseColorTexture']['extensions'] = {'KHR_texture_transform': {'scale': [t[2][0], t[2][1]]}}
                self.j.setdefault('extensionsUsed', []).append('KHR_texture_transform') if 'KHR_texture_transform' not in self.j.get('extensionsUsed', []) else None
            if alpha: m['alphaMode'] = 'MASK'; m['alphaCutoff'] = 0.45
        self.j['materials'].append(m); self.matid[name] = len(self.j['materials']) - 1; return self.matid[name]
    def mesh(self, name, matname, mat, M=None):
        key = (name, matname, None if M is None else tuple(np.round(M, 4).ravel()))
        V, N, T, Fc = geom(name)
        V2 = V.copy(); N2 = None if N is None else N.copy()
        if M is not None:
            V2 = (np.c_[V2, np.ones(len(V2))] @ M.T)[:, :3].astype('f4')
            if N2 is not None and len(N2) == len(V2):
                n = N2 @ np.linalg.inv(M[:3, :3]).T; N2 = (n / np.maximum(1e-9, np.linalg.norm(n, axis=1, keepdims=True))).astype('f4')
            if np.linalg.det(M[:3, :3]) < 0: Fc = Fc[:, ::-1].copy()
        attrs = {'POSITION': self.acc(V2.astype('f4'), 5126, 'VEC3', 34962, True)}
        if N2 is not None and len(N2) == len(V2): attrs['NORMAL'] = self.acc(N2.astype('f4'), 5126, 'VEC3', 34962)
        if T is not None and len(T) == len(V2): attrs['TEXCOORD_0'] = self.acc(np.c_[T[:, 0], 1 - T[:, 1]].astype('f4'), 5126, 'VEC2', 34962)
        prim = {'attributes': attrs, 'indices': self.acc(Fc.astype('u4').ravel(), 5125, 'SCALAR', 34963), 'material': self.material(matname, mat)}
        self.j['meshes'].append({'name': name, 'primitives': [prim]}); return len(self.j['meshes']) - 1
    def node(self, n, root=True):
        self.j['nodes'].append(n); i = len(self.j['nodes']) - 1
        if root: self.j['scenes'][0]['nodes'].append(i)
        return i
    def save(self, path):
        while len(self.bin) % 4: self.bin += b'\0'
        self.j['buffers'][0]['byteLength'] = len(self.bin)
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out); return len(out)

G = GLB()
# prototypes at the origin, in their own space (instances supply the matrix)
proto_mat = {}
for name, lst in (('Stam', trees), ('Grenar', branches), ('RockMesh', rocks), ('Utelykta', lamps)):
    if not lst: continue
    mn = lst[0]['mat']
    mi = G.mesh(name, mn, mats.get(mn))
    G.node({'name': 'proto_' + name, 'mesh': mi})
# landmark groups: every part baked into the group's own frame (anchor at the origin)
data = {'groups': {}, 'trees': [], 'rocks': [], 'lamps': []}
for gname, items in groups.items():
    (ax, az), r = ANCHOR[gname]; gx, gz = to_game(ax, az)
    kids = []
    for e in items:
        M = e['W'].copy(); M[0, 3] -= gx; M[2, 3] -= gz
        mi = G.mesh(e['mesh'], e['mat'], mats.get(e['mat']), M)
        kids.append(G.node({'name': e['mesh'], 'mesh': mi}, root=False))
    G.node({'name': 'group_' + gname, 'children': kids})
    data['groups'][gname] = {'boxes': footprint(items, gx, gz), 'parts': len(items)}
    print(gname, 'parts', len(items), 'boxes', len(data['groups'][gname]['boxes']))
r6 = lambda M: [round(float(v), 4) for v in M.T.ravel()]  # column-major for THREE.Matrix4.fromArray
for t, b in pairs:
    x, z = t['W'][0, 3] - CX, t['W'][2, 3] - CZ
    sc = float(np.linalg.norm(t['W'][:3, 0]))
    T = t['W'].copy(); T[0, 3] = x; T[2, 3] = z
    rec = {'x': round(x, 2), 'z': round(z, 2), 'r': round(max(0.25, min(0.7, 0.12 * sc)), 3), 't': r6(T)}
    if b is not None: B = b['W'].copy(); B[0, 3] -= CX; B[2, 3] -= CZ; rec['b'] = r6(B)
    data['trees'].append(rec)
for e in rocks:
    M = e['W'].copy(); M[0, 3] -= CX; M[2, 3] -= CZ
    data['rocks'].append({'x': round(M[0, 3], 2), 'z': round(M[2, 3], 2), 'r': round(1.2 * float(np.linalg.norm(M[:3, 0])), 2), 'm': r6(M)})
for e in lamps:
    M = e['W'].copy(); M[0, 3] -= CX; M[2, 3] -= CZ
    data['lamps'].append({'x': round(M[0, 3], 2), 'z': round(M[2, 3], 2), 'm': r6(M)})
n = G.save(f'{ROOT}/public/models/forest_map.glb')
print('glb', n, 'bytes; trees', len(data['trees']), 'rocks', len(data['rocks']), 'lamps', len(data['lamps']))
with open(f'{ROOT}/public/js/forestdata.js', 'w') as f:
    f.write('// Slendrina: The Forest (1.4.3): generated by tools/forest/build_forest.py from the owner\'s game files. Do not edit.\n')
    f.write('// Game space (three.js), the middle of the map at the big house. Trees: trunk base x/z, collision radius r,\n')
    f.write('// t / b = trunk / crown matrices (column-major). Groups: collision boxes [x, z, hx, hz] around each landmark.\n')
    f.write('export const FOREST = ' + json.dumps(data, separators=(',', ':')) + ';\n')
