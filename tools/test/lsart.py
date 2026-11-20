# GTA-style loading-screen art: in-engine shots (lsart-page.js) -> comic panels: smoothed flat colours, a warm/neon
# grade, boosted saturation and dark ink lines along the edges.  python3 lsart.py indir outdir
import sys, os
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
names = ['granny', 'grandpa', 'slendrina', 'nosferatu']
for i, n in enumerate(names):
    im = Image.open(os.path.join(src, 'f%04d.jpg' % i)).convert('RGB')
    CROP = {'slendrina': (374, 250, 1206, 718)}  # (her shot is wide: zoom in on her)
    if n in CROP: im = im.crop(CROP[n]).resize((1280, 720), Image.LANCZOS)
    # a sunset behind it all: dark sky pixels in the upper half take a purple-pink-orange gradient
    A = np.asarray(im).astype(np.float32); h0, w0 = A.shape[:2]
    lum = A.mean(axis=2); yy = np.arange(h0)[:, None] / h0
    sky = np.zeros_like(A); top = np.array([60, 14, 96.]); mid = np.array([255, 60, 150.]); low = np.array([255, 150, 70.])
    k = np.clip(yy / 0.5, 0, 1)[..., None]
    sky = np.where(k < 0.6, top + (mid - top) * (k / 0.6), mid + (low - mid) * ((k - 0.6) / 0.4))
    m = (np.clip((40 - lum) / 30, 0, 1) * np.clip((0.55 - yy) / 0.2, 0, 1))[..., None]
    A = A * (1 - m * 0.85) + sky * m * 0.85
    im = Image.fromarray(np.clip(A, 0, 255).astype(np.uint8))
    flat = im.filter(ImageFilter.MedianFilter(5)).filter(ImageFilter.MedianFilter(5))
    flat = ImageEnhance.Color(flat).enhance(1.5)
    flat = ImageEnhance.Contrast(flat).enhance(1.15)
    q = flat.quantize(colors=28, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE).convert('RGB')
    q = q.filter(ImageFilter.SMOOTH_MORE)
    # ink: edges of the flattened picture, thickened a little
    g = ImageOps.grayscale(flat).filter(ImageFilter.GaussianBlur(1.2))
    e = np.asarray(g.filter(ImageFilter.FIND_EDGES)).astype(np.float32)
    ink = np.clip((e - 10) / 30, 0, 1)
    ink = np.asarray(Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(3))).astype(np.float32) / 255
    a = np.asarray(q).astype(np.float32)
    a *= (1 - ink[..., None] * 0.85)
    # a halftone-ish grain and a vignette for the printed look
    h, w = ink.shape
    yy, xx = np.mgrid[0:h, 0:w]
    vig = 1 - 0.35 * (((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a *= np.clip(vig, 0.55, 1)[..., None]
    a += (np.random.default_rng(i).random((h, w, 1)) - 0.5) * 8
    out = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))
    out.save(os.path.join(dst, n + '.jpg'), quality=78, optimize=True)
    print(n, os.path.getsize(os.path.join(dst, n + '.jpg')))
