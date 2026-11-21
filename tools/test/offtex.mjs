// 1.6.0: the offline single file (file://, like the exe / APK) loads the embedded photo textures. node offtex.mjs [quality]
import { chromium } from 'playwright';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const FILE = 'file://' + join(dirname(fileURLToPath(import.meta.url)), '../../GrannyDBD.html'), Q = process.argv[2] || 'medium';
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); pg.setDefaultTimeout(400000); const errs = [], warns = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'warning' || m.type() === 'error') warns.push(m.text().slice(0, 160)); });
await pg.addInitScript(q => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: q, name: 'T', lb: false })); window.__nbMqtt = ['ws://127.0.0.1:1']; }, Q);
await pg.goto(FILE);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 400000 });
for (let i = 0; i < 30; i++) { const n = await pg.evaluate(() => window.__photoDone ? window.__photoDone().length : -1); if (n >= 20) break; await pg.waitForTimeout(3000); }
console.log(Q, 'scans loaded:', await pg.evaluate(() => window.__photoDone && window.__photoDone().join(',')), 'errors', errs, 'warnings', warns.filter(w => /photo|ktx|basis|wasm|nb-tex/i.test(w)).slice(0, 5));
await br.close();
