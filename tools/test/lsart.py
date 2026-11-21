# GTA-style loading-screen art: the 1920x1080 illustrations from lsart-page.js saved as JPEGs for public/img/ls/<character>.jpg
# (no filtering: they are drawn sharp).  python3 lsart.py indir outdir
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
FRAMES = {0: 'granny', 1: 'grandpa', 2: 'slendrina', 3: 'nosferatu', 5: 'angeline', 6: 'father', 7: 'mara', 8: 'eli', 9: 'june', 10: 'tomas'}
for i, n in FRAMES.items():
    f = os.path.join(src, 'f%04d.jpg' % i)
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB')
    im.save(os.path.join(dst, n + '.jpg'), quality=86, optimize=True, progressive=True)
    print(n, im.size, os.path.getsize(os.path.join(dst, n + '.jpg')))
