// City Mode: Midnight City's look (citymap.js / city.js). Streets, pavements and kerbs, lit buildings, street lights,
// the skyline past the fence, the hiding spots, and every frame the Victim's Cars and the pedestrians.
import * as THREE from 'three';
import { mat, mergeGeos, makeSurvivor, animate } from './models.js';
import { tex } from './textures.js';
import { makeVictimCar, skinModelReady } from './grannyGlb.js';
import { CITY, ROADS, ROAD_HALF, HIDE_KINDS } from './citymap.js';

const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
function ctex(c, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
function rnd(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---- textures ----
function asphalt() {
  const R = rnd(7);
  return canvas(256, 256, (x, w, h) => {
    x.fillStyle = '#26272a'; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const g = 28 + R() * 30 | 0; x.fillStyle = `rgb(${g},${g},${g + 2})`; x.fillRect(R() * w, R() * h, 1 + R() * 1.5, 1 + R() * 1.5); }
    x.strokeStyle = 'rgba(10,10,12,.55)'; x.lineWidth = 1;
    for (let i = 0; i < 6; i++) { x.beginPath(); let px = R() * w, py = R() * h; x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (R() - 0.5) * 40; py += (R() - 0.5) * 40; x.lineTo(px, py); } x.stroke(); }
  });
}
function paving() {
  const R = rnd(3);
  return canvas(256, 256, (x, w, h) => {
    x.fillStyle = '#5b5a56'; x.fillRect(0, 0, w, h);
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const g = 82 + R() * 22 | 0; x.fillStyle = `rgb(${g},${g - 2},${g - 6})`; x.fillRect(i * 64 + 2, j * 64 + 2, 60, 60); }
    for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.12})`; x.fillRect(R() * w, R() * h, 2, 2); }
  });
}
// facade: 8 m wide x 12.8 m tall (4 bays x 4 floors). Returns { map, emissive }
const FACADE = {
  brick: { wall: '#6e3a2c', mortar: '#4a2a22', frame: '#2a1a14', glass: '#1a1e24', lit: 0.3 },
  concrete: { wall: '#77746c', mortar: '#5e5c56', frame: '#3a3a3a', glass: '#161b22', lit: 0.25 },
  glass: { wall: '#1c2632', mortar: '#2e3a48', frame: '#3a4654', glass: '#0e1622', lit: 0.4 },
};
function facade(style, seed) {
  const F = FACADE[style] || FACADE.concrete, R = rnd(seed);
  const lit = [];
  const map = canvas(256, 512, (x, w, h) => {
    x.fillStyle = F.wall; x.fillRect(0, 0, w, h);
    if (style === 'brick') { x.fillStyle = F.mortar; for (let y = 0; y < h; y += 8) { x.fillRect(0, y, w, 1); for (let b = (y / 8) % 2 ? 0 : 12; b < w; b += 24) x.fillRect(b, y, 1, 8); } }
    if (style === 'concrete') { x.fillStyle = F.mortar; for (let y = 0; y < h; y += 128) x.fillRect(0, y + 120, w, 6); }
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const wx = i * 64 + (style === 'glass' ? 4 : 14), wy = j * 128 + (style === 'glass' ? 8 : 34), ww = style === 'glass' ? 56 : 36, wh = style === 'glass' ? 112 : 62;
      x.fillStyle = F.frame; x.fillRect(wx - 3, wy - 3, ww + 6, wh + 6);
      x.fillStyle = F.glass; x.fillRect(wx, wy, ww, wh);
      x.fillStyle = 'rgba(160,180,210,.08)'; x.fillRect(wx, wy, ww * 0.4, wh);
      if (R() < F.lit) lit.push([wx, wy, ww, wh, R()]);
    }
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(0,0,0,${R() * 0.15})`; x.fillRect(R() * w, R() * h, 2, 3); }
    // grime running down from the windows
    for (let i = 0; i < 40; i++) { const gx = R() * w, gy = R() * h; const g = x.createLinearGradient(0, gy, 0, gy + 60); g.addColorStop(0, 'rgba(0,0,0,.25)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(gx, gy, 3 + R() * 6, 60); }
  });
  const em = canvas(256, 512, (x, w, h) => {
    x.fillStyle = '#000'; x.fillRect(0, 0, w, h);
    for (const [wx, wy, ww, wh, k] of lit) {
      const warm = k < 0.75, g = x.createLinearGradient(0, wy, 0, wy + wh);
      g.addColorStop(0, warm ? '#ffcf7a' : '#9fc4ff'); g.addColorStop(1, warm ? '#c27a2a' : '#4a6aa8');
      x.fillStyle = g; x.fillRect(wx, wy, ww, wh);
      if (R() < 0.5) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(wx + ww * (0.3 + R() * 0.4), wy + wh * 0.4, ww * 0.18, wh * 0.6); } // someone at the window
    }
  });
  return { map: ctex(map), emissive: ctex(em) };
}

