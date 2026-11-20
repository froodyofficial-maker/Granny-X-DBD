// takeover online: host A + client B in a lobby with bots; B dies, presses T, and must end up playing a bot's survivor.
//   node broker.mjs (local relay) first; then node takeonline.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
async function player(name) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(n => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, readInbox: { gdbd153: true, gdbd152: true } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'potato', name: n, net: 'p2p', lb: false })); window.__nbNoRTC = true; window.__nbMqtt = ['ws://localhost:8883']; }, name);
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e.message));
  await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
  await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
  await pg.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 300000 }); await pg.waitForTimeout(3000);
  await pg.addStyleTag({ content: '#announce{display:none!important}' });
  return { ctx, pg };
}
const A = await player('HostA'), B = await player('JoinB');
await A.pg.evaluate(q => document.querySelector(q).click(), '[data-act="online"]'); await A.pg.waitForTimeout(500);
await A.pg.evaluate(q => document.querySelector(q).click(), '#btn-host');
await A.pg.waitForFunction(() => window.__nb.lobby && window.__nb.lobby.code, null, { timeout: 60000 });
await B.pg.evaluate(q => document.querySelector(q).click(), '[data-act="online"]');
await B.pg.waitForSelector('[data-join]', { timeout: 30000, state: 'attached' });
await B.pg.evaluate(q => document.querySelector(q).click(), '[data-join]');
await B.pg.waitForFunction(() => window.__nb.lobby && window.__nb.lobby.players.length === 2, null, { timeout: 60000 });
await A.pg.evaluate(q => document.querySelector(q).click(), '#btn-lobby-start');
const inGame = pg => pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && document.getElementById('loading').classList.contains('hidden') && !document.documentElement.classList.contains('ls-up'), null, { timeout: 400000 });
await inGame(A.pg); await inGame(B.pg); console.log('both in');
await B.pg.waitForTimeout(3000);
const ids = await A.pg.evaluate(() => { const s = window.__nb.session, S = s.sim.S; return S.players.map(p => [p.id, p.name, p.role, p.bot, p.st]); });
console.log('host players', JSON.stringify(ids));
const bId = await B.pg.evaluate(() => window.__nb.session.game.myId);
console.log('B myId', bId);
await A.pg.evaluate(id => { const s = window.__nb.session, S = s.sim.S, p = S.players.find(p => p.id === id); s.sim.kill(p, 'sacrificed'); }, bId);
await B.pg.waitForTimeout(3000);
console.log('B before', JSON.stringify(await B.pg.evaluate(() => { const g = window.__nb.session.game, me = g.mine(), t = g.takeoverTarget(); return { st: me && me.st, target: t && t.id, hint: (document.querySelector('.takeover') || {}).textContent || null }; })));
await B.pg.keyboard.press('KeyT'); await B.pg.waitForTimeout(4000);
console.log('B after', JSON.stringify(await B.pg.evaluate(() => { const g = window.__nb.session.game, me = g.mine(); return { myId: g.myId, st: me && me.st, bot: me && me.bot, name: me && me.name }; })));
console.log('host view', JSON.stringify(await A.pg.evaluate(() => window.__nb.session.sim.S.players.map(p => [p.id, p.name, p.bot, p.st]))));
// B moves: does the host see the taken-over body move?
const p0 = await A.pg.evaluate(id => { const S = window.__nb.session.sim.S, p = S.players.find(p => p.name === 'JoinB' && p.st === 'ok'); return p && [p.id, p.x, p.z]; });
await B.pg.keyboard.down('KeyW'); await B.pg.waitForTimeout(2500); await B.pg.keyboard.up('KeyW');
const p1 = await A.pg.evaluate(id => { const S = window.__nb.session.sim.S, p = S.players.find(p => p.id === id); return p && [p.id, p.x, p.z]; }, p0 && p0[0]);
console.log('moved', JSON.stringify(p0), JSON.stringify(p1));
console.log('errors', errs); await br.close(); srv.close();
