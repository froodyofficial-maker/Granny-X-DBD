// 1.4 screens: Loadout (levels, stats, sidekick), Store sidekicks, Progress (season pass), bot panel in 2v8
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'angeline', perks: ['scent', 'overload', 'relentless', 'brute'], pet: 'child' }, survivor: { char: 'mara', perks: [] },
    stats: { embers: 90000, matches: 12, escapes: 4, kills: 9 }, pets: { child: true }, perksOwned: { brute: true }, chars: { angeline: { xp: 9000, st: { spd: 3, cd: 2 } }, mara: { xp: 2500, st: {} } },
    prog: { xp: 7400, ranks: { survivor: 9, killer: 22 }, season: { id: 's1', xp: 6400, claimed: { 1: true, 2: true }, prem: false }, badges: {} } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
});
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.addStyleTag({ content: '#announce{display:none!important}' });
const click = q => pg.evaluate(q => document.querySelector(q).click(), q);
await pg.waitForTimeout(3000);
await pg.screenshot({ path: 'u_menu.png' });
await click('[data-act="loadout"]'); await pg.waitForTimeout(800); await click('#lo-tab [data-v="killer"]'); await pg.waitForTimeout(1200);
await pg.screenshot({ path: 'u_loadout.png' });
await click('#panel-close'); await pg.waitForTimeout(400);
await click('[data-act="store"]'); await pg.waitForTimeout(600); await click('#st-tabs [data-t="sidekicks"]'); await pg.waitForTimeout(800);
await pg.screenshot({ path: 'u_store.png' });
await click('#st-close'); await pg.waitForTimeout(400);
await click('[data-act="pass"]'); await pg.waitForTimeout(1000);
await pg.screenshot({ path: 'u_pass.png' });
await click('#panel-close'); await pg.waitForTimeout(400);
await click('[data-act="play-killer"]'); await pg.waitForTimeout(600); await pg.selectOption('#bots-gm', 'duo'); await pg.waitForTimeout(600);
await pg.screenshot({ path: 'u_bots.png' });
console.log('errors', errs); await br.close(); srv.close();