// ---- geometry helpers ----
function quadGeo(list) {
  // list of [p0, p1, p2, p3 (counter-clockwise from outside), u0, v0, u1, v1, nx, ny, nz]
  const pos = [], uv = [], nor = [], idx = [];
  for (const [a, b, c, d, u0, v0, u1, v1, nx, ny, nz] of list) {
    const i = pos.length / 3;
    pos.push(...a, ...b, ...c, ...d); uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
    for (let k = 0; k < 4; k++) nor.push(nx, ny, nz);
    idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
function buildingQuads(b, out, roof) {
  const x0 = b.x - b.hx, x1 = b.x + b.hx, z0 = b.z - b.hz, z1 = b.z + b.hz, h = b.h, U = 8, V = 12.8, o = (b.x * 0.37 + b.z * 0.21) % 8;
  out.push([[x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], o / U, 0, (o + x1 - x0) / U, h / V, 0, 0, 1]);
  out.push([[x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], o / U, 0, (o + x1 - x0) / U, h / V, 0, 0, -1]);
  out.push([[x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], o / U, 0, (o + z1 - z0) / U, h / V, 1, 0, 0]);
  out.push([[x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], o / U, 0, (o + z1 - z0) / U, h / V, -1, 0, 0]);
  roof.push([[x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], 0, 0, (x1 - x0) / 4, (z1 - z0) / 4, 0, 1, 0]);
}
const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(sx, sy, sz));

export function buildCity(W, M, quality) {
  const scene = W.scene, lite = quality === 'potato' || quality === 'low', half = M.half;
  const C = W.city = { cars: [], peds: [], hides: [], lights: [] };
  // ---------- ground: asphalt everywhere, pavements and kerbs round the blocks, grass in the parks ----------
  const asp = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 + 40, half * 2 + 40), new THREE.MeshStandardMaterial({ map: ctex(asphalt(), (half * 2 + 40) / 6, (half * 2 + 40) / 6), roughness: 0.82, metalness: 0.05, color: 0xb8b8b8 }));
  asp.rotation.x = -Math.PI / 2; asp.position.y = 0.006; asp.receiveShadow = true; scene.add(asp);
  const pave = [], grass = [], kerb = [];
  for (const c of M.cityCells) {
    const g = new THREE.PlaneGeometry(15, 15); g.rotateX(-Math.PI / 2); pave.push({ geo: g, matrix: M4(c.x, 0.014, c.z) });
    if (c.t === 'park' || c.t === 'open' || c.t === 'plaza') { const gg = new THREE.PlaneGeometry(c.t === 'park' ? 12.4 : 9, c.t === 'park' ? 12.4 : 9); gg.rotateX(-Math.PI / 2); grass.push({ geo: gg, matrix: M4(c.x, 0.02, c.z) }); }
    for (const [dx, dz, w, d] of [[0, 7.45, 15, 0.22], [0, -7.45, 15, 0.22], [7.45, 0, 0.22, 15], [-7.45, 0, 0.22, 15]]) kerb.push({ geo: new THREE.BoxGeometry(w, 0.13, d), matrix: M4(c.x + dx, 0.065, c.z + dz) });
  }
  const paveM = new THREE.MeshStandardMaterial({ map: ctex(paving(), 1, 1), roughness: 0.9 }); paveM.map.repeat.set(15 / 4, 15 / 4);
  const pm = new THREE.Mesh(mergeGeos(pave), paveM); pm.receiveShadow = true; scene.add(pm);
  if (grass.length) { const gt = tex('ground2'); const gm = new THREE.Mesh(mergeGeos(grass), new THREE.MeshLambertMaterial({ map: gt.map, color: 0x4a5a34 })); gm.receiveShadow = true; scene.add(gm); }
  const km = new THREE.Mesh(mergeGeos(kerb), mat(0x9a968e, { map: 'stone', rough: 0.9 })); km.receiveShadow = true; scene.add(km);
  // ---------- road markings: dashed centre lines and zebra crossings ----------
  const marks = [], zebra = [];
  for (const L of ROADS) for (let s = 0; s < ROADS.length - 1; s++) {
    const a = ROADS[s] + ROAD_HALF + 1.5, b = ROADS[s + 1] - ROAD_HALF - 1.5;
    for (let t = a; t + 2 <= b; t += 4.5) {
      const g1 = new THREE.PlaneGeometry(0.14, 2.2); g1.rotateX(-Math.PI / 2); marks.push({ geo: g1, matrix: M4(L, 0.018, t + 1.1) });
      const g2 = new THREE.PlaneGeometry(2.2, 0.14); g2.rotateX(-Math.PI / 2); marks.push({ geo: g2, matrix: M4(t + 1.1, 0.018, L) });
    }
  }
  for (const X of ROADS) for (const Z of ROADS) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    if (Math.abs(X + dx * 5) > half - 2 || Math.abs(Z + dz * 5) > half - 2) continue;
    for (let k = -2; k <= 2; k++) {
      const g = new THREE.PlaneGeometry(dx ? 2.2 : 0.5, dx ? 0.5 : 2.2); g.rotateX(-Math.PI / 2);
      zebra.push({ geo: g, matrix: M4(X + dx * 4.9 + (dx ? 0 : k * 1.2), 0.018, Z + dz * 4.9 + (dz ? 0 : k * 1.2)) });
    }
  }
  const lineM = new THREE.MeshLambertMaterial({ color: 0xd8c27a, transparent: true, opacity: 0.75, depthWrite: false });
  scene.add(new THREE.Mesh(mergeGeos(marks), lineM));
  scene.add(new THREE.Mesh(mergeGeos(zebra), new THREE.MeshLambertMaterial({ color: 0xcfcfc8, transparent: true, opacity: 0.6, depthWrite: false })));
  // ---------- buildings ----------
  const byStyle = {}, roofs = [];
  for (const b of M.boxes) if (b.kind === 'bldg') buildingQuads(b, byStyle[b.style] ||= [], roofs);
  let seed = 11;
  for (const st in byStyle) {
    const fx = facade(st, seed += 7);
    const m = new THREE.MeshStandardMaterial({ map: fx.map, emissiveMap: fx.emissive, emissive: 0xffffff, emissiveIntensity: 1.4, roughness: st === 'glass' ? 0.35 : 0.9, metalness: st === 'glass' ? 0.4 : 0 });
    const mesh = new THREE.Mesh(quadGeo(byStyle[st]), m); mesh.castShadow = true; mesh.receiveShadow = true; scene.add(mesh);
    C.windows = (C.windows || []).concat(m);
  }
  if (roofs.length) scene.add(new THREE.Mesh(quadGeo(roofs), mat(0x2e2e30, { map: 'metal', rough: 0.9 })));
  // neon signs over some of the shops and buildings
  const neonCols = [0xff2a5a, 0x2affd0, 0xffb02a, 0x8a5aff, 0xff4a2a];
  let ni = 0;
  for (const b of M.boxes) if (b.kind === 'bldg' && (ni++ % 2 === 0)) {
    const side = ni % 4, col = neonCols[ni % neonCols.length];
    const along = side < 2, sx = along ? Math.min(b.hx * 1.2, 3.2) : 0.08, sz = along ? 0.08 : Math.min(b.hz * 1.2, 3.2);
    const px = b.x + (side === 2 ? b.hx + 0.06 : side === 3 ? -b.hx - 0.06 : 0), pz = b.z + (side === 0 ? b.hz + 0.06 : side === 1 ? -b.hz - 0.06 : 0);
    const n = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.45, sz), new THREE.MeshStandardMaterial({ color: 0x111111, emissive: col, emissiveIntensity: 2.6 }));
    n.position.set(px, 3.6, pz); scene.add(n);
    if (!lite && C.lights.length < 4) { const l = new THREE.PointLight(col, 3, 9, 1.8); l.position.set(px + (side === 2 ? 1 : side === 3 ? -1 : 0), 3.2, pz + (side === 0 ? 1 : side === 1 ? -1 : 0)); scene.add(l); C.lights.push(l); }
  }
  // ---------- the skyline past the fence ----------
  {
    const R = rnd(M.seed + 5), list = [];
    for (let i = 0; i < (lite ? 50 : 110); i++) {
      const side = i % 4, along = (R() * 2 - 1) * (half + 50), out = half + 8 + R() * 50;
      const x = side < 2 ? along : side === 2 ? out : -out, z = side < 2 ? (side ? out : -out) : along;
      if (M.gates.some(g => Math.abs(x - g.x) < 9 && Math.sign(z) === g.dir && Math.abs(z) < half + 16)) continue;
      list.push({ x, z, w: 8 + R() * 14, d: 8 + R() * 14, h: 10 + R() * 38 });
    }
    const fx = facade('concrete', 99), fg = facade('glass', 98);
    for (const [k, F] of [[0, fx], [1, fg]]) {
      const L = list.filter((_, i) => i % 2 === k); if (!L.length) continue;
      F.map.repeat.set(2, 3); F.emissive.repeat.set(2, 3);
      const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ map: F.map, emissiveMap: F.emissive, emissive: 0xffffff, emissiveIntensity: 1.2, roughness: 0.9 }), L.length);
      L.forEach((b, i) => im.setMatrixAt(i, M4(b.x, 0, b.z, 0, b.w, b.h, b.d)));
      scene.add(im);
    }
  }
  // ---------- street lights (flicker and go out with the rest: W.lamps) ----------
  const postM = mat(0x24262a, { map: 'metal', metal: 0.6, rough: 0.5 }), poolTex = tex('glow').map;
  const postG = new THREE.CylinderGeometry(0.07, 0.1, 5.4, 8).translate(0, 2.7, 0), armG = new THREE.BoxGeometry(0.08, 0.08, 1.3).translate(0, 5.3, 0.6);
  const posts = [];
  for (const L of M.cityLamps) {
    // the arm leans out over the street
    posts.push({ geo: postG, matrix: M4(L.x, 0, L.z, L.yaw) }, { geo: armG, matrix: M4(L.x, 0, L.z, L.yaw) });
    const hx = L.x + Math.sin(L.yaw) * 1.2, hz = L.z + Math.cos(L.yaw) * 1.2;
    const bulbM = new THREE.MeshStandardMaterial({ color: 0x332a1a, emissive: 0xffc47a, emissiveIntensity: 3 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.6), bulbM); head.position.set(hx, 5.25, hz); head.rotation.y = L.yaw; scene.add(head);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.6, 24), new THREE.MeshBasicMaterial({ map: poolTex, color: 0xffb060, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.set(hx, 0.03, hz); scene.add(pool);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: poolTex, color: 0xffc070, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.setScalar(1.4); glow.position.set(hx, 5.1, hz); scene.add(glow);
    W.lamps.push({ bulbM, pool, glow, light: null, ph: L.x * 3 + L.z, op: 0.22 });
  }
  const pm2 = new THREE.Mesh(mergeGeos(posts), postM); pm2.castShadow = !lite; scene.add(pm2);
  // a few real lights that follow the camera round (the nearest street lights)
  if (!lite) for (let i = 0; i < (quality === 'high' ? 6 : 3); i++) { const l = new THREE.PointLight(0xffb870, 0, 13, 1.5); scene.add(l); C.lampLights = (C.lampLights || []).concat(l); }
  // ---------- statues, fountains ----------
  const stoneM = mat(0xa09a90, { map: 'stone', rough: 0.9 });
  for (const p of M.props || []) {
    if (p.kind === 'statue') {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
      const ped = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.4, 1.9), stoneM); ped.position.y = 0.7; g.add(ped);
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.8, 10), stoneM); body.position.y = 2.3; g.add(body);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), stoneM); head.position.y = 3.4; g.add(head);
      for (const s of [-1, 1]) { const wing = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.4, 0.8), stoneM); wing.position.set(s * 0.32, 2.7, -0.3); wing.rotation.z = s * 0.35; g.add(wing); }
      g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
    } else if (p.kind === 'fountain') {
      const g = new THREE.Group(); g.position.set(p.x, 0, p.z);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r + 0.1, 0.75, 24, 1, true), stoneM); rim.position.y = 0.375; g.add(rim);
      const water = new THREE.Mesh(new THREE.CircleGeometry(p.r - 0.05, 24), new THREE.MeshStandardMaterial({ color: 0x0c1a22, roughness: 0.1, metalness: 0.3 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.6; g.add(water);
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.25, 1.5, 10), stoneM); col.position.y = 0.75; g.add(col);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.2, 0.25, 16), stoneM); bowl.position.y = 1.5; g.add(bowl);
      scene.add(g);
    }
  }
  // ---------- hiding spots ----------
  const dumpM = mat(0x3f7a46, { map: 'metal', metal: 0.25, rough: 0.55, tint: 0.6 }), lidM = mat(0x22262a, { map: 'metal', metal: 0.3, rough: 0.7 });
  const binM = mat(0x3a3e42, { map: 'metal', metal: 0.5, rough: 0.5 }), loM = mat(0x1e5aa8, { map: 'metal', metal: 0.2, rough: 0.6 }), roofW = mat(0xd8d8d0, { rough: 0.7 });
  const boxM = mat(0xa07a4a, { map: 'boards', rough: 1 });
  for (const h of M.hides) {
    const g = new THREE.Group(), K = HIDE_KINDS[h.kind]; g.position.set(h.x, 0, h.z); g.rotation.y = h.yaw;
    let lid = null, door = null;
    if (h.kind === 'dumpster') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(K.hx * 2, K.h - 0.1, K.hz * 2), dumpM); body.position.y = (K.h - 0.1) / 2; g.add(body);
      lid = new THREE.Group(); lid.position.set(0, K.h - 0.08, -K.hz); g.add(lid);
      const l = new THREE.Mesh(new THREE.BoxGeometry(K.hx * 2 + 0.06, 0.06, K.hz * 2 + 0.04), lidM); l.position.z = K.hz; lid.add(l);
      for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 10).rotateZ(Math.PI / 2), lidM); w.position.set(s * (K.hx - 0.15), 0.09, s * 0.3); g.add(w); }
    } else if (h.kind === 'bin') {
      const body = new THREE.Mesh(new THREE.CylinderGeometry(K.r, K.r * 0.88, K.h - 0.08, 16), binM); body.position.y = (K.h - 0.08) / 2; g.add(body);
      lid = new THREE.Group(); lid.position.set(0, K.h - 0.06, -K.r); g.add(lid);
      const l = new THREE.Mesh(new THREE.CylinderGeometry(K.r + 0.03, K.r + 0.03, 0.06, 16), binM); l.position.z = K.r; lid.add(l);
    } else if (h.kind === 'toilet') {
      const body = new THREE.Mesh(new THREE.BoxGeometry(K.hx * 2, K.h - 0.1, K.hz * 2), loM); body.position.y = (K.h - 0.1) / 2; g.add(body);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(K.hx * 2 + 0.08, 0.12, K.hz * 2 + 0.08), roofW); roof.position.y = K.h - 0.05; g.add(roof);
      door = new THREE.Group(); door.position.set(-K.hx + 0.05, 0, K.hz + 0.02); g.add(door);
      const d = new THREE.Mesh(new THREE.BoxGeometry(K.hx * 2 - 0.12, K.h - 0.35, 0.04), mat(0x2a6ac0, { rough: 0.6 })); d.position.set(K.hx - 0.05, (K.h - 0.35) / 2 + 0.05, 0); door.add(d);
    } else {
      for (const [x, y, z, s, r] of [[-0.25, 0.32, -0.2, 0.64, 0.2], [0.3, 0.3, 0.2, 0.6, -0.3], [0, 0.9, 0, 0.56, 0.6]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), boxM); b.position.set(x, y, z); b.rotation.y = r; g.add(b); }
    }
    g.traverse(o => { if (o.isMesh) { o.castShadow = !lite; o.receiveShadow = true; } });
    scene.add(g);
    C.hides[h.id] = { g, lid, door, kick: 0 };
  }
  C.lite = lite;
  return C;
}

