// render The Child of Slendrina's portrait for the Store / Loadout: node childshot.mjs out.png
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile, writeFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const page0 = `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{ "imports": { "three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module">
import * as THREE from 'three';
import { loadChild, makeChild } from './js/grannyGlb.js';
window.go = async () => {
  await loadChild();
  const W = 768, H = 768, r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setSize(W, H);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.4; r.outputColorSpace = THREE.SRGBColorSpace; r.shadowMap.enabled = true;
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x07060a); sc.fog = new THREE.FogExp2(0x07060a, 0.18);
  sc.add(new THREE.HemisphereLight(0x5a6080, 0x100808, 0.6));
  const key = new THREE.SpotLight(0xffd8b0, 40, 8, 0.6, 0.6, 1.2); key.position.set(-1.2, 2.2, 2.0); key.target.position.set(0, 0.3, 0); key.castShadow = true; sc.add(key, key.target);
  const red = new THREE.PointLight(0xff2a18, 6, 5, 1.5); red.position.set(1.2, 0.8, -1.2); sc.add(red);
  const fl = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x1a1612, roughness: 1 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; sc.add(fl);
  const R = makeChild(false); R.root.traverse(o => { if (o.isMesh) o.castShadow = true; }); R.root.rotation.y = 0.5; sc.add(R.root);
  for (let i = 0; i < 25; i++) R.play('attack', 1 / 30);
  const cam = new THREE.PerspectiveCamera(32, W / H, 0.05, 50); cam.position.set(0.55, 0.5, 1.9); cam.lookAt(0, 0.33, 0);
  r.render(sc, cam); return r.domElement.toDataURL('image/png');
};
window.ready = true;
</script>`;
const srv = http.createServer(async (q, res) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/public/__c.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(page0); } try { const b = await readFile(join(ROOT, u)); res.writeHead(200, { 'content-type': { '.js': 'text/javascript' }[extname(u)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage(); pg.on('pageerror', e => console.log('err', e.message));
await pg.goto(`http://localhost:${srv.address().port}/public/__c.html`); await pg.waitForFunction(() => window.ready);
const d = await pg.evaluate(() => window.go());
await writeFile(process.argv[2] || 'child.png', Buffer.from(d.split(',')[1], 'base64'));
await br.close(); srv.close();
