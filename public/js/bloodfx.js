// 1.6.0: blood that looks like blood.
//  - fixModelBlood(scene): the killers' own files paint blood as a bright red splat: Granny's bat wears a "Blood" shell whose
//    texture is a red splat on WHITE (a JPEG, no transparency: the bat looked white), and Grandpa's club ("OldWoodBloody")
//    has a paint-red blob. The splat pixels are repainted as dark, wet, uneven blood; on the shell everything that isn't
//    blood becomes see-through (alpha test), so the wood shows.
//  - smearTexture(): a blood smear with drips and spatter (transparent elsewhere) for weapon blood after a hit.
import * as THREE from 'three';

const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// a cheap value noise for the colour variation
function noiseField(w, h, cell, seed = 1) {
  const gw = Math.ceil(w / cell) + 2, gh = Math.ceil(h / cell) + 2, g = new Float32Array(gw * gh);
  let s = seed * 9301 + 49297; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const fx = x / cell, fy = y / cell, ix = fx | 0, iy = fy | 0, tx = fx - ix, ty = fy - iy;
    const a = g[iy * gw + ix], b = g[iy * gw + ix + 1], c = g[(iy + 1) * gw + ix], d = g[(iy + 1) * gw + ix + 1];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
// blood colour for a 0..1 "wetness/depth": dried brown-maroon at the thin edges, deep wet red where it pools
function bloodRGB(depth, n) {
  const k = Math.max(0, Math.min(1, depth * 0.75 + n * 0.35));
  return [38 + 92 * k, 3 + 9 * k, 4 + 8 * k];
}

function repaint(img, shell) {
  const w = img.width, h = img.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
  const D = x.getImageData(0, 0, w, h), d = D.data;
  const n1 = noiseField(w, h, Math.max(8, w / 24), 3), n2 = noiseField(w, h, Math.max(3, w / 90), 7);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const r = d[i], g = d[i + 1], b = d[i + 2];
    const red = r - (g + b) * 0.5;          // how "blood red" the pixel is (the splat), 0 for wood / white / pale pink
    const k = sstep(48, 135, red);
    if (k <= 0) { if (shell) d[i + 3] = 0; continue; }
    const px = p % w, py = (p / w) | 0, n = n1(px, py) * 0.65 + n2(px, py) * 0.35;
    const [br, bg, bb] = bloodRGB(k, n);
    if (shell) { d[i] = br; d[i + 1] = bg; d[i + 2] = bb; d[i + 3] = Math.round(255 * Math.min(1, k * 1.25) * (0.75 + n * 0.25)); }
    else { const m = Math.min(1, k * 1.1); d[i] = r * (1 - m) + br * m; d[i + 1] = g * (1 - m) + bg * m; d[i + 2] = b * (1 - m) + bb * m; }
  }
  x.putImageData(D, 0, 0);
  return c;
}

const done = new WeakSet();
export function fixModelBlood(root) {
  root.traverse(o => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (!m || done.has(m) || !m.map || !m.map.image) continue;
      const nm = m.name || '';
      const shell = /^blood$/i.test(nm), soaked = /bloody/i.test(nm);
      if (!shell && !soaked) continue;
      done.add(m);
      try {
        const old = m.map, c = repaint(old.image, shell), t = new THREE.CanvasTexture(c);
        t.flipY = old.flipY; t.wrapS = old.wrapS; t.wrapT = old.wrapT; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = old.anisotropy; t.needsUpdate = true;
        m.map = t;
        if (shell) { m.transparent = false; m.alphaTest = 0.3; m.depthWrite = true; m.color.set(0xffffff); m.polygonOffset = true; m.polygonOffsetFactor = -1; }
        // wet: blood is glossy where it's fresh
        if ('roughness' in m) m.roughness = shell ? 0.22 : Math.min(m.roughness, 0.8);
        if ('metalness' in m) m.metalness = 0;
        m.needsUpdate = true;
      } catch (e) { console.warn('blood repaint', e); }
    }
  });
}

// a blood smear for a weapon (wraps around a cylinder: u = round, v = along): soaked band at the end, drips running down,
// spatter dots; transparent elsewhere
let smear = null;
export function smearTexture() {
  if (smear) return smear;
  const W = 256, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  let s = 4242; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const col = (a, k = 0.5) => { const [R, G, B] = bloodRGB(k, r()); return `rgba(${R | 0},${G | 0},${B | 0},${a})`; };
  // the soaked end (top of the texture), ragged lower edge
  x.fillStyle = col(0.95, 0.9); x.beginPath(); x.moveTo(0, 0); x.lineTo(W, 0);
  for (let i = 0; i <= 24; i++) x.lineTo(W - i * W / 24, 150 + r() * 70);
  x.closePath(); x.fill();
  // drips running down
  for (let i = 0; i < 16; i++) {
    const dx = r() * W, len = 60 + r() * 240, wd = 3 + r() * 7;
    x.fillStyle = col(0.9, 0.7); x.fillRect(dx - wd / 2, 140, wd, len);
    x.beginPath(); x.arc(dx, 140 + len, wd * 0.9, 0, Math.PI * 2); x.fill();
  }
  // spatter
  for (let i = 0; i < 160; i++) { const y = 140 + Math.pow(r(), 1.6) * 360; x.fillStyle = col(0.6 + r() * 0.35, r()); x.beginPath(); x.arc(r() * W, y, 0.8 + r() * 3.2 * (1 - y / H), 0, Math.PI * 2); x.fill(); }
  // darker clots and lighter wet highlights
  for (let i = 0; i < 60; i++) { x.fillStyle = `rgba(20,0,2,${0.15 + r() * 0.25})`; x.beginPath(); x.ellipse(r() * W, r() * 180, 4 + r() * 16, 2 + r() * 8, r() * 3, 0, Math.PI * 2); x.fill(); }
  smear = new THREE.CanvasTexture(c); smear.colorSpace = THREE.SRGBColorSpace; smear.wrapS = THREE.RepeatWrapping;
  return smear;
}
// a blood shell for a weapon from 'base' to 'tip' (positions in the same space): open cylinder, slightly bigger than the weapon
export function weaponBlood(base, tip, radius = 0.05) {
  const len = base.distanceTo(tip), g = new THREE.CylinderGeometry(radius, radius * 0.9, len, 14, 1, true);
  const m = new THREE.MeshStandardMaterial({ map: smearTexture(), transparent: true, alphaTest: 0.08, roughness: 0.2, metalness: 0, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(g, m);
  mesh.position.copy(base).lerp(tip, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tip.clone().sub(base).normalize());
  mesh.renderOrder = 6;
  return mesh;
}