// ---- cars and pedestrians, every frame ----
function fallbackCar() {
  const g = new THREE.Group(), m = mat(0x6a2a20, { map: 'metal', metal: 0.4, rough: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.3), m); body.position.y = 0.65; g.add(body);
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.2), mat(0x1a1e22, { metal: 0.3, rough: 0.3 })); top.position.set(0, 1.25, -0.2); g.add(top);
  return g;
}
function carObj(scene) {
  const g = new THREE.Group(), body = makeVictimCar() || fallbackCar(); g.add(body);
  const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2c8, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow').map });
  const lamps = [];
  for (const s of [-1, 1]) { const sp = new THREE.Sprite(lampM); sp.scale.setScalar(0.7); sp.position.set(s * 0.62, 0.78, 2.2); g.add(sp); lamps.push(sp); }
  const tailM = new THREE.MeshBasicMaterial({ color: 0xff2010, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, map: tex('glow').map });
  for (const s of [-1, 1]) { const sp = new THREE.Sprite(tailM); sp.scale.setScalar(0.35); sp.position.set(s * 0.65, 0.85, -2.2); g.add(sp); }
  scene.add(g);
  return { g, body, lampM, tailM, real: skinModelReady('victim_car'), x: null };
}
const PED_SHIRTS = [0x4a5a6a, 0x7a3a2a, 0x2a3a2a, 0x8a7a5a, 0x3a2a4a, 0x5a5a5a, 0x9a8a7a, 0x2a2a3a];
const PED_PANTS = [0x22262e, 0x3a3226, 0x2a2a2a, 0x4a4a52, 0x1a1a22];
const PED_SKIN = [0xe2b896, 0xc89070, 0x8a5a3a, 0xf0c8a8, 0x6a4028];
const PED_HAIR = [0x1a120c, 0x3a2414, 0x6a5030, 0x8a8a8a, 0x2a1a10];
function pedRig(lk) {
  const def = { id: 'ped', name: 'Pedestrian', skin: PED_SKIN[lk % 5], hair: PED_HAIR[(lk >> 2) % 5], shirt: PED_SHIRTS[(lk >> 3) % 8], pants: PED_PANTS[(lk >> 5) % 5], hairStyle: ['short', 'long', 'cap', 'bun', 'short'][(lk >> 6) % 5] };
  return makeSurvivor(def, {});
}

