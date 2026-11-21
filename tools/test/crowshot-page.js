// The Tamed Crow's store picture (1.6.0): PAGE=crowshot-page.js OUT=crow.png node render-devlog.mjs, then -> public/img/crow.jpg
// FRAMES=3 OUTDIR=... for a perched / mid-flight / spread check
import * as THREE from 'three';
import { makeCrow, loadCrow, animateCrowPerched, animateCrowFlying } from './js/crow.js';
const W = 640, H = 640; let R, sc, cam, crow;
window.setup = async () => {
  sc = new THREE.Scene();
  // a moonlit night: dark blue gradient, a pale moon, a dead branch
  const c = document.createElement('canvas'); c.width = 512; c.height = 512; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#1a2440'); g.addColorStop(0.65, '#0b1020'); g.addColorStop(1, '#05060a'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  const m = x.createRadialGradient(360, 150, 10, 360, 150, 160); m.addColorStop(0, 'rgba(230,235,255,1)'); m.addColorStop(0.28, 'rgba(210,220,255,0.95)'); m.addColorStop(0.32, 'rgba(160,180,230,0.35)'); m.addColorStop(1, 'rgba(60,80,140,0)');
  x.fillStyle = m; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 70; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; x.fillRect(Math.random() * 512, Math.random() * 300, 1.2, 1.2); }
  const bg = new THREE.CanvasTexture(c); bg.colorSpace = THREE.SRGBColorSpace; sc.background = bg;
  sc.add(new THREE.HemisphereLight(0x8aa0d0, 0x101018, 1.4));
  const moon = new THREE.DirectionalLight(0xc8d6ff, 5); moon.position.set(2, 2, -2.5); sc.add(moon);
  const key = new THREE.DirectionalLight(0xffe0c0, 2.6); key.position.set(-1.5, 1.5, 2.5); sc.add(key);
  const br = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0x2a1d14, roughness: 0.9 }));
  br.rotation.z = Math.PI / 2 + 0.1; br.position.set(0, -0.005, 0); sc.add(br);
  await loadCrow(); crow = makeCrow(); crow.rotation.y = 0.75; sc.add(crow);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H); R.toneMapping = THREE.ACESFilmicToneMapping; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(30, 1, 0.01, 20); cam.position.set(0.05, 0.22, 1.05); cam.lookAt(0, 0.14, 0);
  return true;
};
window.frame = i => {
  const U = crow.userData;
  if (i === 0) { crow.position.set(0, 0, 0); crow.rotation.set(0, 0.75, 0); animateCrowPerched(crow, 1 / 60); U.head.rotation.y = 0.5; U.head.rotation.x = 0.05; cam.position.set(0.05, 0.22, 1.05); cam.lookAt(0, 0.14, 0); }
  else {
    // flight checks from further away: 1 side (down-beat), 2 from behind/below (up-beat), 3 top (glide)
    U.t = i === 1 ? Math.PI / 2 / 20 : i === 2 ? -Math.PI / 2 / 20 : 0; animateCrowFlying(crow, 0, i === 3 ? -0.5 : 1);
    crow.position.set(0, 0.25, 0); crow.rotation.set(0, i === 1 ? Math.PI / 2 : i === 2 ? Math.PI * 0.85 : 0.3, 0);
    if (i === 3) { cam.position.set(0, 1.9, 0.01); cam.lookAt(0, 0.25, 0); } else { cam.position.set(0, i === 2 ? 0.05 : 0.35, 1.7); cam.lookAt(0, 0.3, 0); }
  }
  R.render(sc, cam); return R.domElement.toDataURL('image/jpeg', 0.92);
};
window.ready = true;
