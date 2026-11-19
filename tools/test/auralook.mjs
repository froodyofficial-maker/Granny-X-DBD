// Aura outline check (auralook.mjs [role] [killer] [prefix] [quality]). Was: City Mode check: starts a bot match in City Mode from the source page (public/index.html), then shoots the city,
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
console.log('gm', await pick('#bots-gm', 'classic'), errs);
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
const res = await pg.evaluate(async () => {
  const s = window.__nb.session, g = s.game, S = s.sim.S, me = S.players.find(p => p.id === 'me'), K = S.players.find(p => p.role === 'killer');
  s.sim.update = () => {}; s.bots.update = () => {};
  const mates = S.players.filter(p => p.role === 'survivor' && p.id !== 'me');
  // teammates spread out ahead of me, the killer exposed (outlined for survivors)
  const f = { x: Math.sin(g.camYaw), z: Math.cos(g.camYaw) };
  mates.forEach((p, i) => { p.x = me.x + f.x * (9 + i * 4) + (i - 1) * 2.5 * f.z; p.z = me.z + f.z * (9 + i * 4) - (i - 1) * 2.5 * f.x; p.tp++; });
  K.x = me.x + f.x * 14 - 4 * f.z; K.z = me.z + f.z * 14 + 4 * f.x; K.tp++; K.exposed = 30;
  for (let i = 0; i < 20; i++) g.frame(1 / 30);
  const out = [g.renderer.domElement.toDataURL('image/jpeg', 0.9)];
  return { out };
});
for (let i = 0; i < res.out.length; i++) await writeFile(`${pre}${i}.jpg`, Buffer.from(res.out[i].split(',')[1], 'base64'));
console.log('errors', errs.filter(e => !/WebSocket|404/.test(e)).slice(0, 10));
await br.close(); srv.close();
