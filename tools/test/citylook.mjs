// City Mode check: starts a bot match in City Mode from the source page (public/index.html), then shoots the city,
// the cars and pedestrians, a drive in a Victim's Car and the view from inside a hiding spot.
//   node citylook.mjs [role=survivor] [killer=granny] [prefix=/tmp/claude-0/city] [quality=medium]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const [role = 'survivor', killer = 'granny', pre = '/tmp/claude-0/city', quality = 'medium'] = process.argv.slice(2);
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/public/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(([q]) => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: q, name: 'Tester' })); window.__nbNoRTC = true; window.__nbMqtt = ['ws://127.0.0.1:1']; }, [quality]);
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.waitForTimeout(6000);
await pg.click(`#mainnav button[data-act="play-${role}"]`, { force: true }); await pg.waitForTimeout(500);
const pick = (sel, v) => pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('change')); return [e.value, getComputedStyle(e).display, e.offsetParent ? 'vis' : 'hidden']; }, [sel, v]);
console.log('gm', await pick('#bots-gm', 'city'), errs);
if (role === 'survivor') await pick('#bots-killer', killer);
await pg.evaluate(() => document.querySelector('#btn-bots-start').click());
pg.on('console', m => { if (/Error|error/.test(m.text())) console.log('[console]', m.text().slice(0, 300)); });
pg.on('response', r => { if (r.status() === 404) console.log('404', r.url()); });
for (let i = 0; i < 60; i++) {
  const st = await pg.evaluate(() => ({ s: !!window.__nb.session, g: !!(window.__nb.session && window.__nb.session.game), t: window.__nb.session && window.__nb.session.sim ? window.__nb.session.sim.S.t : -1, load: (document.querySelector('#loading') || {}).textContent?.slice(0, 80), toast: (document.querySelector('#toast') || {}).textContent }));
  if (st.t > 2) break;
  if (i % 6 === 0) console.log(JSON.stringify(st), errs.slice(-3));
  await pg.waitForTimeout(5000);
}
const t0 = Date.now();
const res = await pg.evaluate(async () => {
  const s = window.__nb.session, g = s.game, S = s.sim.S, M = s.M, me = S.players.find(p => p.id === 'me');
  const out = [], info = { map: s.map, cars: S.cars.length, peds: S.peds.length, hides: M.hides.length };
  const snap = () => g.renderer.domElement.toDataURL('image/jpeg', 0.85);
  const shoot = (x, y, z, lx, ly, lz) => { g.frame(1 / 30); g.camera.position.set(x, y, z); g.camera.lookAt(lx, ly, lz); g.renderer.render(g.scene, g.camera); return snap(); };
  for (let i = 0; i < 20; i++) g.frame(1 / 30);
  out.push(snap()); // the player's own view
  // a street: the camera on a kerb looking down the road at a parked car
  const c0 = S.cars[0];
  out.push(shoot(c0.x + 7, 1.7, c0.z + 9, c0.x, 0.8, c0.z));
  out.push(shoot(0, 60, 75, 0, 0, 0));
  // pedestrians
  const ped = S.peds.find(q => q.s === 0);
  if (ped) out.push(shoot(ped.x + 3, 1.6, ped.z + 3, ped.x, 1.0, ped.z));
  // get in the nearest car and drive it for 3 seconds
  const sim = s.sim, car = S.cars.filter(c => c.pd < 0).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  const cx0 = car.x, cz0 = car.z; me.x = car.x + 2; me.z = car.z; me.tp++;
  sim.inputs.get('me').e = true; sim.inputs.get('me').latch = false;
  for (let i = 0; i < 40 && me.car < 0; i++) { sim.update(1 / 30); }
  info.inCar = me.car;
  sim.inputs.get('me').e = false;
  g.paused = false; info.paused = g.paused; g.keys.add('KeyW');
  for (let i = 0; i < 90; i++) g.frame(1 / 30);
  info.drove = Math.hypot(me.x - cx0, me.z - cz0).toFixed(1);
  out.push(snap());
  g.keys.delete('KeyW');
  // get out, then hide in a dumpster
  sim.inputs.get('me').e = true; sim.inputs.get('me').latch = false;
  for (let i = 0; i < 30 && me.car >= 0; i++) sim.update(1 / 30);
  sim.inputs.get('me').e = false; info.out = me.car;
  const h = M.hides.find(h => h.kind === 'dumpster');
  me.x = h.x + Math.sin(h.yaw) * 1.6; me.z = h.z + Math.cos(h.yaw) * 1.6; me.tp++; me.st = 'ok';
  sim.inputs.get('me').latch = false; sim.inputs.get('me').e = true;
  for (let i = 0; i < 40 && me.hide < 0; i++) sim.update(1 / 30);
  sim.inputs.get('me').e = false; info.hid = me.hide;
  for (let i = 0; i < 10; i++) g.frame(1 / 30);
  out.push(snap());
  info.prompt = document.querySelector('#prompt') ? document.querySelector('#prompt').textContent : '';
  out.push(shoot(h.x + Math.sin(h.yaw) * 3 + 1, 1.8, h.z + Math.cos(h.yaw) * 3, h.x, 0.7, h.z));
  return { out, info, perf: g.renderer.info.render.calls };
});
for (let i = 0; i < res.out.length; i++) await writeFile(`${pre}${i}.jpg`, Buffer.from(res.out[i].split(',')[1], 'base64'));
console.log(JSON.stringify(res.info), 'calls', res.perf, 'shots', res.out.length, 'secs', ((Date.now() - t0) / 1000).toFixed(0));
console.log('errors', errs.slice(0, 10));
await br.close(); srv.close();
