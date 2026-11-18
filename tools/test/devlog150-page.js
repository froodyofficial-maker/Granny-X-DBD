// Devlog banner for 1.5.0 (1280x720 at 2x): City Mode. Granny in the middle of a Midnight City street, lit from behind by
// a Victim's Car's headlights; lit windows both sides; Slendrina's Father far down the road in the haze (Season 2 teaser).
// PAGE=devlog150-page.js OUT=devlog150.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny, loadFather, loadVictimCar, makeVictimCar } from './js/grannyGlb.js';
import { SURVIVORS, skinOf } from './js/config.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, A = {};
window.setup = async () => {
  await Promise.all([loadGranny(), loadFather(), loadVictimCar()]);
  const M = buildMap(11, 'city');
  const W0 = buildWorld(M, 'high'); sc = W0.scene;
  sc.fog.density *= 0.8;
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  const X = 11; // the street (road centre line x = 11), looking down it toward -z
  A.granny = makeKiller('granny', {}); A.granny.root.position.set(X + 0.3, 0, 19); A.granny.root.rotation.y = 0.12; shadows(A.granny); sc.add(A.granny.root);
  A.father = makeKiller('father', {}); A.father.root.position.set(X + 3.6, 0, -4); A.father.root.rotation.y = 0.35; sc.add(A.father.root);
  A.ped = makeSurvivor({ id: 'ped', skin: 0xe2b896, hair: 0x2a1a10, shirt: 0x4a5a6a, pants: 0x22262e, hairStyle: 'short' }, {}); A.ped.root.position.set(X + 4.6, 0, 24.5); A.ped.root.rotation.y = -1.2; sc.add(A.ped.root);
  // the Victim's Car behind her, headlights on her back
  const car = makeVictimCar(); car.position.set(X + 1.6, 0, 10.5); car.rotation.y = 0.18; sc.add(car);
  for (const s of [-1, 1]) {
    const hx = X + 1.6 + Math.cos(0.18) * s * 0.62 + Math.sin(0.18) * 2.2, hz = 10.5 - Math.sin(0.18) * s * 0.62 + Math.cos(0.18) * 2.2;
    const L = new THREE.SpotLight(0xfff0d0, 140, 40, 0.42, 0.45, 1.3); L.position.set(hx, 0.8, hz); L.target.position.set(hx + 1, 0.4, 32); L.castShadow = s > 0; L.shadow.mapSize.set(2048, 2048); sc.add(L, L.target);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xfff4dc, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(1.3); sp.position.set(hx, 0.8, hz + 0.05); sc.add(sp);
  }
  // her red rim from a neon sign, a cold moon on the father
  const red = new THREE.PointLight(0xff2a40, 14, 9, 1.6); red.position.set(X - 3.5, 3.2, 21); sc.add(red);
  const cold = new THREE.SpotLight(0x9ab0ff, 50, 30, 0.3, 0.6, 1.2); cold.position.set(X + 2, 9, 4); cold.target.position.set(X + 3.6, 1.5, -4); sc.add(cold, cold.target);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.45; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 300);
  logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'img/granny-logo.png'; });
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
let gT = null;
function glow() {
  if (gT) return gT;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.5)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (gT = new THREE.CanvasTexture(c));
}
window.frame = (mode) => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) {
    animate(A.granny, { anim: 'walk', speed: 1.4 }, dt);
    animate(A.father, { anim: 'idle', speed: 0 }, dt);
    animate(A.ped, { anim: 'run', speed: 4.2 }, dt);
  }
  cam.position.set(7.4, 1.35, 29.5); cam.lookAt(13.6, 2.6, 8); cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  const g1 = x.createLinearGradient(0, 0, W * 0.6, 0); g1.addColorStop(0, 'rgba(0,0,0,.9)'); g1.addColorStop(0.7, 'rgba(0,0,0,.4)'); g1.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.66, H * 0.5, H * 0.25, W * 0.66, H * 0.5, W * 0.72); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.65)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 250, lh = lw * logo.height / logo.width; x.drawImage(logo, 56, 42, lw, lh);
  x.font = '66px "IM Fell English SC"'; x.fillStyle = '#e8241c'; x.fillText('×', 56 + lw + 14, 42 + lh * 0.82); x.fillStyle = '#efe6d6'; x.fillText('DBD', 56 + lw + 58, 42 + lh * 0.82);
  x.font = '600 26px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#ffb040'; x.fillText('UPDATE 1.5.0 · SEASON 1 EVENT', 60, 250); x.letterSpacing = '0px';
  x.font = '150px "Bebas Neue"'; x.fillStyle = '#f2ebdf'; x.shadowColor = 'rgba(255,160,60,.35)'; x.shadowBlur = 30; x.fillText('CITY MODE', 52, 390);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  x.font = '44px "Bebas Neue"'; x.fillStyle = '#e8241c'; x.fillText('SHE CAME TO TOWN', 58, 446);
  const items = ['Hide in dumpsters, bins & portable toilets', "Drive the Victim's Cars · ram the killer", 'Pedestrians: catch them, run them over', 'Season 2 on 1 Dec: Slendrina\'s Father'];
  x.font = '600 25px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 512 + i * 38; x.fillStyle = i === 3 ? '#9ab0ff' : '#e8241c'; x.fillRect(60, y - 13, 9, 9); x.fillStyle = i === 3 ? '#c8d4ff' : '#d8cfc2'; x.fillText(s.toUpperCase(), 82, y); });
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
