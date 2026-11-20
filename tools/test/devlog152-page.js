// Devlog banner for 1.5.2 (1280x720 at 2x): Vice Nights. Granny and Grandpa on a Midnight City street lit pink and teal by
// neon, a Victim's Car, the sky graded into a sunset with a striped sun, palm silhouettes, the VI badge. Text on the left.
// PAGE=devlog152-page.js OUT=devlog152.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny, loadGrandpa, loadVictimCar, makeVictimCar } from './js/grannyGlb.js';
import { palm, badge, grade, sun, neonText } from './__vicity-common.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, A = {};
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
  logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'img/granny-logo.png'; });
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
  // logo
  x.save(); x.shadowColor = 'rgba(255,45,149,.6)'; x.shadowBlur = 18;
  const lw = 240, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 40, lw, lh);
  x.font = '64px "IM Fell English SC"'; x.fillStyle = '#ff2d95'; x.fillText('×', 56 + lw + 14, 40 + lh * 0.82); x.fillStyle = '#fff0f8'; x.fillText('DBD', 56 + lw + 56, 40 + lh * 0.82); x.restore();
  // headline
  x.font = '600 25px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#6fe7ee'; x.shadowColor = 'rgba(31,209,217,.7)'; x.shadowBlur = 10; x.fillText('UPDATE 1.5.2 · LIMITED EVENT', 60, 238); x.shadowBlur = 0; x.letterSpacing = '0px';
  x.save(); x.transform(1, 0, -0.12, 1, 40, 0); neonText(x, 'VICE NIGHTS', 52, 372, 'italic 140px "Bebas Neue"', '#fff0f8', '#ff2d95', 34); x.restore();
  badge(x, 60 + 50, 440, 92);
  x.font = '40px "Bebas Neue"'; x.fillStyle = '#ffc04d'; x.shadowColor = 'rgba(255,150,40,.6)'; x.shadowBlur = 14; x.fillText('EARN THE VI BADGE', 172, 432); x.shadowBlur = 0;
  x.font = '600 21px "Barlow Condensed"'; x.letterSpacing = '2px'; x.fillStyle = '#f0d8ea'; x.fillText('BEFORE 14 DECEMBER · THEN IT\'S GONE FOREVER', 174, 462); x.letterSpacing = '0px';
  const items = ['Neon sunset theme for the menus', '25 escapes + 60 kills = the VI badge', 'Vice Legend title · badge shows online', 'Fixed: hiding spots in City Mode'];
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 538 + i * 36; x.fillStyle = i === 3 ? '#6fe7ee' : '#ff2d95'; x.shadowColor = x.fillStyle; x.shadowBlur = 8; x.fillRect(60, y - 13, 9, 9); x.shadowBlur = 0; x.fillStyle = '#efe0ea'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
