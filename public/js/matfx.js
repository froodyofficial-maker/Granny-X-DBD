// 1.6.0: give flat, single-texture character models surface detail at load time (Angeline: one 1024x2048 atlas, no relief,
// fully matte, which made her look flat and washed out).
//  - a normal map built from the colour texture (its shading becomes relief: cloth weave, dirt, stains, creases)
//  - a roughness map (dark grime and blood rougher / glossier by brightness), and fabric sheen on a physical material
import * as THREE from 'three';

function lum(d, i) { return (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255; }
export function reliefMaps(img, strength = 2.2, folds = 0) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0); const src = x.getImageData(0, 0, w, h).data;
  // height: brightness (soft) + optional long vertical folds
  const H = new Float32Array(w * h);
  for (let y = 0, p = 0; y < h; y++) for (let i = 0; i < w; i++, p++) H[p] = lum(src, p * 4) + (folds ? Math.sin(i / w * Math.PI * 2 * folds) * 0.11 + Math.sin(i / w * Math.PI * 2 * folds * 2.7 + 1.3) * 0.045 : 0);
  // a light blur so the relief follows shapes, not pixel noise
  const B = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    let s = 0, n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, i + dx)); s += H[yy * w + xx]; n++; }
    B[y * w + i] = s / n;
  }
  const N = x.createImageData(w, h), nd = N.data, R = x.createImageData(w, h), rd = R.data;
  for (let y = 0; y < h; y++) for (let i = 0; i < w; i++) {
    const p = y * w + i, l = B[y * w + Math.max(0, i - 1)], r = B[y * w + Math.min(w - 1, i + 1)], u = B[Math.max(0, y - 1) * w + i], d = B[Math.min(h - 1, y + 1) * w + i];
    let nx = (l - r) * strength, ny = (u - d) * strength, nz = 1; const k = 1 / Math.hypot(nx, ny, nz); nx *= k; ny *= k; nz *= k;
    nd[p * 4] = (nx * 0.5 + 0.5) * 255; nd[p * 4 + 1] = (ny * 0.5 + 0.5) * 255; nd[p * 4 + 2] = (nz * 0.5 + 0.5) * 255; nd[p * 4 + 3] = 255;
    // roughness (green channel, as three.js reads it): 0.55..0.95, darker grime rougher, saturated red (blood) glossy
    const q = p * 4, red = Math.max(0, (src[q] - (src[q + 1] + src[q + 2]) * 0.5) / 255), L = lum(src, q);
    const rough = Math.max(0.3, Math.min(0.95, 0.62 + (0.5 - L) * 0.35 - red * 0.9));
    rd[q] = rd[q + 1] = rd[q + 2] = rough * 255; rd[q + 3] = 255;
  }
  const mk = data => { const cc = document.createElement('canvas'); cc.width = w; cc.height = h; cc.getContext('2d').putImageData(data, 0, 0); const t = new THREE.CanvasTexture(cc); t.colorSpace = THREE.NoColorSpace; return t; };
  return { normalMap: mk(N), roughnessMap: mk(R) };
}

// swap a character's materials for physical ones with relief, roughness variation and a fabric sheen
export function enhanceCharacter(root, { strength = 2.2, sheen = 0.6, sheenColor = 0xf2e8f0, tone = 0.88, folds = 0 } = {}) {
  const made = new Map();
  root.traverse(o => {
    if (!o.isMesh) return;
    const m = o.material; if (!m || !m.map || !m.map.image) return;
    if (!made.has(m)) {
      const { normalMap, roughnessMap } = reliefMaps(m.map.image, strength, folds);
      for (const t of [normalMap, roughnessMap]) { t.flipY = m.map.flipY; t.wrapS = m.map.wrapS; t.wrapT = m.map.wrapT; t.anisotropy = m.map.anisotropy; }
      const p = new THREE.MeshPhysicalMaterial({
        map: m.map, color: new THREE.Color(tone, tone, tone), normalMap, normalScale: new THREE.Vector2(1, 1), roughness: 1, roughnessMap, metalness: 0,
        sheen, sheenColor: new THREE.Color(sheenColor), sheenRoughness: 0.65, side: m.side, transparent: m.transparent, alphaTest: m.alphaTest, name: m.name,
      });
      made.set(m, p);
    }
    o.material = made.get(m);
  });
}
