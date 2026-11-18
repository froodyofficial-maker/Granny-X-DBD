// the offline single file (what the exe and apk run): the main menu's event button, then a bot match in that mode.
//   node offevent.mjs [gm=city] [killer=granny] [now=ISO date, e.g. 2026-12-02 for Season 2] [out=/tmp/claude-0/off]
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
const [gm = 'city', killer = 'granny', now = '', out = '/tmp/claude-0/off'] = process.argv.slice(2);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--allow-file-access-from-files'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(([now]) => { if (now) window.__now = Date.parse(now + 'T12:00:00Z'); localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' })); window.__nbNoRTC = true; window.__nbMqtt = ['ws://127.0.0.1:9']; }, [now]);
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/WebSocket|ERR_/.test(m.text())) errs.push(m.text()); });
const t0 = Date.now();
await pg.goto('file:///home/user/granny-x-dbd/GrannyDBD.html');
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 180000 });
await pg.waitForTimeout(5000);
const menu = await pg.evaluate(() => ({ event: document.querySelector('#nav-event').classList.contains('hidden') ? null : document.querySelector('#nav-event').textContent.trim(), modes: [...document.querySelectorAll('#bots-gm option')].map(o => o.value).join(','), killers: [...document.querySelectorAll('#bots-killer option')].map(o => o.value).join(',') }));
console.log('menu', JSON.stringify(menu), 'boot', ((Date.now() - t0) / 1000).toFixed(0) + 's');
await pg.screenshot({ path: out + '-menu.png' });
await pg.evaluate(() => document.querySelector('#nav-event:not(.hidden)') ? document.querySelector('#nav-event').click() : document.querySelector('#mainnav button[data-act="play-survivor"]').click());
await pg.waitForTimeout(600);
await pg.evaluate(([gm, k]) => { const g = document.querySelector('#bots-gm'); g.value = gm; g.dispatchEvent(new Event('change')); const s = document.querySelector('#bots-killer'); if ([...s.options].some(o => o.value === k)) { s.value = k; s.dispatchEvent(new Event('change')); } }, [gm, killer]);
const t1 = Date.now();
await pg.evaluate(() => document.querySelector('#btn-bots-start').click());
// loading screen: is it held (the still) while the match builds?
let held = false;
for (let i = 0; i < 120; i++) {
  const st = await pg.evaluate(() => ({ held: document.querySelector('#loading') && document.querySelector('#loading').classList.contains('held'), t: window.__nb.session && window.__nb.session.sim ? window.__nb.session.sim.S.t : -1 }));
  held ||= st.held;
  if (st.t > 1.5) break;
  await pg.waitForTimeout(1500);
}
const info = await pg.evaluate(() => { const s = window.__nb.session; return s && s.sim ? { map: s.map, mode: s.sim.S.mode, killer: s.sim.S.players.find(p => p.role === 'killer').char, t: s.sim.S.t.toFixed(1) } : null; });
console.log('match', JSON.stringify(info), 'start', ((Date.now() - t1) / 1000).toFixed(0) + 's', 'heldSeen', held);
await pg.waitForTimeout(2000);
const d = await pg.evaluate(() => { const g = window.__nb.session.game; g.frame(1 / 30); return g.renderer.domElement.toDataURL('image/jpeg', 0.85); });
await writeFile(out + '-match.jpg', Buffer.from(d.split(',')[1], 'base64'));
console.log('errors', JSON.stringify(errs.slice(0, 8)));
await br.close();
