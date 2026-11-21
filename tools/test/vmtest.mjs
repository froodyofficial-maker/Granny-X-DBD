// 1.6.0: the first-person weapon in a match: a strip of frames through an attack (and Grandpa's aim). node vmtest.mjs <killer> <out.jpg>
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', [K = 'granny', OUT = '/tmp/claude-0/vm.jpg'] = process.argv.slice(2);
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); pg.setDefaultTimeout(400000); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.text().startsWith('POSE')) console.log(m.text()); else if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
await pg.addInitScript(k => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: k, perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'T' })); window.__nbMqtt = ['ws://127.0.0.1:1']; }, K);
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 300000 });
await pg.evaluate(() => document.querySelector('[data-act="play-killer"]').click()); await pg.waitForTimeout(500);
await pg.selectOption('#bots-map', 'granny1');
await pg.evaluate(() => document.getElementById('btn-bots-start').click());
try { await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1, null, { timeout: 150000 }); } catch (e) { console.log('START FAILED', errs); process.exit(1); } await pg.waitForTimeout(3000); console.log(JSON.stringify(await pg.evaluate(() => { const g = window.__nb.session.game; return { view: !!g.view, pend: g.viewPending, ready: g.viewReady, ch: g.myId }; })));
const seq = process.env.SEQ ? JSON.parse(process.env.SEQ) : [
  { atk: 0 }, { atk: 1, atkF: 0.1 }, { atk: 1, atkF: 0.22 }, { atk: 1, atkF: 0.32 }, { atk: 1, atkF: 0.45 }, { atk: 1, atkF: 0.6 }, { atk: 2, recF: 0.2 }, { atk: 0, aim: true },
];
const shots = await pg.evaluate(async seq => {
  const { animateView } = await import('/public/js/models.js');
  const g = window.__nb.session.game, out = [];
  g.frame(1 / 30);
  for (const s of seq) {
    for (let i = 0; i < 40; i++) animateView(g.view, { t: 1, speed: 0, ...s }, 1 / 30);
    { const u = g.view.userData; g.camera.updateMatrixWorld(true); const T = u.tip.getWorldPosition(new g.camera.position.constructor()), B = u.base.getWorldPosition(new g.camera.position.constructor()); g.camera.worldToLocal(T); g.camera.worldToLocal(B); console.error('POSE', JSON.stringify(s), 'tip', T.toArray().map(v => +v.toFixed(2)), 'base', B.toArray().map(v => +v.toFixed(2)), 'arm', u.arm.position.toArray().map(v => +v.toFixed(2)), 'ltip', u.tip.position.toArray().map(v => +v.toFixed(2)), 'lbase', u.base.position.toArray().map(v => +v.toFixed(2)), 'ax', u.wAxis && u.wAxis.toArray().map(v => +v.toFixed(2))); }
    g.renderer.render(g.scene, g.camera); out.push(g.renderer.domElement.toDataURL('image/jpeg', 0.85));
  }
  return out;
}, seq);
const { execFileSync } = await import('node:child_process'); const fs = await import('node:fs');
shots.forEach((d, i) => fs.writeFileSync(`/tmp/claude-0/vm_${i}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
execFileSync('python3', ['-c', `from PIL import Image\nims=[Image.open('/tmp/claude-0/vm_%d.jpg'%i).resize((480,270)) for i in range(${shots.length})]\no=Image.new('RGB',(1920,270*((len(ims)+3)//4)))\nfor i,im in enumerate(ims): o.paste(im,((i%4)*480,(i//4)*270))\no.save('${OUT}')`]);
console.log('errors', errs.slice(0, 5)); await br.close(); srv.close();
