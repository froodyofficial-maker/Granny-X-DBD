// City Mode: hide in a dumpster, climb back out, and check the hiding overlay (#hideov) goes away with it.
//   node hidetest.mjs   (serves this repo; the event has to be open: window.__now fakes the date otherwise)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/public/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(() => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'T' })); window.__nbMqtt = ['ws://127.0.0.1:1']; window.__now = Date.UTC(2026, 10, 20); });
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.evaluate(() => document.querySelector('[data-act="play-survivor"]').click()); await pg.waitForTimeout(500);
await pg.evaluate(() => { const e = document.querySelector('#bots-gm'); e.value = 'city'; e.dispatchEvent(new Event('change')); document.querySelector('#btn-bots-start').click(); });
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1, null, { timeout: 300000 });
const ov = () => pg.evaluate(() => { const o = document.getElementById('hideov'); return o ? o.classList.contains('on') && getComputedStyle(o).display !== 'none' : false; });
await pg.evaluate(() => { const s = window.__nb.session, sim = s.sim, M = sim.M, me = sim.S.players.find(p => p.id === 'me'); for (const K of sim.S.players) if (K.role === 'killer') { K.x = 70; K.z = 70; }
  const h = M.hides.find(h => h.kind === 'dumpster') || M.hides[0]; me.x = h.x + Math.sin(h.yaw) * 1.6; me.z = h.z + Math.cos(h.yaw) * 1.6; me.tp++; window.__h = h;
  window.__nb.session.game.onKeyCode({ code: 'KeyE', repeat: false, target: document.body, preventDefault() {} }, true); });
await pg.waitForFunction(() => window.__nb.session.sim.S.players.find(p => p.id === 'me').hide >= 0, null, { timeout: 20000 });
await pg.evaluate(() => window.__nb.session.game.onKeyCode({ code: 'KeyE', repeat: false, target: document.body, preventDefault() {} }, false));
await pg.waitForTimeout(1500);
const inside = await ov();
await pg.evaluate(() => window.__nb.session.game.onKeyCode({ code: 'KeyE', repeat: false, target: document.body, preventDefault() {} }, true));
await pg.waitForFunction(() => window.__nb.session.sim.S.players.find(p => p.id === 'me').hide < 0, null, { timeout: 20000 });
await pg.evaluate(() => window.__nb.session.game.onKeyCode({ code: 'KeyE', repeat: false, target: document.body, preventDefault() {} }, false));
await pg.evaluate(() => window.__nb.session.game.onKeyCode({ code: 'KeyW', repeat: false, target: document.body, preventDefault() {} }, true));
await pg.waitForTimeout(2000);
await pg.evaluate(() => window.__nb.session.game.onKeyCode({ code: 'KeyW', repeat: false, target: document.body, preventDefault() {} }, false));
const after = await ov();
await pg.screenshot({ path: process.env.OUT || 'hide_after.png' });
console.log(JSON.stringify({ overlayWhileHiding: inside, overlayAfterClimbingOut: after }), 'errors', errs);
await br.close(); srv.close();
