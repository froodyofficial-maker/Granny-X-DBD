// 1.6.0: the Tamed Crow (survivor sidekick, a community idea). It rides on its survivor's left shoulder, looks around,
// and every minute or so flies up high in circles (sim: p.crowF = flight time left), caws at the top (the killer's
// outline is shown to its owner) and comes back down.
// Model: public/models/crow.glb = "Granny granny 3 crow dvloper" by Gsjeijenjd (sketchfab.com/Gsjeijenjd), CC BY 4.0
// (the owner's upload; its PNG texture repacked as a JPEG). It is a static mesh with folded wings, so it gets a small rig
// here: bones for the head, the tail and both wings, with weights from where each vertex sits on the body. In flight the
// folded wings swing out and broad flight feathers (drawn in code) open along them.
import * as THREE from 'three';
import { loadStatic } from './glbModels.js';

export const LEN = 0.38; // beak to tail, metres (a big raven next to the survivors' heads)
const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// shapes in the xz plane (ShapeGeometry is xy; y becomes -z = backwards)
function flat(pts) { const s = new THREE.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (const [x, y] of pts.slice(1)) s.lineTo(x, y); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); return g; }
// a crow's wing: span along +x (0.345), trailing edge behind, fingered primaries at the tip
const WING = [[0, 0], [0.07, -0.012], [0.16, -0.012], [0.24, 0.0], [0.3, 0.02], [0.345, 0.05], [0.322, 0.062], [0.34, 0.085], [0.312, 0.09], [0.326, 0.118], [0.292, 0.112], [0.3, 0.14], [0.268, 0.128], [0.255, 0.15], [0.225, 0.135], [0.17, 0.14], [0.12, 0.128], [0.07, 0.115], [0.03, 0.09], [0, 0.06]];

let base = null; // { geo, mat, wingMat, piv: {head, tail, wing}, H, W }
export const crowReady = () => !!base;
export function loadCrow() {
  if (base) return Promise.resolve(base);
  return loadStatic('crow').then(t => { if (t && !base) base = rigCrow(t); return base; });
}
function rigCrow(t) {
  t.updateMatrixWorld(true);
  let mesh = null; t.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
  if (!mesh) return null;
  const g = mesh.geometry.clone(); g.applyMatrix4(mesh.matrixWorld);
  // turn it so the beak (the front of the highest part, the head) points to +z, feet at y 0, centred
  g.computeBoundingBox(); let b = g.boundingBox; const P = g.attributes.position;
  let hx = 0, hz = 0, n = 0; const top = b.max.y - (b.max.y - b.min.y) * 0.12;
  for (let i = 0; i < P.count; i++) if (P.getY(i) > top) { hx += P.getX(i); hz += P.getZ(i); n++; }
  const c = b.getCenter(new THREE.Vector3());
  g.translate(-c.x, 0, -c.z); g.rotateY(-Math.atan2(hx / n - c.x, hz / n - c.z));
  g.computeBoundingBox(); b = g.boundingBox; g.translate(0, -b.min.y, 0);
  const s = LEN / (b.max.z - b.min.z); g.scale(s, s, s); g.computeBoundingBox(); b = g.boundingBox;
  const L = b.max.z - b.min.z, H = b.max.y, W = b.max.x, z0 = b.min.z;
  // pivots (fractions of the body measured on the model)
  const piv = { head: new THREE.Vector3(0, H * 0.66, z0 + L * 0.74), tail: new THREE.Vector3(0, H * 0.42, z0 + L * 0.32), wing: new THREE.Vector3(W * 0.45, H * 0.72, z0 + L * 0.6) };
  // weights: bone 0 body, 1 head, 2 tail, 3 wing L (+x), 4 wing R
  const si = new Uint16Array(P.count * 4), sw = new Float32Array(P.count * 4);
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const wh = sstep(piv.head.z - L * 0.05, piv.head.z + L * 0.05, z) * sstep(H * 0.45, H * 0.62, y);
    const wt = (1 - sstep(piv.tail.z - L * 0.08, piv.tail.z + L * 0.02, z)) * (1 - wh);
    // the folded wing lies on the upper side of the body from the shoulder back
    const ww = 0; // (the folded wings stay on the body as its back plumage; in flight the code-drawn wings open)
    const rest = Math.max(0, 1 - wh - wt - ww);
    si.set([0, 1, 2, x >= 0 ? 3 : 4], i * 4); sw.set([rest, wh, wt, ww], i * 4);
  }
  g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
  const m0 = mesh.material, mat = m0.clone(); mat.side = THREE.DoubleSide; mat.roughness = 0.62; mat.metalness = 0;
  const wingMat = new THREE.MeshStandardMaterial({ color: 0x15161b, roughness: 0.85, metalness: 0, side: THREE.DoubleSide });
  return { geo: g, mat, wingMat, piv, H, W, L };
}

