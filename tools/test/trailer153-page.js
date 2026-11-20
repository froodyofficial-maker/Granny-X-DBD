// 20 s YouTube trailer for 1.5.3 (GTA VI x Granny x DBD), rendered in-engine on Midnight City at a neon sunset.
//   FRAMES=480 OUTDIR=/tmp/tr PAGE=trailer153-page.js node render-devlog.mjs     (24 fps; frame(i) = time i / 24)
//   then ffmpeg with the synthesized score (tools/test/trailer153-music.py).
// Shots: 0-3.5 Granny walks down the street · 3.5-7.5 Mara runs, turns, throws the GTA VI case at her · 7.5-11.5 Granny
// at the desk playing GTA VI · 11.5-14.5 the GTA VI Monster Can on the asphalt · 14.5-17 the other killers · 17-20 end card.
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './js/models.js';
import { buildMap } from './js/map.js';
import { buildWorld } from './js/world.js';
import { SURVIVORS } from './js/config.js';
import { loadGranny, loadGrandpa, loadSlendrina, loadAngeline, loadNosferatu } from './js/grannyGlb.js';
import { makeGameDesk, makeCollectable, makeFlyingCase, loadViceModels, gtaLogo } from './js/vice.js';
import { grade, palm, loadImg, logoRow, gtaLogo as drawGta, eventLine } from './__vicity-common.js';

