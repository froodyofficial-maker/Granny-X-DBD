// Devlog banner for 1.4.3 (1280x720 at 2x): Nosferatu leaping out of the dark in front of Granny's House at a survivor
// PAGE=devlog143-page.js OUT=devlog143.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './js/models.js';
import { loadScene, cloneScene } from './js/sceneGlb.js';
import { loadNosferatu } from './js/grannyGlb.js';
import { SURVIVORS, skinOf } from './js/config.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, A = {};
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
window.setup = async () => {
  await Promise.all([loadScene('granny_map'), loadNosferatu()]);
  sc = new THREE.Scene(); sc.background = new THREE.Color(0x020409); sc.fog = new THREE.FogExp2(0x060a12, 0.05);
  sc.add(new THREE.HemisphereLight(0x34425e, 0x0c0806, 0.5));
  const moon = new THREE.DirectionalLight(0x9fb4e6, 1.0); moon.position.set(-14, 26, 30); moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048);
  Object.assign(moon.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14 }); moon.target.position.set(0, 0, 18); sc.add(moon, moon.target);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: 0x12150f, roughness: 1 })); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  sc.add(cloneScene('granny_map', false));
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Nosferatu mid-leap, claws first, coming at the camera
  A.nos = makeKiller('nosferatu', {}); A.nos.root.position.set(2.6, 0.55, 20.6); A.nos.root.rotation.y = -0.25; shadows(A.nos); sc.add(A.nos.root);
  // a survivor running from him, half out of the light
  A.surv = makeSurvivor(SURVIVORS.june, skinOf('june', 'default')); A.surv.root.position.set(4.1, 0, 22.2); A.surv.root.rotation.y = -0.65; shadows(A.surv); sc.add(A.surv.root);
  // lights: cold rim from behind, a pale key on his face, the red of the house, his shadow thrown long
  const key = new THREE.SpotLight(0xd8e2ff, 70, 14, 0.42, 0.6, 1.4); key.position.set(1.0, 3.6, 26.0); key.target.position.set(2.6, 1.6, 20.6); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); sc.add(key, key.target);
  const rim = new THREE.SpotLight(0x7fa6ff, 90, 12, 0.6, 0.5, 1.3); rim.position.set(3.4, 4.2, 16.4); rim.target.position.set(2.6, 1.4, 20.6); sc.add(rim, rim.target);
  const red = new THREE.PointLight(0xff2412, 24, 10, 1.6); red.position.set(1.2, 2.4, 16.0); sc.add(red);
  const back = new THREE.SpotLight(0xff3a20, 30, 14, 0.7, 0.6, 1.4); back.position.set(0.4, 3.5, 15.4); back.target.position.set(1.0, 1, 20); sc.add(back, back.target);
  // mist and dust
  const gtex = glowTex('rgba(220,230,255,1)', 'rgba(160,180,255,0)');
  const n = 600, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = -3 + Math.random() * 10; pos[i * 3 + 1] = Math.random() * 3.6; pos[i * 3 + 2] = 17 + Math.random() * 9; }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  sc.add(new THREE.Points(dg, new THREE.PointsMaterial({ map: gtex, color: 0xc8d4ff, size: 0.03, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));
  const fogTex = glowTex('rgba(150,165,200,0.55)', 'rgba(150,165,200,0)');
  for (let i = 0; i < 14; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fogTex, transparent: true, opacity: 0.22, depthWrite: false })); s.position.set(-2 + Math.random() * 9, 0.3 + Math.random() * 0.5, 18 + Math.random() * 7); s.scale.set(5 + Math.random() * 3, 1.4, 1); sc.add(s); }
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
    animate(A.surv, { anim: 'run', speed: 4.6, t: i * dt }, dt);
  }
  cam.position.set(1.4, 1.25, 26.6); cam.lookAt(2.5, 1.45, 20.4); cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  const g1 = x.createLinearGradient(0, 0, W * 0.6, 0); g1.addColorStop(0, 'rgba(0,0,0,.92)'); g1.addColorStop(0.7, 'rgba(0,0,0,.45)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.68, H * 0.48, H * 0.25, W * 0.68, H * 0.48, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.7)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 250, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 42, lw, lh);
  x.font = '66px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 42 + lh * 0.82); x.fillStyle = '#efe6d6'; x.fillText('DBD', 56 + lw + 58, 42 + lh * 0.82);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#e8241c'; x.fillText('UPDATE 1.4.3 · NEW KILLER', 60, 250); x.letterSpacing = '0px';
  x.font = '150px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(120,150,255,.35)'; x.shadowBlur = 30; x.fillText('NOSFERATU', 52, 390);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '44px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('OUT OF THE FOREST', 58, 446);
  const items = ['Night Leap · crouch, then pounce from 11m', 'Nightfall · the dark swallows the map', 'Blood Scent · he smells the injured', '+ fixes for Windows, phones & online'];
  x.font = '600 25px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 512 + i * 38; x.fillStyle = '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = '#d8cfc2'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
