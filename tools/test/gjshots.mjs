// Game Jolt screenshots (1.6.0): staged scenes in real bot matches on High, rendered by the game itself (HUD off).
//   node gjshots.mjs <shot> [W H] [outdir]     shots: house, swing, aim, crow, forest, angeline
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', [SHOT = 'house', W = '960', H = '540', OUT = '/tmp/claude-0/gj'] = process.argv.slice(2);
const CFG = {
  house: { map: 'granny', role: 'killer', killer: 'granny', surv: 'mara' },
  swing: { map: 'granny', role: 'killer', killer: 'granny', surv: 'eli' },
  aim: { map: 'granny1', role: 'killer', killer: 'grandpa', surv: 'june' },
  crow: { map: 'granny', role: 'survivor', killer: 'granny', surv: 'june', crow: true },
  forest: { map: 'forest', role: 'survivor', killer: 'nosferatu', surv: 'tomas' },
  angeline: { map: 'granny1', role: 'killer', killer: 'angeline', surv: 'mara' },
  scout: { map: process.env.MAP || 'granny', role: 'killer', killer: 'granny', surv: 'mara' },
  c_granny: { map: 'granny', role: 'survivor', killer: 'granny', surv: 'mara' },
  c_hunt: { map: 'granny', role: 'survivor', killer: 'granny', surv: 'mara' },
  c_crow: { map: 'granny', role: 'survivor', killer: 'granny', surv: 'june', crow: true },
  c_grandpa: { map: 'granny1', role: 'survivor', killer: 'grandpa', surv: 'eli' },
  c_forest: { map: 'forest', role: 'survivor', killer: 'nosferatu', surv: 'tomas' },
  c_angeline: { map: 'granny1', role: 'survivor', killer: 'angeline', surv: 'mara' },
}[SHOT];
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: +W, height: +H } }); pg.setDefaultTimeout(600000);
const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(c => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, pets: { crow: true }, killer: { char: c.killer, perks: [] }, survivor: { char: c.surv, perks: [], pet: c.crow ? 'crow' : '' } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'high', name: 'Tester', dynres: false, viTheme: false }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
}, CFG);
await pg.addInitScript(e => { window.__scoutC = e.c; window.__scoutR = e.r; window.__lampIdx = e.l; }, { c: process.env.SC || '', r: process.env.SR || '', l: process.env.LAMP || '0' });
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 300000 });
await pg.evaluate(r => document.querySelector(`[data-act="play-${r}"]`).click(), CFG.role); await pg.waitForTimeout(600);
await pg.selectOption('#bots-map', CFG.map);
if (CFG.role === 'survivor') await pg.selectOption('#bots-killer', CFG.killer);
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1.5, null, { timeout: 500000 });
await pg.waitForTimeout(2500);
const shots = await pg.evaluate(async ([SHOT, CFG]) => {
  const { animateView } = await import('/public/js/models.js');
  const s = window.__nb.session, g = s.game, S = s.sim.S, M = s.sim.M, THREE = window.__THREE;
  s.tick = () => {}; // frozen: the scene is staged by hand
  for (const id of ['hud', 'crosshair', 'markers', 'feed', 'fps', 'item']) { const e = document.getElementById(id); if (e) e.style.visibility = 'hidden'; }
  document.querySelectorAll('#touch, #toast, .tc-b').forEach(e => e.style.display = 'none');
  const me = S.players.find(p => p.id === 'me'), K = S.players.find(p => p.role === 'killer'), sv = S.players.filter(p => p.role === 'survivor');
  for (const p of S.players) { p.stun = 0; p.reveal = 0; p.act = null; p.vault = null; p.atk = 0; p.aim = false; }
  const yawTo = (a, b) => Math.atan2(b.x - a.x, b.z - a.z);
  const spot = (x, z, fx, fz) => s.sim.safeSpot ? s.sim.safeSpot(x, z, fx, fz, 0) : { x, z };
  const lampPos = i => { const L = g.W.lamps[i]; if (!L || !L.glow) return null; const v = new THREE.Vector3(); L.glow.getWorldPosition(v); return v; };
  let cam = null, look = null, view = null, frames = 6;
  const gen = (k) => M.gens[k % M.gens.length];
  // pick the generator that has the most open ground around it (and, for some shots, a lamp near it)
  const openness = G => { let n = 0; for (let a = 0; a < 8; a++) { const p = spot(G.x + Math.sin(a * 0.785) * 5, G.z + Math.cos(a * 0.785) * 5, G.x, G.z); if (Math.hypot(p.x - G.x, p.z - G.z) > 4) n++; } return n; };
  const best = [...M.gens].sort((a, b) => openness(b) - openness(a))[0];
  if (SHOT === 'house' || SHOT === 'swing' || SHOT === 'crow' || SHOT === 'forest') {
    const G = best, d = { x: Math.sin(G.rot || 0), z: Math.cos(G.rot || 0) };
    const a = spot(G.x + d.x * 1.0, G.z + d.z * 1.0, G.x, G.z); const A = sv[0]; A.x = a.x; A.z = a.z; A.yaw = yawTo(A, G); A.act = { k: 'repair', id: M.gens.indexOf(G), t: 2 }; A.mv = 0;
    const b = spot(G.x - d.z * 1.1, G.z + d.x * 1.1, G.x, G.z); const B = sv[1]; B.x = b.x; B.z = b.z; B.yaw = yawTo(B, G); B.act = { k: 'repair', id: M.gens.indexOf(G), t: 2 };
    for (const o of sv.slice(2)) { const c = spot(G.x + 14, G.z - 12, G.x, G.z); o.x = c.x; o.z = c.z; }
    if (SHOT === 'house') {
      // the killer creeping up on two survivors at a generator, seen from behind her
      const k = spot(G.x + d.x * 6.5 + d.z * 2, G.z + d.z * 6.5 - d.x * 2, G.x, G.z); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, G);
      g.view && (g.view.visible = false);
      cam = new THREE.Vector3(K.x + (K.x - G.x) * 0.35 - d.z * 1.2, 2.3, K.z + (K.z - G.z) * 0.35 + d.x * 1.2); look = new THREE.Vector3(G.x, 0.9, G.z);
      me.x = K.x; me.z = K.z;
    } else if (SHOT === 'swing') {
      // first person: Granny's bat coming down on a survivor
      A.act = null; A.mv = 2; A.hp = 2; A.yaw = yawTo(G, A) + Math.PI;
      const k = spot(A.x + Math.sin(A.yaw) * -2.2, A.z + Math.cos(A.yaw) * -2.2, A.x, A.z); me.x = k.x; me.z = k.z; me.yaw = yawTo(me, A);
      g.camYaw = me.yaw; g.camPitch = -0.12; view = { atk: 1, atkF: 0.36 };
    } else if (SHOT === 'crow') {
      // June (with her crow) at a generator, Granny coming out of the dark behind it
      if (me !== A) { me.x = A.x; me.z = A.z; me.yaw = A.yaw; me.act = A.act; A.x = G.x + 30; A.z = G.z + 30; A.act = null; }
      me.crowF = 0;
      const k = spot(G.x - d.x * 7, G.z - d.z * 7, G.x, G.z); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, G);
      const back = { x: -Math.sin(me.yaw), z: -Math.cos(me.yaw) }, left = { x: Math.cos(me.yaw), z: -Math.sin(me.yaw) };
      cam = new THREE.Vector3(me.x + back.x * 1.5 + left.x * 0.75, 1.75, me.z + back.z * 1.5 + left.z * 0.75); look = new THREE.Vector3(G.x - d.x * 2.5, 1.2, G.z - d.z * 2.5);
    } else if (SHOT === 'forest') {
      // Tomás running with his flashlight up, Nosferatu in the mist behind
      me.act = null; me.mv = 2; me.flashOn = true; me.flash = 10; me.x = G.x + d.x * 4; me.z = G.z + d.z * 4; me.yaw = yawTo(G, me);
      const k = spot(me.x - Math.sin(me.yaw) * 7, me.z - Math.cos(me.yaw) * 7, me.x, me.z); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, me);
      cam = new THREE.Vector3(me.x + Math.sin(me.yaw) * 2.6 + Math.cos(me.yaw) * 0.8, 1.5, me.z + Math.cos(me.yaw) * 2.6 - Math.sin(me.yaw) * 0.8); look = new THREE.Vector3(K.x * 0.5 + me.x * 0.5, 1.2, K.z * 0.5 + me.z * 0.5);
    }
  } else if (SHOT === 'aim' || SHOT === 'angeline') {
    const G = best, d = { x: Math.sin(G.rot || 0), z: Math.cos(G.rot || 0) };
    const A = sv[0], a = spot(G.x + d.x * 1.0, G.z + d.z * 1.0, G.x, G.z); A.x = a.x; A.z = a.z; A.yaw = yawTo(A, G); A.act = { k: 'repair', id: M.gens.indexOf(G), t: 2 };
    for (const o of sv.slice(1)) { const c = spot(G.x + 16, G.z - 14, G.x, G.z); o.x = c.x; o.z = c.z; }
    const k = spot(G.x + d.x * 7, G.z + d.z * 7, G.x, G.z); me.x = k.x; me.z = k.z; me.yaw = yawTo(me, A);
    g.camYaw = me.yaw; g.camPitch = -0.06;
    if (SHOT === 'aim') view = { aim: true }; else { me.aim = true; me.abT = 1; }
  }
  if (SHOT === 'scout') {
    // 8 views round a centre, for picking camera spots
    const C = JSON.parse(window.__scoutC || '[3.4, 9.8]'), R = +(window.__scoutR || 22), out = [];
    g.view && (g.view.visible = false);
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; const cu = g.updateCamera.bind(g); g.updateCamera = (dt, S2, m2) => { cu(dt, S2, m2); g.camera.position.set(C[0] + Math.sin(a) * R, 3, C[1] + Math.cos(a) * R); g.camera.lookAt(C[0], 2.5, C[1]); }; g.frame(1 / 30); g.frame(1 / 30); g.view && (g.view.visible = false); if (g.composer) g.composer.render(1 / 30); out.push(g.renderer.domElement.toDataURL('image/jpeg', 0.8)); g.updateCamera = Object.getPrototypeOf(g).updateCamera.bind(g); }
    return out;
  }
  if (SHOT.startsWith('c_')) {
    // cinematic stills: a street lamp with open ground round it is the set; the camera goes where the game's never does
    const open = (x, z, r = 4.5) => { let n = 0; for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, tx = x + Math.sin(a) * r, tz = z + Math.cos(a) * r, p = spot(tx, tz, x, z); if (Math.hypot(p.x - tx, p.z - tz) < 0.6) n++; } return n; };
    const lamps = g.W.lamps.map((L, i) => lampPos(i)).filter(Boolean).map(v => ({ x: v.x, z: v.z, y: v.y, o: open(v.x, v.z) })).filter(l => !(M.isIndoors && M.isIndoors(l.x, l.z)));
    lamps.sort((a, b) => b.o - a.o || (Math.hypot(a.x - 3.4, a.z - 9.8) - Math.hypot(b.x - 3.4, b.z - 9.8)));
    const L = lamps[+(window.__lampIdx || 0)] || { x: 0, z: 0, y: 3 }; const P = spot(L.x, L.z, L.x, L.z);
    const H = { x: 3.4, z: 9.8 }; // Granny's House (map 'granny')
    const dirTo = (a, b) => { const l = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.x - a.x) / l, z: (b.z - a.z) / l }; };
    const at = (o, d, r, side = 0) => spot(o.x + d.x * r - d.z * side, o.z + d.z * r + d.x * side, o.x, o.z);
    const park = o => { const f = spot(P.x + 30, P.z + 30, P.x, P.z); o.x = f.x; o.z = f.z; };
    for (const o of sv) if (o !== me) park(o);
    me.x = P.x; me.z = P.z; g.hideMe = true;
    const fwd = CFG.map === 'granny' ? dirTo(P, H) : { x: 0, z: 1 };
    if (SHOT === 'c_granny') {
      // Granny in the east yard, seen from the ground: the house, the wreck and the lamps behind her
      const k = spot(20.6, 8.4, 20.6, 8.4); K.x = k.x; K.z = k.z; K.yaw = Math.PI / 2 + 0.2; me.x = K.x + 2; me.z = K.z;
      cam = new THREE.Vector3(K.x + 3.3, 0.45, K.z + 1.1); look = new THREE.Vector3(K.x - 2.5, 2.25, K.z + 0.2);
    } else if (SHOT === 'c_hunt') {
      // over Granny's shoulder: Mara creeping past the wreck, not knowing who's behind her
      const A = sv.find(o => o !== me) || sv[0]; const a = spot(17.6, 10.9, 17.6, 10.9); A.x = a.x; A.z = a.z; A.yaw = -Math.PI / 2 - 0.3; A.cr = 1; A.mv = 1;
      const k = spot(22.3, 8.3, 22.3, 8.3); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, A);
      const bk = dirTo(A, K); cam = new THREE.Vector3(K.x + bk.x * 1.25 - bk.z * 0.55, 1.85, K.z + bk.z * 1.25 + bk.x * 0.55); look = new THREE.Vector3(A.x, 0.8, A.z);
      me.x = (A.x + K.x) / 2; me.z = (A.z + K.z) / 2;
    } else if (SHOT === 'c_crow') {
      // June's crow close up, the killer coming out of the dark behind her
      const j = spot(18.5, 9.2, 18.5, 9.2); me.x = j.x; me.z = j.z; me.yaw = Math.PI / 2 - 0.35; me.crowF = 0; g.hideMe = false;
      const k = spot(11.5, 9.8, 11.5, 9.8); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, me);
      const fr = { x: Math.sin(me.yaw), z: Math.cos(me.yaw) }, lf = { x: Math.cos(me.yaw), z: -Math.sin(me.yaw) };
      cam = new THREE.Vector3(me.x + fr.x * 0.9 + lf.x * 0.55, 1.45, me.z + fr.z * 0.9 + lf.z * 0.55); look = new THREE.Vector3(me.x + lf.x * 0.18 - fr.x * 3, 1.5, me.z + lf.z * 0.18 - fr.z * 3);
    } else if (SHOT === 'c_grandpa') {
      // Grandpa raising the shotgun, low and close
      K.x = P.x + 0.7; K.z = P.z; K.yaw = 0.4; K.aim = true; K.abT = 1;
      const fr = { x: Math.sin(K.yaw), z: Math.cos(K.yaw) };
      cam = new THREE.Vector3(K.x + fr.x * 2.3 + fr.z * 1.1, 0.55, K.z + fr.z * 2.3 - fr.x * 1.1); look = new THREE.Vector3(K.x, 1.45, K.z);
    } else if (SHOT === 'c_forest') {
      // a crane shot: Tomás and his flashlight in the mist, Nosferatu among the trees
      me.x = P.x + 1; me.z = P.z; me.yaw = 2.2; me.flashOn = true; me.flash = 10; me.mv = 2; g.hideMe = false;
      const fr = { x: Math.sin(me.yaw), z: Math.cos(me.yaw) };
      const k = at(me, { x: -fr.x, z: -fr.z }, 6.5, 1.5); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, me);
      cam = new THREE.Vector3(me.x + fr.x * 3.5 - fr.z * 2.5, 6.5, me.z + fr.z * 3.5 + fr.x * 2.5); look = new THREE.Vector3((me.x + K.x) / 2, 0.6, (me.z + K.z) / 2);
    } else if (SHOT === 'c_angeline') {
      // Angeline's Yellow Eyes finding a survivor
      const A = sv.find(o => o !== me) || sv[0]; A.x = P.x + 0.6; A.z = P.z; A.yaw = 1.2; A.mv = 2;
      const k = at(A, { x: Math.sin(A.yaw + Math.PI), z: Math.cos(A.yaw + Math.PI) }, 5.5); K.x = k.x; K.z = k.z; K.yaw = yawTo(K, A); K.aim = true; K.abT = 1;
      const mid = { x: (A.x + K.x) / 2, z: (A.z + K.z) / 2 }, n = dirTo(K, A);
      cam = new THREE.Vector3(mid.x - n.z * 5.2, 1.3, mid.z + n.x * 5.2); look = new THREE.Vector3(mid.x, 1.3, mid.z); me.x = mid.x; me.z = mid.z;
    }
  }
  // settle the characters (poses, crow) and render
  if (cam) { const cu = g.updateCamera.bind(g); g.updateCamera = (dt, S2, m2) => { cu(dt, S2, m2); g.camera.position.copy(cam); g.camera.lookAt(look); }; }
  for (let i = 0; i < frames + 30; i++) g.frame(1 / 30);
  if (view && g.view) { for (let i = 0; i < 60; i++) animateView(g.view, { t: 1, speed: 0, ...view }, 1 / 30); }
  for (const arr of [g.W.gens, g.W.cages, g.W.gates]) for (const o of arr || []) if (o.userData.aura) o.userData.aura.visible = false; // (no prop outlines in a cinematic)
  for (const [id, c] of g.chars) { if (c.rig && c.rig.setAura) c.rig.setAura(null); c.aura = null; if (id === 'me' && g.hideMe && c.rig) c.rig.root.visible = false; }
  if (g.composer) g.composer.render(1 / 30); else g.renderer.render(g.scene, g.camera);
  return [g.renderer.domElement.toDataURL('image/png')];
}, [SHOT, CFG]);
const { mkdirSync, writeFileSync } = await import('node:fs'); mkdirSync(OUT, { recursive: true });
shots.forEach((d, i) => writeFileSync(join(OUT, SHOT + (shots.length > 1 ? '_' + i : '') + (d.startsWith('data:image/jpeg') ? '.jpg' : '.png')), Buffer.from(d.split(',')[1], 'base64')));
console.log(SHOT, 'saved', errs.length ? errs.slice(0, 4) : '');
await br.close(); srv.close();
