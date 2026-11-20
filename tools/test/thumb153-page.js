// YouTube thumbnail for the 1.5.3 trailer (1280x720 at 2x): Granny close up on the right, lit hot pink and teal on a neon
// Midnight City street, the GTA VI logo big on the left, the GRANNY logo small above it. Next to no words to read.
//   PAGE=thumb153-page.js OUT=thumb153.png node render-devlog.mjs
// (MODE=devlog: the devlog thumbnail instead: Granny at the GTA VI desk, "1.5.3" and three short words)
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny } from './js/grannyGlb.js';
import { makeGameDesk, loadViceModels, gtaLogo } from './js/vice.js';
import { grade, sun, palm, loadImg, logoRow, gtaLogo as drawGta, eventLine } from './__vicity-common.js';

const W = 1280, H = 720, SS = 2, X = 11;
let R, sc, cam, logo, dbd, gta, G;
window.setup = async () => {
  await Promise.all([loadGranny(), loadViceModels()]); await gtaLogo();
  const M = buildMap(11, 'city');
  sc = buildWorld(M, 'high').scene; sc.fog.color.setHex(0x2a0f3a); sc.fog.density *= 0.7;
  G = makeKiller('granny', {}); G.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); sc.add(G.root);
  if (window.__dev) { G.root.position.set(X, -0.4, 20); G.root.rotation.y = Math.PI; const d = makeGameDesk(); d.position.set(X, 0, 20); d.rotation.y = Math.PI; sc.add(d); }
  else { G.root.position.set(X + 0.4, 0, 22); G.root.rotation.y = -0.35; }
  const L = (c, i, x, y, z, d = 10) => { const l = new THREE.PointLight(c, i, d, 1.3); l.position.set(x, y, z); sc.add(l); };
  L(0xff2d95, 55, X + 2.2, 2.2, 23.6); L(0x1fd1d9, 40, X - 1.6, 2.4, 22.8); L(0xffd0e8, 10, X + 0.6, 1.8, 25.5, 6);
  if (window.__dev) { L(0xff2d95, 40, X - 1.6, 2.2, 18.4); L(0x1fd1d9, 30, X + 1.8, 2.2, 18.8); L(0xffffff, 6, X, 1.5, 19.2, 3); }
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.5; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(window.__dev ? 40 : 34, W / H, 0.05, 300);
  [logo, dbd, gta] = await Promise.all([loadImg('img/granny-logo.png'), loadImg('__art/dbd.png'), loadImg('__art/gta6.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = () => {
  for (let i = 0; i < 30; i++) animate(G, { anim: 'idle', speed: 0 }, 1 / 30);
  if (window.__dev) { cam.position.set(X + 1.5, 2.0, 21.75); cam.lookAt(X - 1.15, 1.15, 19.25); }
  else { cam.position.set(X - 0.6, 1.15, 24.9); cam.lookAt(X - 0.55, 1.62, 21.5); }
  cam.updateProjectionMatrix(); R.render(sc, cam);
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  grade(x, W, H, H * 0.5);
  if (!window.__dev) {
    sun(x, W * 0.3, H * 0.52, 250, 0.42);
    const g1 = x.createLinearGradient(0, 0, W * 0.62, 0); g1.addColorStop(0, 'rgba(10,2,18,.78)'); g1.addColorStop(0.75, 'rgba(10,2,18,.25)'); g1.addColorStop(1, 'rgba(10,2,18,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
    palm(x, -40, H + 20, 560, { flip: true, color: '#0a0212' });
    logoRow(x, logo, dbd, W * 0.3, 34, 66);
    drawGta(x, gta, W * 0.3, 128, 520);
  } else {
    const g1 = x.createLinearGradient(0, 0, W * 0.65, 0); g1.addColorStop(0, 'rgba(10,2,18,.9)'); g1.addColorStop(0.65, 'rgba(10,2,18,.6)'); g1.addColorStop(1, 'rgba(10,2,18,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
    palm(x, -30, H + 20, 480, { flip: true, color: '#0a0212' });
    logoRow(x, logo, dbd, W * 0.27, 40, 62);
    drawGta(x, gta, W * 0.27, 128, 300);
    x.save(); x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.textAlign = 'center'; x.fillStyle = '#6fe7ee'; x.shadowColor = 'rgba(31,209,217,.8)'; x.shadowBlur = 10; x.fillText('UPDATE 1.5.3', W * 0.27 + 3, 482); x.restore();
    x.save(); x.font = '52px "Bebas Neue"'; x.letterSpacing = '3px'; x.textAlign = 'center'; x.fillStyle = '#fff0f8'; x.shadowColor = '#ff2d95'; x.shadowBlur = 22;
    x.fillText('GTA VI PASS', W * 0.27, 546); x.fillText('COLLECTABLES', W * 0.27, 600); x.fillText('LEADERBOARD', W * 0.27, 654); x.restore();
  }
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,0,16,.55)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  return c.toDataURL('image/png');
};
window.ready = true;
