// Devlog banner for 1.7.0 (1280x720 at 2x): Grandpa's execution "Last Round" a moment after the first shot, the survivor on
// their back in the new gore, Granny's House behind.   PAGE=devlog170-page.js OUT=devlog170.png node render-devlog.mjs
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './js/models.js';
import { loadScene, cloneScene } from './js/sceneGlb.js';
import { loadGranny, loadGrandpa } from './js/grannyGlb.js';
import { SURVIVORS } from './js/config.js';
import { MORI } from './js/mori.js';
import { torsoPoint, slashAt, jointWound, Gibs, BloodDecals } from './js/gore.js';
import { tex } from './js/textures.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, dbd, A = {};
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function lamp(gt) {
  const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0x2a2622, metalness: 0.5, roughness: 0.55 });
  const pm = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.castShadow = true; g.add(o); return o; };
  pm(new THREE.CylinderGeometry(0.2, 0.26, 0.22, 12), 0, 0.11, 0); pm(new THREE.CylinderGeometry(0.13, 0.18, 0.3, 12), 0, 0.37, 0);
  pm(new THREE.CylinderGeometry(0.055, 0.085, 2.9, 12), 0, 1.95, 0);
  for (const y of [0.55, 1.6, 3.35]) pm(new THREE.CylinderGeometry(0.09, 0.09, 0.06, 12), 0, y, 0);
  pm(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 6), 0.34, 3.32, 0, 0, 0, Math.PI / 2);
  pm(new THREE.TorusGeometry(0.16, 0.02, 6, 12, Math.PI), 0.2, 3.18, 0, 0, 0, Math.PI);
  pm(new THREE.ConeGeometry(0.2, 0.16, 4, 1), 0.66, 3.4, 0, 0, Math.PI / 4, 0); pm(new THREE.BoxGeometry(0.26, 0.03, 0.26), 0.66, 3.03, 0);
  const glassM = new THREE.MeshStandardMaterial({ color: 0xffe8b0, emissive: 0xffb050, emissiveIntensity: 0.8, transparent: true, opacity: 0.4, roughness: 0.1, depthWrite: false });
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2, p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.28), glassM); p.position.set(0.66 + Math.sin(a) * 0.12, 3.18, Math.cos(a) * 0.12); p.rotation.y = a; g.add(p); }
  for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) pm(new THREE.BoxGeometry(0.018, 0.3, 0.018), 0.66 + dx * 0.12, 3.18, dz * 0.12);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), new THREE.MeshStandardMaterial({ color: 0x332a1a, emissive: 0xffb050, emissiveIntensity: 4 })); bulb.position.set(0.66, 3.16, 0); g.add(bulb);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: gt, color: 0xffc070, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })); glow.scale.setScalar(1.6); glow.position.set(0.66, 3.16, 0); g.add(glow);
  const L = new THREE.PointLight(0xffb060, 26, 13, 1.5); L.position.set(0.66, 3.0, 0); L.castShadow = true; L.shadow.mapSize.set(1024, 1024); g.add(L);
  return g;
}
window.setup = async () => {
  await Promise.all([loadScene('granny_map'), loadGranny(), loadGrandpa()]);
  sc = new THREE.Scene(); sc.background = new THREE.Color(0x05060c); sc.fog = new THREE.FogExp2(0x0a0d16, 0.04);
  sc.add(new THREE.HemisphereLight(0x3a4666, 0x0e0806, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb4e6, 1.2); moon.position.set(-14, 26, 30); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); moon.target.position.set(0, 0, 18); sc.add(moon, moon.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x14170f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  sc.add(cloneScene('granny_map', false));
  const gt = glowTex('rgba(255,236,190,1)', 'rgba(255,170,60,0)');
  A.lamp = lamp(gt); A.lamp.position.set(6.4, 0, 18.6); A.lamp.rotation.y = Math.PI * 0.9; sc.add(A.lamp);
  // Grandpa at (2.6, 21.4) facing +x a little toward the camera; the victim on their back at his feet
  A.yaw = 1.25;
  A.gp = makeKiller('grandpa', {}); A.gp.root.position.set(2.2, 0, 21.4); A.gp.root.rotation.y = A.yaw; sc.add(A.gp.root);
  A.v = makeSurvivor(SURVIVORS.eli, {}); sc.add(A.v.root);
  for (const r of [A.gp, A.v]) r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  A.decals = new BloodDecals(sc, 80, tex('bloodatlas').map, false);
  A.gibs = new Gibs(sc, 60);
  const key = new THREE.SpotLight(0xdfe6ff, 80, 14, 0.5, 0.6, 1.4); key.position.set(0.8, 4.2, 26.5); key.target.position.set(3.0, 0.6, 21.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); sc.add(key, key.target);
  const red = new THREE.PointLight(0xff2412, 26, 10, 1.6); red.position.set(1.0, 2.4, 16.2); sc.add(red);
  const rim = new THREE.SpotLight(0xff5a30, 45, 14, 0.7, 0.6, 1.4); rim.position.set(1.2, 3.4, 16.5); rim.target.position.set(3, 1, 21.5); sc.add(rim, rim.target);
  const flash = new THREE.PointLight(0xffc070, 10, 4, 1.6); flash.position.set(3.0, 1.2, 21.7); sc.add(flash); // the muzzle flash
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.5; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(34, W / H, 0.05, 200);
  const img = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  [logo, dbd] = await Promise.all([img('img/granny-logo.png'), img('img/dbd-logo.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = () => {
  const dt = 1 / 30, f = 0.56, M = MORI.grandpa, yaw = A.yaw, F = { x: Math.sin(yaw), z: Math.cos(yaw) };
  const pl = M.place(f), kx = A.gp.root.position.x, kz = A.gp.root.position.z;
  A.v.root.position.set(kx + F.x * pl.d, 0, kz + F.z * pl.d); A.v.root.rotation.y = yaw + pl.yaw;
  for (let i = 0; i < 50; i++) { animate(A.gp, { anim: 'idle', speed: 0, exec: { f, char: 'grandpa', role: 'killer', ...M.killer(f) } }, dt); animate(A.v, { anim: 'exec', exec: { f, char: 'grandpa', role: 'victim' }, t: i * dt, speed: 0 }, dt); }
  if (!A.gore) {
    A.gore = true; const G = A.v.gore;
    if (G) { for (const [a, h] of [[0, 0.55], [0.4, 0.75], [-0.35, 0.35], [0.1, 0.15], [0.7, 0.5]]) G.add(torsoPoint(G, a, h), 0.12, { cut: slashAt(a, 1, 0.06, 0.03), drip: 0.5 }); jointWound(G, 'head', new THREE.Vector3(0, 0.05, 0.1), 0.04, { drip: 0.3 }); G.all = 0.35; for (const w of G.W) { w.r0 = w.r; w.drip = w.dripTo; w.age = 1; } G.update(0); }
    const vx = A.v.root.position.x, vz = A.v.root.position.z;
    const cx = vx - F.x * 0.35, cz = vz - F.z * 0.35; A.decals.add(cx, cz, 1.9, 1); A.decals.add(cx + F.x * 0.2, cz + F.z * 0.2, 1.3, 0); A.decals.mesh.material.color.setRGB(0.42, 0.3, 0.3); A.decals.mesh.material.emissiveIntensity = 0.3;
    for (let i = 0; i < 6; i++) { const a = yaw + (Math.random() - 0.5) * 3; A.decals.add(cx + Math.sin(a) * (0.7 + Math.random() * 0.6), cz + Math.cos(a) * (0.7 + Math.random() * 0.6), 0.7 + Math.random() * 0.6, 2, a); }
    A.gibs.burst(cx, 0.5, cz, 22, F.x, F.z, 2.2, 0); for (let i = 0; i < 90; i++) A.gibs.update(1 / 60);
    A.decals.update(0.5);
  }
  cam.position.set(2.0, 1.4, 27.5); cam.lookAt(1.4, 0.75, 21.6); cam.updateProjectionMatrix();
  R.render(sc, cam);
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  const g1 = x.createLinearGradient(0, 0, W * 0.58, 0); g1.addColorStop(0, 'rgba(0,0,0,.93)'); g1.addColorStop(0.68, 'rgba(0,0,0,.5)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.68, H * 0.5, H * 0.25, W * 0.68, H * 0.5, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // letterbox bars: it is a film now
  x.fillStyle = '#000'; x.fillRect(0, 0, W, 26); x.fillRect(0, H - 26, W, 26);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 230, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 48, lw, lh);
  x.font = '54px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 48 + lh * 0.72);
  const dw = 190, dh = dw * dbd.height / dbd.width; x.drawImage(dbd, 56 + lw + 54, 48 + lh / 2 - dh / 2, dw, dh);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#e8241c'; x.fillText('UPDATE 1.7.0', 60, 240); x.letterSpacing = '0px';
  x.font = '128px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(200,30,20,.45)'; x.shadowBlur = 30; x.fillText('EXECUTIONS', 52, 356);
  x.font = '96px "Bebas Neue"'; x.fillText('ON FILM', 54, 444);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '40px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('AND THE BLOOD TO GO WITH THEM', 58, 496);
  const items = ['Six cinematic executions, one per killer', 'Gore overhaul: gashes, blood, flesh', 'Collect and rewatch executions on your Profile', 'Custom Game: 17 killers vs 2, your rules'];
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 552 + i * 34; x.fillStyle = '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = '#d8cfc2'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  // the execution title card, like in the game
  x.textAlign = 'right'; x.font = '600 15px "Barlow Condensed"'; x.letterSpacing = '5px'; x.fillStyle = '#c23a30'; x.fillText('EXECUTION', W - 48, H - 92); x.letterSpacing = '0px';
  x.font = '44px "IM Fell English SC"'; x.fillStyle = '#efe6d6'; x.fillText('Last Round', W - 48, H - 50); x.textAlign = 'left';
  return c.toDataURL('image/png');
};
window.ready = true;
