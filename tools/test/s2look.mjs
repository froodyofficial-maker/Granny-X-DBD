// Season 2 check (node s2look.mjs [gm=pages] [killer=father] [prefix] [quality]): the date is faked to 2 Dec 2026; also City Mode check: starts a bot match in City Mode from the source page (public/index.html), then shoots the city,
// the cars and pedestrians, a drive in a Victim's Car and the view from inside a hiding spot.
//   node citylook.mjs [role=survivor] [killer=granny] [prefix=/tmp/claude-0/city] [quality=medium]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const [gm = 'pages', killer = 'father', pre = '/tmp/claude-0/s2', quality = 'low'] = process.argv.slice(2); const role = 'survivor';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.ktx2': 'image/ktx2' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/public/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(([q]) => { window.__now = Date.UTC(2026, 11, 2); localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, teddy: 's2', killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [], item: 'teddy' } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: q, name: 'Tester' })); window.__nbNoRTC = true; window.__nbMqtt = ['ws://127.0.0.1:1']; }, [quality]);
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.waitForTimeout(6000);
await pg.click(`#mainnav button[data-act="play-${role}"]`, { force: true }); await pg.waitForTimeout(500);
const pick = (sel, v) => pg.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('change')); return [e.value, getComputedStyle(e).display, e.offsetParent ? 'vis' : 'hidden']; }, [sel, v]);
console.log('gm', await pick('#bots-gm', gm), errs);
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
  const s = window.__nb.session, g = s.game, S = s.sim.S, M = s.M, me = S.players.find(p => p.id === 'me'), K = S.players.find(p => p.role === 'killer');
  const out = [], info = { mode: S.mode, killer: K.char, item: me.item, teddy: me.teddy, need: S.gensNeeded };
  const snap = () => g.renderer.domElement.toDataURL('image/jpeg', 0.85);
  const shoot = (x, y, z, lx, ly, lz) => { g.frame(1 / 30); g.camera.position.set(x, y, z); g.camera.lookAt(lx, ly, lz); g.renderer.render(g.scene, g.camera); return snap(); };
  s.sim.update = (() => { const u = s.sim.update.bind(s.sim); return dt => u(dt); })();
  for (let i = 0; i < 10; i++) g.frame(1 / 30);
  // the killer, from the front, then with his tendrils out
  const f = () => ({ x: Math.sin(K.yaw), z: Math.cos(K.yaw) });
  s.bots.update = () => {};
  out.push(shoot(K.x + f().x * 4.5, 1.8, K.z + f().z * 4.5, K.x, 1.5, K.z));
  K.aim = true; K.abT = 0.3; for (let i = 0; i < 20; i++) g.frame(1 / 30);
  out.push(shoot(K.x + f().x * 4.5 + f().z * 2, 1.9, K.z + f().z * 4.5 - f().x * 2, K.x, 1.6, K.z));
  K.aim = false;
  // a page
  const pg0 = M.gens[0]; out.push(shoot(pg0.x + Math.sin(pg0.rot || 0) * 2.2, 1.5, pg0.z + Math.cos(pg0.rot || 0) * 2.2, pg0.x, 1.3, pg0.z));
  // the Teddy: put the killer in front of me facing me, hold it up
  me.x = K.x + f().x * 5; me.z = K.z + f().z * 5; me.tp++; me.yaw = Math.atan2(K.x - me.x, K.z - me.z);
  s.sim.onMsg('me', { t: 'act', a: 'teddy' });
  for (let i = 0; i < 10; i++) { s.sim.update(1 / 30); g.frame(1 / 30); }
  info.killerStun = +K.stun.toFixed(1); info.teddyLeft = me.teddy;
  out.push(shoot(me.x - Math.sin(me.yaw) * 2.6 + 0.8, 1.8, me.z - Math.cos(me.yaw) * 2.6, me.x, 1.2, me.z));
  info.prompt = (document.querySelector('#feed') || {}).textContent;
  return { out, info };
});
for (let i = 0; i < res.out.length; i++) await writeFile(`${pre}${i}.jpg`, Buffer.from(res.out[i].split(',')[1], 'base64'));
console.log(JSON.stringify(res.info), 'secs', ((Date.now() - t0) / 1000).toFixed(0));
console.log('errors', errs.filter(e => !/WebSocket|404/.test(e)).slice(0, 10));
await br.close(); srv.close();
