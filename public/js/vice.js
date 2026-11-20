// 1.5.3 (drawing): the collectables, the thrown GTA VI game case, and the desk a killer sits at while playing GTA VI.
// The rules are in vicesim.js. Models: public/models/monster_can.glb ("Soda Monster x GTA 6"), phone_case.glb (a GTA VI
// PlayStation case), teddy.glb; the page, the key and the bulb are made here.
import * as THREE from 'three';
import { COLLECTABLES, RARITY } from './config.js';
import { loadSkinModel, glbScene } from './grannyGlb.js';
import { heightAt } from './map.js';

export const COLL = Object.fromEntries(COLLECTABLES.map(c => [c.id, c]));
const protos = {};

// the GTA VI logo as an image (it comes through the stylesheet, so the offline builds have it inlined)
let logoP = null;
export function gtaLogo() {
  if (logoP) return logoP;
  return (logoP = new Promise(res => {
    const s = document.createElement('span'); s.className = 'vi-badge'; s.style.cssText = 'position:absolute;left:-999px;top:0;width:10px;height:10px'; document.body.appendChild(s);
    const m = /url\(["']?(.*?)["']?\)/.exec(getComputedStyle(s).backgroundImage || ''); s.remove();
    if (!m) return res(null);
    const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = m[1];
  }));
}

// load whatever models the given collectables need (and the game case)
export function loadViceModels(ids = COLLECTABLES.map(c => c.id), withCase = true) {
  const need = new Set(ids.map(id => COLL[id] && COLL[id].glb).filter(Boolean));
  if (withCase) need.add('phone_case');
  return Promise.all([...need].map(n => loadSkinModel(n).catch(() => null)));
}

// a model fitted to h metres tall, standing on y = 0, centred
function fit(obj, h) {
  const g = new THREE.Group(); g.add(obj); g.updateMatrixWorld(true);
  let b = new THREE.Box3().setFromObject(g); const k = h / Math.max(1e-6, b.max.y - b.min.y); obj.scale.multiplyScalar(k); g.updateMatrixWorld(true);
  b = new THREE.Box3().setFromObject(g); const c = b.getCenter(new THREE.Vector3()); obj.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
  return g;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });

function makePage() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 340; const x = c.getContext('2d');
  x.fillStyle = '#e9e1cc'; x.fillRect(0, 0, 256, 340);
  for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(90,70,40,${Math.random() * 0.06})`; x.fillRect(Math.random() * 256, Math.random() * 340, 2, 2); }
  x.strokeStyle = '#1a1414'; x.lineWidth = 4; x.font = 'bold 40px serif'; x.fillStyle = '#1a1414'; x.textAlign = 'center';
  x.save(); x.translate(128, 150); x.rotate(-0.08); x.fillText('SHE IS', 0, -20); x.fillText('WATCHING', 0, 30); x.restore();
  x.beginPath(); x.arc(128, 262, 34, 0, 7); x.moveTo(108, 252); x.arc(112, 252, 4, 0, 7); x.moveTo(140, 252); x.arc(144, 252, 4, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.4), new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.9 }));
  m.rotation.x = -0.25; m.position.y = 0.2;
  return m;
}
function makeKey() {
  const g = new THREE.Group(), mat = std(0x8a5a2e, { metalness: 0.7, roughness: 0.45 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 20), mat); ring.position.y = 0.24; g.add(ring);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.17, 8), mat); shaft.position.y = 0.09; g.add(shaft);
  for (const [y, w] of [[0.03, 0.06], [0.07, 0.045]]) { const t = new THREE.Mesh(new THREE.BoxGeometry(w, 0.022, 0.012), mat); t.position.set(w / 2, y, 0); g.add(t); }
  return g;
}
function makeBulb() {
  const g = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xfff1c0, emissive: 0xffc860, emissiveIntensity: 1.6, roughness: 0.2 }));
  glass.position.y = 0.17; glass.scale.y = 1.2; g.add(glass);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.07, 12), std(0x8c8c80, { metalness: 0.8, roughness: 0.35 })); cap.position.y = 0.05; g.add(cap);
  return g;
}

// a collectable, h metres tall (its own height by default), standing on y = 0. Null until its model has loaded.
export function makeCollectable(id, h) {
  const C = COLL[id]; if (!C) return null;
  h = h || C.h;
  if (C.glb) {
    const src = glbScene(C.glb); if (!src) return null;
    if (!protos[id]) {
      const o = src.clone(true);
      if (C.tint) o.traverse(m => { if (m.isMesh) { m.material = m.material.clone(); m.material.color = new THREE.Color(C.tint); m.material.metalness = 0.85; m.material.roughness = 0.3; } });
      if (C.glb === 'teddy') o.rotation.y = -Math.PI / 2;
      if (C.glb === 'phone_case') o.rotation.y = -Math.PI / 2; // (the file's cover faces -x)
      protos[id] = fit(o, 1);
    }
    const g = protos[id].clone(true); g.scale.setScalar(h); return g;
  }
  const g = id === 'page' ? makePage() : id === 'key' ? makeKey() : makeBulb();
  const w = fit(g, 1); w.scale.setScalar(h); return w;
}

// the soft glow under a collectable lying in a match (its rarity colour)
let glowTex = null;
function glow(color) {
  if (!glowTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); glowTex = new THREE.CanvasTexture(c); }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
  s.scale.set(1.3, 1.3, 1); return s;
}

// the desk: a table with panels down to the floor (they hide the killer's legs), a monitor with GTA VI on it, a
// controller, and a gaming chair. Built facing +z: the killer sits at the origin, the screen is in front of them.
let screenTex = null;
function screen() {
  if (screenTex) return screenTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 288; const x = c.getContext('2d');
  const paint = img => {
    const g = x.createLinearGradient(0, 0, 0, 288); g.addColorStop(0, '#2a0b4a'); g.addColorStop(0.55, '#ff2d95'); g.addColorStop(0.8, '#ff9a3c'); g.addColorStop(1, '#1fd1d9');
    x.fillStyle = g; x.fillRect(0, 0, 512, 288);
    x.fillStyle = 'rgba(255,224,102,.55)'; x.beginPath(); x.arc(256, 200, 70, 0, 7); x.fill();
    if (img) { const h = 200, w = h * img.width / img.height; x.drawImage(img, 256 - w / 2, 30, w, h); }
    else { x.fillStyle = '#fff'; x.font = 'bold italic 120px sans-serif'; x.textAlign = 'center'; x.fillText('VI', 256, 180); }
    x.fillStyle = 'rgba(255,255,255,.85)'; x.font = 'bold 18px sans-serif'; x.textAlign = 'center'; x.fillText('PRESS ANY BUTTON', 256, 270);
    if (screenTex) screenTex.needsUpdate = true;
  };
  paint(null); gtaLogo().then(paint);
  screenTex = new THREE.CanvasTexture(c); screenTex.colorSpace = THREE.SRGBColorSpace;
  return screenTex;
}
let deskProto = null;
export function makeGameDesk() {
  if (deskProto) return deskProto.clone(true);
  const g = new THREE.Group(), wood = std(0x2b2320, { roughness: 0.75 }), black = std(0x111114, { roughness: 0.5 }), red = std(0x9a1030, { roughness: 0.55 });
  const box = (w, h, d, m, x, y, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; g.add(b); return b; };
  // desk: top, front panel and two sides down to the floor
  box(1.3, 0.05, 0.62, wood, 0, 0.76, 0.62);
  box(1.3, 0.74, 0.04, wood, 0, 0.37, 0.92);
  box(0.04, 0.74, 0.62, wood, -0.63, 0.37, 0.62); box(0.04, 0.74, 0.62, wood, 0.63, 0.37, 0.62);
  // monitor
  box(0.08, 0.2, 0.08, black, 0, 0.88, 0.78); box(0.26, 0.02, 0.18, black, 0, 0.79, 0.78);
  box(0.82, 0.5, 0.04, black, 0, 1.22, 0.8);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.43), new THREE.MeshBasicMaterial({ map: screen(), toneMapped: false }));
  scr.position.set(0, 1.22, 0.777); scr.rotation.y = Math.PI; g.add(scr);
  // controller
  box(0.16, 0.04, 0.09, std(0xf2f2f2, { roughness: 0.4 }), 0, 0.8, 0.45);
  // console
  box(0.12, 0.38, 0.32, std(0xf4f4f4, { roughness: 0.35 }), 0.5, 0.98, 0.7);
  // gaming chair: base box to the floor (hides the legs from behind), seat, tall back, side wings
  box(0.56, 0.42, 0.5, black, 0, 0.21, -0.02);
  box(0.6, 0.08, 0.56, red, 0, 0.46, -0.02);
  box(0.6, 0.62, 0.1, red, 0, 0.8, -0.32); // (low enough to show the killer's head and shoulders from behind)
  box(0.08, 0.3, 0.5, black, -0.32, 0.6, -0.02); box(0.08, 0.3, 0.5, black, 0.32, 0.6, -0.02);
  deskProto = g;
  return g.clone(true);
}
export const SEAT_DROP = 0.4; // how far a seated killer sinks (the chair's seat height, roughly)

// the thrown game case (spinning while it flies)
export function makeFlyingCase() {
  const src = glbScene('phone_case');
  if (src) { const g = makeCollectable('gtacase', 0.24); if (g) return g; }
  const b = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.21, 0.02), std(0x1a3fbf)); const g = new THREE.Group(); b.position.y = 0.1; g.add(b); return g;
}

// per frame (game.js): collectables lying around, game cases in the air, desks under killers who are playing
export function updateVice(G, S, dt) {
  const scene = G.scene, t = G.t;
  G.viceColl ||= new Map(); G.viceCase ||= new Map(); G.viceDesk ||= new Map();
  if (!G.viceLoad && ((S.colls && S.colls.length) || (S.cases && S.cases.length) || S.players.some(p => p.item === 'gtaps'))) { G.viceLoad = true; loadViceModels((S.colls || []).map(o => o.c)); }
  // collectables
  const live = new Set();
  for (const o of S.colls || []) {
    const key = o.c; live.add(key);
    let e = G.viceColl.get(key);
    if (!e) { const m = makeCollectable(o.c, COLL[o.c].h * 1.35); if (!m) continue; const gl = glow(RARITY[COLL[o.c].rarity] || '#fff'); const grp = new THREE.Group(); grp.add(m, gl); scene.add(grp); e = { grp, m, gl }; G.viceColl.set(key, e); }
    const y = heightAt(G.M, o);
    e.grp.position.set(o.x, y, o.z);
    e.m.position.y = 0.12 + Math.sin(t * 2 + o.x) * 0.06; e.m.rotation.y = t * 1.2;
    e.gl.position.y = 0.35; e.gl.material.opacity = 0.55 + Math.sin(t * 3) * 0.2;
  }
  for (const [k, e] of G.viceColl) if (!live.has(k)) { scene.remove(e.grp); G.viceColl.delete(k); }
  // game cases in the air
  const cl = new Set();
  for (const c of S.cases || []) {
    cl.add(c.id);
    let m = G.viceCase.get(c.id);
    if (!m) { m = makeFlyingCase(); scene.add(m); G.viceCase.set(c.id, m); }
    m.position.set(c.x, heightAt(G.M, c) + c.y, c.z);
    if (c.st === 'land') { m.rotation.set(-Math.PI / 2, 0, 0.4); } else { m.rotation.x += dt * 14; m.rotation.y = Math.atan2(c.vx, c.vz); }
  }
  for (const [k, m] of G.viceCase) if (!cl.has(k)) { scene.remove(m); G.viceCase.delete(k); }
  // desks
  const dl = new Set();
  for (const p of S.players) {
    if (!(p.gamed > 0)) continue;
    const c = G.chars && G.chars.get(p.id); if (!c) continue;
    dl.add(p.id);
    let d = G.viceDesk.get(p.id);
    if (!d) { d = makeGameDesk(); scene.add(d); G.viceDesk.set(p.id, d); d.userData.yaw = c.yaw; }
    d.position.set(c.x, c.h || 0, c.z); d.rotation.y = d.userData.yaw;
  }
  for (const [k, d] of G.viceDesk) if (!dl.has(k)) { scene.remove(d); G.viceDesk.delete(k); }
}
export function clearVice(G) {
  for (const M of [G.viceColl, G.viceCase, G.viceDesk]) if (M) { for (const v of M.values()) G.scene.remove(v.grp || v); M.clear(); }
  G.viceLoad = false;
}

// a small 3D viewer for the Profile panel: one collectable on a turntable, drag to turn it. Its own renderer (made when
// opened, thrown away when closed).
export function openViewer(el, id) {
  const W = el.clientWidth || 360, H = el.clientHeight || 300;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio || 1)); r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  el.appendChild(r.domElement);
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.01, 20);
  sc.add(new THREE.HemisphereLight(0xffe8f4, 0x221030, 2.2));
  const k = new THREE.DirectionalLight(0xffffff, 2.2); k.position.set(1.5, 2, 2.5); sc.add(k);
  const rim = new THREE.DirectionalLight(0xff2d95, 2.5); rim.position.set(-2, 1, -2); sc.add(rim);
  const rim2 = new THREE.DirectionalLight(0x1fd1d9, 1.8); rim2.position.set(2, 0.5, -2); sc.add(rim2);
  let obj = null, yaw = 0.6, vy = 0.5, drag = null, dead = false;
  const place = () => { if (obj || dead) return; obj = makeCollectable(id, 1); if (!obj) return; obj.position.y = -0.5; sc.add(obj); };
  loadViceModels([id], false).then(place); place();
  cam.position.set(0, 0.25, 3.2); cam.lookAt(0, 0, 0);
  const down = e => { drag = e.clientX; el.setPointerCapture && el.setPointerCapture(e.pointerId); };
  const move = e => { if (drag == null) return; vy = (e.clientX - drag) * 0.01; yaw += vy; drag = e.clientX; };
  const up = () => { drag = null; };
  el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  let last = performance.now();
  const loop = now => {
    if (dead) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (drag == null) { vy += (0.5 * dt - vy) * Math.min(1, dt * 2); yaw += vy * dt * 2; }
    if (obj) obj.rotation.y = yaw;
    r.render(sc, cam); requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return () => { dead = true; el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); r.dispose(); r.forceContextLoss && r.forceContextLoss(); r.domElement.remove(); };
}
