// 1.5.3 (host simulation): GTA VI (PlayStation), the thrown item, and the collectables lying around the map.
//  - GTA VI (PlayStation): a survivor throws the game case where they look (S.cases, a short arc). A killer it hits sits
//    down at a desk and plays GTA VI: stunned for ITEMS.gtaps.freeze seconds (K.gamed counts it down for the picture:
//    chair, desk, monitor; game.js / vice.js). 3 throws a match (p.gtaps).
//  - Collectables: at the start every COLLECTABLES entry rolls its chance; the ones that turn up lie on a random walkable,
//    reachable spot (S.colls). Whoever walks over one first gets it (event 'coll'; each client keeps its own in the profile).
import { ITEMS, COLLECTABLES, nowMs } from './config.js';
import { levelOf, losBlocked, levelsMeet } from './map.js';
import { fwd } from './rules.js';

const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;

export function viceInit(sim) {
  const S = sim.S, M = sim.M, L = levelOf(M, 0), half = (M.half || 60) - 4, from = M.spawns.killer;
  S.cases = []; S.colls = [];
  if (!L.grid) return;
  const used = [M.spawns.killer, ...M.spawns.survivors];
  for (const c of COLLECTABLES) {
    if (Math.random() >= c.chance || (c.until && nowMs() >= c.until)) continue; // (GTA VI ones: only until the event ends)
    for (let k = 0; k < 40; k++) {
      const x = (Math.random() * 2 - 1) * half, z = (Math.random() * 2 - 1) * half;
      if (used.some(u => Math.hypot(u.x - x, u.z - z) < 9)) continue;
      const sp = sim.reachableSpot(L, x, z, from);
      if (!sp) continue;
      used.push(sp);
      S.colls.push({ c: c.id, x: +sp.x.toFixed(2), z: +sp.z.toFixed(2), fl: 0 });
      break;
    }
  }
}

// the throw (act 'gtaps')
export function viceAct(sim, p, m) {
  const S = sim.S, T = ITEMS.gtaps;
  if (p.role !== 'survivor' || p.st !== 'ok' || p.item !== 'gtaps' || !(p.gtaps > 0) || p.act || p.vault || (p.hide ?? -1) >= 0 || (p.car ?? -1) >= 0) return;
  if ((p.psCd || 0) > 0) return;
  const yaw = num(m.yaw, p.yaw), pitch = Math.max(-0.35, Math.min(0.5, num(m.pitch, 0))), f = fwd(yaw), sp = T.speed;
  p.gtaps--; p.psCd = T.cooldown; p.yaw = yaw; p.flashOn = false;
  S.cases.push({ id: ++S.lid, x: p.x + f.x * 0.5, z: p.z + f.z * 0.5, y: 1.35, fl: p.fl || 0, vx: f.x * sp * Math.cos(pitch), vz: f.z * sp * Math.cos(pitch), vy: 2.4 + sp * Math.sin(pitch), t: 0, by: p.id, st: 'fly', sx: p.x, sz: p.z });
  sim.ev({ k: 'psthrow', id: p.id, x: p.x, z: p.z });
  if (!p.gtaps) sim.ev({ k: 'psgone', id: p.id });
}

export function viceUpdate(sim, dt) {
  const S = sim.S, M = sim.M, T = ITEMS.gtaps;
  for (const p of S.players) {
    if (p.psCd > 0) p.psCd = Math.max(0, p.psCd - dt);
    if (p.gamed > 0) { p.gamed = Math.max(0, p.gamed - dt); if (!(p.stun > 0)) p.gamed = 0; }
  }
  // the flying game cases
  for (let i = S.cases.length - 1; i >= 0; i--) {
    const c = S.cases[i];
    c.t += dt;
    if (c.st === 'land') { if (c.t > 1.2) S.cases.splice(i, 1); continue; }
    const L = levelOf(M, c.fl), steps = 4, h = dt / steps;
    let end = null;
    for (let k = 0; k < steps && !end; k++) {
      const px = c.x, pz = c.z;
      c.vy -= 9 * h; c.x += c.vx * h; c.z += c.vz * h; c.y += c.vy * h;
      for (const K of S.players) {
        if (K.role !== 'killer' || K.disguise || (K.fl || 0) !== c.fl || K.st === 'dead') continue;
        if (c.y < 2.3 && c.y > 0 && Math.hypot(c.x - K.x, c.z - K.z) < 0.8) { end = { K }; break; }
      }
      if (end) break;
      if (c.y <= 0.08 || Math.hypot(c.x - c.sx, c.z - c.sz) > T.range) end = {};
      else if (losBlocked(L, px, pz, c.x, c.z, Math.min(1.2, c.y))) { c.x = px; c.z = pz; end = {}; }
    }
    if (!end) continue;
    if (end.K) {
      const K = end.K, by = sim.P(c.by);
      if (!(K.act && K.act.k === 'execute')) {
        sim.stunKiller(K, T.freeze); K.gamed = T.freeze; K.gameYaw = K.yaw;
        if (by) by.score.b += 500;
        sim.ev({ k: 'gamed', id: K.id, by: c.by, x: K.x, z: K.z });
      }
      S.cases.splice(i, 1);
    } else { c.st = 'land'; c.t = 0; c.y = 0.05; c.vx = c.vz = c.vy = 0; sim.ev({ k: 'psland', x: c.x, z: c.z }); }
  }
  // collectables: first one over it keeps it
  for (let i = S.colls.length - 1; i >= 0; i--) {
    const o = S.colls[i];
    const p = S.players.find(p => (p.st === 'ok' || (p.role === 'killer' && p.st !== 'dead')) && (p.fl || 0) === o.fl && (p.hide ?? -1) < 0 && (p.car ?? -1) < 0 && Math.hypot(p.x - o.x, p.z - o.z) < 1.0);
    if (!p) continue;
    S.colls.splice(i, 1);
    sim.ev({ k: 'coll', c: o.c, by: p.id, x: o.x, z: o.z });
  }
}
