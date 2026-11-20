# GTA-style loading-screen art: the 1920x1080 illustrations from lsart-page.js saved as JPEGs for public/img/ls (no
# filtering: they are drawn sharp).  python3 lsart.py indir outdir
import sys, os
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
for i, n in enumerate(['granny', 'grandpa', 'slendrina', 'nosferatu']):
    im = Image.open(os.path.join(src, 'f%04d.jpg' % i)).convert('RGB')
    im.save(os.path.join(dst, n + '.jpg'), quality=88, optimize=True, progressive=True)
    print(n, im.size, os.path.getsize(os.path.join(dst, n + '.jpg')))
