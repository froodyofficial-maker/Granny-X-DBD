// City Mode (1.4.4, the Season 1 event): "Midnight City". A 7x7 grid of city blocks with streets between them.
// The layout goes through map.js buildArena like the other outdoor maps (generators, hooks, gates, spawns); this
// file has the block templates and the city's own extras: hiding spots, parked Victim's Cars, the pavement graph
// the pedestrians walk and the street lights. No imports (themes.js reads this while map.js is still loading).
//
// A block is 15 m square (local -7.5..7.5): its outer 1.2 m is pavement (kept clear: pedestrians walk there), the
// set pieces stay inside +-6. The streets between blocks are 7 m wide.
export const CITY = { N: 7, step: 22, block: 7.5, inner: 6.0, walk: 6.9, half: 81, gens: 8, cages: 9 };
CITY.xs = [-66, -44, -22, 0, 22, 44, 66];
// street centre lines (both directions): between the blocks, plus the ring road inside the fence
export const ROADS = [-77, -55, -33, -11, 11, 33, 55, 77];
export const ROAD_HALF = 3.5;

// hiding spots: collision footprint and how the survivor sits in it
export const HIDE_KINDS = {
  dumpster: { name: 'dumpster', hx: 0.95, hz: 0.55, h: 1.3 },
  bin: { name: 'trash can', r: 0.4, h: 1.08 },
  toilet: { name: 'portable toilet', hx: 0.62, hz: 0.62, h: 2.35 },
  boxes: { name: 'pile of boxes', hx: 0.72, hz: 0.72, h: 1.25 },
};

function hide(M, C, x, z, kind, fx = 0, fz = 1) {
  const K = HIDE_KINDS[kind], [wx, wz] = C.rp(x, z), [ax, az] = C.rp(x + fx, z + fz);
  const yaw = Math.atan2(ax - wx, az - wz);
  if (K.r) M.circles.push({ x: wx, z: wz, r: K.r, h: K.h, kind: 'hide', nocast: true });
  else {
    // (a quarter turn swaps the footprint's axes)
    const sw = Math.abs(Math.sin(yaw)) > 0.7;
    M.boxes.push({ x: wx, z: wz, hx: sw ? K.hz : K.hx, hz: sw ? K.hx : K.hz, h: K.h, kind: 'hide', style: 'metal', nocast: true });
  }
  (M.hides ||= []).push({ id: M.hides.length, x: wx, z: wz, kind, yaw });
}
const bld = (C, x, z, hx, hz, h, style) => C.box(x, z, hx, hz, h, 'bldg', style);
// a parking space inside a block (local spot + heading); the car drives out through the open side
function carSpot(M, C, x, z, fx, fz) {
  const [wx, wz] = C.rp(x, z), [ax, az] = C.rp(x + fx, z + fz);
  (M.carSpots ||= []).push({ x: wx, z: wz, yaw: Math.atan2(ax - wx, az - wz), lot: true });
}

