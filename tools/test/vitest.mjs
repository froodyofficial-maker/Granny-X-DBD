// Vice Nights: the menu during the event (theme + card), the event panel, the badge on a profile, and after the event.
//   node vitest.mjs   (offline single file; dates faked with window.__now)
import { chromium } from 'playwright';
import { join, dirname } from 'node:path'; import { fileURLToPath } from 'node:url';
const FILE = 'file://' + join(dirname(fileURLToPath(import.meta.url)), '../../GrannyDBD.html');
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
async function shot(now, vi, out, act) {
  const pg = await br.newPage({ viewport: { width: 1280, height: 720 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.addInitScript(([now, vi]) => { window.__now = now; localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'granny', perks: [] }, survivor: { char: 'mara', perks: [] }, stats: { embers: 1000, matches: 30, escapes: 8, kills: 40 }, vi, readInbox: { gdbd152: true, gdbd151: true } })); localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' })); }, [now, vi]);
  await pg.goto(FILE);
  await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 180000 });
  await pg.addStyleTag({ content: '#announce{display:none!important}' });
  await pg.waitForTimeout(6000);
  if (act) { await pg.evaluate(a => document.querySelector(a).click(), act); await pg.waitForTimeout(1200); }
  await pg.screenshot({ path: out });
  const st = await pg.evaluate(() => ({ theme: document.documentElement.classList.contains('theme-vi'), card: !document.getElementById('vi-card').classList.contains('hidden'), chipBadge: !!document.querySelector('#profile .vi-badge') }));
  console.log(out, JSON.stringify(st), errs);
  await pg.close();
}
const NOW = Date.UTC(2026, 10, 21), AFTER = Date.UTC(2026, 11, 20);
await shot(NOW, { esc: 9, kills: 37, got: 0 }, 'vi_menu.png');
await shot(NOW, { esc: 9, kills: 37, got: 0 }, 'vi_panel.png', '#vi-card');
await shot(NOW, { esc: 25, kills: 61, got: NOW }, 'vi_profile.png', '#profile');
await shot(AFTER, { esc: 25, kills: 61, got: NOW }, 'vi_after.png');
await shot(AFTER, { esc: 3, kills: 2, got: 0 }, 'vi_after_none.png');
await br.close();
