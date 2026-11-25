// 1.7.0 executions: play a killer, put a downed survivor in front of them, execute, and save frames through the film
// (the cinematic camera, the victim's pose, the gore). node moritest.mjs <killer> <map> <out prefix> [f list]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
import fs from 'node:fs';
const ROOT = '/home/user/granny-x-dbd';
const [killer = 'granny', map = 'granny', pre = 'mo', fl] = process.argv.slice(2);
const FS = fl ? JSON.parse(fl) : [0.05, 0.2, 0.35, 0.5, 0.58, 0.68, 0.78, 0.9, 0.98];
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(k => {
  if (k === 'father') window.__now = Date.UTC(2026, 11, 3);
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: k, perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 1000, matches: 3, escapes: 1, kills: 2 }, owned: { ['k:' + k]: true }, readInbox: {} }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: window.process_q || 'medium', name: 'Tester', lb: false }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
}, killer);
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (/error/i.test(m.type()) && !/WebSocket|404/.test(m.text())) errs.push(m.text().slice(0, 200)); });
await pg.addInitScript(`window.process_q = ${JSON.stringify(process.env.Q || 'medium')};`);
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.waitForTimeout(4000);
await pg.evaluate(() => document.querySelector('#mainnav button[data-act="play-killer"]').click()); await pg.waitForTimeout(500);
await pg.selectOption('#bots-map', map);
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 2, null, { timeout: 240000 });
const info = await pg.evaluate(async () => {
  const s = window.__nb.session, g = s.game, S = s.sim.S, me = S.players.find(p => p.id === g.myId);
  s.bots.update = () => {};
  const v = S.players.find(p => p.role === 'survivor');
  for (const o of S.players) if (o.role === 'survivor' && o !== v) { o.x = me.x + 30; o.z = me.z + 30; }
  v.st = 'down'; v.stage = 2; v.hp = 0; v.bleed = 200; v.fl = me.fl; v.sp = me.sp; v.x = me.x + Math.sin(me.yaw) * 1.0; v.z = me.z + Math.cos(me.yaw) * 1.0; v.tp++;
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 30)); }
  g.send({ t: 'act', a: 'execute', id: v.id });
  for (let i = 0; i < 20; i++) { await new Promise(r => setTimeout(r, 30)); if (me.act && me.act.k === 'execute') break; }
  return { char: me.char, act: me.act && me.act.k, vst: v.st };
});
console.log(JSON.stringify(info));
const frames = await pg.evaluate(async FS => {
  const s = window.__nb.session, g = s.game, S = s.sim.S, me = S.players.find(p => p.id === g.myId);
  const T = (window.__nb.RULES_EXEC || 6.2);
  s.sim.update = () => {}; // drive the execution's clock by hand
  const out = []; let cur = me.act ? me.act.t / T : 0;
  for (const f of FS) {
    while (cur < f) { cur = Math.min(f, cur + (+window.__step || 0.025)); if (me.act) me.act.t = cur * T; g.frame(1 / 30); }
    for (let i = 0; i < 4; i++) g.frame(1 / 30);
    out.push(g.renderer.domElement.toDataURL('image/jpeg', 0.85));
  }
  return out;
}, FS);
frames.forEach((d, i) => fs.writeFileSync(`${pre}${i}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
console.log('frames', frames.length, 'errors', errs.slice(0, 8));
await br.close(); srv.close();
