// City Mode driving with real key presses (cardrive.mjs [role] [killer] [prefix] [quality]). Was: City Mode check: starts a bot match in City Mode from the source page (public/index.html), then shoots the city,
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
const ev = (f, ...a) => pg.evaluate(f, ...a);
const st = () => ev(() => { const s = window.__nb.session, me = s.sim.S.players.find(p => p.id === 'me'); const it = window.__findIt ? window.__findIt() : null; return { car: me.car, x: +me.x.toFixed(2), z: +me.z.toFixed(2), act: me.act && me.act.k, prog: me.prog, paused: s.game.paused, keys: [...s.game.keys].join(','), drive: s.game.drive && { v: +s.game.drive.v.toFixed(2), x: +s.game.drive.x.toFixed(1) } }; });
// freeze the bots so nobody interferes; put me beside the nearest empty car
const info = await ev(() => {
  const s = window.__nb.session, S = s.sim.S, me = S.players.find(p => p.id === 'me');
  s.bots.update = () => {};
  for (const p of S.players) if (p.role === 'killer') { p.x = 70; p.z = 70; p.tp++; }
  const car = S.cars.filter(c => c.pd < 0).sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0];
  const side = { x: Math.cos(car.y) * 1.7, z: -Math.sin(car.y) * 1.7 };
  me.x = car.x + side.x; me.z = car.z + side.z; me.tp++;
  window.__car0 = { id: car.id, x: car.x, z: car.z };
  return { car: car.id, at: [+car.x.toFixed(1), +car.z.toFixed(1)], me: [+me.x.toFixed(1), +me.z.toFixed(1)] };
});
console.log('setup', JSON.stringify(info));
await pg.mouse.click(640, 360); await pg.waitForTimeout(300);
console.log('before', JSON.stringify(await st()));
await pg.keyboard.down('KeyE'); await pg.waitForTimeout(1200); console.log('E held', JSON.stringify(await st()));
await pg.keyboard.up('KeyE'); await pg.waitForTimeout(300);
console.log('after E', JSON.stringify(await st()));
await pg.keyboard.down('KeyW'); await ev(() => { const g = window.__nb.session.game; for (let i = 0; i < 90; i++) g.frame(1 / 30); }); console.log('W held 3s (fixed steps)', JSON.stringify(await st()));
await pg.keyboard.up('KeyW');
const moved = await ev(() => { const me = window.__nb.session.sim.S.players.find(p => p.id === 'me'), c = window.__car0; return Math.hypot(me.x - c.x, me.z - c.z).toFixed(1); });
console.log('moved', moved);
const shot = await ev(() => { const g = window.__nb.session.game; g.frame(1 / 30); return g.renderer.domElement.toDataURL('image/jpeg', 0.8); });
await writeFile(pre + '-drive.jpg', Buffer.from(shot.split(',')[1], 'base64'));
await pg.keyboard.down('KeyE'); await pg.waitForTimeout(900); await pg.keyboard.up('KeyE'); await pg.waitForTimeout(300);
console.log('exit', JSON.stringify(await st()));
console.log('errors', errs.filter(e => !/WebSocket|404/.test(e)).slice(0, 10));
await br.close(); srv.close();
