// 1.6.0: the Tamed Crow in a match (on the shoulder, in flight) + the taser's battery cells in the HUD.
// node crowlook.mjs outprefix   (web build index.html; quality from Q, default medium)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', pre = process.argv[2] || '/tmp/claude-0/crowlook';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(q => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, pets: { crow: true }, addons: { cellswap: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'june', perks: [], pet: 'crow', addons: ['cellswap'] } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: q, name: 'Tester' }));
  window.__nbNoRTC = true; window.__nbMqtt = ['ws://127.0.0.1:1'];
}, process.env.Q || 'medium');
const pg = await ctx.newPage(); pg.setDefaultTimeout(240000);
const errs = []; pg.on('pageerror', e => errs.push('PAGEERROR ' + e.message)); pg.on('console', m => { if (m.type() === 'error' && !/WebSocket|ws:\/\/|ERR_/.test(m.text())) errs.push(m.text()); });
await pg.goto(`http://localhost:${srv.address().port}/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.click('#mainnav button[data-act="play-survivor"]'); await pg.waitForTimeout(600);
await pg.selectOption('#bots-map', 'granny1'); await pg.selectOption('#bots-killer', 'grandpa');
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1.5, null, { timeout: 300000 });
const frame = async (name, setup) => {
  await pg.evaluate(setup);
  await pg.waitForTimeout(400);
  await pg.evaluate(() => { const g = window.__nb.session.game; for (let i = 0; i < 4; i++) g.frame(1 / 30); });
  await pg.screenshot({ path: `${pre}-${name}.png` });
};
// keep the killer away so nothing interrupts
await pg.evaluate(() => { const S = window.__nb.session.sim.S, K = S.players.find(p => p.role === 'killer'); K.stun = 999; const me = S.players.find(p => p.id === 'me'); me.crowCd = 999; me.item = 'taser'; me.tasers = 2; me.taserMax = 3; });
await pg.waitForFunction(() => window.__nb.session.game.crows && window.__nb.session.game.crows.size > 0, null, { timeout: 60000 }).catch(() => errs.push('no crow made'));
// 1: from behind, crow on the left shoulder
await frame('perch', () => { const g = window.__nb.session.game; g.camPitch = 0.15; });
// 2: a close look (camera right beside her)
await frame('close', () => { const g = window.__nb.session.game; g.camPitch = 0.05; g.camYaw = (g.camYaw || 0) + 2.4; });
// 3: in flight, looking up
await frame('fly', () => { const S = window.__nb.session.sim.S, me = S.players.find(p => p.id === 'me'); me.crowF = 2.4; const g = window.__nb.session.game; g.camPitch = -0.55; });
// 4: the caw: the killer's outline
await frame('caw', () => { const S = window.__nb.session.sim.S, me = S.players.find(p => p.id === 'me'); me.crowF = 0; me.crowSee = 5; window.__nb.session.game.onEvents([{ k: 'crowcaw', id: 'me', by: S.players.find(p => p.role === 'killer').id, x: 0, z: 0 }]); window.__nb.session.game.camPitch = 0.1; });
const info = await pg.evaluate(() => { const g = window.__nb.session.game, C = [...(g.crows || new Map()).values()][0]; return { crows: g.crows && g.crows.size, vis: C && C.m.visible, pos: C && C.pos.toArray().map(v => +v.toFixed(2)), cells: (document.getElementById('tcells') || {}).innerHTML, item: document.getElementById('item').innerText.slice(0, 160) }; });
console.log(JSON.stringify(info));
console.log('errors:', errs.length ? errs.slice(0, 10) : 'none');
await br.close(); srv.close();
