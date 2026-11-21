// 1.6.0: an in-match look on a given quality (killer view: weapon blood after a hit), plus timing of frames.
//   node gfx160.mjs <quality> <outprefix>
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', [Q = 'high', pre = 'g160'] = process.argv.slice(2);
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); pg.setDefaultTimeout(400000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.addInitScript(q => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, readInbox: { gdbd153: true, gdbd152: true, gdbd160: true } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: q, name: 'T', lb: false, dynres: false })); }, Q);
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 300000 });
await pg.waitForFunction(() => document.getElementById('loading').classList.contains('hidden'), null, { timeout: 300000 }); await pg.waitForTimeout(1500);
await pg.addStyleTag({ content: '#announce{display:none!important}' });
await pg.evaluate(() => document.querySelector('[data-act="play-killer"]').click()); await pg.waitForTimeout(500);
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 400000 });
await pg.waitForTimeout(3000);
const out = await pg.evaluate(async () => {
  const s = window.__nb.session, g = s.game;
  const bu = s.bots.update.bind(s.bots); s.bots.update = () => {};
  if (g.view) g.view.userData.bloody = 1;
  const t0 = performance.now(); for (let i = 0; i < 10; i++) g.frame(1 / 30); const ms = (performance.now() - t0) / 10;
  const passes = g.composer ? g.composer.passes.map(p => p.constructor.name) : [];
  const img = g.renderer.domElement.toDataURL('image/jpeg', 0.9);
  // a generator, a lamp, and grass up close (free camera)
  const shots = [];
  const shoot = (x, y, z, lx, ly, lz) => { const cu = g.updateCamera; g.updateCamera = () => { g.camera.position.set(x, y, z); g.camera.lookAt(lx, ly, lz); }; g.frame(1 / 30); g.frame(1 / 30); g.updateCamera = cu; shots.push(g.renderer.domElement.toDataURL('image/jpeg', 0.88)); };
  const G0 = g.M.gens[0]; shoot(G0.x + 2.2, 1.6, G0.z + 2.4, G0.x, 0.7, G0.z);
  const L0 = g.W.lamps[0] && g.W.lamps[0].bulbM ? (() => { let p = null; g.scene.traverse(o => { if (!p && o.material === g.W.lamps[0].bulbM) { p = new o.position.constructor(); o.getWorldPosition(p); } }); return p; })() : null;
  if (L0) shoot(L0.x + 3, 2.2, L0.z + 3.5, L0.x, 2.2, L0.z);
  shoot(G0.x + 8, 0.9, G0.z + 8, G0.x + 2, 0.3, G0.z + 2);
  // JS only: drawing stubbed out
  const rr = g.renderer.render.bind(g.renderer), cr = g.composer && g.composer.render.bind(g.composer);
  g.renderer.render = () => {}; if (g.composer) g.composer.render = () => {};
  const t1 = performance.now(); for (let i = 0; i < 60; i++) g.frame(1 / 60); const js = (performance.now() - t1) / 60;
  g.renderer.render = rr; if (cr) g.composer.render = cr;
  // simulation + bots step
  const t2 = performance.now(); for (let i = 0; i < 60; i++) { bu(1 / 60); s.sim.update(1 / 60); s.sim.takeEvents(); } const sim = (performance.now() - t2) / 60;
  const info = g.renderer.info; return { ms: +ms.toFixed(0), js: +js.toFixed(2), sim: +sim.toFixed(2), calls: info.render.calls, tris: info.render.triangles, progs: info.programs.length, tex: info.memory.textures, lights: (() => { const L = []; g.scene.traverse(o => { if (o.isLight) L.push(o.type.replace('Light', '') + (o.castShadow ? '*' + (o.shadow.mapSize.x) : '') + (o.intensity > 0 ? '' : '(off)')); }); return L.join(' '); })(), grass: (() => { let n = 0, m = ''; g.scene.traverse(o => { if (o.isInstancedMesh) { n += o.count; m += o.name + ':' + o.count + (o.castShadow ? '*' : '') + ' '; } }); return m; })(), passes, pr: g.renderer.getPixelRatio(), img, shots };
});
const fs = await import('node:fs'); fs.writeFileSync(pre + '.jpg', Buffer.from(out.img.split(',')[1], 'base64')); (out.shots || []).forEach((d, i) => fs.writeFileSync(pre + '_' + i + '.jpg', Buffer.from(d.split(',')[1], 'base64')));
const { img, shots, ...rest } = out; console.log(Q, JSON.stringify(rest), 'errors', errs);
await br.close(); srv.close();