export const cityTheme = {
  name: 'Midnight City', style: 'brick', boundary: 'concrete', center: 'plaza',
  names: ['tower', 'alley', 'shops', 'park', 'parking', 'construction', 'diner', 'alley', 'shops', 'tower', 'diner', 'parking'],
  scatter: { n: 0, tree: 0 },
  templates(S, M, R) {
    const H = (a, b) => R.range(a, b);
    return {
      plaza(C) {
        C.circle(0, 0, 1.25, 4.2, 'statue');
        for (const [x, z] of [[-3.6, 0], [3.6, 0]]) C.box(x, z, 0.3, 1.1, 0.5, 'bench', 'wood');
        C.box(0, 3.4, 1.3, 0.3, 0.5, 'bench', 'wood');
        C.box(-4.6, -4.4, 1.0, 1.0, 1.0, 'planter', 'concrete'); C.box(4.6, 4.4, 1.0, 1.0, 1.0, 'planter', 'concrete');
        hide(M, C, -4.8, 4.6, 'bin');
        return { G: [3.4, -3.6], C: [-3.8, 3.6], trees: [[-5.2, 0.5], [5.2, -0.5]] };
      },
      open(C) {
        C.box(-2.6, 2.4, 1.2, 0.3, 0.5, 'bench', 'wood');
        hide(M, C, 4.8, -4.8, 'bin');
        return { G: [2.5, 2.5], C: [-3.5, -4.0], trees: [[5, 5], [-5, -5.2]] };
      },
      tower(C) {
        bld(C, -1.6, -1.6, 4.3, 4.3, H(14, 24), R.pick(['glass', 'concrete']));
        C.box(4.6, 0.6, 0.9, 1.5, 1.0, 'planter', 'concrete');
        C.barricade(3.2, 1.6, 'z', 0.5);
        hide(M, C, 4.7, -4.4, 'dumpster', -1, 0);
        hide(M, C, -4.6, 4.8, 'bin');
        return { G: [3.6, 4.4], C: [-3.2, 4.4], trees: [] };
      },
      alley(C) {
        const st = R.pick(['brick', 'concrete', 'brick']);
        bld(C, -3.6, -1.5, 2.4, 4.5, H(8, 13), st);
        bld(C, 3.6, -1.5, 2.4, 4.5, H(8, 13), R.pick(['brick', 'concrete']));
        C.barricade(0, -1.6, 'z', 1.08);
        hide(M, C, 0, 2.2, 'boxes');
        hide(M, C, -4.7, 4.6, 'dumpster', 1, 0);
        return { G: [2.8, 4.6], C: [-1.2, 4.9], trees: [] };
      },
      shops(C) {
        C.windowWall(-5.6, -1.6, 0, -1.6, 'shop', 0.5, 1.8, 3.2);
        C.doorWall(0, -1.6, 5.6, -1.6, 'shop', 0.5, 1.8, false, 3.2);
        C.seg(5.6, -1.6, 5.6, 4.2, 'shop', 3.2);
        C.doorWall(5.6, 4.2, -5.6, 4.2, 'shop', 0.3, 1.7, true, 3.2);
        C.seg(-5.6, 4.2, -5.6, -1.6, 'shop', 3.2);
        C.seg(-1.2, 1.2, -1.2, 4.2, 'shop', 3.2);
        C.box(2.4, 2.6, 1.6, 0.4, 1.0, 'counter', 'wood');
        hide(M, C, -1.6, -5.0, 'bin');
        hide(M, C, -3.4, 2.7, 'boxes');
        (M.shops ||= []).push(...[C.rp(-5.6, -1.6), C.rp(5.6, 4.2)]);
        return { G: [3.4, -4.2], C: [-4.4, -4.4], trees: [] };
      },
      park(C) {
        C.circle(0, 0, 1.6, 0.85, 'fountain');
        C.box(-3.2, -3.4, 2.1, 0.4, 1.25, 'hedge', 'hedge');
        C.box(3.2, -3.4, 2.1, 0.4, 1.25, 'hedge', 'hedge');
        C.barricade(0, -3.4, 'z', 0.95);
        C.box(-4.2, 2.6, 0.3, 1.1, 0.5, 'bench', 'wood');
        hide(M, C, 4.7, 4.7, 'toilet', -1, 0);
        return { G: [3.6, 1.2], C: [-3.6, 4.6], trees: [[-5, -5.2], [5, -5.3], [-5.2, 0.6], [1, 5], [-1.8, 3]] };
      },
      parking(C) {
        C.seg(-5.8, 5.8, 5.8, 5.8, 'concrete', 1.0);
        C.seg(-5.8, -1.0, -5.8, 5.8, 'concrete', 1.0);
        C.seg(5.8, -1.0, 5.8, 3.6, 'concrete', 1.0);
        C.box(0, 2.6, 0.9, 0.9, 2.4, 'booth', 'shop');
        carSpot(M, C, -3.2, 0.8, 0, -1);
        carSpot(M, C, 3.2, 0.8, 0, -1);
        hide(M, C, 4.6, 4.8, 'dumpster', -1, 0);
        return { G: [0, -3.4], C: [-1.8, 4.6], trees: [] };
      },
      construction(C) {
        C.seg(-5.8, -5.8, -0.9, -5.8, 'fence', 2.2);
        C.seg(0.9, -5.8, 5.8, -5.8, 'fence', 2.2);
        C.barricade(0, -5.8, 'z', 0.75);
        C.seg(5.8, -5.8, 5.8, 1.6, 'fence', 2.2);
        C.seg(-5.8, -5.8, -5.8, 1.6, 'fence', 2.2);
        C.box(-2.4, -1.6, 1.5, 0.9, 2.8, 'scaffold', 'metal');
        C.box(2.6, -2.6, 0.8, 0.8, 1.6, 'crate', 'wood');
        C.box(3.1, -0.6, 0.6, 0.6, 1.1, 'crate', 'wood');
        hide(M, C, -4.6, 4.6, 'toilet', 1, 0);
        hide(M, C, 4.6, 4.6, 'boxes');
        return { G: [1.0, 0.8], C: [-0.4, 4.6], trees: [] };
      },
      diner(C) {
        C.windowWall(-5.4, -2.4, 5.4, -2.4, 'brick', 0.3, 1.5, 3.4);
        C.doorWall(5.4, -2.4, 5.4, 3.0, 'brick', 0.5, 1.8, false, 3.4);
        C.windowWall(5.4, 3.0, -5.4, 3.0, 'brick', 0.65, 1.5, 3.4);
        C.doorWall(-5.4, 3.0, -5.4, -2.4, 'brick', 0.5, 1.8, true, 3.4);
        C.box(-0.6, 0.6, 2.0, 0.4, 1.0, 'counter', 'wood');
        hide(M, C, 3.6, 5.0, 'dumpster', 0, -1);
        return { G: [-2.8, -4.6], C: [3.6, -4.6], trees: [] };
      },
    };
  },
  // pavements, parked cars, street lights
  extra(M, R, cells, near) {
    const W = CITY.walk, half = M.half;
    M.city = { roads: ROADS, half };
    M.cityCells = cells.map(c => ({ x: c.cx, z: c.cz, t: c.t, rot: c.rot }));
    // pedestrians walk round each block's pavement and cross at the corners
    const nodes = M.pedNodes = [], at = new Map();
    for (const c of cells) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const id = nodes.length; nodes.push({ id, x: c.cx + sx * W, z: c.cz + sz * W, nb: [] }); at.set(`${c.i},${c.j},${sx},${sz}`, id);
    }
    const link = (a, b) => { if (a == null || b == null) return; nodes[a].nb.push(b); nodes[b].nb.push(a); };
    for (const c of cells) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const me = at.get(`${c.i},${c.j},${sx},${sz}`);
      if (sx < 0) link(me, at.get(`${c.i},${c.j},1,${sz}`));
      if (sz < 0) link(me, at.get(`${c.i},${c.j},${sx},1`));
      if (sx > 0) link(me, at.get(`${c.i + 1},${c.j},-1,${sz}`));
      if (sz > 0) link(me, at.get(`${c.i},${c.j + 1},${sx},-1`));
    }
    // street lights halfway along each pavement
    M.cityLamps = [];
    for (const c of cells) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (R() < 0.45) continue;
      const x = c.cx + dx * 6.35, z = c.cz + dz * 6.35; // (on the inside of the pavement: never wedged against a parked car)
      M.cityLamps.push({ x, z, yaw: Math.atan2(dx, dz) });
      M.circles.push({ x, z, r: 0.14, h: 5.5, kind: 'lamppost', nocast: true });
    }
    // parked cars along the kerbs (plus the ones in the parking lots): at least a dozen
    const spots = M.carSpots ||= [];
    const okSpot = (x, z) => Math.abs(x) < half - 2 && Math.abs(z) < half - 2 && M.gates.every(g => Math.hypot(x - g.x, z - g.z) > 11)
      && [...M.spawns.survivors, M.spawns.killer].every(s => Math.hypot(x - s.x, z - s.z) > 8) && spots.every(s => Math.hypot(x - s.x, z - s.z) > 14);
    const cand = [];
    for (const X of ROADS) for (const zc of CITY.xs) for (const side of [-1, 1]) {
      cand.push({ x: X + side * 2.5, z: zc + R.range(-4, 4), yaw: side > 0 ? 0 : Math.PI });
      cand.push({ x: zc + R.range(-4, 4), z: X + side * 2.5, yaw: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
    R.shuffle(cand);
    for (const s of cand) { if (spots.length >= 14) break; if (okSpot(s.x, s.z)) spots.push(s); }
    // a few more drive round the streets with a pedestrian at the wheel (sim)
  },
};
