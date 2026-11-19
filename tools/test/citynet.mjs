// City Mode online: host A + client B (start `node broker.mjs` first). B (a client) gets into a car and drives it.
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/public/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const errs = [];
async function player(name) {
  const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addInitScript(n => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'potato', name: n, net: 'p2p' })); window.__nbNoRTC = true; window.__nbMqtt = ['ws://localhost:8883']; }, name);
  const pg = await ctx.newPage(); pg.on('pageerror', e => errs.push(name + ': ' + e.message));
  await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
  await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
  await pg.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 300000 }); await pg.waitForTimeout(3000);
  await pg.addStyleTag({ content: '#announce{display:none!important}' });
  return { ctx, pg };
}
const list = pg => pg.evaluate(() => [document.getElementById('lb-count').textContent, [...document.querySelectorAll('.lb-row')].map(r => r.innerText.replace(/\s+/g, ' '))]);
const A = await player('HostA'), B = await player('JoinB');
await A.pg.evaluate(q => document.querySelector(q).click(), '[data-act="online"]'); await A.pg.waitForTimeout(500);
await A.pg.evaluate(q => document.querySelector(q).click(), '#btn-host');
await A.pg.waitForFunction(() => window.__nb.lobby && window.__nb.lobby.code, null, { timeout: 60000 });
await B.pg.evaluate(q => document.querySelector(q).click(), '[data-act="online"]');
await B.pg.waitForSelector('[data-join]', { timeout: 30000, state: 'attached' });
await B.pg.evaluate(q => document.querySelector(q).click(), '[data-join]');
await B.pg.waitForFunction(() => window.__nb.lobby && window.__nb.lobby.players.length === 2, null, { timeout: 60000 });
console.log('B joined');
await B.pg.evaluate(() => { window.__toasts = []; new MutationObserver(() => window.__toasts.push(Math.round(performance.now()) + ' ' + document.getElementById('toast').textContent)).observe(document.getElementById('toast'), { childList: true, characterData: true, subtree: true }); });
console.log('before start A lobby', await A.pg.evaluate(() => [window.__nb.lobby.players.map(p => p.name + ':' + p.id).join(), window.__nb.lobby.map]), 'B lobby', await B.pg.evaluate(() => window.__nb.lobby && [window.__nb.lobby.players.map(p => p.name).join(), window.__nb.lobby.myId, document.getElementById('p-lobby').classList.contains('hidden')]));
await A.pg.evaluate(() => { const n = window.__nb.lobby.net, b = n.broadcast.bind(n); window.__sent = {}; n.broadcast = (m, ...r) => { window.__sent[m.t] = (window.__sent[m.t] || 0) + 1; return b(m, ...r); }; });
await A.pg.evaluate(() => { const g = document.querySelector('#lobby-gm'); g.value = 'city'; g.dispatchEvent(new Event('change')); });
await A.pg.waitForTimeout(800);
await A.pg.evaluate(q => document.querySelector(q).click(), '#btn-lobby-start');
for (const P of [A, B]) await P.pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 400000 });
console.log('both in', await A.pg.evaluate(() => window.__nb.session.sim.S.mode));
// host: freeze the bots, put B beside an empty car
const setup = await A.pg.evaluate(() => {
  const s = window.__nb.session, S = s.sim.S, b = S.players.find(p => !p.bot && p.id !== s.myId);
  s.bots.update = () => {}; for (const p of S.players) if (p.role === 'killer') { p.x = 70; p.z = 70; p.tp++; }
  const car = S.cars.filter(c => c.pd < 0).sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
  b.x = car.x + Math.cos(car.y) * 1.7; b.z = car.z - Math.sin(car.y) * 1.7; b.tp++;
  window.__car0 = { id: car.id, x: car.x, z: car.z }; return { b: b.id, car: car.id, role: b.role };
});
console.log('setup', JSON.stringify(setup));
await A.pg.evaluate(id => { const sim = window.__nb.session.sim; window.__log = []; const om = sim.onMsg.bind(sim); sim.onMsg = (pid, m) => { if (pid === id && m.t !== 'pos') window.__log.push(sim.S.t.toFixed(2) + ' ' + JSON.stringify(m)); if (pid === id && m.t === 'pos' && window.__log.filter(x => x.includes('pos')).length < 400) { const p = sim.S.players.find(q => q.id === id); if (p.car >= 0 || m.cy != null) window.__log.push(sim.S.t.toFixed(2) + ' pos tp' + m.tp + '/' + p.tp + ' car' + p.car + ' cy' + m.cy); } return om(pid, m); }; const ev = sim.ev.bind(sim); sim.ev = e => { if (/car|hide/.test(e.k)) window.__log.push(sim.S.t.toFixed(2) + ' EV ' + JSON.stringify(e)); return ev(e); }; }, setup.b);
await B.pg.waitForTimeout(1500);
const bst = () => B.pg.evaluate(() => { const g = window.__nb.session.game, me = g.mine(); return { car: me && me.car, x: me && +me.x.toFixed(1), z: me && +me.z.toFixed(1), it: g.S && me ? JSON.stringify((window.__fi || (() => null))()) : '', drive: g.drive && { v: +g.drive.v.toFixed(1) }, paused: g.paused }; });
const ast = () => A.pg.evaluate(id => { const S = window.__nb.session.sim.S, p = S.players.find(q => q.id === id), c = S.cars[window.__car0.id]; return { car: p.car, x: +p.x.toFixed(1), z: +p.z.toFixed(1), carAt: [+c.x.toFixed(1), +c.z.toFixed(1)], d: c.d }; }, setup.b);
console.log('B before', JSON.stringify(await bst()));
await B.pg.mouse.click(640, 360); await B.pg.keyboard.down('KeyE'); await B.pg.waitForTimeout(800);
console.log('host while E', await A.pg.evaluate(async id => { const { findInteraction } = await import('./js/rules.js'); const s = window.__nb.session, S = s.sim.S, p = S.players.find(q => q.id === id); return JSON.stringify({ inp: s.sim.inputs.get(id), it: findInteraction(s.M, S, p), act: p.act, bot: p.bot, st: p.st, hide: p.hide, car: p.car, carry: p.carry, stun: p.stun, atk: p.atk, vault: p.vault, leap: p.leap, dash: p.dash, tele: p.tele }); }, setup.b));
console.log('client while E', await B.pg.evaluate(async () => { const { findInteraction } = await import('./js/rules.js'); const g = window.__nb.session.game, me = g.mine(); return JSON.stringify({ keys: [...g.keys], eHeld: g.eHeld, it: findInteraction(g.M, g.S, me), car: me.car, cars: !!g.S.cars, mode: g.S.mode }); }));
await B.pg.waitForTimeout(1700); await B.pg.keyboard.up('KeyE'); await B.pg.waitForTimeout(1500);
console.log('B after E', JSON.stringify(await bst()), 'host sees', JSON.stringify(await ast()));
await B.pg.keyboard.down('KeyW');
for (let k = 0; k < 2; k++) { await B.pg.evaluate(() => { const g = window.__nb.session.game; for (let i = 0; i < 15; i++) g.frame(1 / 30); }); await B.pg.waitForTimeout(400); }
await B.pg.keyboard.up('KeyW'); await B.pg.waitForTimeout(1500);
console.log('B after W', JSON.stringify(await bst()), 'host sees', JSON.stringify(await ast()));
console.log((await A.pg.evaluate(() => window.__log)).slice(0, 80).join('\n'));
console.log('errors', errs); await br.close(); srv.close();