// G: the Game. Draws the cars (your own from your own driving) and the pedestrians; opens the lids being searched
export function updateCity(G, S, dt, me) {
  const C = G.W && G.W.city; if (!C || !S.cars) return;
  const scene = G.scene;
  for (const c of S.cars) {
    let o = C.cars[c.id];
    if (!o || (!o.real && skinModelReady('victim_car'))) { if (o) scene.remove(o.g); o = C.cars[c.id] = carObj(scene); }
    const mine = me && me.car === c.id && G.drive && G.drive.id === c.id;
    const tx = mine ? G.drive.x : c.x, tz = mine ? G.drive.z : c.z, ty = mine ? G.drive.y : c.y;
    if (o.x == null || mine || Math.hypot(tx - o.x, tz - o.z) > 8) { o.x = tx; o.z = tz; o.y = ty; }
    else { const k = Math.min(1, dt * 12); o.x += (tx - o.x) * k; o.z += (tz - o.z) * k; let d = ty - o.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; o.y += d * k; }
    o.g.position.set(o.x, 0, o.z); o.g.rotation.y = o.y;
    const on = c.d != null || c.pd >= 0;
    o.lampM.opacity += ((on ? 0.9 : 0.12) - o.lampM.opacity) * Math.min(1, dt * 6);
    o.tailM.opacity = on ? (c.v < -0.2 || Math.abs(c.v) < 0.5 ? 0.85 : 0.45) : 0.12;
    // a little body roll and bounce while moving
    const v = Math.abs(c.v); o.body.position.y = v > 1 ? Math.sin(G.t * 17 + c.id) * 0.012 : 0;
  }
  // my headlights light the road
  if (me && me.car >= 0 && !C.lite) {
    if (!C.head) { C.head = new THREE.SpotLight(0xfff0d0, 40, 30, 0.5, 0.5, 1.2); scene.add(C.head, C.head.target); }
    const o = C.cars[me.car]; if (o) { const f = { x: Math.sin(o.y), z: Math.cos(o.y) }; C.head.position.set(o.x + f.x * 2.2, 1.0, o.z + f.z * 2.2); C.head.target.position.set(o.x + f.x * 14, 0, o.z + f.z * 14); C.head.intensity = 40; }
  } else if (C.head) C.head.intensity = 0;
  // pedestrians
  for (const q of S.peds || []) {
    let o = C.peds[q.id];
    if (!o || o.lk !== q.lk) { if (o) scene.remove(o.R.root); const R = pedRig(q.lk); scene.add(R.root); o = C.peds[q.id] = { R, lk: q.lk, x: q.x, z: q.z, y: q.y, fall: 0 }; }
    const R = o.R, vis = q.s !== 3;
    R.root.visible = vis; if (!vis) continue;
    const ox = o.x, oz = o.z;
    if (Math.hypot(q.x - o.x, q.z - o.z) > 6) { o.x = q.x; o.z = q.z; } else { const k = Math.min(1, dt * 10); o.x += (q.x - o.x) * k; o.z += (q.z - o.z) * k; }
    const sp = Math.hypot(o.x - ox, o.z - oz) / Math.max(dt, 1e-3);
    let d = q.y - o.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; o.y += d * Math.min(1, dt * 8);
    R.root.position.set(o.x, 0, o.z); R.root.rotation.y = o.y;
    if (q.s === 2) { o.fall = Math.min(1, o.fall + dt * 3); R.root.rotation.x = 0; animate(R, { anim: 'down', speed: 0, fallF: o.fall }, dt); }
    else { o.fall = 0; animate(R, { anim: q.s === 1 ? 'run' : sp > 0.3 ? 'walk' : 'idle', speed: q.s === 1 ? 4.3 : sp }, dt); }
  }
  // lids rattle when somebody climbs in or out, and fly open when searched
  for (const h of C.hides) if (h && h.kick > 0) {
    h.kick = Math.max(0, h.kick - dt);
    const a = Math.sin(Math.min(1, h.kick) * Math.PI) * (h.big ? 1.2 : 0.35);
    if (h.lid) h.lid.rotation.x = -a; if (h.door) h.door.rotation.y = -a * 1.4;
  }
  // the nearest street lights carry real light
  if (C.lampLights && me) {
    const f = G.camera.position;
    const near = G.M.cityLamps.map(L => ({ L, d: (L.x - f.x) ** 2 + (L.z - f.z) ** 2 })).sort((a, b) => a.d - b.d);
    C.lampLights.forEach((l, i) => { const n = near[i]; if (!n) return; const hx = n.L.x + Math.sin(n.L.yaw) * 1.2, hz = n.L.z + Math.cos(n.L.yaw) * 1.2; l.position.set(hx, 5.0, hz); l.intensity = 9 * (1 - (G.W.darkK || 0)); });
  }
}
export function cityHideFx(G, id, big) { const h = G.W && G.W.city && G.W.city.hides[id]; if (h) { h.kick = big ? 1.2 : 0.6; h.big = big; } }
