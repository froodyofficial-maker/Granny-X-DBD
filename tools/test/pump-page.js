// Grandpa's shotgun pump (1.6.0): aim pose, mid-pump, from the side. PAGE=pump-page.js FRAMES=1 OUTDIR=... node render-devlog.mjs
import * as THREE from 'three';
import { makeKiller, animate } from './js/models.js';
import { loadGrandpa, loadGranny, sawOffGun } from './js/grannyGlb.js';
const W = 1280, H = 720; let R, sc, cam, A, B;
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa()]);
  sc = new THREE.Scene(); sc.background = new THREE.Color(0x707c8c); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.2)); const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 4, 3); sc.add(d);
  A = makeKiller('grandpa', {}); A.root.position.x = -0.8; A.root.rotation.y = Math.PI / 2; sc.add(A.root);
  B = makeKiller('grandpa', {}); B.root.position.x = 0.8; B.root.rotation.y = Math.PI / 2; sc.add(B.root);
  sawOffGun(B.root);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 50);
  return true;
};
window.frame = () => {
  for (let i = 0; i < 30; i++) { animate(A, { anim: 'idle', speed: 0, aim: true }, 1 / 30); animate(B, { anim: 'idle', speed: 0, aim: true }, 1 / 30); }
  cam.position.set(0, 1.4, 4.2); cam.lookAt(0, 1.2, 0); R.render(sc, cam); return R.domElement.toDataURL('image/jpeg', 0.9);
};
window.ready = true;
