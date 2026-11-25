// 1.7.0: replay an execution from the Profile's Executions collection: the same film as in a match (mori.js choreography,
// camera and gore from Game.moriFx), on a small foggy stage of its own, with its own renderer.
import * as THREE from 'three';
import { makeKiller, makeSurvivor, animate } from './models.js';
import { MORI, moriShot } from './mori.js';
import { Game, Particles, BloodDrops, makeExecTrap } from './game.js';
import { Gibs, BloodDecals } from './gore.js';
import { tex } from './textures.js';
import { RULES, SURVIVORS } from './config.js';
import { sound } from './audio.js';

export function openMoriView(el, killer, victimChar = 'mara', skin = {}, onLine = null, R0 = null) {
  // 1.7.0 (second build): it borrows the game's own renderer (a second WebGL context failed on some phones and recompiled
  // every shader while the film was already running: it stuttered or never played). The menu stops drawing while it's open;
  // each frame is drawn into a corner of the game's canvas and copied onto this canvas.
  const view = document.createElement('canvas'); view.style.cssText = 'display:block;width:100%;height:100%'; el.appendChild(view);
  const ctx2 = view.getContext('2d');
  const own = !R0;
  const r = R0 || new THREE.WebGLRenderer({ antialias: true });
  if (own) { r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace; }
  const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(45, 21 / 9, 0.03, 80);
  sc.background = new THREE.Color(0x07080c); sc.fog = new THREE.FogExp2(0x0b0d12, 0.075);
  sc.add(new THREE.HemisphereLight(0x5a6a8a, 0x120c0a, 0.9));
  const moon = new THREE.DirectionalLight(0xb8c8ff, 2.2); moon.position.set(-6, 9, 4); moon.castShadow = true; moon.shadow.mapSize.set(1024, 1024);
  Object.assign(moon.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 1, far: 30 }); sc.add(moon);
  const lamp = new THREE.PointLight(0xffb070, 18, 9, 1.6); lamp.position.set(2.2, 2.6, 2.4); sc.add(lamp);
  const g = tex('ground') || tex('dirt') || {};
  const ground = new THREE.Mesh(new THREE.CircleGeometry(22, 48), new THREE.MeshStandardMaterial({ color: 0x3a3430, roughness: 0.95, map: g.map || null }));
  if (ground.material.map) { ground.material.map = ground.material.map.clone(); ground.material.map.wrapS = ground.material.map.wrapT = THREE.RepeatWrapping; ground.material.map.repeat.set(10, 10); ground.material.map.needsUpdate = true; }
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; sc.add(ground);
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.28 + 0.3, d = 6 + (i % 3) * 2.5; const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 7, 7), new THREE.MeshStandardMaterial({ color: 0x1a1512, roughness: 1 })); t.position.set(Math.cos(a) * d, 3.5, Math.sin(a) * d); t.castShadow = true; sc.add(t); }
  const K = makeKiller(killer, skin), V = makeSurvivor(SURVIVORS[victimChar] || SURVIVORS.mara, {});
  for (const R of [K, V]) { R.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); sc.add(R.root); }
  const kp = { id: 'k', char: killer, yaw: 0, x: 0, z: 0 }, vp = { id: 'v', char: victimChar, stage: 2 };
  // a stand-in for the match's renderer: the same particles, gibs and decals, so Game.moriFx runs unchanged
  const fx = {
    scene: sc, t: 0, myId: 'viewer', shake: 0, hitStop: 0, view: null, flash: 0,
    chars: new Map([['k', { rig: K, x: 0, z: 0, yaw: 0, h: 0 }], ['v', { rig: V, h: 0 }]]),
    blood: new BloodDrops(sc, 700, false), sparks: new Particles(sc, THREE.AdditiveBlending, 0.12, 300), smoke: new Particles(sc, THREE.NormalBlending, 1.4, 100),
    decals: new BloodDecals(sc, 160, tex('bloodatlas').map, false),
    feed: t => { if (onLine) onLine(t); }, splat() {},
  };
  fx.gibs = new Gibs(sc, 120, (x, z, y, rr) => { if (rr > 0.02) fx.decals.add(x, z, 0.12 + rr * 5, 0, undefined, y); });
  fx.blood.onLand = (x, z, y) => { if (Math.random() < 0.3) fx.decals.add(x, z, 0.12 + Math.random() * 0.2, 0, undefined, y); };
  const T = RULES.execTime, M = MORI[killer];
  let t = -0.6, dead = false, ready = false;
  const restart = () => {
    t = -0.6; fx.execFired = null;
    if (fx.execTrap) { sc.remove(fx.execTrap); fx.execTrap = null; }
    if (V.gore) { V.gore.clear(); V.gore.all = 0; V.gore.update(0); }
    for (const d of fx.decals.list) if (d) d.age = 1e4; fx.decals.update(0); fx.gibs.list.length = 0;
  };
  // the pose at the start, then every shader compiled before the film rolls (the trap too)
  const pose = f => {
    const pl = M.place(f); V.root.position.set(-pl.side, pl.y, pl.d); V.root.rotation.set(0, pl.yaw, 0);
    animate(V, { anim: 'exec', exec: { f, char: killer, role: 'victim' }, t: fx.t, speed: 0 }, 1 / 30);
    animate(K, { anim: 'idle', speed: 0, exec: { f, char: killer, role: 'killer', ...(M.killer ? M.killer(f) : {}) } }, 1 / 30);
  };
  pose(0);
  // (Granny's trap appears mid-film: one is in the scene, hidden, while the shaders compile)
  let trap0 = null; try { trap0 = makeExecTrap(); trap0.visible = false; sc.add(trap0); } catch (e) {}
  const size = () => {
    const w = Math.max(64, Math.round((el.clientWidth || 960) * Math.min(1.5, devicePixelRatio || 1))), h = Math.round(w * 9 / 21);
    if (view.width !== w || view.height !== h) { view.width = w; view.height = h; if (own) r.setSize(w, h, false); }
    return [w, h];
  };
  const pr = r.compileAsync ? r.compileAsync(sc, cam) : Promise.resolve();
  Promise.race([pr, new Promise(res => setTimeout(res, 8000))]).then(() => { ready = true; if (trap0) sc.remove(trap0); });
  const draw = () => {
    const [w, h] = size();
    if (own) { r.render(sc, cam); ctx2.drawImage(r.domElement, 0, 0, w, h); return; }
    // the shared renderer: draw into the bottom-left corner of its canvas, copy it out, put everything back
    const cv = r.domElement, pw = cv.width, ph = cv.height, s = Math.min(1, pw / w, ph / h), vw = Math.floor(w * s), vh = Math.floor(h * s);
    const pv = new THREE.Vector4(), ps = new THREE.Vector4(); r.getViewport(pv); r.getScissor(ps); const pst = r.getScissorTest(), prt = r.getRenderTarget(), pac = r.autoClear;
    const dpr = r.getPixelRatio();
    r.setRenderTarget(null); r.setViewport(0, 0, vw / dpr, vh / dpr); r.setScissor(0, 0, vw / dpr, vh / dpr); r.setScissorTest(true); r.autoClear = true;
    try { r.render(sc, cam); ctx2.drawImage(cv, 0, ph - vh, vw, vh, 0, 0, w, h); }
    finally { r.setViewport(pv); r.setScissor(ps); r.setScissorTest(pst); r.setRenderTarget(prt); r.autoClear = pac; }
  };
  const tick = dt => {
    if (dead) return;
    if (!ready) { cam.position.set(-1.8, 1.4, 3.2); cam.lookAt(0, 0.8, 0.6); try { draw(); } catch (e) {} return; }
    if (fx.hitStop > 0) { fx.hitStop -= dt; dt *= 0.15; } // the killing blows hang for a beat
    t += dt; fx.t += dt;
    const f = Math.max(0, Math.min(1, t / T));
    try {
      pose(f);
      if (t >= 0 && t <= T + 0.1) Game.prototype.execFx.call(fx, vp, kp, f, killer, V.root.position);
      if (V.gore) V.gore.update(dt);
      fx.blood.update(dt); fx.sparks.update(dt); fx.smoke.update(dt); fx.gibs.update(dt); fx.decals.update(dt);
    } catch (e) { console.warn('execution replay', e); }
    // the film camera
    const ms = moriShot(killer, f), P = v => new THREE.Vector3(-v[0], v[1], v[2]);
    const sh = fx.shake * 0.05; fx.shake = Math.max(0, fx.shake - dt * 1.5);
    cam.position.copy(P(ms.cam)).add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, 0));
    cam.up.set(0, 1, 0); cam.lookAt(P(ms.look)); if (ms.roll) cam.rotateZ(ms.roll);
    if (cam.fov !== ms.fov) { cam.fov = ms.fov; cam.updateProjectionMatrix(); }
    try { sound.listener(0, 0.6, Math.atan2(cam.position.x, cam.position.z) + Math.PI); } catch (e) {}
    try { draw(); } catch (e) { console.warn('execution replay draw', e); }
    if (t > T + 2.2) restart(); // it plays again
  };
  // its own clock only when it has its own renderer (otherwise the game's main loop calls tick)
  let last = performance.now();
  if (own) { const loop = now => { if (dead) return; const dt = Math.min(0.05, (now - last) / 1000); last = now; tick(dt); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
  return {
    tick, replay: restart, get ready() { return ready; },
    close() { dead = true; view.remove(); if (own) { r.dispose(); r.forceContextLoss && r.forceContextLoss(); } },
  };
}
