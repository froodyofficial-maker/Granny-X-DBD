// studio shots of game props (generator, chest) on a dark ground: PAGE=propview-page.js FRAMES=2 OUTDIR=... node render-devlog.mjs
import * as THREE from 'three';
import { makeGenerator, makeChest } from './js/models.js';
const W = 1280, H = 720;
let R, sc, cam, gen, chest;
window.setup = async () => {
  sc = new THREE.Scene(); sc.background = new THREE.Color(0x0c0e14);
  sc.add(new THREE.HemisphereLight(0x8090b0, 0x201814, 1.2));
  const k = new THREE.DirectionalLight(0xdfe6ff, 2.2); k.position.set(3, 5, 4); k.castShadow = true; sc.add(k);
  const w = new THREE.PointLight(0xffb060, 8, 6, 1.5); w.position.set(-1.5, 2, 1.5); sc.add(w);
  const gr = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.95 })); gr.rotation.x = -Math.PI / 2; gr.receiveShadow = true; sc.add(gr);
  gen = makeGenerator(); sc.add(gen); gen.userData.bulbs.forEach(b => b.material.emissiveIntensity = 2.5);
  try { chest = makeChest && makeChest(); if (chest) { chest.visible = false; sc.add(chest); } } catch (e) { chest = null; }
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); R.shadowMap.enabled = true; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.3; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(35, W / H, 0.05, 100);
  return true;
};
window.frame = (i) => {
  gen.visible = i === 0; if (chest) chest.visible = i === 1;
  if (i === 0) { cam.position.set(2.2, 1.6, 2.6); cam.lookAt(0, 0.7, 0); } else { cam.position.set(1.4, 1.1, 1.6); cam.lookAt(0, 0.35, 0); }
  R.render(sc, cam); return R.domElement.toDataURL('image/jpeg', 0.9);
};
window.ready = true;
