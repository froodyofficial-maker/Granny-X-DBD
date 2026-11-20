// 1.5.3: in-match shots of the GTA VI desk (a killer hit by the game case), a case in the air, and collectables.
//   node vicelook.mjs <killer> <map> <outprefix>     (web build, served from the project root)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const [killer = 'granny', map = 'granny', pre = 'vl'] = process.argv.slice(2);
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(() => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [], item: 'gtaps' }, gtaps: true, stats: { embers: 1000, matches: 3, escapes: 1, kills: 2 }, readInbox: { gdbd153: true, gdbd152: true, gdbd151: true } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'medium', name: 'Tester', lb: false })); });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.waitForTimeout(6000); await pg.click('#mainnav button[data-act="play-survivor"]', { force: true }); await pg.waitForTimeout(500);
await pg.selectOption('#bots-map', map); await pg.selectOption('#bots-killer', killer);
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 2, null, { timeout: 240000 });
const shots = await pg.evaluate(async () => {
  const s = window.__nb.session, g = s.game, S = s.sim.S, K = S.players.find(p => p.role === 'killer'), me = S.players.find(p => p.id === 'me');
  s.bots.update = () => {};
  const out = [], info = { item: me.item, gtaps: me.gtaps, colls: S.colls.map(o => o.c) };
  // a killer frozen at the desk: put me 6 m in front of the killer and throw
  const f = { x: Math.sin(K.yaw), z: Math.cos(K.yaw) };
  me.x = K.x + f.x * 6; me.z = K.z + f.z * 6; me.fl = K.fl || 0; me.yaw = K.yaw + Math.PI; K.stun = 0;
  s.sim.onMsg('me', { t: 'act', a: 'gtaps', yaw: Math.atan2(K.x - me.x, K.z - me.z), pitch: 0 });
  for (let i = 0; i < 6; i++) { s.step ? s.step(1 / 30) : s.sim.update(1 / 30); g.frame(1 / 30); }
  const shoot = (x, y, z, lx, ly, lz) => { g.frame(1 / 30); g.camera.position.set(x, y, z); g.camera.lookAt(lx, ly, lz); g.renderer.render(g.scene, g.camera); return g.renderer.domElement.toDataURL('image/jpeg', 0.85); };
  const c = S.cases[0]; if (c) out.push(shoot(c.x + 1.2, 1.6, c.z + 1.2, c.x, c.y, c.z));
  for (let i = 0; i < 40 && !(K.gamed > 0); i++) { s.sim.update(1 / 30); g.frame(1 / 30); }
  info.gamed = K.gamed;
  s.sim.update = () => {};
  for (let i = 0; i < 4; i++) g.frame(1 / 30);
  const d = g.viceDesk && g.viceDesk.get(K.id), y = d ? d.userData.yaw : K.yaw, F = { x: Math.sin(y), z: Math.cos(y) };
  out.push(shoot(K.x + F.x * 2.4 + F.z * 1.4, 1.7, K.z + F.z * 2.4 - F.x * 1.4, K.x, 0.9, K.z));
  out.push(shoot(K.x - F.x * 2.2 + F.z * 1.6, 1.8, K.z - F.z * 2.2 - F.x * 1.6, K.x + F.x * 0.7, 1.1, K.z + F.z * 0.7));
  // collectables: drop each kind near me and look
  S.colls = ['monster', 'gtacase', 'goldted', 'page', 'key', 'bulb'].map((c, i) => ({ c, x: me.x + (i - 2.5) * 0.9, z: me.z + 1.5, fl: me.fl || 0 }));
  for (let i = 0; i < 30; i++) { g.frame(1 / 30); await new Promise(r => setTimeout(r, 30)); }
  out.push(shoot(me.x, 1.5, me.z - 1.6, me.x, 0.4, me.z + 1.5));
  return { out, info };
});
const fs = await import('node:fs'); shots.out.forEach((d, i) => fs.writeFileSync(`${pre}${i}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
console.log(JSON.stringify(shots.info), 'errors', errs);
await br.close(); srv.close();
