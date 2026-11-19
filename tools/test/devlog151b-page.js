// Devlog banner for 1.5.1, take 2 (1280x720 at 2x): in the yard of Granny's Old House, a survivor pepper-sprays Granny in the
// face at arm's length (an orange cloud, Granny reeling), a teammate further back drawn with the new continuous outline.
// Text on the right this time, warm orange instead of red.
// PAGE=devlog151b-page.js OUT=devlog151b.png node render-devlog.mjs   (window.frame('raw') = the 3D render alone)
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate, auraParts, AURA_T } from './js/models.js';
import { loadScene } from './js/sceneGlb.js';
import { buildMap, overlaps } from './js/map.js';
import { buildWorld } from './js/world.js';
import { loadGranny } from './js/grannyGlb.js';
import { SURVIVORS, skinOf } from './js/config.js';

const W = 1280, H = 720, SS = 2;
let R, sc, cam, logo, A = {}, P0;
function glowTex(c0, c1) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
window.setup = async () => {
  await Promise.all([loadScene('granny1_map'), loadGranny()]);
  const M = buildMap(5, 'granny1');
  // an open patch of yard: the survivors' spawn corner, with room for the camera on the left
  const sp = M.spawns.survivors[0];
  let base = null;
  for (let r = 0; r < 40 && !base; r += 0.5) for (let a = 0; a < 16 && !base; a++) {
    const x = sp.x + Math.cos(a / 16 * 6.28) * r, z = sp.z + Math.sin(a / 16 * 6.28) * r;
    const clear = [[0, 0], [0, -2.1], [-6.2, -1.0], [7, 2.6], [-3, -1.0], [3, -0.5]].every(([dx, dz]) => !overlaps(M, x + dx, z + dz, 0.9));
    // (and no tree near the camera or between it and them: their branches filled the frame)
    const noTree = M.trees.every(t => Math.hypot(t.x - (x - 6.2), t.z - (z - 1)) > 4.5 && Math.hypot(t.x - (x - 3), t.z - (z - 1)) > 3.5 && Math.hypot(t.x - x, t.z - (z - 1)) > 3
      && [0.2, 0.4, 0.6, 0.8].every(f => Math.hypot(t.x - (x - 6.2 + 6.2 * f), t.z - (z - 1 - 1.1 * f)) > 2.6 && Math.hypot(t.x - (x - 6.2 + 6.2 * f), t.z - (z - 1 + 1 * f)) > 2.2));
    if (clear && noTree) base = { x, z };
  }
  P0 = base || sp;
  const W0 = buildWorld(M, 'high'); sc = W0.scene;
  sc.fog.density *= 0.75;
  // clear scattered plants (instanced bushes, grass clumps, trees) from in front of the camera and its view of the two of them
  { const cx = P0.x - 6.2, cz = P0.z - 1, m = new THREE.Matrix4(), p = new THREE.Vector3(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
    const near = (x, z) => { for (let f = 0; f <= 1.0001; f += 0.1) { const lx = cx + 6.2 * f; if (Math.hypot(x - lx, z - (cz - 1.1 * f)) < 3.6 || Math.hypot(x - lx, z - (cz + 1 * f)) < 2.4) return true; } return Math.hypot(x - cx, z - cz) < 5; };
    sc.traverse(o => { if (!o.isInstancedMesh) return; let ch = false; for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (near(p.x, p.z) && p.y < 3) { o.setMatrixAt(i, zero); ch = true; } } if (ch) o.instanceMatrix.needsUpdate = true; }); }
  const shadows = r => r.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  // Granny reeling back, the survivor (June) with her arm out, a teammate (Eli) behind, outlined
  A.granny = makeKiller('granny', {}); A.granny.root.position.set(P0.x, 0, P0.z - 2.1); A.granny.root.rotation.y = -0.55; shadows(A.granny); sc.add(A.granny.root);
  A.june = makeSurvivor(SURVIVORS.june, skinOf('june', 'default')); A.june.root.position.set(P0.x + 0.15, 0, P0.z); A.june.root.rotation.y = Math.PI - 0.05; shadows(A.june); sc.add(A.june.root);
  A.eli = makeSurvivor(SURVIVORS.eli, skinOf('eli', 'default')); A.eli.root.position.set(P0.x + 7, 0, P0.z + 2.6); A.eli.root.rotation.y = 0.4; sc.add(A.eli.root);
  A.eli.setAura(0xe8d8a0); for (const a of A.eli.aura) auraParts(a);
  // the can in her hand
  const can = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xc8401a, metalness: 0.5, roughness: 0.35 })); can.add(body);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.04, 10), new THREE.MeshStandardMaterial({ color: 0x111111 })); cap.position.y = 0.1; can.add(cap);
  can.position.set(P0.x + 0.12, 1.38, P0.z - 0.5); can.rotation.x = -1.2; sc.add(can);
  // the spray: a cone of orange mist from the can to her face
  const mist = glowTex('rgba(255,150,60,0.9)', 'rgba(255,90,20,0)');
  for (let i = 0; i < 70; i++) {
    const f = Math.random(), s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mist, color: f < 0.5 ? 0xffb070 : 0xff7a30, transparent: true, opacity: 0.32 * (1.1 - f * 0.6), depthWrite: false }));
    const spread = 0.05 + f * 0.45;
    s.position.set(P0.x + 0.1 + (Math.random() - 0.5) * spread, 1.42 + f * 0.18 + (Math.random() - 0.5) * spread, P0.z - 0.6 - f * 1.35);
    s.scale.setScalar(0.12 + f * 0.6); sc.add(s);
  }
  // light: hot orange on her face from the spray, a cold moon rim, the house's warm window behind
  const hot = new THREE.PointLight(0xff8a3a, 18, 6, 1.6); hot.position.set(P0.x, 1.6, P0.z - 1.3); sc.add(hot);
  const key = new THREE.SpotLight(0xffd8b0, 60, 14, 0.5, 0.6, 1.4); key.position.set(P0.x - 3.5, 3.4, P0.z + 1.5); key.target.position.set(P0.x, 1.4, P0.z - 1.5); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); sc.add(key, key.target);
  const rim = new THREE.SpotLight(0x8fb0ff, 70, 14, 0.6, 0.5, 1.3); rim.position.set(P0.x + 2.5, 4, P0.z - 5); rim.target.position.set(P0.x, 1.4, P0.z - 1.5); sc.add(rim, rim.target);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, stencil: true }); R.setSize(W * SS, H * SS);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.4; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 300);
  logo = await new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = 'img/granny-logo.png'; });
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
window.frame = (mode) => {
  const dt = 1 / 30;
  for (let i = 0; i < 40; i++) {
    animate(A.granny, { anim: 'idle', speed: 0, stun: true }, dt);
    animate(A.june, { anim: 'idle', speed: 0 }, dt);
    animate(A.eli, { anim: 'run', speed: 4.2 }, dt);
  }
  AURA_T.value = 1.2;
  // her spraying arm up and out at Granny's face
  if (A.june.j && A.june.j.shR) { A.june.j.shR.rotation.x -= 1.5; if (A.june.j.elR) A.june.j.elR.rotation.x = -0.1; }
  // the camera low on the left, looking across at the two of them (they sit in the left half; the words on the right)
  cam.position.set(P0.x - 6.2, 1.35, P0.z - 1.0); cam.lookAt(P0.x + 0.2, 1.3, P0.z + 0.75); // (side on: her on the left, Granny on the right of them, both clear of the words) cam.updateProjectionMatrix();
  R.render(sc, cam);
  if (mode === 'raw') return R.domElement.toDataURL('image/png');
  const c = document.createElement('canvas'); c.width = W * SS; c.height = H * SS; const x = c.getContext('2d'); x.scale(SS, SS);
  x.imageSmoothingQuality = 'high'; x.drawImage(R.domElement, 0, 0, W, H);
  // darken the right side for the words, warm vignette
  const g1 = x.createLinearGradient(W, 0, W * 0.38, 0); g1.addColorStop(0, 'rgba(8,3,0,.94)'); g1.addColorStop(0.65, 'rgba(8,3,0,.55)'); g1.addColorStop(1, 'rgba(8,3,0,0)'); x.fillStyle = g1; x.fillRect(0, 0, W, H);
  const vg = x.createRadialGradient(W * 0.3, H * 0.5, H * 0.3, W * 0.3, H * 0.5, W * 0.8); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(20,6,0,.6)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  x.textAlign = 'right';
  const RX = W - 60;
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 16;
  const lw = 210, lh = lw * logo.height / logo.width; x.drawImage(logo, RX - lw - 150, 40, lw, lh);
  x.font = '56px "IM Fell English SC"'; x.fillStyle = '#ff8a3a'; x.fillText('×', RX - 92, 40 + lh * 0.82); x.fillStyle = '#efe6d6'; x.fillText('DBD', RX, 40 + lh * 0.82);
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '6px'; x.fillStyle = '#ffb040'; x.fillText('UPDATE 1.5.1 · BUILT WITH THE PLAYERS', RX, 232); x.letterSpacing = '0px';
  x.font = '128px "Bebas Neue"'; x.fillStyle = '#f6eadb'; x.shadowColor = 'rgba(255,120,40,.45)'; x.shadowBlur = 34; x.fillText('RIGHT IN', RX, 352); x.fillText('THE EYES', RX, 470);
  x.shadowColor = 'rgba(0,0,0,.9)'; x.shadowBlur = 14;
  const items = ['Pepper Spray: blind the killer for 25s', "Victim's Cars drive again", 'One clean outline · sounds that vary', 'Backup file · menu music'];
  x.font = '600 24px "Barlow Condensed"'; x.letterSpacing = '1px';
  items.forEach((s, i) => { const y = 530 + i * 34; x.fillStyle = '#ff8a3a'; x.fillRect(RX - 9, y - 13, 9, 9); x.fillStyle = '#e2d6c6'; x.fillText(s.toUpperCase(), RX - 22, y); });
  x.font = 'italic 600 20px "Barlow Condensed"'; x.fillStyle = '#ffd890'; x.fillText('Ideas by Ommm & WolfSpider', RX, 684);
  x.letterSpacing = '0px';
  return c.toDataURL('image/png');
};
window.ready = true;
