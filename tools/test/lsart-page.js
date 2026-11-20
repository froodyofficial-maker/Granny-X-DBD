// Art for the GTA-style loading screen (1.5.3, Vice Nights), 1920x1080: like GTA's loading-screen illustrations, a killer
// posed big in the foreground (rendered in-engine, sharp, on a transparent background, sunset rim light, ink outline) over
// a painted backdrop drawn here (sunset sky, sun, clouds, skyline, palms, a gas station / pier / street).
//   FRAMES=4 OUTDIR=/tmp/lsart PAGE=lsart-page.js node render-devlog.mjs     (then: python3 lsart.py /tmp/lsart public/img/ls)
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { loadGranny, loadGrandpa, loadSlendrina, loadNosferatu, loadVictimCar, makeVictimCar } from './js/grannyGlb.js';
import { PALM } from './__vicity-common.js';

const W = 1920, H = 1080, SS = 1.5;
let R, sc, cam, car, ground;
const A = {};
// per panel: the killer, its pose, where it stands in the picture (camera), the backdrop
const SHOTS = [
  { id: 'granny', st: { anim: 'idle', speed: 0, aim: true }, frames: 18, yaw: 0.55, cam: [0.15, 0.6, 3.5], at: [-0.8, 1.2, 0], scene: 'gas' },
  { id: 'grandpa', st: { anim: 'idle', speed: 0, aim: true }, frames: 40, yaw: -0.35, cam: [-0.2, 0.7, 3.0], at: [0.75, 1.15, 0], scene: 'street', car: true },
  { id: 'slendrina', st: { anim: 'idle', speed: 0, gaze: true }, frames: 40, yaw: 0.35, cam: [0.2, 0.7, 2.9], at: [-0.7, 1.15, 0], scene: 'pier' },
  { id: 'nosferatu', st: { anim: 'idle', speed: 0 }, frames: 40, yaw: -0.45, cam: [-0.3, 0.75, 3.9], at: [0.95, 1.15, 0], scene: 'roof' },
];
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa(), loadSlendrina(), loadNosferatu(), loadVictimCar()]);
  sc = new THREE.Scene();
  for (const s of SHOTS) { const r = makeKiller(s.id, {}); r.root.visible = false; r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } }); sc.add(r.root); A[s.id] = r; }
  car = makeVictimCar(); car.visible = false; car.traverse(o => { if (o.isMesh) o.castShadow = true; }); sc.add(car);
  // a ground that only shows shadows
  ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.45, color: 0x1a0320 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  // sunset lighting: a hot orange-pink sun behind (rim), a soft purple sky fill, a warm bounce from the front
  sc.add(new THREE.HemisphereLight(0xb58cff, 0x3a1030, 1.4));
  const sunL = new THREE.DirectionalLight(0xffa06a, 4.2); sunL.position.set(-4, 3.2, -5); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
  Object.assign(sunL.shadow.camera, { left: -4, right: 4, top: 4, bottom: -2, near: 0.5, far: 20 }); sc.add(sunL);
  const rim = new THREE.DirectionalLight(0xff3c9a, 3.2); rim.position.set(5, 2.5, -3); sc.add(rim);
  const key = new THREE.DirectionalLight(0xffd8c0, 1.7); key.position.set(1.5, 2.2, 4); sc.add(key);
  R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS); R.setClearColor(0x000000, 0);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.35; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(30, W / H, 0.05, 100);
  return true;
};

