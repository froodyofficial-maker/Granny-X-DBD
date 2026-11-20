// a static GLB as a transparent picture (Store art): node propshot.mjs file.glb out.png [yaw] [size]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd/public';
const [file, out, yaw = '0', size = '512'] = process.argv.slice(2);
const page0 = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:transparent"><script type="importmap">{ "imports": { "three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.go = async (yaw, S) => {
  const g = await new GLTFLoader().loadAsync('/__model.glb');
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true, alpha: true }); r.setSize(S, S); r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xffffff, 0x554466, 2.6));
  const d = new THREE.DirectionalLight(0xffffff, 1.6); d.position.set(2, 3, 4); sc.add(d);
  const rim = new THREE.DirectionalLight(0xff2d95, 2); rim.position.set(-3, 1, -2); sc.add(rim);
  g.scene.rotation.y = yaw; sc.add(g.scene); g.scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g.scene), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.y, sz.z);
  const cam = new THREE.PerspectiveCamera(30, 1, R / 100, R * 20); cam.position.set(c.x + R * 0.35, c.y + R * 0.15, c.z + R * 2.05); cam.lookAt(c);
  r.render(sc, cam); return r.domElement.toDataURL('image/png');
};
window.ready = true;
</script>`;
const srv = http.createServer(async (q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page0); } if (u === '/__model.glb') { r.writeHead(200); return r.end(await readFile(file)); } try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': extname(u) === '.js' ? 'text/javascript' : 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage(); pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForFunction(() => window.ready);
const url = await pg.evaluate(([y, s]) => window.go(y, s), [+yaw, +size]);
await writeFile(out, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', out);
await br.close(); srv.close();
