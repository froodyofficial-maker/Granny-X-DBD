// Builds Nightbound.html: one self-contained file (three.js, game code, CSS, fonts inlined)
// that runs when double-clicked, with no server needed.
//   cd tools && npm install && cd .. && node tools/build.mjs
import { build } from './node_modules/esbuild/lib/main.js';
import { readFile, writeFile } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');

const threeVendor = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(pub, 'vendor/three/three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, a => ({ path: join(pub, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
  },
};

const res = await build({
  entryPoints: [join(pub, 'js/main.js')],
  bundle: true, format: 'iife', minify: true, write: false, target: 'es2020',
  plugins: [threeVendor], legalComments: 'none',
});
const js = res.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

let css = await readFile(join(pub, 'css/style.css'), 'utf8');
for (const m of [...css.matchAll(/url\(\.\.\/fonts\/([\w.-]+\.woff2)\)/g)]) {
  const b64 = (await readFile(join(pub, 'fonts', m[1]))).toString('base64');
  css = css.replace(m[0], `url(data:font/woff2;base64,${b64})`);
}
const MIME = { webp: 'image/webp', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg' };
for (const m of [...new Set([...css.matchAll(/url\(\.\.\/img\/([\w./-]+)\)/g)].map(x => x[0]))]) {
  const file = m.slice('url(../img/'.length, -1), b64 = (await readFile(join(pub, 'img', file))).toString('base64');
  css = css.split(m).join(`url(data:${MIME[file.split('.').pop()]};base64,${b64})`);
}

let html = await readFile(join(pub, 'index.html'), 'utf8');
html = html.replace(/<link rel="stylesheet" href="css\/style.css">/, () => `<style>${css}</style>`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>\s*/, '');
const peer = (await readFile(join(pub, 'vendor/peerjs.min.js'), 'utf8')).replace(/<\/script/gi, '<\\/script');
// the Foreman's rigged model as base64 in an inert tag placed before the game script (read by foremanGlb.js)
const extraGlb = ['ghosttrap', 'granny_map', 'granny1_map', 'slendrina', 'angeline', 'nosferatu', 'forest_map', 'freddy', 'grandpa_thug', 'victim_car', 'slenderman', 'teddy', 'granny', 'granny_anims', 'grandpa', 'spidermom', 'slendrina_child', 'beartrap', 'taser', 'monster_can', 'phone_case'].filter(n => existsSync(join(pub, 'models/' + n + '.glb'))).map(n => `<script id="nb-${n}-glb" type="application/octet-stream">${readFileSync(join(pub, 'models/' + n + '.glb')).toString('base64')}</script>\n`).join('');
// 1.5.1: the menu music (audio.js reads #nb-music-mp3 when there is no audio/ folder next to the page)
const musicTag = existsSync(join(pub, 'audio/menu.mp3')) ? `<script id="nb-music-mp3" type="application/octet-stream">${readFileSync(join(pub, 'audio/menu.mp3')).toString('base64')}</script>\n` : '';
// 1.5.3: Granny's House background music (#nb-granny3-mp3)
// (1.6.0: and the GTA VI theme's menu music, audio/vitheme.mp3, when it's there)
const musicTag2 = ['granny3', 'vitheme'].filter(n => existsSync(join(pub, 'audio/' + n + '.mp3'))).map(n => `<script id="nb-${n}-mp3" type="application/octet-stream">${readFileSync(join(pub, 'audio/' + n + '.mp3')).toString('base64')}</script>\n`).join('');
// the map vote cards' pictures (the exe / apk have no img/ folder next to the page)
const mapImgs = Object.fromEntries(['granny', 'granny1', 'forest'].filter(n => existsSync(join(pub, 'img/maps/' + n + '.jpg'))).map(n => [n, 'data:image/jpeg;base64,' + readFileSync(join(pub, 'img/maps/' + n + '.jpg')).toString('base64')]));
const mapImgTag = `<script>window.__MAPIMG=${JSON.stringify(mapImgs)}</script>\n`;
// 1.6.0: the photo-scanned surfaces (public/tex/*/*.ktx2) and the KTX2 decoder go into the offline file too (pbr.js maps their
// URLs to these): before, the exe and the APK never had them and showed only the painted textures
import { readdirSync } from 'node:fs';
const texFiles = {};
if (existsSync(join(pub, 'tex'))) for (const d of readdirSync(join(pub, 'tex'))) { const dir = join(pub, 'tex', d); try { for (const f of readdirSync(dir)) if (f.endsWith('.ktx2')) texFiles['tex/' + d + '/' + f] = readFileSync(join(dir, f)).toString('base64'); } catch {} }
for (const f of ['basis_transcoder.js', 'basis_transcoder.wasm']) { const p = join(pub, 'vendor/three/addons/libs/basis', f); if (existsSync(p)) texFiles['basis/' + f] = readFileSync(p).toString('base64'); }
const texTag = Object.keys(texFiles).length ? `<script id="nb-tex" type="application/json">${JSON.stringify(texFiles)}</script>\n` : '';
const withModel = html.replace(/<script type="module" src="js\/main.js"><\/script>/, () => `${extraGlb}${musicTag}${musicTag2}${mapImgTag}${texTag}<script>${peer}</script>\n<script>${js}</script>`);
// the web build stays small: it fetches public/models/foreman.glb instead of embedding it
const web = html.replace(/<script type="module" src="js\/main.js"><\/script>/, () => `<script>${peer}</script>\n<script>${js}</script>`);
const note = `<title>Granny x DBD</title>\n  <!-- Built file: everything is inlined. Source lives in public/. -->\n  <script>window.__NB_BUILT__=${Date.now()}</script>`;
const offline = withModel.replace('<title>Granny x DBD</title>', note), page = web.replace('<title>Granny x DBD</title>', note);
await writeFile(join(root, 'GrannyDBD.html'), offline);
await writeFile(join(root, 'index.html'), page); // GitHub Pages entry point
console.log(`GrannyDBD.html ${(offline.length / 1048576).toFixed(2)} MB, index.html ${(page.length / 1048576).toFixed(2)} MB`);
