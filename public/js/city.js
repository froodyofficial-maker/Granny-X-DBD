// City Mode (1.4.4): the rules on top of a normal match on Midnight City (citymap.js).
//  - Hiding spots (dumpsters, trash cans, portable toilets, piles of boxes): a survivor climbs in and can't be seen or
//    hit; a killer can search one, and whoever is inside is dragged out and hit.
//  - Victim's Cars: anyone can drive one (the driver steers it on their own machine and sends where it is, like walking).
//    A survivor's car that rams the killer stuns them; a killer's car knocks a survivor aside (no damage). A killer who
//    strikes a car pulls its survivor out and hits them.
//  - Pedestrians: walk the pavements, run screaming from killers, some drive round the streets. Killers kill them for
//    Embers; survivors (and killers) can run them over for Embers, and pull a driving one out to take the car.
// All of it lives in S (cars, peds) and on the players (p.hide, p.car), so snapshots carry it to everyone.
import { dynBoxes, moveCircle, losBlocked } from './map.js';
import { CITY, ROADS, ROAD_HALF, HIDE_KINDS } from './citymap.js';

export const CAR = { maxV: 13, rev: 4.5, acc: 6.5, brake: 15, drag: 2.6, steer: 2.0, hitV: 4.5, seat: 1.15 };
export const CITY_TIMES = { hide: 0.55, unhide: 0.3, search: 1.1, car: 0.45, exitcar: 0.2, carjack: 0.9 };
export const CITY_PAY = { pedKill: 300, runOver: 250, ram: 300, cap: 2400 };
const PED_WALK = 1.35, PED_RUN = 4.3, PEDS = 16, PED_CARS = 4;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fwdOf = y => ({ x: Math.sin(y), z: Math.cos(y) });
const onRoad = (x, z) => ROADS.some(r => Math.abs(x - r) < ROAD_HALF + 0.3) || ROADS.some(r => Math.abs(z - r) < ROAD_HALF + 0.3);

