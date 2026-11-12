// the offline single file (what the exe and the apk run): Store > Sidekicks picture, the Profile panel, saves
import { chromium } from 'playwright';
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--allow-file-access-from-files'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 760 }, ...(process.env.MOBILE ? { isMobile: true, hasTouch: true, viewport: { width: 1280, height: 600 } } : {}) });
await ctx.addInitScript(() => {
  if (!sessionStorage.getItem('s')) { sessionStorage.setItem('s', 1);
    localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 30000, matches: 120, escapes: 30, kills: 70 }, pets: {}, owned: { 'granny:ghost': true } }));
    localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' })); }
  if (window.__forceMobile) window.__forceTouch = true;
  // a fake disk (like the exe's preload) to check the mirror
  const D = {}; window.gdbdDisk = { load: k => D[k] || null, save: (k, v) => { D[k] = v; } }; window.__D = D;
});
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto('file:///home/user/granny-x-dbd/GrannyDBD.html');
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 180000 });
await pg.addStyleTag({ content: '#announce{display:none!important}' });
await pg.waitForTimeout(2500);
const click = q => pg.evaluate(q => document.querySelector(q).click(), q);
await click('[data-act="store"]'); await pg.waitForTimeout(600); await click('#st-tabs [data-t="sidekicks"]'); await pg.waitForTimeout(800);
console.log('child art bg:', await pg.evaluate(() => getComputedStyle(document.querySelector('.kid-img')).backgroundImage.slice(0, 40)));
await pg.screenshot({ path: 'o_store.png' });
await click('[data-kidbuy]'); await pg.waitForTimeout(300); await click('#st-close'); await pg.waitForTimeout(400);
await click('#profile'); await pg.waitForTimeout(900);
await pg.screenshot({ path: 'o_profile.png' });
await click('[data-av="angeline"]'); await pg.waitForTimeout(300); await click('[data-title="child"]'); await pg.waitForTimeout(300); await click('[data-acc="#e0b84a"]'); await pg.waitForTimeout(500);
await pg.screenshot({ path: 'o_profile2.png' });
const code = await pg.evaluate(() => { document.querySelector('#pf-show').click(); return document.querySelector('#pf-code').value; });
console.log('backup code', code.slice(0, 30), code.length, 'disk mirror has profile:', await pg.evaluate(() => !!window.__D.profile && JSON.parse(window.__D.profile).pets.child));
// wipe the browser storage: the disk copy must bring it back
await pg.evaluate(() => { const d = JSON.stringify(window.__D); sessionStorage.setItem('disk', d); localStorage.removeItem('gdbd_profile'); });
await pg.addInitScript(() => { const d = sessionStorage.getItem('disk'); if (d) { const D = JSON.parse(d); window.gdbdDisk = { load: k => D[k] || null, save: (k, v) => { D[k] = v; } }; } });
await pg.reload(); await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 180000 }); await pg.waitForTimeout(1500);
console.log('after wiping localStorage:', await pg.evaluate(() => { const p = window.__nb.profile; return JSON.stringify({ embers: p.stats.embers, child: !!p.pets.child, avatar: p.avatar, title: p.title }); }));
// restore from the backup code on a "new device"
await pg.evaluate(() => { localStorage.clear(); });
console.log('errors', errs); await br.close();