const W = 1280, H = 720, FPS = 24;
let R, sc, cam, logo, dbd, gta, A = {}, prevT = -1;
const X = 11; // the street
window.setup = async () => {
  await Promise.all([loadGranny(), loadGrandpa(), loadSlendrina(), loadAngeline(), loadNosferatu(), loadViceModels()]);
  await gtaLogo();
  const M = buildMap(11, 'city');
  sc = buildWorld(M, 'high').scene;
  sc.fog.color.setHex(0x2a0f3a); sc.fog.density *= 0.6;
  const sh = r => { (r.root || r).traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return r; };
  // shot 1-2: Granny, Mara
  A.granny = sh(makeKiller('granny', {})); sc.add(A.granny.root);
  A.mara = sh(makeSurvivor(SURVIVORS.mara)); sc.add(A.mara.root);
  A.case = makeFlyingCase(); A.case.scale.multiplyScalar(1.6); sc.add(A.case);
  // shot 3: a second Granny at the desk, down the street
  A.sit = sh(makeKiller('granny', {})); A.sit.root.position.set(X, -0.4, -12); A.sit.root.rotation.y = Math.PI / 2; sc.add(A.sit.root);
  A.desk = makeGameDesk(); A.desk.position.set(X, 0, -12); A.desk.rotation.y = Math.PI / 2; sh(A.desk); sc.add(A.desk);
  // shot 4: the Monster Can
  A.can = makeCollectable('monster', 0.62); A.can.position.set(X + 2, 0, -40); sc.add(A.can);
  const glowC = document.createElement('canvas'); glowC.width = glowC.height = 64; { const x = glowC.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.4, 'rgba(255,255,255,.4)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
  A.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(glowC), color: 0xffb42e, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); A.glow.scale.set(2, 2, 1); A.glow.position.set(X + 2, 0.4, -40); sc.add(A.glow);
  // shot 5: the line-up
  const line = [['grandpa', -2.4], ['slendrina', -0.8], ['angeline', 0.8], ['nosferatu', 2.4]];
  A.line = line.map(([id, dx]) => { const r = sh(makeKiller(id, {})); r.root.position.set(X + dx, 0, -64); r.root.rotation.y = 0; sc.add(r.root); return [id, r]; });
  // neon lights for every shot
  const L = (c, i, x, y, z, d = 16) => { const l = new THREE.PointLight(c, i, d, 1.4); l.position.set(x, y, z); sc.add(l); };
  L(0xff2d95, 40, X - 5, 3, 24); L(0x1fd1d9, 34, X + 6, 3, 18);
  L(0xff2d95, 30, X - 3, 2.6, -9); L(0x1fd1d9, 24, X + 3, 2.6, -15); L(0xffffff, 6, X, 1.6, -11, 4);
  L(0xff9a3c, 26, X + 4, 1.5, -37); L(0xff2d95, 26, X - 1, 2, -43);
  L(0xff2d95, 40, X - 6, 3, -60); L(0x1fd1d9, 40, X + 6, 3, -60);
  const back = new THREE.SpotLight(0xff7ac0, 120, 60, 0.7, 0.6, 1.2); back.position.set(X, 9, -2); back.target.position.set(X, 0, 22); back.castShadow = true; back.shadow.mapSize.set(2048, 2048); sc.add(back, back.target);
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(W, H);
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.5; R.outputColorSpace = THREE.SRGBColorSpace;
  cam = new THREE.PerspectiveCamera(40, W / H, 0.05, 300);
  [logo, dbd, gta] = await Promise.all([loadImg('img/granny-logo.png'), loadImg('__art/dbd.png'), loadImg('__art/gta6.png')]);
  await document.fonts.load('100px "Bebas Neue"'); await document.fonts.load('100px "IM Fell English SC"'); await document.fonts.load('600 40px "Barlow Condensed"');
  return true;
};
const ease = t => t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const seg = (t, a, b) => ease((t - a) / (b - a));
function text(x, s, X0, Y0, px, a, color = '#fff0f8', glow = '#ff2d95') {
  if (a <= 0) return;
  x.save(); x.globalAlpha = a; x.font = `${px}px "Bebas Neue"`; x.textAlign = 'center'; x.letterSpacing = `${Math.round(px * 0.08)}px`;
  x.fillStyle = color; x.shadowColor = glow; x.shadowBlur = px * 0.5; x.fillText(s, X0, Y0); x.shadowBlur = px * 0.15; x.fillText(s, X0, Y0); x.restore();
}
window.frame = (i) => {
  const t = i / FPS, dt = prevT < 0 ? 1 / FPS : Math.max(1 / FPS, t - prevT); prevT = t;
  // ---- actors ----
  const g = A.granny, m = A.mara;
  let shot = t < 3.5 ? 1 : t < 7.5 ? 2 : t < 11.5 ? 3 : t < 14.5 ? 4 : t < 17 ? 5 : 6;
  if (shot === 1) {
    const z = lerp(14, 21, t / 3.5);
    g.root.position.set(X + 0.6, 0, z); g.root.rotation.y = 0; animate(g, { anim: 'walk', speed: 1.4 }, dt);
    m.root.visible = false; A.case.visible = false;
  } else if (shot === 2) {
    const u = t - 3.5;
    m.root.visible = true;
    const turn = u > 2.0, mz = 10 + Math.min(u, 2) * 4.4, gz = 6.4 + u * 4.2;
    m.root.position.set(X - 0.5, 0, mz); m.root.rotation.y = turn ? Math.PI : 0;
    animate(m, turn ? { anim: 'idle', speed: 0, flash: false } : { anim: 'run', speed: 5 }, dt);
    g.root.position.set(X + 0.2, 0, Math.min(gz, mz - 2.4)); g.root.rotation.y = 0;
    const hit = u > 2.8;
    animate(g, hit ? { anim: 'idle', speed: 0, stun: false } : { anim: 'walk', speed: 3.2, atk: 0 }, dt);
    // the case: thrown at 2.15 s, lands on her at 2.8 s
    const k = (u - 2.15) / 0.65;
    A.case.visible = k > 0 && k < 1;
    if (A.case.visible) { const from = m.root.position, to = g.root.position; A.case.position.set(lerp(from.x, to.x, k), 1.35 + Math.sin(k * Math.PI) * 0.7, lerp(from.z, to.z, k)); A.case.rotation.x += dt * 16; }
  } else {
    m.root.visible = false; A.case.visible = false;
  }
  animate(A.sit, { anim: 'idle', speed: 0 }, dt);
  A.can.rotation.y = t * 1.6; A.can.position.y = 0.15 + Math.sin(t * 2.4) * 0.07; A.glow.material.opacity = 0.6 + Math.sin(t * 3) * 0.25;
  for (const [, r] of A.line) animate(r, { anim: 'idle', speed: 0, aim: false }, dt);
  // ---- camera ----
  if (shot === 1) { const u = seg(t, 0, 3.5); cam.position.set(X + lerp(-1.6, -0.6, u), lerp(0.7, 1.2, u), lerp(31, 26.5, u)); cam.lookAt(X + 0.6, lerp(1.6, 1.45, u), 18); cam.fov = 38; }
  else if (shot === 2) { const u = t - 3.5, mz = 10 + Math.min(u, 2) * 4.4; cam.position.set(X + 3.6, 1.35, mz + 3.2 + u * 0.4); cam.lookAt(X, 1.2, mz - 1.4); cam.fov = 44; }
  else if (shot === 3) { const u = seg(t, 7.5, 11.5); if (t < 9.6) { const v = seg(t, 7.5, 9.6); cam.position.set(X - lerp(1.7, 1.2, v), lerp(2.0, 1.85, v), -12 + lerp(1.0, 0.55, v)); cam.lookAt(X + 0.8, 1.2, -12); } else { const v = seg(t, 9.6, 11.5); cam.position.set(X + lerp(2.3, 1.9, v), lerp(1.45, 1.4, v), -12 + lerp(1.9, 1.2, v)); cam.lookAt(X + 0.1, 1.15, -12); } cam.fov = 42; }
  else if (shot === 4) { const u = seg(t, 11.5, 14.5); cam.position.set(X + 2 + lerp(-1.4, -0.9, u), lerp(0.55, 0.42, u), -40 + lerp(1.6, 1.05, u)); cam.lookAt(X + 2, 0.45, -40); cam.fov = 36; }
  else if (shot === 5) { const u = seg(t, 14.5, 17); cam.position.set(X + lerp(-3.2, 3.2, u), 1.45, -57.8); cam.lookAt(X + lerp(-1.2, 1.2, u), 1.35, -64); cam.fov = 40; }
  else { const u = seg(t, 17, 20); cam.position.set(X, 1.6 + u * 0.4, 30 - u * 2); cam.lookAt(X, 2.4, 0); cam.fov = 40; }
  cam.aspect = W / H; cam.updateProjectionMatrix();
  R.render(sc, cam);
  // ---- 2D: grade, palms, text ----
  const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
  x.drawImage(R.domElement, 0, 0);
  grade(x, W, H, H * 0.55);
  const vg = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(8,0,16,.65)'); x.fillStyle = vg; x.fillRect(0, 0, W, H);
  if (shot === 1) { logoRow(x, logo, dbd, W / 2, 46, 70); }
  if (shot === 2 && t > 5.6 && t < 7.5) text(x, 'GTA VI, INCOMING', W / 2, H - 70, 64, seg(t, 5.6, 5.9));
  if (shot === 3) text(x, "SHE'S BUSY.", W / 2, H - 64, 82, seg(t, 8.3, 8.7) * (1 - seg(t, 11.1, 11.5)));
  if (shot === 4) text(x, 'FIND THE GTA VI CAN', W / 2, H - 64, 64, seg(t, 12.0, 12.4) * (1 - seg(t, 14.1, 14.5)), '#fff3d6', '#ffb42e');
  if (shot === 6) {
    const a = seg(t, 17, 17.6);
    x.fillStyle = `rgba(10,2,18,${0.55 * a})`; x.fillRect(0, 0, W, H);
    palm(x, 60, H + 20, 520, { flip: true, color: '#0a0212' }); palm(x, W - 60, H + 20, 520, { color: '#0a0212' });
    x.save(); x.globalAlpha = a; logoRow(x, logo, dbd, W / 2, 34, 68); drawGta(x, gta, W / 2, 130, 400 * (0.94 + 0.06 * a)); x.restore();
    x.save(); x.globalAlpha = seg(t, 17.8, 18.3); eventLine(x, 'LIMITED TIME EVENT · UNTIL 30 NOVEMBER', W / 2, 640, 40); x.restore();
  }
  // fades between shots
  const cuts = [3.5, 7.5, 11.5, 14.5, 17];
  let f = Math.max(0, 1 - t / 0.5, ...cuts.map(k => 1 - Math.abs(t - k) / 0.12), (t - 19.4) / 0.6);
  if (f > 0) { x.fillStyle = `rgba(0,0,0,${Math.min(1, f)})`; x.fillRect(0, 0, W, H); }
  return c.toDataURL('image/jpeg', 0.92);
};
window.ready = true;
