// 1.7.0: Profile (stats + Executions), the execution replay viewer, the Custom Game options. OUT=dir node ui170b.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', OUT = process.env.OUT || '.';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] },
    stats: { embers: 90000, matches: 12, escapes: 4, kills: 9 }, customGame: !!window.__cg, moris: { granny: { given: 2, faced: 1, victim: 'eli' }, grandpa: { given: 1, faced: 0 }, nosferatu: { faced: 1 } },
    prog: { xp: 7400, ranks: { survivor: 9, killer: 22 }, season: { id: 's1', xp: 1400, claimed: {}, prem: false }, badges: {} } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
});
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.addStyleTag({ content: '#announce{display:none!important}' });
const click = q => pg.evaluate(q => document.querySelector(q).click(), q);
await pg.waitForTimeout(3000);
await click('#profile'); await pg.waitForTimeout(800);
await pg.evaluate(() => { const e = document.querySelector('.pf-stats'); e && e.scrollIntoView(); });
await pg.screenshot({ path: OUT + '/u7_profile.png', timeout: 180000 });
await click('[data-mori="granny"]'); await pg.waitForTimeout(16000);
await pg.screenshot({ path: OUT + '/u7_view1.png', timeout: 180000 }); await pg.waitForTimeout(3000);
await pg.screenshot({ path: OUT + '/u7_view2.png', timeout: 180000 });
await click('#mv-close'); await pg.waitForTimeout(400);
await click('#panel-close'); await pg.waitForTimeout(400);
await click('#mainnav button[data-act="play-killer"]'); await pg.waitForTimeout(500);
await pg.selectOption('#bots-gm', 'custom'); await pg.waitForTimeout(500);
await pg.evaluate(() => document.getElementById('bots-custom').scrollIntoView());
await pg.screenshot({ path: OUT + '/u7_custom_locked.png', timeout: 180000 });
await pg.evaluate(() => document.querySelector('[data-cgbuy]').click()); await pg.waitForTimeout(500);
await pg.evaluate(() => { for (let i = 0; i < 8; i++) document.querySelector('[data-cgn="k"][data-d="1"]').click(); document.querySelector('[data-cgs="kPerks"][data-v="pick"]').click(); });
await pg.evaluate(() => { document.querySelector('[data-cgp="kPick"]').click(); document.querySelector('[data-cgban="taser"]').click(); });
await pg.evaluate(() => document.getElementById('bots-custom').scrollIntoView());
await pg.screenshot({ path: OUT + '/u7_custom.png', timeout: 180000 });
console.log(JSON.stringify(await pg.evaluate(() => ({ cg: window.__nb.profile.customGame, cfg: window.__nb.profile.customCfg, em: window.__nb.profile.stats.embers }))), 'errors', errs);
await br.close(); srv.close();
