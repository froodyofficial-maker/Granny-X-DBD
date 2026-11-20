// Art for the GTA-style loading screen (1.5.3, Vice Nights): four in-engine shots of the killers on a neon Midnight City
// street, later turned into comic-style panels by tools/test/lsart.py (flat colours + ink lines).
//   FRAMES=4 OUTDIR=/tmp/lsart PAGE=lsart-page.js node render-devlog.mjs
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny, loadGrandpa, loadSlendrina, loadAngeline, loadNosferatu } from './js/grannyGlb.js';

const W = 1280, H = 720, X = 11;
let R, sc, cam;
const SHOTS = [
  // killer, position, yaw, anim state, camera, look-at, light colours
  { id: 'granny', p: [X + 0.3, 0, 22], yaw: -0.25, st: { anim: 'walk', speed: 1.3 }, cam: [X - 0.75, 0.95, 24.1], at: [X - 0.35, 1.5, 21.6], L: [0xff2d95, 0x1fd1d9] },
  { id: 'grandpa', p: [X - 22, 0, 0.5], yaw: 0.5, st: { anim: 'idle', speed: 0, aim: true }, cam: [X - 21.15, 1.3, 2.35], at: [X - 22.45, 1.35, 0.2], L: [0x1fd1d9, 0xff9a3c] },
  { id: 'slendrina', p: [X, 0, -30], yaw: 0, st: { anim: 'idle', speed: 0, gaze: true }, cam: [X + 0.75, 1.3, -27.9], at: [X - 0.45, 1.3, -30.3], L: [0xb469ff, 0xff2d95] },
  { id: 'nosferatu', p: [X + 22, 0, 10], yaw: -0.6, st: { anim: 'idle', speed: 0, aim: true }, cam: [X + 20.75, 1.15, 11.55], at: [X + 22.05, 1.3, 9.6], L: [0xff2d95, 0xffb42e] },
];
const A = [];
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa(), loadSlendrina(), loadAngeline(), loadNosferatu()]);
  sc = buildWorld(buildMap(11, 'city'), 'high').scene; sc.fog.color.setHex(0x3a1240); sc.fog.density *= 0.55;
  for (const s of SHOTS) {
    const r = makeKiller(s.id, {}); r.root.position.set(...s.p); r.root.rotation.y = s.yaw; r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); sc.add(r.root); A.push(r);
    const [a, b] = s.L, [px, , pz] = s.p;
    const l1 = new THREE.PointLight(a, 60, 9, 1.3); l1.position.set(px - 1.6, 2.4, pz + 1.6); sc.add(l1);
    const l2 = new THREE.PointLight(b, 50, 9, 1.3); l2.position.set(px + 1.8, 2.2, pz - 0.4); sc.add(l2);
    const l3 = new THREE.PointLight(0xffe6f2, 12, 6, 1.3); l3.position.set(s.cam[0], s.cam[1] + 0.6, s.cam[2]); sc.add(l3);
  }
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.6; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(38, W / H, 0.05, 300);
  return true;
};
window.frame = (i) => {
  const s = SHOTS[i % SHOTS.length], r = A[i % SHOTS.length];
  for (let k = 0; k < 40; k++) animate(r, s.st, 1 / 30);
  cam.position.set(...s.cam); cam.lookAt(...s.at); cam.updateProjectionMatrix();
  R.render(sc, cam);
  return R.domElement.toDataURL('image/png');
};
window.ready = true;
