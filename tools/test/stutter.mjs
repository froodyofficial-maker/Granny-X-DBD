// 1.7.0: what stutters on shots / hits / downs? A bot match (you as a killer bot's target) with every sim step, bot step and
// rendered frame timed, and each spike printed with the events of that moment. node stutter.mjs <killer> <map> [seconds]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const [killer = 'grandpa', map = 'granny', secs = '60'] = process.argv.slice(2);
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.mp3': 'audio/mpeg', '.ktx2': 'image/ktx2', '.wasm': 'application/wasm' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 960, height: 540 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 1000, matches: 3, escapes: 1, kills: 2 } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: window.__q || 'low', name: 'Tester', lb: false }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
});
if (process.env.NOUNHIDE) await ctx.addInitScript('window.__noUnhide = true');
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.waitForTimeout(3000);
await pg.evaluate(() => document.querySelector('#mainnav button[data-act="play-survivor"]').click()); await pg.waitForTimeout(400);
await pg.selectOption('#bots-map', map); await pg.selectOption('#bots-killer', killer);
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 2, null, { timeout: 240000 });
const out = await pg.evaluate(async secs => {
  const s = window.__nb.session, g = s.game, R = g.renderer, log = [], evs = [];
  const wrap = (o, k, tag) => { const f = o[k].bind(o); o[k] = (...a) => { const t0 = performance.now(); const r = f(...a); const d = performance.now() - t0; log.push([tag, +d.toFixed(1), +(s.sim.S.t).toFixed(2), R.info.programs.length]); return r; }; };
  wrap(s.sim, 'update', 'sim'); wrap(s.bots, 'update', 'bots'); wrap(g, 'onEvents', 'events');
  const ev0 = g.onEvents.bind(g); g.onEvents = ev => { for (const e of ev) if (/hit|shot|down|pickup|caged|rush|exec|died/.test(e.k)) evs.push([e.k, +(s.sim.S.t).toFixed(2)]); return ev0(ev); };
  window.__newp = []; const fr0 = g.frame.bind(g); g.frame = (...a) => { const p0 = R.info.programs.length, names0 = new Set(R.info.programs.map(p => p.cacheKey)), t0 = performance.now(); const r = fr0(...a); if (R.info.programs.length !== p0 || R.info.programs.some(p => !names0.has(p.cacheKey))) for (const p of R.info.programs) if (!names0.has(p.cacheKey)) window.__newp.push([+(s.sim.S.t).toFixed(2), p.name, p.cacheKey.slice(0, 160)]); log.push(['frame', +(performance.now() - t0).toFixed(1), +(s.sim.S.t).toFixed(2), R.info.programs.length, R.info.programs.length - p0]); return r; };
  // the human survivor stays put near the killer so things happen to them
  await new Promise(r => setTimeout(r, secs * 1000));
  const by = t => log.filter(l => l[0] === t).map(l => l[1]).sort((a, b) => a - b), q = (a, p) => a[Math.floor(a.length * p)] || 0;
  const sum = {}; for (const t of ['frame', 'sim', 'bots', 'events']) { const a = by(t); sum[t] = { n: a.length, med: q(a, 0.5), p95: q(a, 0.95), max: a[a.length - 1] || 0 }; }
  const fr = log.filter(l => l[0] === 'frame'), med = sum.frame.med;
  const spikes = log.filter(l => (l[0] === 'frame' && l[1] > Math.max(med * 3, med + 60)) || (l[0] !== 'frame' && l[1] > 25)).slice(0, 40).map(l => ({ l, near: evs.filter(e => Math.abs(e[1] - l[2]) < 0.6).map(e => e[0]).join(',') }));
  return { newp: window.__newp, sum, spikes, evs: evs.length, programs: R.info.programs.length, newProg: fr.filter(l => l[4] > 0).map(l => [l[2], l[4], evs.filter(e => Math.abs(e[1] - l[2]) < 0.6).map(e => e[0]).join(',')]) };
}, +secs);
console.log(JSON.stringify(out.sum)); console.log('events', out.evs, 'programs', out.programs);
console.log('new programs at', JSON.stringify(out.newProg));
for (const s of out.spikes) console.log('spike', JSON.stringify(s.l), s.near);
console.log('newp', JSON.stringify(out.newp, null, 1));
console.log('errors', errs.slice(0, 5));
await br.close(); srv.close();
