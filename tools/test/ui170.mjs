// 1.7.0 screens: killer Loadout (first-person / third-person marks), Progress (Collect all, scroll kept after a claim)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', OUT = process.env.OUT || '.';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(fr => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] },
    stats: { embers: 90000, matches: 12, escapes: 4, kills: 9 },
    prog: { xp: 7400, ranks: { survivor: 9, killer: 22 }, season: { id: 's1', xp: 19400, claimed: { 1: true, 2: true }, prem: true }, badges: {} } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
});
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.addStyleTag({ content: '#announce{display:none!important}' });
const click = q => pg.evaluate(q => document.querySelector(q).click(), q);
await pg.waitForTimeout(3000);
await click('[data-act="loadout"]'); await pg.waitForTimeout(800); await click('#lo-tab [data-v="killer"]'); await pg.waitForTimeout(1200);
await pg.screenshot({ path: OUT + '/u7_loadout.png' });
await click('#panel-close'); await pg.waitForTimeout(400);
await click('[data-act="pass"]'); await pg.waitForTimeout(1000);
await pg.screenshot({ path: OUT + '/u7_pass.png' });
const before = await pg.evaluate(() => { const s = document.querySelector('#pass-body .sp-scroll'); s.scrollLeft = 600; return s.scrollLeft; });
await click('#pass-body [data-claim]'); await pg.waitForTimeout(500);
const after = await pg.evaluate(() => document.querySelector('#pass-body .sp-scroll').scrollLeft);
const em0 = await pg.evaluate(() => window.__nb.profile.stats.embers);
await click('#pass-body [data-claimall]'); await pg.waitForTimeout(600);
const em1 = await pg.evaluate(() => window.__nb.profile.stats.embers);
await pg.screenshot({ path: OUT + '/u7_pass2.png' });
console.log(JSON.stringify({ before, after, em0, em1, left: await pg.evaluate(() => document.querySelectorAll('#pass-body [data-claim]').length) }), 'errors', errs);
await br.close(); srv.close();
