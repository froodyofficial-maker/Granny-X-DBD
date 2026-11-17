# Prepares an outfit GLB for the game (1.4.4): textures down to at most MAX px (JPEG unless they need alpha),
# spec-gloss materials (KHR_materials_pbrSpecularGlossiness, which three.js no longer reads: they render black)
# turned into plain metal-rough ones, and the binary buffer rebuilt.
#   python3 prep_glb.py in.glb out.glb [MAX=1024]
import sys, json, struct, io
import numpy as np
from PIL import Image

src, dst = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
L = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + L])
o = 20 + L; BL = struct.unpack('<I', b[o:o + 4])[0]; binb = b[o + 8:o + 8 + BL]
views = j['bufferViews']
img_views = {im['bufferView']: i for i, im in enumerate(j.get('images', [])) if 'bufferView' in im}
# which images are used as base colour with alpha blending / masking (keep PNG alpha for those)
alpha_imgs = set()
for m in j.get('materials', []):
    if m.get('alphaMode') in ('MASK', 'BLEND'):
        t = m.get('pbrMetallicRoughness', {}).get('baseColorTexture') or m.get('extensions', {}).get('KHR_materials_pbrSpecularGlossiness', {}).get('diffuseTexture')
        if t: alpha_imgs.add(j['textures'][t['index']]['source'])
# spec-gloss -> metal-rough
for m in j.get('materials', []):
    sg = m.get('extensions', {}).pop('KHR_materials_pbrSpecularGlossiness', None)
    if sg is None: continue
    pbr = m.setdefault('pbrMetallicRoughness', {})
    if 'diffuseTexture' in sg: pbr['baseColorTexture'] = sg['diffuseTexture']
    if 'diffuseFactor' in sg: pbr['baseColorFactor'] = sg['diffuseFactor']
    pbr['metallicFactor'] = 0.0
    pbr['roughnessFactor'] = round(1.0 - float(sg.get('glossinessFactor', 0.2)), 3)
    if not m['extensions']: del m['extensions']
for k in ('extensionsUsed', 'extensionsRequired'):
    if k in j: j[k] = [e for e in j[k] if e != 'KHR_materials_pbrSpecularGlossiness']
    if k in j and not j[k]: del j[k]
# rebuild the buffer, re-encoding images
out = bytearray(); newviews = []
for vi, v in enumerate(views):
    data = binb[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    if vi in img_views:
        ii = img_views[vi]; im = Image.open(io.BytesIO(data)); im.load()
        alpha = ii in alpha_imgs and im.mode in ('RGBA', 'LA', 'P')
        if max(im.size) > MAX:
            k = MAX / max(im.size); im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
        bb = io.BytesIO()
        if alpha: im.convert('RGBA').save(bb, 'PNG', optimize=True); j['images'][ii]['mimeType'] = 'image/png'
        else: im.convert('RGB').save(bb, 'JPEG', quality=85); j['images'][ii]['mimeType'] = 'image/jpeg'
        data = bb.getvalue()
    while len(out) % 4: out += b'\0'
    nv = dict(v); nv['byteOffset'] = len(out); nv['byteLength'] = len(data); nv['buffer'] = 0
    out += data; newviews.append(nv)
while len(out) % 4: out += b'\0'
j['bufferViews'] = newviews; j['buffers'] = [{'byteLength': len(out)}]
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
blob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(out)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(out), 0x004E4942) + bytes(out)
open(dst, 'wb').write(blob)
print(dst, len(b) // 1024, '->', len(blob) // 1024, 'KB')
