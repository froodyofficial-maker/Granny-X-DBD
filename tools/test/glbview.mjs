// static GLB viewer: world-space bounds of every mesh + front / side / top shots. node glbview.mjs file.glb outprefix [hide-regex]
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd/public';
const [file, pre, hide = ''] = process.argv.slice(2);
const page0 = `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{ "imports": { "three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
window.go = async (hide) => {
  const g = await new GLTFLoader().loadAsync('/__model.glb');
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true, antialias: true }); r.setSize(500, 700); document.body.appendChild(r.domElement);
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x8899aa); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.5));
  const d = new THREE.DirectionalLight(0xffffff, 1.5); d.position.set(2, 4, 3); sc.add(d);
  sc.add(g.scene); g.scene.updateMatrixWorld(true);
  const info = [];
  g.scene.traverse(o => { if (o.isMesh) { const b = new THREE.Box3().setFromObject(o); info.push([o.name, o.material.name, b.min.toArray().map(v => +v.toFixed(2)), b.max.toArray().map(v => +v.toFixed(2))]); if (hide && new RegExp(hide).test(o.name)) o.visible = false; } });
  const box = new THREE.Box3(); g.scene.traverse(o => { if (o.isMesh && o.visible) box.expandByObject(o); });
  const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3()), R = Math.max(sz.x, sz.y, sz.z);
  const cam = new THREE.PerspectiveCamera(35, 500 / 700, R / 100, R * 20), out = [];
  for (const [dx, dy, dz] of [[0, 0, 1], [1, 0, 0], [0, 0, -1], [0, 1, 0.01]]) { cam.position.set(c.x + dx * R * 2.4, c.y + dy * R * 2.4, c.z + dz * R * 2.4); cam.lookAt(c); r.render(sc, cam); out.push(r.domElement.toDataURL('image/jpeg', 0.85)); }
  return { info, box: [box.min.toArray(), box.max.toArray()], out };
};
window.ready = true;
</script>`;
const srv = http.createServer(async (q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page0); } if (u === '/__model.glb') { r.writeHead(200); return r.end(await readFile(file)); } try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': extname(u) === '.js' ? 'text/javascript' : 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage(); pg.on('pageerror', e => console.log('ERR', e.message));
await pg.goto(`http://localhost:${srv.address().port}/`); await pg.waitForFunction(() => window.ready);
const res = await pg.evaluate(h => window.go(h), hide);
for (const i of res.info) console.log(JSON.stringify(i));
console.log('box', JSON.stringify(res.box));
for (let i = 0; i < res.out.length; i++) await writeFile(`${pre}${i}.jpg`, Buffer.from(res.out[i].split(',')[1], 'base64'));
await br.close(); srv.close();
