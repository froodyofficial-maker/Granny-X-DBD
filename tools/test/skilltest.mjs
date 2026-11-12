// a survivor repairs a generator until a skill check comes up; screenshot it, hit Space in the zone, read the result
import { chromium } from 'playwright';
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 720 }, ...(process.env.MOBILE ? { isMobile: true, hasTouch: true } : {}) });
await ctx.addInitScript(() => { localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 0, matches: 1, escapes: 0, kills: 0 } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'T' })); window.__forceTouch = !!window.__mob; });
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('file:///home/user/granny-x-dbd/GrannyDBD.html');
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 180000 });
await pg.evaluate(() => document.querySelector('[data-act="play-survivor"]').click()); await pg.waitForTimeout(600);
await pg.evaluate(() => { document.querySelector('#bots-diff [data-v="easy"]').click(); document.querySelector('#btn-bots-start').click(); });
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1, null, { timeout: 240000 });
const key = (code, down) => pg.evaluate(([c, d]) => window.__nb.session.game.onKeyCode({ code: c, repeat: false, target: document.body, preventDefault() {} }, d), [code, down]);
// stand at the nearest generator, facing it, holding E
await pg.evaluate(() => { const s = window.__nb.session, me = s.sim.S.players.find(p => p.id === 'me'), M = s.sim.M; const g = M.gens.slice().sort((a, b) => Math.hypot(a.x - me.x, a.z - me.z) - Math.hypot(b.x - me.x, b.z - me.z))[0]; me.x = g.x + 1.1; me.z = g.z; me.yaw = Math.atan2(g.x - me.x, g.z - me.z); me.tp++; window.__g = g; const K = s.sim.S.players.find(p => p.role === 'killer'); K.x = -999 + 0; });
await key('KeyE', true);
const results = [];
for (let n = 0; n < 3; n++) {
  await pg.waitForFunction(() => { const g = window.__nb.session.game; return g.skill && g.skill.phase === 'active'; }, null, { timeout: 90000 }).catch(() => {});
  const st = await pg.evaluate(() => { const g = window.__nb.session.game; const s = g.skill; return s ? { start: s.start, end: s.end, great: s.great, needle: s.needle, act: !!g.mine().act, canvas: [g.skillCanvas.width, g.skillCanvas.height, getComputedStyle(g.skillCanvas).display] } : null; });
  if (!st) { results.push('no skill check: ' + await pg.evaluate(() => { const g = window.__nb.session.game, me = g.mine(); return JSON.stringify({ act: me.act, st: me.st, x: me.x, z: me.z, g: window.__g, cd: g.skillCooldown }); })); break; }
  if (n === 0) await pg.screenshot({ path: 'sk_shot.png' });
  // wait until the needle is in the great zone, then press Space
  await pg.waitForFunction(() => { const s = window.__nb.session.game.skill; return !s || s.phase !== 'active' || s.needle >= s.start + 0.005; }, null, { timeout: 5000 });
  await key('Space', true); await key('Space', false);
  const r = await pg.evaluate(() => { const s = window.__nb.session.game.skill; return s ? s.res + ' at needle ' + (s.needle || 0).toFixed(3) + ' zone ' + s.start.toFixed(3) + '-' + s.end.toFixed(3) : 'gone'; });
  results.push(r);
  await pg.waitForTimeout(800);
}
console.log(JSON.stringify(results), 'errors', errs);
await br.close();
