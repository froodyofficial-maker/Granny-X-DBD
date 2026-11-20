// Devlog banner for 1.5.2 (1280x720 at 2x): Vice Nights. Granny and Grandpa on a Midnight City street lit pink and teal by
// neon, a Victim's Car, the sky graded into a sunset with a striped sun, palm silhouettes. Left: GRANNY × DBD, the GTA VI logo, LIMITED TIME EVENT.
// PAGE=devlog152-page.js OUT=devlog152.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny, loadGrandpa, loadVictimCar, makeVictimCar } from './js/grannyGlb.js';
import { palm, grade, sun, loadImg, logoRow, gtaLogo, eventLine } from './__vicity-common.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, dbd, gta, A = {};
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa(), loadVictimCar()]);
  const M = buildMap(11, 'city');
  const W0 = buildWorld(M, 'high'); sc = W0.scene;
  sc.fog.color.setHex(0x2a0f3a); sc.fog.density *= 0.7;
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const X = 11; // the street (road centre line x = 11), looking down it toward -z
  A.granny = makeKiller('granny', {}); A.granny.root.position.set(X + 1.2, 0, 20.5); A.granny.root.rotation.y = 0.05; shadows(A.granny); sc.add(A.granny.root);
  A.grandpa = makeKiller('grandpa', {}); A.grandpa.root.position.set(X + 3.4, 0, 18.4); A.grandpa.root.rotation.y = -0.25; shadows(A.grandpa); sc.add(A.grandpa.root);
  const car = makeVictimCar(); car.position.set(X - 1.6, 0, 13.5); car.rotation.y = 0.5; sc.add(car);
  // neon: hot pink from the left, teal from the right, a magenta wash down the street
  const pink = new THREE.PointLight(0xff2d95, 36, 14, 1.4); pink.position.set(X - 2.5, 3.0, 21.5); sc.add(pink);
  const teal = new THREE.PointLight(0x1fd1d9, 30, 14, 1.4); teal.position.set(X + 6.5, 2.6, 19.5); sc.add(teal);
  const back = new THREE.SpotLight(0xff6ab8, 90, 40, 0.5, 0.6, 1.3); back.position.set(X + 2, 6, 6); back.target.position.set(X + 2, 1, 20); back.castShadow = true; back.shadow.mapSize.set(2048, 2048); sc.add(back, back.target);
  const key = new THREE.SpotLight(0xffd0e8, 40, 18, 0.5, 0.7, 1.2); key.position.set(X - 1, 3.5, 28); key.target.position.set(X + 2, 1.2, 19.5); sc.add(key, key.target);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.5; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 300);
  [logo, dbd, gta] = await Promise.all([loadImg('img/granny-logo.png'), loadImg('__art/dbd.png'), loadImg('__art/gta6.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('italic 100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = (mode) => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) { animate(A.granny, { anim: 'walk', speed: 1.3 }, dt); animate(A.grandpa, { anim: 'idle', speed: 0, aim: i > 20 }, dt); }
  cam.position.set(7.6, 1.3, 28.5); cam.lookAt(14.4, 2.4, 9); cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  grade(x, W, H, H * 0.55);
  sun(x, W * 0.78, H * 0.34, 115, 0.55);
  palm(x, W * 0.985, H + 10, 470, { tilt: -0.04 }); palm(x, W * 0.9, H + 20, 360, { tilt: 0.06, flip: true });
  // readable left side + vignette
  const g1 = x.createLinearGradient(0, 0, W * 0.6, 0); g1.addColorStop(0, 'rgba(10,2,18,.92)'); g1.addColorStop(0.7, 'rgba(10,2,18,.45)'); g1.addColorStop(1, 'rgba(10,2,18,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.66, H * 0.5, H * 0.3, W * 0.66, H * 0.5, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,0,16,.6)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  palm(x, -30, H + 10, 420, { flip: true, tilt: 0.05, color: '#0a0212' });
  // GRANNY × DBD, the GTA VI logo, LIMITED TIME EVENT (art/*.png = the official logos the owner sent; not committed)
  logoRow(x, logo, dbd, 300, 40, 84);
  gtaLogo(x, gta, 300, 158, 418);
  eventLine(x, 'LIMITED TIME EVENT', 300, 652, 52);
  return c.toDataURL('image/png');
};
window.ready = true;
