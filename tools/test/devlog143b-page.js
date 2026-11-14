// Devlog banner for the full 1.4.3 update (1280x720 at 2x): Nosferatu leaping at a survivor in the new map, Slendrina: The
// Forest (its trees and the barn-house), her flashlight glowing UV violet (add-ons).
// PAGE=devlog143b-page.js OUT=devlog143b.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './js/models.js';
import { loadScene } from './js/sceneGlb.js';
import { buildMap, overlaps, losBlocked } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadNosferatu } from './js/grannyGlb.js';
import { SURVIVORS, skinOf } from './js/config.js';
import { FOREST } from './js/forestdata.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, A = {};
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
window.setup = async () => {
  await Promise.all([loadScene('forest_map'), loadNosferatu()]);
  const M = buildMap(3, 'forest');
  // keep the spots where the figures stand and the camera clear of trunks
  const spots = [[4.2, 15.2], [4.2, 20.6], [1.5, 24], [0.5, 26.5], [2.5, 22]];
  M.forestTrees = M.forestTrees.filter(i => { const t = FOREST.trees[i]; return spots.every(([x, z]) => Math.hypot(t.x - x, t.z - z) > 2.6); });
  // a clear spot for the camera behind her, with a straight view of him
  let best = null;
  for (const d of [11, 10, 9, 12, 8, 13]) for (const a of [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45]) {
    if (best) break;
    const bx = 4.2 + Math.sin(-0.32 + a) * d, bz = 15.2 + Math.cos(-0.32 + a) * d;
    if (!overlaps(M, bx, bz, 0.9) && !losBlocked(M, bx, bz, 4.2, 15.2, 1.5) && !losBlocked(M, bx, bz, 4.2, 20.6, 1.0)) best = [bx, bz];
  }
  window.__cam = best || [0.5, 26.5];
  M.forestTrees = M.forestTrees.filter(i => { const t = FOREST.trees[i]; return Math.hypot(t.x - window.__cam[0], t.z - window.__cam[1]) > 2.5; });
  const W0 = buildWorld(M, 'high'); sc = W0.scene;
  W0.moon.position.set(-20, 40, -30); W0.moon.target.position.set(4, 0, 14);
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Nosferatu mid-leap, claws first, coming at the camera
  A.nos = makeKiller('nosferatu', {}); A.nos.root.position.set(4.2, 0.5, 15.2); A.nos.root.rotation.y = 0.15; shadows(A.nos); sc.add(A.nos.root);
  // a survivor running from him, half out of the light
  A.surv = makeSurvivor(SURVIVORS.june, skinOf('june', 'default')); A.surv.root.position.set(4.2, 0, 20.6); A.surv.root.rotation.y = 3.05; shadows(A.surv); sc.add(A.surv.root);
  // lights: cold rim from behind, a pale key on his face, the red of the house, his shadow thrown long
  const key = new THREE.SpotLight(0xd8e2ff, 60, 14, 0.45, 0.6, 1.4); key.position.set(2.2, 4.2, 21.0); key.target.position.set(4.2, 1.6, 15.2); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); sc.add(key, key.target);
  const rim = new THREE.SpotLight(0x7fa6ff, 90, 12, 0.6, 0.5, 1.3); rim.position.set(4.6, 4.4, 10.6); rim.target.position.set(4.2, 1.4, 15.2); sc.add(rim, rim.target);
  const red = new THREE.PointLight(0xff2412, 18, 10, 1.6); red.position.set(1.0, 2.4, 9.5); sc.add(red);
  // her UV Torch (add-ons): a violet beam into his face
  const tx = 4.05, ty = 1.32, tz = 20.1, uv = new THREE.SpotLight(0xa070ff, 120, 12, 0.22, 0.4, 1.2); uv.position.set(tx, ty, tz); uv.target.position.set(4.2, 1.7, 15.2); sc.add(uv, uv.target);
  const glow = new THREE.PointLight(0x9a6aff, 6, 3, 2); glow.position.set(tx, ty, tz); sc.add(glow);
  { const L = 5.2, g = new THREE.ConeGeometry(Math.tan(0.2) * L, L, 24, 1, true); g.translate(0, -L / 2, 0); g.rotateX(-Math.PI / 2);
    const cm = new THREE.MeshBasicMaterial({ color: 0x7a4cff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    const cone = new THREE.Mesh(g, cm); cone.position.set(tx, ty, tz); cone.lookAt(4.2, 1.7, 15.2); sc.add(cone); }
  // mist and dust
  const gtex = glowTex('rgba(220,230,255,1)', 'rgba(160,180,255,0)');
  const n = 600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = 0 + Math.random() * 10; pos[i * 3 + 1] = Math.random() * 3.6; pos[i * 3 + 2] = 11 + Math.random() * 11; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sc.add(new THREE.Points(dg, new THREE.PointsMaterial({ map: gtex, color: 0xc8d4ff, size: 0.03, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  const fogTex = glowTex('rgba(150,165,200,0.55)', 'rgba(150,165,200,0)');
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, transparent: true, opacity: 0.22, depthWrite: false })); s.position.set(0 + Math.random() * 9, 0.3 + Math.random() * 0.5, 18 + Math.random() * 7 - 5); s.scale.set(5 + Math.random() * 3, 1.4, 1); sc.add(s); }
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.5; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(36, W / H, 0.05, 200);
  logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'img/granny-logo.png'; });
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = (mode) => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) {
    animate(A.nos, { anim: 'idle', speed: 0, leap: 0.45 }, dt);
    animate(A.surv, { anim: 'idle', speed: 0, t: i * dt }, dt);
  }
  const [cx0, cz0] = window.__cam; cam.position.set(cx0, 1.55, cz0);
  // aim left of him so he and she sit in the right half, clear of the words
  { const dx = 4.2 - cx0, dz = 15.2 - cz0, L = Math.hypot(dx, dz), a = Math.atan2(dx, dz) + 0.24; cam.lookAt(cx0 + Math.sin(a) * L, 1.9, cz0 + Math.cos(a) * L); } cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  const g1 = x.createLinearGradient(0, 0, W * 0.6, 0); g1.addColorStop(0, 'rgba(0,0,0,.92)'); g1.addColorStop(0.7, 'rgba(0,0,0,.45)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.68, H * 0.48, H * 0.25, W * 0.68, H * 0.48, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 250, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 42, lw, lh);
  x.font = '66px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 42 + lh * 0.82); x.fillStyle = '#efe6d6'; x.fillText('DBD', 56 + lw + 58, 42 + lh * 0.82);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#e8241c'; x.fillText('UPDATE 1.4.3', 60, 250); x.letterSpacing = '0px';
  x.font = '150px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(120,150,255,.35)'; x.shadowBlur = 30; x.fillText('NOSFERATU', 52, 390);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '44px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('+ SLENDRINA: THE FOREST', 58, 446);
  const items = ['New killer · Nosferatu: Night Leap & Nightfall', 'New map · Slendrina: The Forest', 'Item add-ons · UV Torch & more (idea: Ommm & WolfSpider)', 'Grandpa toned down · smarter bots · phone fixes'];
  x.font = '600 25px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 512 + i * 38; x.fillStyle = '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = '#d8cfc2'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