// ---------------- setup ----------------
export function cityInit(sim) {
  const S = sim.S, M = sim.M;
  if (!M.city) return;
  S.cars = (M.carSpots || []).map((s, i) => ({ id: i, x: s.x, z: s.z, y: s.yaw, v: 0, d: null, pd: -1, home: i, hitCd: 0, idle: 0 }));
  S.peds = [];
  const nodes = M.pedNodes, R = Math.random;
  for (let i = 0; i < PEDS; i++) {
    let n = nodes[Math.floor(R() * nodes.length)];
    for (let k = 0; k < 20 && S.players.some(p => Math.hypot(p.x - n.x, p.z - n.z) < 14); k++) n = nodes[Math.floor(R() * nodes.length)];
    const to = n.nb[Math.floor(R() * n.nb.length)];
    S.peds.push({ id: i, x: n.x, z: n.z, y: 0, s: 0, c: -1, n: to, last: n.id, lk: Math.floor(R() * 1000), t: 0, sc: 0 });
  }
  // pedestrians at the wheel: they start on the streets, between two crossings
  for (let i = 0; i < PED_CARS; i++) {
    const ped = { id: S.peds.length, x: 0, z: 0, y: 0, s: 3, c: -1, n: -1, last: -1, lk: Math.floor(R() * 1000), t: 0, sc: 0 };
    S.peds.push(ped);
    let a, b, alongX, dir, tries = 0;
    do { a = 1 + Math.floor(R() * 6); b = Math.floor(R() * 7); alongX = R() < 0.5; dir = R() < 0.5 ? 1 : -1; }
    while (tries++ < 20 && S.cars.some(o => o.lane && o.lane.ax === (alongX ? 'x' : 'z') && o.lane.line === ROADS[a] && Math.abs(o.lane.to - (dir > 0 ? b + 1 : b)) < 2)); // (not on top of another one)
    const car = { id: S.cars.length, x: 0, z: 0, y: 0, v: 0, d: null, pd: ped.id, home: -1, hitCd: 0, idle: 0, lane: null };
    // start halfway between crossings (b, b+1) on road line a
    const lineV = ROADS[a], t0 = (ROADS[b] + ROADS[b + 1]) / 2;
    if (alongX) { car.lane = { ax: 'x', line: lineV, dir, to: dir > 0 ? b + 1 : b }; }
    else { car.lane = { ax: 'z', line: lineV, dir, to: dir > 0 ? b + 1 : b }; }
    placeOnLane(car, t0);
    S.cars.push(car); ped.c = car.id; ped.x = car.x; ped.z = car.z;
  }
}
// lanes: a car on road line `line` running along axis `ax` (its x or z changes) in direction dir keeps 1.75 m to one side
function laneOff(L) { return -L.dir * 0.95; } // (1.5.1: nearer the middle, clear of the cars parked at the kerb)
function placeOnLane(c, t) {
  const L = c.lane;
  if (L.ax === 'x') { c.x = t; c.z = L.line + laneOff(L); c.y = L.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
  else { c.z = t; c.x = L.line - laneOff(L); c.y = L.dir > 0 ? 0 : Math.PI; }
}
function laneTarget(c) {
  const L = c.lane, t = ROADS[L.to];
  return L.ax === 'x' ? { x: t, z: L.line + laneOff(L) } : { x: L.line - laneOff(L), z: t };
}

// ---------------- collision ----------------
function hitAt(M, x, z, r) {
  const g = M.hash; if (!g) return false;
  const hh = M.half + 12, gx = Math.floor((x + hh) / 8), gz = Math.floor((z + hh) / 8);
  for (let a = gx - 1; a <= gx + 1; a++) for (let b = gz - 1; b <= gz + 1; b++) {
    const bucket = g.get(a * 1000 + b); if (!bucket) continue;
    for (const o of bucket) {
      if (o.h !== undefined && o.h < 0.35) continue;
      if (o.r !== undefined) { if (Math.hypot(x - o.x, z - o.z) < o.r + r) return true; }
      else if (Math.abs(x - o.x) < o.hx + r && Math.abs(z - o.z) < o.hz + r) return true;
    }
  }
  return false;
}
// how far into things a car would be at x, z facing yaw (0 = clear): its three circles against walls, props, closed
// gates, dropped pallets and the other cars
function hitDepth(M, x, z, r) {
  const g = M.hash; if (!g) return 0;
  const hh = M.half + 12, gx = Math.floor((x + hh) / 8), gz = Math.floor((z + hh) / 8);
  let worst = 0;
  for (let a = gx - 1; a <= gx + 1; a++) for (let b = gz - 1; b <= gz + 1; b++) {
    const bucket = g.get(a * 1000 + b); if (!bucket) continue;
    for (const o of bucket) {
      if (o.h !== undefined && o.h < 0.35) continue;
      if (o.r !== undefined) worst = Math.max(worst, o.r + r - Math.hypot(x - o.x, z - o.z));
      else { const dx = Math.abs(x - o.x) - o.hx, dz = Math.abs(z - o.z) - o.hz; worst = Math.max(worst, r - Math.max(dx, dz, Math.hypot(Math.max(0, dx), Math.max(0, dz)))); }
    }
  }
  return worst;
}
export function carDepth(M, S, x, z, yaw, self) {
  const f = fwdOf(yaw), h = M.half - 0.6;
  const dyn = dynBoxes(M, S);
  let depth = 0;
  for (const k of [-1.3, 0, 1.3]) {
    const px = x + f.x * k, pz = z + f.z * k;
    depth += Math.max(0, Math.abs(px) - h, Math.abs(pz) - h);
    depth += Math.max(0, hitDepth(M, px, pz, 0.9));
    for (const b of dyn) { const dx = Math.abs(px - b.x) - b.hx, dz = Math.abs(pz - b.z) - b.hz; depth += Math.max(0, 0.9 - Math.max(dx, dz)); }
  }
  if (S.cars) for (const o of S.cars) if (o.id !== self) depth += Math.max(0, 2.0 - Math.hypot(o.x - x, o.z - z));
  return depth;
}
// 1.5.1: a move is allowed when it doesn't push the car further into anything. A car that somehow ended up overlapping
// something (a pedestrian's car stopped through it, a tow onto a busy kerb) can always drive or reverse out of it: before,
// every move counted as blocked and the car never moved again ("I can't drive the cars").
export function carBlocked(M, S, x, z, yaw, self, from) {
  const d = carDepth(M, S, x, z, yaw, self);
  if (d <= 1e-4) return false;
  return !from || d > carDepth(M, S, from.x, from.z, from.y, self) - 1e-4;
}
// walkers are pushed out of cars (three circles along the car)
export function pushFromCars(S, p, r) {
  if (!S || !S.cars) return;
  for (const c of S.cars) {
    if (Math.abs(c.x - p.x) > 4 || Math.abs(c.z - p.z) > 4) continue;
    const f = fwdOf(c.y);
    for (const k of [-1.2, 0, 1.2]) {
      const cx = c.x + f.x * k, cz = c.z + f.z * k, dx = p.x - cx, dz = p.z - cz, d = Math.hypot(dx, dz), min = 0.95 + r;
      if (d < min && d > 1e-5) { p.x = cx + dx / d * min; p.z = cz + dz / d * min; }
    }
  }
}

// the driver's own car, one step (also used by the host for its own player). inp: { f: -1..1 throttle, r: -1..1 steer }
// returns the speed it crashed at (0 if it didn't)
export function driveCar(M, S, c, inp, dt) {
  let v = c.v;
  if (inp.f > 0.1) v += (v < -0.2 ? CAR.brake : CAR.acc * (1 - Math.max(0, v) / CAR.maxV * 0.55)) * inp.f * dt;
  else if (inp.f < -0.1) v -= (v > 0.3 ? CAR.brake : CAR.acc * 0.7) * -inp.f * dt;
  else v -= Math.sign(v) * Math.min(Math.abs(v), CAR.drag * dt);
  v = clamp(v, -CAR.rev, CAR.maxV);
  const sk = Math.min(1, Math.abs(v) / 3.5) * Math.sign(v) * (1 - Math.min(0.4, Math.abs(v) / CAR.maxV * 0.4));
  const yaw = c.y - inp.r * CAR.steer * sk * dt;
  const f = fwdOf(yaw), nx = c.x + f.x * v * dt, nz = c.z + f.z * v * dt;
  if (!carBlocked(M, S, nx, nz, yaw, c.id, c)) { c.x = nx; c.z = nz; c.y = yaw; c.v = v; return 0; }
  // scrape along the wall
  if (!carBlocked(M, S, nx, c.z, c.y, c.id, c)) { c.x = nx; c.v = v * 0.75; return 0; }
  if (!carBlocked(M, S, c.x, nz, c.y, c.id, c)) { c.z = nz; c.v = v * 0.75; return 0; }
  const hit = Math.abs(v);
  c.v = -v * 0.2;
  if (!carBlocked(M, S, c.x, c.z, yaw, c.id, c)) c.y = yaw;
  return hit;
}

// ---------------- interactions ----------------
// what a player can do here: { k, id, label, excl } (excl: the only thing they can do, e.g. getting out of a car)
export function cityInteraction(M, S, p) {
  if (!S.cars) return null;
  if (p.car >= 0) return { k: 'exitcar', id: p.car, label: 'Get out of the car', excl: true };
  if (p.hide >= 0) return p.role === 'survivor' ? { k: 'unhide', id: p.hide, label: 'Climb out', excl: true } : null;
  if (p.carry != null || p.stun > 0 || p.atk || p.vault || p.leap || p.dash || p.tele) return null;
  if (p.role === 'survivor' && p.st !== 'ok') return null;
  let best = null, bd = 1e9;
  const D = (x, z) => Math.hypot(x - p.x, z - p.z);
  // (bots never drive, and only hide in / search the spot they picked: p.hg)
  if (!p.bot) for (const c of S.cars) {
    const d = D(c.x, c.z);
    if (d > 3.5 || d >= bd) continue; // (from the bumpers too, not just the doors)
    if (c.d == null && c.pd < 0 && Math.abs(c.v) < 1.2) { bd = d; best = { k: 'car', id: c.id, label: "Drive the Victim's Car" }; }
    else if (c.pd >= 0 && Math.abs(c.v) < 2.2) { bd = d; best = { k: 'carjack', id: c.id, label: 'Pull the driver out' }; }
  }
  if (best) return best;
  for (const h of M.hides || []) {
    if (p.bot && p.hg !== h.id) continue;
    const K = HIDE_KINDS[h.kind], reach = (K.r || Math.max(K.hx, K.hz)) + 1.0, d = D(h.x, h.z);
    if (d > reach || d >= bd) continue;
    if (p.role === 'survivor' && !S.players.some(o => o.hide === h.id)) { bd = d; best = { k: 'hide', id: h.id, label: 'Hide in the ' + K.name }; }
    else if (p.role === 'killer') { bd = d; best = { k: 'search', id: h.id, label: 'Search the ' + K.name }; }
  }
  return best;
}

// a free spot next to a car / hiding spot to step out to
function stepOut(sim, x, z, yaw, dist) {
  const M = sim.M;
  for (const da of [Math.PI / 2, -Math.PI / 2, 0, Math.PI, 0.8, -0.8, 2.3, -2.3]) {
    const a = yaw + da, px = x + Math.sin(a) * dist, pz = z + Math.cos(a) * dist;
    if (Math.abs(px) < M.half - 1 && Math.abs(pz) < M.half - 1 && !hitAt(M, px, pz, 0.4)) return { x: px, z: pz };
  }
  return sim.safeSpot(x + Math.sin(yaw) * dist, z + Math.cos(yaw) * dist, x, z);
}
export function exitCar(sim, p) {
  const S = sim.S, c = S.cars && S.cars[p.car];
  p.car = -1;
  if (!c) return;
  c.d = null; c.v = 0; c.idle = 0;
  const sp = stepOut(sim, c.x, c.z, c.y, 1.75);
  p.x = sp.x; p.z = sp.z; p.tp++;
  sim.ev({ k: 'cardoor', id: c.id, x: c.x, z: c.z });
}
export function unhide(sim, p) {
  const h = sim.M.hides[p.hide];
  p.hide = -1;
  if (!h) return;
  const K = HIDE_KINDS[h.kind], sp = stepOut(sim, h.x, h.z, h.yaw + Math.PI / 2 * 0, (K.r || Math.max(K.hx, K.hz)) + 0.55);
  p.x = sp.x; p.z = sp.z; p.tp++;
  sim.ev({ k: 'hideout', id: h.id, x: h.x, z: h.z, by: p.id });
}
function pay(p, n) { const got = p.cityPay || 0; const add = Math.max(0, Math.min(n, CITY_PAY.cap - got)); p.cityPay = got + add; p.score.c += add; return add; }

// an action just finished (sim.finishAct). returns true when it was a city one
export function cityFinish(sim, p, a) {
  const S = sim.S, M = sim.M;
  switch (a.k) {
    case 'hide': {
      const h = M.hides[a.id];
      if (!h || S.players.some(o => o.hide === h.id) || p.st !== 'ok') return true;
      p.hide = h.id; p.x = h.x; p.z = h.z; p.yaw = h.yaw; p.tp++; p.flashOn = false; p.mv = 0;
      p.hideT = 0;
      sim.ev({ k: 'hidein', id: h.id, by: p.id, x: h.x, z: h.z });
      return true;
    }
    case 'unhide': unhide(sim, p); return true;
    case 'search': {
      const h = M.hides[a.id], s = S.players.find(o => o.hide === a.id);
      sim.ev({ k: 'search', id: a.id, by: p.id, x: h.x, z: h.z, found: s ? s.id : null });
      if (s) {
        unhide(sim, s);
        // dragged out in front of the killer, and hit
        s.x = p.x + Math.sin(p.yaw) * 0.9; s.z = p.z + Math.cos(p.yaw) * 0.9; s.tp++;
        sim.ev({ k: 'msg', text: `${s.name} was dragged out of the ${HIDE_KINDS[h.kind].name}!` });
        sim.damage(s, p, false);
        p.score.c += 300;
      }
      return true;
    }
    case 'car': {
      const c = S.cars[a.id];
      if (!c || c.d != null || c.pd >= 0) return true;
      c.d = p.id; c.v = 0; c.idle = 0; p.car = c.id; p.x = c.x; p.z = c.z; p.yaw = c.y; p.tp++; p.flashOn = false; p.aim = false;
      sim.ev({ k: 'cardoor', id: c.id, x: c.x, z: c.z, by: p.id, in: true });
      return true;
    }
    case 'exitcar': exitCar(sim, p); return true;
    case 'carjack': {
      const c = S.cars[a.id];
      if (!c || c.pd < 0) return true;
      const ped = S.peds[c.pd];
      c.pd = -1; c.v = 0; c.lane = null;
      if (ped) { const sp = stepOut(sim, c.x, c.z, c.y + Math.PI, 1.8); ped.x = sp.x; ped.z = sp.z; ped.c = -1; flee(ped, p, 6); sim.ev({ k: 'scream', x: ped.x, z: ped.z }); }
      sim.ev({ k: 'carjack', id: c.id, by: p.id, x: c.x, z: c.z });
      c.d = p.id; p.car = c.id; p.x = c.x; p.z = c.z; p.yaw = c.y; p.tp++; p.flashOn = false;
      if (p.role === 'killer' && ped) { ped.s = 2; ped.t = 25; pay(p, CITY_PAY.pedKill); sim.ev({ k: 'pedkill', by: p.id, x: ped.x, z: ped.z, id: ped.id }); }
      return true;
    }
  }
  return false;
}

// the killer's lunge: pedestrians are fair game (called when it hit no survivor)
export function cityKillerHit(sim, K, range) {
  const S = sim.S, M = sim.M; if (!S.peds) return false;
  const f = fwdOf(K.yaw);
  for (const ped of S.peds) {
    if (ped.s > 1) continue;
    const dx = ped.x - K.x, dz = ped.z - K.z, d = Math.hypot(dx, dz);
    if (d > range + 0.2 || (d > 0.9 && (dx * f.x + dz * f.z) / d < 0.55)) continue;
    if (losBlocked(M, K.x, K.z, ped.x, ped.z, 1.0)) continue;
    killPed(sim, ped, K, 'pedkill');
    return true;
  }
  return false;
}
function killPed(sim, ped, by, how) {
  ped.s = 2; ped.t = 25; ped.c = -1;
  let got = 0;
  if (by) { got = pay(by, how === 'runover' ? (by.role === 'killer' ? CITY_PAY.pedKill : CITY_PAY.runOver) : CITY_PAY.pedKill); by.score.peds = (by.score.peds || 0) + 1; }
  sim.ev({ k: how, by: by ? by.id : null, x: ped.x, z: ped.z, id: ped.id, got });
}
function flee(ped, from, t) { ped.s = 1; ped.t = t; ped.fx = from.x; ped.fz = from.z; }

// a strike that reaches a survivor's car pulls them out first (sim.damage calls this)
export function cityOnDamage(sim, s) {
  if (s.car >= 0) { exitCar(sim, s); sim.ev({ k: 'msg', text: s.name + ' was pulled out of the car!' }); }
  if (s.hide >= 0) unhide(sim, s);
}

// ---------------- every tick (host) ----------------
export function cityUpdate(sim, dt) {
  const S = sim.S, M = sim.M;
  if (!S.cars) return;
  const killers = S.players.filter(p => p.role === 'killer');
  // hidden survivors stay put; drivers sit in their car
  for (const p of S.players) {
    if (p.hide >= 0) { const h = M.hides[p.hide]; if (!h || p.st !== 'ok') { p.hide = -1; continue; } p.x = h.x; p.z = h.z; p.mv = 0; p.hideT = (p.hideT || 0) + dt; }
    if (p.car >= 0) {
      const c = S.cars[p.car];
      if (!c || c.d !== p.id || (p.role === 'survivor' && p.st !== 'ok') || p.stun > 0 && p.role === 'survivor') { if (c && c.d === p.id) exitCar(sim, p); else p.car = -1; continue; }
      if (p.bot) { p.x = c.x; p.z = c.z; } // (bots never drive; if one ends up in a car it gets straight out)
      p.mv = 0;
      if (p.bot && !p.act) exitCar(sim, p);
    }
  }
  // the cars: run-overs, rams, ped drivers, abandoned cars
  for (const c of S.cars) {
    if (c.hitCd > 0) c.hitCd -= dt;
    if (c.pd >= 0) driveLane(sim, c, dt);
    const drv = c.d != null ? sim.P(c.d) : null;
    if (c.d != null && (!drv || drv.car !== c.id)) c.d = null;
    if (c.d == null && c.pd < 0) {
      c.v = 0;
      c.idle += dt;
      // left somewhere off the streets (an alley, a parking lot entrance) for long enough: towed back to a kerb
      if (c.idle > 40 && !onRoad(c.x, c.z) && !S.players.some(p => Math.hypot(p.x - c.x, p.z - c.z) < 18)) towHome(sim, c);
    } else c.idle = 0;
    const sp = Math.abs(c.v);
    if (sp < CAR.hitV) continue;
    const f = fwdOf(c.y), sg = Math.sign(c.v), fx = c.x + f.x * 1.3 * sg, fz = c.z + f.z * 1.3 * sg;
    for (const ped of S.peds) {
      if (ped.s > 1) continue;
      if (Math.hypot(ped.x - fx, ped.z - fz) < 1.25 || Math.hypot(ped.x - c.x, ped.z - c.z) < 1.2) killPed(sim, ped, drv, 'runover');
    }
    if (!drv || c.hitCd > 0) continue;
    for (const o of S.players) {
      if (o === drv || o.car >= 0 || o.hide >= 0 || o.st !== 'ok' || o.role === drv.role) continue;
      if (Math.hypot(o.x - fx, o.z - fz) > 1.45 && Math.hypot(o.x - c.x, o.z - c.z) > 1.3) continue;
      c.hitCd = 6; c.v *= 0.25;
      if (o.role === 'killer') { sim.stunKiller(o, 2.0); pay(drv, CITY_PAY.ram); sim.ev({ k: 'carhit', id: o.id, by: drv.id, x: o.x, z: o.z, ram: true }); sim.ev({ k: 'msg', text: `${drv.name} rammed ${o.name} with a car!` }); }
      else { o.drowsy = Math.max(o.drowsy || 0, 2.2); const a = c.y + (Math.random() < 0.5 ? 1.4 : -1.4); const q = moveCircle(M, S, o.x, o.z, Math.sin(a) * 1.4, Math.cos(a) * 1.4, 0.36); o.x = q.x; o.z = q.z; o.tp++; sim.ev({ k: 'carhit', id: o.id, by: drv.id, x: o.x, z: o.z }); }
      break;
    }
  }
  // pedestrians
  for (const ped of S.peds) updatePed(sim, ped, killers, dt);
}

function towHome(sim, c) {
  const S = sim.S, M = sim.M, spots = M.carSpots || [];
  const free = s => !S.cars.some(o => o !== c && Math.hypot(o.x - s.x, o.z - s.z) < 3) && !S.players.some(p => Math.hypot(p.x - s.x, p.z - s.z) < 12);
  const s = (c.home >= 0 && free(spots[c.home])) ? spots[c.home] : spots.find(free);
  if (!s) return;
  c.x = s.x; c.z = s.z; c.y = s.yaw; c.v = 0; c.idle = 0;
}

function driveLane(sim, c, dt) {
  const S = sim.S, L = c.lane;
  if (!L) { c.v = 0; return; }
  if (c.t > 0) { c.t -= dt; c.v = Math.max(0, c.v - 10 * dt); return; }
  const T = laneTarget(c), dx = T.x - c.x, dz = T.z - c.z, d = Math.hypot(dx, dz);
  if (d < 1.0) {
    // at a crossing: carry on, or turn (never back the way it came); sometimes stop for a moment
    const opts = [];
    const ia = L.to, here = ROADS.indexOf(L.line);
    if (ia + L.dir >= 0 && ia + L.dir < ROADS.length) opts.push({ ax: L.ax, line: L.line, dir: L.dir, to: ia + L.dir }, { ax: L.ax, line: L.line, dir: L.dir, to: ia + L.dir });
    for (const dir of [-1, 1]) if (here + dir >= 0 && here + dir < ROADS.length) opts.push({ ax: L.ax === 'x' ? 'z' : 'x', line: ROADS[ia], dir, to: here + dir });
    c.lane = opts[Math.floor(Math.random() * opts.length)] || { ...L, dir: -L.dir, to: ia - L.dir };
    if (Math.random() < 0.3) c.t = 1.5 + Math.random() * 3;
    return;
  }
  // steer toward the lane point; slow for corners and for anyone in the road ahead
  const want = Math.atan2(dx, dz);
  let da = want - c.y; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2;
  c.y += clamp(da, -2.4 * dt, 2.4 * dt);
  const f = fwdOf(c.y);
  let top = Math.abs(da) > 0.35 ? 3.2 : Math.min(7.5, 2 + d * 1.2);
  const ahead = (x, z, w = 1.6) => { const rx = x - c.x, rz = z - c.z, along = rx * f.x + rz * f.z, side = Math.abs(rx * f.z - rz * f.x); return along > 0 && along < 7 && side < w; };
  if (S.players.some(p => p.car !== c.id && p.st !== 'dead' && p.st !== 'out' && ahead(p.x, p.z))) top = 0;
  if (S.cars.some(o => o !== c && ahead(o.x, o.z, 1.0))) top = 0; // (a car parked at the kerb is passed)
  if (S.peds.some(q => q.s < 2 && q.c < 0 && ahead(q.x, q.z))) top = Math.min(top, 0.8);
  c.v += clamp(top - c.v, -12 * dt, 4 * dt);
  c.x += f.x * c.v * dt; c.z += f.z * c.v * dt;
  const ped = S.peds[c.pd]; if (ped) { ped.x = c.x; ped.z = c.z; ped.y = c.y; }
}

function updatePed(sim, ped, killers, dt) {
  const S = sim.S, M = sim.M, nodes = M.pedNodes;
  if (ped.sc > 0) ped.sc -= dt;
  if (ped.s === 3) return; // at the wheel (driveLane moves it)
  if (ped.s === 2) {
    ped.t -= dt;
    if (ped.t <= 0) {
      // a new one walks on, somewhere nobody is looking
      for (let k = 0; k < 30; k++) {
        const n = nodes[Math.floor(Math.random() * nodes.length)];
        if (S.players.some(p => Math.hypot(p.x - n.x, p.z - n.z) < 28)) continue;
        Object.assign(ped, { x: n.x, z: n.z, s: 0, n: n.nb[0], last: n.id, lk: Math.floor(Math.random() * 1000), t: 0, c: -1 });
        break;
      }
    }
    return;
  }
  // a killer close by and in sight: run, screaming (survivors hear it)
  for (const K of killers) {
    const d = Math.hypot(K.x - ped.x, K.z - ped.z);
    if (d < 8.5 && (K.car >= 0 || !losBlocked(M, K.x, K.z, ped.x, ped.z, 1.4))) {
      if (ped.s !== 1 && ped.sc <= 0) { ped.sc = 9; sim.ev({ k: 'scream', x: ped.x, z: ped.z, id: ped.id }); }
      flee(ped, K, 4.5);
      break;
    }
  }
  if (ped.s === 1) {
    ped.t -= dt;
    const ax = ped.x - ped.fx, az = ped.z - ped.fz, al = Math.hypot(ax, az) || 1;
    // away from the killer, bending round walls
    const wob = Math.sin(S.t * 1.7 + ped.id) * 0.5, a = Math.atan2(ax / al, az / al) + wob;
    const q = moveCircle(M, S, ped.x, ped.z, Math.sin(a) * PED_RUN * dt, Math.cos(a) * PED_RUN * dt, 0.3);
    ped.y = Math.atan2(q.x - ped.x, q.z - ped.z); ped.x = q.x; ped.z = q.z;
    if (ped.t <= 0) {
      ped.s = 0;
      let best = 0, bd = 1e9; for (const n of nodes) { const d = Math.hypot(n.x - ped.x, n.z - ped.z); if (d < bd) { bd = d; best = n.id; } }
      ped.n = best; ped.last = -1;
    }
    return;
  }
  // walking the pavements, node to node
  const n = nodes[ped.n];
  const dx = n.x - ped.x, dz = n.z - ped.z, d = Math.hypot(dx, dz);
  if (d < 0.3) {
    const opts = n.nb.filter(k => k !== ped.last);
    ped.last = n.id; ped.n = (opts.length ? opts : n.nb)[Math.floor(Math.random() * (opts.length || n.nb.length))];
    if (Math.random() < 0.15) ped.t = 1 + Math.random() * 3; // stops to look at their phone
    return;
  }
  if (ped.t > 0) { ped.t -= dt; return; }
  const st = Math.min(d, PED_WALK * dt);
  // (a pedestrian heading back from somewhere off the pavement goes round walls)
  if (d > 1.6 && ped.last < 0) { const q = moveCircle(M, S, ped.x, ped.z, dx / d * st, dz / d * st, 0.3); ped.x = q.x; ped.z = q.z; }
  else { ped.x += dx / d * st; ped.z += dz / d * st; }
  ped.y = Math.atan2(dx, dz);
}
