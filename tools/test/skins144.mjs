// 1.4.4 outfits with their own models: each one standing, walking and swinging (node skins144.mjs out.png)
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd', OUT = process.argv[2] || '/tmp/claude-0/shots/skins144.png';
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: 1800, height: 560 } });
const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); });
await pg.goto(`http://localhost:${srv.address().port}/public/index.html`);
await pg.addScriptTag({ type: 'module', content: `
  import * as THREE from 'three';
  import { makeKiller, animate } from './js/models.js';
  import { loadGranny, loadGrandpa, loadSkinModel } from './js/grannyGlb.js';
  import { skinOf } from './js/config.js';
  window.__go = async () => {
    await Promise.all([loadGranny(), loadGrandpa(), ...['granny_bloody', 'granny_nightmare', 'granny_santa', 'granny_witch', 'grandpa_thug'].map(loadSkinModel)]);
    const R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); R.setSize(1800, 560); R.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x22262c); sc.add(new THREE.HemisphereLight(0xffffff, 0x404040, 2.2)); const dl = new THREE.DirectionalLight(0xffffff, 2); dl.position.set(3, 6, 8); sc.add(dl);
    const list = [['granny', 'default'], ['granny', 'bloody'], ['granny', 'nightmare'], ['granny', 'santa'], ['granny', 'witch'], ['grandpa', 'default'], ['grandpa', 'sigma']];
    const rigs = [];
    list.forEach(([c, s], i) => { for (let k = 0; k < 2; k++) { const r = makeKiller(c, skinOf(c, s)); r.root.position.set((i * 2 + k) * 1.25 - 8.1, 0, 0); r.root.rotation.y = k ? 0.6 : 0; sc.add(r.root); rigs.push([r, k]); } });
    for (let f = 0; f < 50; f++) for (const [r, k] of rigs) animate(r, k ? { anim: 'walk', speed: 1.8 } : { anim: 'idle', speed: 0, atk: f > 20 ? 1 : 0 }, 1 / 30);
    const cam = new THREE.PerspectiveCamera(30, 1800 / 560, 0.1, 100); cam.position.set(0, 1.2, 16); cam.lookAt(0, 1, 0);
    R.render(sc, cam); return R.domElement.toDataURL('image/png');
  };
  window.__ready = true;` });
await pg.waitForFunction(() => window.__ready);
const d = await pg.evaluate(() => window.__go());
(await import('node:fs')).writeFileSync(OUT, Buffer.from(d.split(',')[1], 'base64'));
console.log('errors', errs.filter(e => !/favicon|404/.test(e)));
await br.close(); srv.close();