// ---------------- the painted backdrop ----------------
const rnd = (s => () => (s = (s * 16807) % 2147483647) / 2147483647)(7);
function sky(x, horizon) {
  const g = x.createLinearGradient(0, 0, 0, horizon);
  g.addColorStop(0, '#24104f'); g.addColorStop(0.32, '#5b2a86'); g.addColorStop(0.58, '#c2417f'); g.addColorStop(0.8, '#f2706a'); g.addColorStop(1, '#ffb26b');
  x.fillStyle = g; x.fillRect(0, 0, W, horizon + 2);
}
function sunDisc(x, cx, cy, r) {
  const g = x.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 3.2); g.addColorStop(0, 'rgba(255,214,140,.9)'); g.addColorStop(0.3, 'rgba(255,150,110,.35)'); g.addColorStop(1, 'rgba(255,120,120,0)');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const d = x.createLinearGradient(0, cy - r, 0, cy + r); d.addColorStop(0, '#fff1b0'); d.addColorStop(1, '#ffad5a');
  x.fillStyle = d; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill();
}
function clouds(x, n, y0, y1) {
  for (let i = 0; i < n; i++) {
    const cx = rnd() * W, cy = y0 + rnd() * (y1 - y0), w = 180 + rnd() * 420, h = 10 + rnd() * 22;
    const g = x.createLinearGradient(0, cy - h, 0, cy + h); g.addColorStop(0, 'rgba(255,190,200,.55)'); g.addColorStop(1, 'rgba(150,60,140,.35)');
    x.fillStyle = g; x.beginPath(); x.ellipse(cx, cy, w, h, 0, 0, Math.PI * 2); x.fill();
  }
}
function skyline(x, base, color, hMin, hMax, lit) {
  let px = -20;
  while (px < W + 20) {
    const w = 50 + rnd() * 110, h = hMin + rnd() * (hMax - hMin);
    x.fillStyle = color; x.fillRect(px, base - h, w, h + 2);
    if (rnd() < 0.25) x.fillRect(px + w * 0.4, base - h - 30, 4, 30); // antenna
    if (lit) for (let wy = base - h + 12; wy < base - 10; wy += 16) for (let wx = px + 8; wx < px + w - 10; wx += 13) if (rnd() < 0.22) { x.fillStyle = rnd() < 0.7 ? 'rgba(255,200,140,.85)' : 'rgba(120,230,255,.8)'; x.fillRect(wx, wy, 5, 7); x.fillStyle = color; }
    px += w + 2;
  }
}
function palmAt(x, cx, foot, h, flip, color = '#1c0a2a') {
  const k = h / 400;
  x.save(); x.translate(cx, foot); x.scale(flip ? -k : k, k); x.translate(-100, -400);
  x.fillStyle = color; for (const p of PALM) x.fill(p);
  x.restore();
}
function road(x, horizon) {
  const g = x.createLinearGradient(0, horizon, 0, H); g.addColorStop(0, '#3a1d4f'); g.addColorStop(1, '#14081f');
  x.fillStyle = g; x.fillRect(0, horizon, W, H - horizon);
  // kerb + lane marks in perspective
  x.strokeStyle = 'rgba(255,170,150,.35)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, horizon + 26); x.lineTo(W, horizon + 26); x.stroke();
  x.fillStyle = 'rgba(255,210,170,.55)';
  for (let i = 0; i < 9; i++) { const t = i / 9, y = horizon + 60 + t * t * (H - horizon), w = 40 + t * 260, h = 4 + t * 16; x.fillRect(W * 0.62 - w / 2 + t * 260, y, w, h); }
}
function gasStation(x, gx, base) {
  x.fillStyle = '#2a1238'; x.fillRect(gx, base - 150, 520, 26); // canopy
  x.fillStyle = '#ff4fa3'; x.fillRect(gx, base - 126, 520, 5);   // neon strip
  x.fillStyle = '#21102e'; for (const px of [40, 250, 460]) x.fillRect(gx + px, base - 124, 16, 124);
  x.fillStyle = '#2e1540'; x.fillRect(gx + 600, base - 120, 300, 120); // shop
  x.fillStyle = 'rgba(255,214,150,.75)'; x.fillRect(gx + 620, base - 90, 120, 60); x.fillRect(gx + 760, base - 90, 120, 60);
  x.fillStyle = '#1b0b26'; x.fillRect(gx + 940, base - 260, 14, 260); x.fillRect(gx + 880, base - 300, 140, 70); // sign
  x.fillStyle = '#ff9a3c'; x.font = 'bold 44px "Bebas Neue", sans-serif'; x.textAlign = 'center'; x.fillText('24/7', gx + 950, base - 248);
}
function pier(x, base) {
  x.fillStyle = '#3c2a6e'; x.fillRect(0, base - 4, W, 4);
  const sea = x.createLinearGradient(0, base, 0, H); sea.addColorStop(0, '#6b3a8c'); sea.addColorStop(0.4, '#2a1a55'); sea.addColorStop(1, '#120a26');
  x.fillStyle = sea; x.fillRect(0, base, W, H - base);
  x.fillStyle = 'rgba(255,190,140,.5)'; for (let i = 0; i < 40; i++) { const y = base + 8 + rnd() * 200, w = 40 + rnd() * 160; x.fillRect(W * 0.62 + (rnd() - 0.5) * 300 - w / 2, y, w, 3); }
  // the pier and a ferris wheel
  x.fillStyle = '#1d0c2b'; x.fillRect(W * 0.05, base - 40, W * 0.5, 22); for (let i = 0; i < 12; i++) x.fillRect(W * 0.05 + i * W * 0.04, base - 20, 8, 80);
  x.strokeStyle = '#1d0c2b'; x.lineWidth = 7; x.beginPath(); x.arc(W * 0.22, base - 220, 170, 0, Math.PI * 2); x.stroke();
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.beginPath(); x.moveTo(W * 0.22, base - 220); x.lineTo(W * 0.22 + Math.cos(a) * 170, base - 220 + Math.sin(a) * 170); x.lineWidth = 3; x.stroke(); x.fillStyle = '#ff4fa3'; x.beginPath(); x.arc(W * 0.22 + Math.cos(a) * 170, base - 220 + Math.sin(a) * 170, 9, 0, 7); x.fill(); }
  x.lineWidth = 9; x.beginPath(); x.moveTo(W * 0.22, base - 220); x.lineTo(W * 0.15, base - 40); x.moveTo(W * 0.22, base - 220); x.lineTo(W * 0.29, base - 40); x.stroke();
}
function rooftop(x, base) {
  x.fillStyle = '#1c0b28'; x.fillRect(0, base, W, H - base);
  x.fillStyle = '#2b1440'; x.fillRect(0, base - 8, W, 10);
  x.fillStyle = '#1c0b28'; x.fillRect(W * 0.08, base - 120, 120, 120); x.fillRect(W * 0.14, base - 170, 30, 50); // water tank / vent
  // a neon billboard
  x.fillStyle = '#160820'; x.fillRect(W * 0.04, base - 470, 560, 230); x.fillRect(W * 0.04 + 120, base - 240, 16, 240); x.fillRect(W * 0.04 + 420, base - 240, 16, 240);
  x.save(); x.shadowColor = '#ff2d95'; x.shadowBlur = 30; x.strokeStyle = '#ff5ab0'; x.lineWidth = 8; x.strokeRect(W * 0.04 + 20, base - 450, 520, 190);
  x.font = 'italic 110px "Bebas Neue", sans-serif'; x.textAlign = 'center'; x.fillStyle = '#ffe7f4'; x.fillText('VICE NIGHTS', W * 0.04 + 280, base - 315); x.restore();
}
function backdrop(x, kind) {
  const horizon = kind === 'pier' ? H * 0.6 : H * 0.64;
  sky(x, horizon);
  clouds(x, 14, H * 0.08, H * 0.42);
  sunDisc(x, kind === 'street' || kind === 'roof' ? W * 0.3 : W * 0.7, horizon - 190, 120);
  skyline(x, horizon, 'rgba(120,60,150,.75)', 120, 380, false);
  if (kind !== 'pier') skyline(x, horizon + 4, '#2a1238', 60, 260, true);
  if (kind === 'pier') pier(x, horizon);
  else if (kind === 'roof') rooftop(x, H * 0.72);
  else road(x, horizon);
  if (kind === 'gas') gasStation(x, W * 0.04, horizon + 40);
  // palms
  const P = { gas: [[W * 0.52, 0.62, false], [W * 0.6, 0.48, true], [W * 0.95, 0.9, true]], street: [[W * 0.05, 0.85, false], [W * 0.14, 0.6, true], [W * 0.46, 0.5, false]],
    pier: [[W * 0.4, 0.66, true], [W * 0.5, 0.5, false], [W * 0.97, 0.95, true]], roof: [[W * 0.58, 0.44, false], [W * 0.66, 0.36, true]] }[kind] || [];
  for (const [px, s, f] of P) palmAt(x, px, horizon + 40 + (s > 0.8 ? 300 : 0), H * s, f);
}
// the killer layer: a dark ink outline round the silhouette, then the render, a touch more saturated
function inked(x, img) {
  const c = document.createElement('canvas'); c.width = W; c.height = H; const y = c.getContext('2d');
  y.drawImage(img, 0, 0, W, H);
  const ink = document.createElement('canvas'); ink.width = W; ink.height = H; const z = ink.getContext('2d');
  z.drawImage(c, 0, 0); z.globalCompositeOperation = 'source-in'; z.fillStyle = '#12051c'; z.fillRect(0, 0, W, H);
  for (let a = 0; a < 16; a++) { const r = 4.5; x.drawImage(ink, Math.cos(a / 16 * 6.283) * r, Math.sin(a / 16 * 6.283) * r); }
  x.save(); x.filter = 'saturate(1.25) contrast(1.12)'; x.drawImage(c, 0, 0); x.restore();
}
window.frame = (i) => {
  const s = SHOTS[i % SHOTS.length];
  for (const k in A) A[k].root.visible = k === s.id;
  const r = A[s.id]; r.root.position.set(0, 0, 0); r.root.rotation.y = s.yaw;
  for (let k = 0; k < s.frames; k++) animate(r, s.st, 1 / 30);
  car.visible = !!s.car; if (s.car) { car.position.set(-1.0, 0, -2.6); car.rotation.y = -1.1; }
  cam.position.set(...s.cam); cam.lookAt(...s.at); cam.updateProjectionMatrix();
  R.render(sc, cam);
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  backdrop(x, s.scene);
  inked(x, R.domElement);
  // a light vignette for the printed look
  const v = x.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(20,4,30,.45)'); x.fillStyle = v; x.fillRect(0, 0, W, H);
  return c.toDataURL('image/png');
};
window.ready = true;
