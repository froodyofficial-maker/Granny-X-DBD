// Devlog banner for 1.6.0 (1280x720 at 2x): Grandpa with the sawed-off shotgun by the new generator and lantern lamp, the
// Tamed Crow on the generator, Granny's House in the fog.   PAGE=devlog160-page.js OUT=devlog160.png node render-devlog.mjs
import * as THREE from 'three';
import { makeKiller, animate, makeGenerator } from './js/models.js';
import { loadScene, cloneScene } from './js/sceneGlb.js';
import { loadGranny, loadGrandpa, sawOffGun } from './js/grannyGlb.js';
import { loadCrow, makeCrow, animateCrowPerched } from './js/crow.js';

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
  await Promise.all([loadScene('granny_map'), loadGranny(), loadGrandpa(), loadCrow()]);
  sc = new THREE.Scene(); sc.background = new THREE.Color(0x05060c); sc.fog = new THREE.FogExp2(0x0a0d16, 0.04);
  sc.add(new THREE.HemisphereLight(0x3a4666, 0x0e0806, 0.55));
  const moon = new THREE.DirectionalLight(0x9fb4e6, 1.2); moon.position.set(-14, 26, 30); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); moon.target.position.set(0, 0, 18); sc.add(moon, moon.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x14170f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  sc.add(cloneScene('granny_map', false));
  const gt = glowTex('rgba(255,236,190,1)', 'rgba(255,170,60,0)');
  A.lamp = lamp(gt); A.lamp.position.set(5.9, 0, 18.4); A.lamp.rotation.y = Math.PI * 0.9; sc.add(A.lamp);
  A.gen = makeGenerator(); A.gen.position.set(4.9, 0, 20.3); A.gen.rotation.y = -0.6; A.gen.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); sc.add(A.gen);
  A.gp = makeKiller('grandpa', {}); A.gp.root.position.set(2.7, 0, 21.6); A.gp.root.rotation.y = 0.2; A.gp.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); sc.add(A.gp.root);
  A.crow = makeCrow(); A.crow.scale.setScalar(1.9); sc.add(A.crow); A.crow.traverse(o => { if (o.isMesh) o.castShadow = true; if (o.material && o.material.color) { o.material = o.material.clone(); o.material.color.multiplyScalar(0.42); o.material.roughness = 0.5; } });
  // a cold key on Grandpa, red from the house behind, the generator's bulbs
  const key = new THREE.SpotLight(0xdfe6ff, 70, 14, 0.45, 0.6, 1.4); key.position.set(0.5, 3.6, 26.5); key.target.position.set(3.2, 1.2, 21); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); sc.add(key, key.target);
  const red = new THREE.PointLight(0xff2412, 24, 10, 1.6); red.position.set(1.0, 2.4, 16.2); sc.add(red);
  const rim = new THREE.SpotLight(0xff5a30, 40, 14, 0.7, 0.6, 1.4); rim.position.set(1.5, 3.4, 16.5); rim.target.position.set(2.5, 1, 21); sc.add(rim, rim.target);
  const gl = new THREE.PointLight(0xffc060, 6, 4, 1.6); gl.position.set(4.9, 1.6, 20.6); sc.add(gl);
  const cl = new THREE.SpotLight(0xd8e0ff, 16, 7, 0.45, 0.6, 1.5); cl.position.set(2.6, 3.8, 24.5); cl.target.position.set(4.6, 1.6, 20.7); sc.add(cl, cl.target);
  const n = 500, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -2 + Math.random() * 9; pos[i * 3 + 1] = Math.random() * 3.8; pos[i * 3 + 2] = 16 + Math.random() * 9; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sc.add(new THREE.Points(dg, new THREE.PointsMaterial({ map: gt, color: 0xffe0b0, size: 0.03, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.45; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(34, W / H, 0.05, 200);
  const img = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = src; });
  [logo, dbd] = await Promise.all([img('img/granny-logo.png'), img('img/dbd-logo.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = () => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) animate(A.gp, { anim: 'idle', speed: 0, aim: true }, dt);
  if (!A.sawn) { A.sawn = true; sawOffGun(A.gp.root); }
  // the crow on top of the generator, looking at the camera
  sc.updateMatrixWorld(true); const bb = new THREE.Box3().setFromObject(A.gen.userData.body || A.gen), bc = bb.getCenter(new THREE.Vector3()); A.crow.position.set(bc.x - 0.25, bb.max.y - 0.01, bc.z + 0.25); A.crow.rotation.y = -1.45;
  animateCrowPerched(A.crow, 1 / 60); const U = A.crow.userData; U.head.rotation.set(0.05, 0.55, 0.08);
  cam.position.set(0.9, 1.1, 28.6); cam.lookAt(2.25, 1.2, 20.0); cam.updateProjectionMatrix();
  R.render(sc, cam);
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  const g1 = x.createLinearGradient(0, 0, W * 0.58, 0); g1.addColorStop(0, 'rgba(0,0,0,.93)'); g1.addColorStop(0.68, 'rgba(0,0,0,.5)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.68, H * 0.5, H * 0.25, W * 0.68, H * 0.5, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  // the official logos: GRANNY x DEAD BY DAYLIGHT
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 230, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 40, lw, lh);
  x.font = '54px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 40 + lh * 0.72);
  const dw = 190, dh = dw * dbd.height / dbd.width; x.drawImage(dbd, 56 + lw + 54, 40 + lh / 2 - dh / 2, dw, dh);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#e8241c'; x.fillText('UPDATE 1.6.0', 60, 236); x.letterSpacing = '0px';
  x.font = '128px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(200,30,20,.45)'; x.shadowBlur = 30; x.fillText('THE GRAPHICS', 52, 352); x.fillText('UPDATE', 52, 462);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '40px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('AND A CROW THAT WATCHES FOR HER', 58, 514);
  const items = ['Sharper, smoother, faster', 'Sidekick: the Tamed Crow', "Grandpa's perk: Sawed-Off", 'New taser add-ons'];
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 570 + i * 34; x.fillStyle = '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = '#d8cfc2'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
