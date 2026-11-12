// 1.4 screens: Loadout (levels, stats, sidekick), Store sidekicks, Progress (season pass), bot panel in 2v8
import { chromium } from 'playwright';
import http from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const ROOT = '/home/user/granny-x-dbd';
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer(async (q, r) => { let u = decodeURIComponent(q.url.split('?')[0]); if (u === '/') u = '/index.html'; try { const b = await readFile(join(ROOT, u)); r.writeHead(200, { 'content-type': MIME[extname(u)] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const br = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await br.newContext({ viewport: { width: 1280, height: 760 } });
await ctx.addInitScript(() => {
  localStorage.setItem('gdbd_profile', JSON.stringify({ seen: { intro: true, help: true, tut: true }, killer: { char: 'angeline', perks: ['scent', 'overload', 'relentless', 'brute'], pet: 'child' }, survivor: { char: 'mara', perks: [] },
    stats: { embers: 90000, matches: 12, escapes: 4, kills: 9 }, pets: { child: true }, perksOwned: { brute: true }, chars: { angeline: { xp: 9000, st: { spd: 3, cd: 2 } }, mara: { xp: 2500, st: {} } },
    prog: { xp: 7400, ranks: { survivor: 9, killer: 22 }, season: { id: 's1', xp: 6400, claimed: { 1: true, 2: true }, prem: false }, badges: {} } }));
  localStorage.setItem('gdbd_settings', JSON.stringify({ quality: 'low', name: 'Tester' }));
  window.__nbMqtt = ['ws://127.0.0.1:1'];
});
const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
await pg.goto(`http://localhost:${srv.address().port}/index.html`);
await pg.waitForFunction(() => window.__nb && document.querySelector('#mainnav button'), null, { timeout: 120000 });
await pg.addStyleTag({ content: '#announce{display:none!important}' });
const click = q => pg.evaluate(q => document.querySelector(q).click(), q);
await pg.waitForTimeout(3000);
await pg.evaluate(k => { window.__nb.profile.killer.char = k; }, process.env.K || 'angeline');
await click('[data-act="play-killer"]'); await pg.waitForTimeout(600); await pg.selectOption('#bots-gm', process.env.GM || 'duo'); await pg.waitForTimeout(400);
await pg.selectOption('#bots-map', 'granny');
await click('#btn-bots-start');
await pg.waitForFunction(() => window.__nb.session && window.__nb.session.game && window.__nb.session.sim && window.__nb.session.sim.S.t > 1, null, { timeout: 240000 });
await pg.waitForTimeout(5000);
await pg.screenshot({ path: 'm_pre.png' });
console.log('PRE', await pg.evaluate(() => { const g = window.__nb.session.game, T = window.__THREE, me = g.mine(), cam = g.camera; const dir = new T.Vector3(); cam.getWorldDirection(dir); const rc = new T.Raycaster(cam.position.clone(), dir, 0, 6); const meshes = []; g.scene.traverse(o => { if (o.isMesh && o.visible) meshes.push(o); }); let hits = []; try { hits = rc.intersectObjects(meshes, false).slice(0, 5).map(h => [h.object.name || h.object.type, (h.object.parent && h.object.parent.name) || '', (h.object.parent && h.object.parent.parent && h.object.parent.parent.name) || '', +h.distance.toFixed(2)]); } catch (e) { hits = ['err ' + e.message]; } const k = window.__nb.session.sim.S.kids[0]; return JSON.stringify({ me: [+me.x.toFixed(2), +me.z.toFixed(2), +me.yaw.toFixed(2)], cam: cam.position.toArray().map(v => +v.toFixed(2)), camDist: +g.camDist.toFixed(2), kid: k && [k.x, k.z], hits }); }));
// walk forward a little so the Child crawls after her
await pg.evaluate(() => { const g = window.__nb.session.game; g.onKeyCode({ code: 'KeyW', repeat: false, target: document.body, preventDefault() {} }, true); });
await pg.waitForTimeout(4000);
await pg.evaluate(() => { const g = window.__nb.session.game; g.onKeyCode({ code: 'KeyW', repeat: false, target: document.body, preventDefault() {} }, false); });
await pg.waitForTimeout(1500);
await pg.screenshot({ path: 'm_hud.png' });
console.log(await pg.evaluate(() => { const g = window.__nb.session.game, me = g.mine(), c = g.camera.position; const ch = g.chars.get('me'); return JSON.stringify({ me: [me.x, me.z, me.yaw, me.pitch], cam: c.toArray().map(v => +v.toFixed(2)), camDist: g.camDist, rigScale: ch && ch.rig.root.scale.toArray(), rigPos: ch && ch.rig.root.position.toArray().map(v=>+v.toFixed(2)), rigVis: ch && ch.rig.root.visible }); }));
await pg.evaluate(() => { const g = window.__nb.session.game; const ch = g.chars.get('me'); ch.rig.root.visible = false; g.hideMe = true; const o = ch.rig.root; o.scale.setScalar(0.0001); });
await pg.waitForTimeout(800);
await pg.screenshot({ path: 'm_hud2.png' });
console.log(await pg.evaluate(() => { const g = window.__nb.session.game, T = window.__THREE; const out = []; for (const [id, P] of g.kids || []) { const b = new T.Box3().setFromObject(P.R.root, true); out.push({ id, pos: P.R.root.position.toArray().map(v => +v.toFixed(2)), size: b.getSize(new T.Vector3()).toArray().map(v => +v.toFixed(2)), vis: P.R.root.visible, op: P.op }); P.R.root.visible = false; } return JSON.stringify(out); }));
await pg.waitForTimeout(800);
await pg.screenshot({ path: 'm_hud3.png' });
await pg.evaluate(() => { window.__camAt = window.__nb.session.game.camera.position.clone(); }); await pg.evaluate(() => { const g = window.__nb.session.game; window.__cine = (G) => { const cam = G.camera; cam.position.set(26, 9, 30); cam.lookAt(21, 0, 22); cam.fov = 60; cam.updateProjectionMatrix(); }; const ch = g.chars.get('me'); ch.rig.root.scale.setScalar(1); ch.rig.root.visible = true; });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: 'm_top.png' });
console.log(await pg.evaluate(() => { const g = window.__nb.session.game, T = window.__THREE; const me = g.mine(); const from = new T.Vector3(me.x, 1.6, me.z), to = window.__camAt; const dir = to.clone().sub(from); const L = dir.length(); dir.normalize(); const rc = new T.Raycaster(from, dir, 0, L); const meshes = []; g.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh && o.geometry && o.visible) meshes.push(o); }); let hits = []; try { hits = rc.intersectObjects(meshes, false).slice(0, 6).map(h => [h.object.name || h.object.type, (h.object.parent && h.object.parent.name) || '', +h.distance.toFixed(2)]); } catch (e) { hits = ['err ' + e.message]; } return JSON.stringify({ L: +L.toFixed(2), hits }); }));
console.log(await pg.evaluate(() => { const S = window.__nb.session.sim.S; return JSON.stringify({ players: S.players.length, killers: S.players.filter(p => p.role === 'killer').map(p => p.char + (p.kid ? '+kid' : '')), kids: S.kids.length, need: S.gensNeeded, stats: S.players.find(p => p.id === 'me').stats }); }));
console.log('errors', errs); await br.close(); srv.close();
