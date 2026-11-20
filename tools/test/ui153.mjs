// 1.5.3 menus in the offline file (date faked to 21 Nov 2026): the menu, Store > Add-ons (GTA VI Pass + item), the Redeem
// Code tab, the Profile shelf, the 3D viewer, the leaderboard, buying the pass; then after 1 Dec. node ui153.mjs outdir
import { chromium } from 'playwright';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const FILE = 'file://' + join(dirname(fileURLToPath(import.meta.url)), '../../GrannyDBD.html'), OUT = process.argv[2] || '.';
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
async function open(now, extra = {}) {
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); pg.setDefaultTimeout(240000); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([now, extra]) => { window.__now = now; window.__nbMqtt = ['ws://localhost:8883']; localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 60000, matches: 30, escapes: 8, kills: 40 }, readInbox: { gdbd153: true, gdbd152: true, gdbd151: true }, colls: { page: { n: 3, at: now }, key: { n: 5, at: now }, bulb: { n: 7, at: now }, goldted: { n: 1, at: now } }, showcase: ['goldted', 'page'], ...extra })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' })); }, [now, extra]);
  await pg.goto(FILE);
  await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 500000 });
  await pg.addStyleTag({ content: '#announce{display:none!important}' });
  await pg.waitForTimeout(5000);
  return { pg, errs };
}
const click = (pg, q) => pg.evaluate(q => document.querySelector(q).click(), q);
const NOW = Date.UTC(2026, 10, 21), AFTER = Date.UTC(2026, 11, 2);
{ const { pg, errs } = await open(NOW);
  await pg.screenshot({ path: OUT + '/u_menu.png' });
  await click(pg, '[data-act="store"]'); await pg.waitForTimeout(600); await click(pg, '#st-tabs [data-t="addons"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/u_addons.png' });
  await click(pg, '#st-tabs [data-t="codes"]'); await pg.waitForTimeout(600); await pg.screenshot({ path: OUT + '/u_codes.png' });
  await click(pg, '#st-tabs [data-t="addons"]'); await pg.waitForTimeout(500); await click(pg, '[data-vipass]'); await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/u_bought.png' });
  const st = await pg.evaluate(() => { const p = window.__nb.profile; return { embers: p.stats.embers, pass: !!p.vi.pass, got: !!p.vi.got, gtaps: p.gtaps, colls: Object.keys(p.colls), item: p.survivor.item }; });
  await click(pg, '#st-close'); await pg.waitForTimeout(500);
  await click(pg, '#profile'); await pg.waitForTimeout(2500); await pg.screenshot({ path: OUT + '/u_profile.png' });
  await pg.evaluate(() => document.querySelector('.panel-body').scrollTop = 600); await pg.waitForTimeout(500); await pg.screenshot({ path: OUT + '/u_shelf.png' });
  await click(pg, '.cl-card[data-cl="monster"]'); await pg.waitForTimeout(3000); await pg.screenshot({ path: OUT + '/u_view.png' });
  await click(pg, '#clv-x'); await pg.waitForTimeout(300); await click(pg, '#panel-close'); await pg.waitForTimeout(400);
  await click(pg, '#lb-btn'); await pg.waitForTimeout(5000); await pg.screenshot({ path: OUT + '/u_board.png' });
  console.log('during', JSON.stringify(st), errs); await pg.close(); }
{ const { pg, errs } = await open(AFTER, { gtaps: true, survivor: { char: 'mara', perks: [], item: 'gtaps' }, vi: { esc: 1, kills: 2, got: NOW, pass: NOW } });
  await pg.screenshot({ path: OUT + '/u_after.png' });
  await click(pg, '[data-act="store"]'); await pg.waitForTimeout(600); await click(pg, '#st-tabs [data-t="addons"]'); await pg.waitForTimeout(800); await pg.screenshot({ path: OUT + '/u_after_addons.png' });
  const st = await pg.evaluate(() => ({ theme: document.documentElement.classList.contains('theme-vi'), card: !document.getElementById('vi-card').classList.contains('hidden'), pass: !!document.querySelector('.vi-pass'), badge: !!document.querySelector('#profile .vi-badge') }));
  console.log('after', JSON.stringify(st), errs); await pg.close(); }
await br.close();
