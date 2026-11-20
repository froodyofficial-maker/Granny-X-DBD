// Game Jolt page header for Vice Nights (2000x400 at 1.5x = 3000x600): a Midnight City street at a neon sunset, the logo and
// VICE NIGHTS in the middle over a striped sun, Granny + Grandpa on the left, Slendrina + Angeline on the right, palms at the
// edges. Everything important stays in the middle ~60% (Game Jolt crops the sides on narrow screens).
// PAGE=gjheader152-page.js OUT=gjheader152.png node render-devlog.mjs
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny, loadGrandpa, loadSlendrina, loadAngeline } from './js/grannyGlb.js';
import { palm, badge, grade, sun, neonText } from './__vicity-common.js';

const W = 2000, H = 400, SS = 1.5;
let R, sc, cam, logo, A = {};
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa(), loadSlendrina(), loadAngeline()]);
  const M = buildMap(11, 'city');
  const W0 = buildWorld(M, 'high'); sc = W0.scene;
  sc.fog.color.setHex(0x3a1240); sc.fog.density *= 0.55;
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const X = 11, Z = 21;
  const put = (id, dx, dz, yaw) => { const r = makeKiller(id, {}); r.root.position.set(X + dx, 0, Z + dz); r.root.rotation.y = yaw; shadows(r); sc.add(r.root); return r; };
  A.granny = put('granny', -4.4, 0.2, 0.25); A.grandpa = put('grandpa', -6.6, -1.6, 0.35);
  A.slend = put('slendrina', 5.6, -0.6, -0.3); A.ang = put('angeline', 7.9, -2.2, -0.4);
  const pink = new THREE.PointLight(0xff2d95, 40, 16, 1.4); pink.position.set(X - 6, 3, Z + 3); sc.add(pink);
  const teal = new THREE.PointLight(0x1fd1d9, 40, 16, 1.4); teal.position.set(X + 7, 3, Z + 3); sc.add(teal);
  const back = new THREE.SpotLight(0xff7ac0, 120, 60, 0.6, 0.6, 1.2); back.position.set(X, 8, Z - 22); back.target.position.set(X, 1, Z); back.castShadow = true; back.shadow.mapSize.set(2048, 2048); sc.add(back, back.target);
  const front = new THREE.SpotLight(0xffe0f0, 30, 30, 0.8, 0.8, 1.2); front.position.set(X, 4, Z + 12); front.target.position.set(X, 1.2, Z); sc.add(front, front.target);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.55; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(24, W / H, 0.05, 400);
  logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'img/granny-logo.png'; });
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('italic 100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = (mode) => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) {
    animate(A.granny, { anim: 'walk', speed: 1.2 }, dt); animate(A.grandpa, { anim: 'idle', speed: 0, aim: i > 20 }, dt);
    animate(A.slend, { anim: 'idle', speed: 0 }, dt); animate(A.ang, { anim: 'idle', speed: 0, aim: true }, dt);
  }
  cam.position.set(11, 1.55, 35); cam.lookAt(11, 2.6, 0); cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  grade(x, W, H, H * 0.62);
  sun(x, W / 2, H * 0.47, 165, 0.6);
  // a darker band behind the words so they read, fading out to the characters
  const mid = x.createRadialGradient(W / 2, H * 0.5, 40, W / 2, H * 0.5, W * 0.3); mid.addColorStop(0, 'rgba(14,2,24,.62)'); mid.addColorStop(1, 'rgba(14,2,24,0)'); x.fillStyle = mid; x.fillRect(0, 0, W, H);
  const vg = x.createLinearGradient(0, 0, W, 0); vg.addColorStop(0, 'rgba(8,0,16,.75)'); vg.addColorStop(0.18, 'rgba(8,0,16,0)'); vg.addColorStop(0.82, 'rgba(8,0,16,0)'); vg.addColorStop(1, 'rgba(8,0,16,.75)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  palm(x, 70, H + 30, 470, { flip: true, tilt: 0.05, color: '#0a0212' }); palm(x, 230, H + 40, 330, { tilt: -0.08, color: '#0d0318' });
  palm(x, W - 70, H + 30, 480, { tilt: -0.05, color: '#0a0212' }); palm(x, W - 240, H + 40, 320, { flip: true, tilt: 0.08, color: '#0d0318' });
  // the logo, centred
  const lw = 330, lh = lw * logo.height / logo.width;
  x.font = '86px "IM Fell English SC"'; const xw = x.measureText('×').width, dw = x.measureText('DBD').width, tot = lw + 22 + xw + 22 + dw, x0 = (W - tot) / 2, ly = 52;
  x.save(); x.shadowColor = 'rgba(255,45,149,.75)'; x.shadowBlur = 22; x.drawImage(logo, x0, ly, lw, lh);
  x.fillStyle = '#ff2d95'; x.fillText('×', x0 + lw + 22, ly + lh * 0.82); x.fillStyle = '#fff0f8'; x.fillText('DBD', x0 + lw + 22 + xw + 22, ly + lh * 0.82); x.restore();
  // VICE NIGHTS + badge
  x.save(); x.font = 'italic 104px "Bebas Neue"'; const vw = x.measureText('VICE NIGHTS').width; x.restore();
  const bs = 84, gap = 22, row = bs + gap + vw, rx = (W - row) / 2, ry = 290;
  badge(x, rx + bs / 2, ry - 36, bs);
  x.save(); x.transform(1, 0, -0.12, 1, 0.12 * ry, 0); neonText(x, 'VICE NIGHTS', rx + bs + gap, ry, 'italic 104px "Bebas Neue"', '#fff0f8', '#ff2d95', 30); x.restore();
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '7px'; x.textAlign = 'center'; x.fillStyle = '#6fe7ee'; x.shadowColor = 'rgba(31,209,217,.8)'; x.shadowBlur = 10;
  x.fillText('LIMITED EVENT · EARN THE VI BADGE BEFORE 14 DECEMBER', W / 2 + 4, 350); x.shadowBlur = 0; x.letterSpacing = '0px'; x.textAlign = 'left';
  return c.toDataURL('image/png');
};
window.ready = true;