export function makeCrow() {
  if (!base) return null;
  const B = base, root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const bone = (p, parent) => { const o = new THREE.Bone(); o.position.copy(p); if (parent) { parent.add(o); o.position.sub(parent.userData.at); } o.userData.at = p.clone(); return o; };
  const b0 = bone(new THREE.Vector3(), null), head = bone(B.piv.head, b0), tail = bone(B.piv.tail, b0);
  const wl = bone(B.piv.wing, b0), wr = bone(B.piv.wing.clone().setX(-B.piv.wing.x), b0);
  for (const w of [wl, wr]) w.rotation.order = 'ZYX';
  const sk = new THREE.SkinnedMesh(B.geo, B.mat); sk.add(b0); sk.castShadow = true; sk.frustumCulled = false;
  body.add(sk); sk.updateMatrixWorld(true); sk.bind(new THREE.Skeleton([b0, head, tail, wl, wr]));
  // flight feathers on each wing bone: in the bone's rest frame the wing points back (like the folded one)
  const wings = [];
  for (const [w, s] of [[wl, 1], [wr, -1]]) {
    const holder = new THREE.Group(); holder.scale.x = s; w.add(holder);
    const f = new THREE.Mesh(flat(WING), B.wingMat); f.rotation.y = Math.PI / 2; f.scale.setScalar(1.08); f.castShadow = true; holder.add(f);
    holder.visible = false; wings.push({ w, s, holder });
  }
  root.userData = { body, head, tail, wings, t: Math.random() * 10, look: 0, lookT: 0, ruffle: 0, hop: 0 };
  return root;
}
// spread 0 (folded) .. 1, flap angle (+ = up)
function wingsPose(U, spread, flap) {
  for (const { w, s, holder } of U.wings) {
    w.rotation.set(0, -s * spread * 1.45, s * spread * flap);
    holder.visible = spread > 0.35; holder.scale.set(s * Math.max(0.01, spread), 1, 1);
  }
}
// perched: looks around in jerks, bobs its tail, now and then shakes out its wings or hops round
export function animateCrowPerched(crow, dt) {
  const U = crow.userData; U.t += dt; U.lookT -= dt;
  if (U.lookT <= 0) { U.look = (Math.random() - 0.5) * 2.0; U.tilt = (Math.random() - 0.5) * 0.5; U.lookT = 0.5 + Math.random() * 1.8; const r = Math.random(); if (r < 0.12) U.ruffle = 0.6; else if (r < 0.2) U.hop = 0.25; }
  U.head.rotation.y += (U.look - U.head.rotation.y) * Math.min(1, dt * 16);
  U.head.rotation.z += ((U.tilt || 0) - U.head.rotation.z) * Math.min(1, dt * 10);
  U.head.rotation.x = Math.sin(U.t * 1.7) * 0.05;
  U.tail.rotation.x = Math.sin(U.t * 2.3) * 0.08;
  U.ruffle = Math.max(0, U.ruffle - dt); U.hop = Math.max(0, U.hop - dt);
  wingsPose(U, U.ruffle > 0 ? 0.25 * Math.sin(U.ruffle / 0.6 * Math.PI) : 0, U.ruffle > 0 ? Math.sin(U.ruffle * 30) * 0.4 : 0);
  U.body.position.y = U.hop > 0 ? Math.sin(U.hop / 0.25 * Math.PI) * 0.05 : 0;
  U.body.rotation.x = 0;
}
// flying: climb > 0 going up (fast beats, nose up), < 0 gliding down
export function animateCrowFlying(crow, dt, climb) {
  const U = crow.userData; U.t += dt;
  const flap = climb > -0.2 ? Math.sin(U.t * (climb > 0 ? 20 : 13)) * (climb > 0 ? 0.75 : 0.5) : 0.12 + Math.sin(U.t * 3) * 0.05;
  wingsPose(U, 1, flap);
  U.head.rotation.set(0.15, 0, 0); U.tail.rotation.x = -0.1;
  U.body.position.y = 0; U.body.rotation.x = -climb * 0.35;
}
// where the crow is during a flight: u = 0..1 of the flight, from the shoulder up in a spiral to ~7 m and back
export function crowFlightOffset(u, out) {
  const h = Math.sin(u * Math.PI), a = u * Math.PI * 3;
  return out.set(Math.cos(a) * 2.6 * h, 7 * Math.pow(h, 0.8), Math.sin(a) * 2.6 * h);
}
