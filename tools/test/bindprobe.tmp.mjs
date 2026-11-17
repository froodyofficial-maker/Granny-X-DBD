// play a GLB's clips with plain three.js (no game code): node rawglb.mjs file.glb out
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd/public';
const [file, pre] = process.argv.slice(2);
const page0 = `<!doctype html><meta charset="utf-8"><body style="margin:0"><script type="importmap">{ "imports": { "three": "./vendor/three/three.module.min.js", "three/addons/": "./vendor/three/addons/" } }</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const toBP = (function (scene) {
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, P = o.geometry.attributes.position, J = o.geometry.attributes.skinIndex, W = o.geometry.attributes.skinWeight;
    // joints in the mesh: the middle of the vertices shared by a bone and its parent
    const acc = new Map();
    for (let i = 0; i < P.count; i++) {
      const inf = []; for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > 0.15) inf.push(J.getComponent(i, k));
      for (const a of inf) for (const b of inf) if (sk.bones[a].parent === sk.bones[b]) { const e = acc.get(a) || [0, 0, 0, 0]; e[0] += P.getX(i); e[1] += P.getY(i); e[2] += P.getZ(i); e[3]++; acc.set(a, e); }
    }
    // per axis, a least-squares line from the bind matrices' joints to the mesh's
    const pairs = [];
    for (const [j, e] of acc) if (e[3] >= 6) pairs.push([new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[j]).invert()), [e[0] / e[3], e[1] / e[3], e[2] / e[3]]]);
    const fit = ax => {
      const n = pairs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (const [p, c] of pairs) { const x = p.getComponent(ax), y = c[ax]; sx += x; sy += y; sxx += x * x; sxy += x * y; }
      const den = n * sxx - sx * sx; let a = Math.abs(den) > 1e-9 ? (n * sxy - sx * sy) / den : 1;
      if (!(a > 0.2 && a < 5)) a = 1;
      return [a, (sy - a * sx) / n];
    };
    const [fx, fy, fz] = [0, 1, 2].map(fit);
    const K = pairs.length >= 6 ? new THREE.Matrix4().set(fx[0], 0, 0, fx[1], 0, fy[0], 0, fy[1], 0, 0, fz[0], fz[1], 0, 0, 0, 1) : new THREE.Matrix4();
    const Ki = new THREE.Matrix4().copy(K).invert();
    const bind = new Map();
    // each joint goes where the mesh has it (K applied to its position) but keeps a plain rotation: no stretch in the
    // bone matrices, or every turned bone (her head, her arms) would come out squashed
    const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    sk.bones.forEach((b, i) => {
      new THREE.Matrix4().copy(sk.boneInverses[i]).invert().decompose(_p, _q, _s);
      const w = new THREE.Matrix4().compose(_p.applyMatrix4(K), _q, one);
      bind.set(b, w); sk.boneInverses[i].copy(w).invert();                           // the mesh stays where it was
    });
    const m = new THREE.Matrix4();
    for (const b of sk.bones) {
      if (bind.has(b.parent)) m.copy(bind.get(b.parent)).invert().multiply(bind.get(b));
      else m.copy(b.parent.matrixWorld).invert().multiply(bind.get(b)); // the top bone
      m.decompose(b.position, b.quaternion, b.scale);
    }
  });
  scene.updateMatrixWorld(true);
}
);
function pureBind(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, bind = new Map();
    sk.bones.forEach((b, i) => bind.set(b, new THREE.Matrix4().copy(o.bindMatrix).multiply(new THREE.Matrix4().copy(sk.boneInverses[i]).invert())));
    // world matrices: mesh's bind frame; set local from parent
    const m = new THREE.Matrix4();
    for (const b of sk.bones) {
      const W = new THREE.Matrix4().copy(o.parent.matrixWorld).multiply(bind.get(b));
      const P = bind.has(b.parent) ? new THREE.Matrix4().copy(o.parent.matrixWorld).multiply(bind.get(b.parent)) : b.parent.matrixWorld;
      m.copy(P).invert().multiply(W); m.decompose(b.position, b.quaternion, b.scale);
      b.updateMatrixWorld(true);
    }
  });
  scene.updateMatrixWorld(true);
}
window.go = async () => {
  const out = [], info = [];
  const r = new THREE.WebGLRenderer({ preserveDrawingBuffer: true }); r.setSize(500, 500); document.body.appendChild(r.domElement);
  for (const mode of ['pure', 'fit']) {
    const g = await new GLTFLoader().loadAsync('/__model.glb');
    const sc = new THREE.Scene(); sc.background = new THREE.Color(0x8899aa); sc.add(new THREE.HemisphereLight(0xffffff, 0x445566, 2.5)); sc.add(g.scene);
    if (mode === 'pure') pureBind(g.scene); else toBP(g.scene);
    g.scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(g.scene, true), cc = b.getCenter(new THREE.Vector3()), s = b.getSize(new THREE.Vector3());
    const d = Math.max(s.x, s.y, s.z) * 1.6;
    for (const ang of [0, Math.PI / 2]) { const cam = new THREE.PerspectiveCamera(40, 1, 0.01, 5000); cam.position.set(cc.x + Math.sin(ang) * d, cc.y, cc.z + Math.cos(ang) * d); cam.lookAt(cc); r.render(sc, cam); out.push(r.domElement.toDataURL('image/jpeg')); }
    info.push(mode + ' size ' + s.toArray().map(v => v.toFixed(2)).join(','));
  }
  return { out, info };
};
window.ready = true;
</script>`;
const srv = http.createServer(async (q, r) => { const u = decodeURIComponent(q.url.split('?')[0]); if (u === '/__r.html') { r.writeHead(200, { 'content-type': 'text/html' }); return r.end(page0); } if (u === '/__model.glb') { r.writeHead(200); return r.end(await readFile(file)); } try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': { '.js': 'text/javascript' }[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const pg = await br.newPage(); pg.on('pageerror', e => console.log('err', e.message));
await pg.goto(`http://localhost:${srv.address().port}/__r.html`); await pg.waitForFunction(() => window.ready);
const { out, info } = await pg.evaluate(() => window.go());
console.log(info.join('\n'));
const fs = await import('node:fs'); out.forEach((d, i) => fs.writeFileSync(`${pre}${String(i).padStart(2, '0')}.jpg`, Buffer.from(d.split(',')[1], 'base64')));
await br.close(); srv.close();
