// 1.7.0 gore overhaul.
//  - Blood that soaks into a survivor's clothes and skin (a shader on their own materials), with open gashes and
//    streaks running down from each wound, instead of the red ellipsoids stuck on the body.
//  - Flesh chunks that fly, bounce and stay (one instanced mesh).
//  - Blood pools, splatter, sprays and drag smears as ONE instanced mesh (it was up to 240 meshes, a draw call each),
//    on the floor the body is on (upper floors of the house too), wet and glossy, drying and fading over time.
import * as THREE from 'three';

// ---------------------------------------------------------------- wounds on the body
const N = 8; // wounds per survivor
const NOISE = `
float gH(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gN(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gH(i), gH(i + vec3(1,0,0)), f.x), mix(gH(i + vec3(0,1,0)), gH(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gH(i + vec3(0,0,1)), gH(i + vec3(1,0,1)), f.x), mix(gH(i + vec3(0,1,1)), gH(i + vec3(1,1,1)), f.x), f.y), f.z); }
`;
// Each wound: uW = centre (rig rest space, metres) + radius; uC = gash direction + half length; uX = fresh, drip length,
// gash width, seed. Everything is computed from the rest-pose position of the surface, so the blood moves with the body.
const BODY_VS_HEAD = 'varying vec3 vGoreP;\n';
const BODY_FS_HEAD = `varying vec3 vGoreP;
uniform vec4 uGW[${N}]; uniform vec4 uGC[${N}]; uniform vec4 uGX[${N}]; uniform float uGAll;
${NOISE}
float gCov, gGash, gFresh;
void goreEval(vec3 P){
  gCov = 0.0; gGash = 0.0; gFresh = 0.0;
  float n = gN(P * 26.0), n2 = gN(P * 70.0 + 3.1);
  for (int i = 0; i < ${N}; i++) {
    vec4 W = uGW[i]; if (W.w <= 0.0) continue;
    vec4 X = uGX[i]; vec3 d = P - W.xyz;
    float r = W.w * (0.7 + 0.55 * n + 0.15 * n2);
    float blob = 1.0 - smoothstep(r * 0.62, r, length(d));
    // streaks running down from the wound: thin columns that get thinner and stop at the drip length
    float dy = -d.y, col = gN(vec3(P.x * 55.0 + X.w, 0.0, P.z * 55.0 - X.w));
    float drip = step(0.0, dy) * smoothstep(0.52, 0.78, col) * (1.0 - smoothstep(X.y * 0.55, X.y, dy + n * 0.03))
               * (1.0 - smoothstep(r * 0.45, r * 1.05, length(d.xz)));
    float c = max(blob, drip * 0.95);
    gCov = max(gCov, c);
    gFresh = max(gFresh, c * X.x);
    vec4 C = uGC[i];
    if (C.w > 0.0) {
      float t = clamp(dot(d, C.xyz), -C.w, C.w), q = abs(t) / C.w;
      float w = X.z * (1.0 - q * q) * (0.65 + 0.7 * n2);
      gGash = max(gGash, 1.0 - smoothstep(w * 0.45, w, length(d - C.xyz * t)));
    }
  }
  gCov = max(gCov, uGAll * smoothstep(0.35, 0.75, n));
  gCov = max(gCov, gGash);
}
`;
const BODY_COLOR = `
  goreEval(vGoreP);
  if (gCov > 0.0) {
    float v = gN(vGoreP * 41.0);
    vec3 fresh = mix(vec3(0.20, 0.006, 0.006), vec3(0.34, 0.012, 0.01), v);
    vec3 dry = mix(vec3(0.07, 0.012, 0.008), vec3(0.12, 0.025, 0.015), v);
    vec3 blood = mix(dry, fresh, clamp(gFresh / max(gCov, 0.001), 0.0, 1.0));
    // soaked cloth keeps a little of its weave: blood darkens what is under it rather than painting over it
    diffuseColor.rgb = mix(diffuseColor.rgb, blood * (0.75 + diffuseColor.rgb * 0.5), gCov * 0.94);
    // an open gash: torn flesh round a dark core
    vec3 flesh = mix(vec3(0.42, 0.05, 0.045), vec3(0.6, 0.16, 0.13), v);
    diffuseColor.rgb = mix(diffuseColor.rgb, mix(flesh, vec3(0.03, 0.0, 0.0), smoothstep(0.55, 0.95, gGash)), gGash);
  }
`;
const BODY_ROUGH = `
  roughnessFactor = mix(roughnessFactor, mix(0.55, 0.1, clamp(gFresh + gGash, 0.0, 1.0)), gCov);
`;

export function bloodBody(R) {
  if (!R || !R.meshes || !R.meshes.length || R.gore) return null;
  // rest-pose joint positions, in the rig's own space (the space the merged body geometry was built in)
  R.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(R.root.matrixWorld).invert(), jp = {};
  for (const [k, j] of Object.entries(R.j || {})) if (j && j.isObject3D) jp[k] = j.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
  const U = {
    uGW: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uGC: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uGX: { value: Array.from({ length: N }, () => new THREE.Vector4()) },
    uGAll: { value: 0 },
  };
  for (const mesh of R.meshes) {
    if (!mesh.isSkinnedMesh || !mesh.material || Array.isArray(mesh.material) || !mesh.material.isMeshStandardMaterial) continue;
    const m = mesh.material = mesh.material.clone();
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = BODY_VS_HEAD + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vGoreP = position;');
      sh.fragmentShader = BODY_FS_HEAD + sh.fragmentShader
        .replace('#include <color_fragment>', '#include <color_fragment>\n' + BODY_COLOR)
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + BODY_ROUGH);
    };
    m.customProgramCacheKey = () => 'gdbd-gore-body';
  }
  const W = [];
  const G = R.gore = {
    jp, U, W,
    // add a wound at a rest-space point: r radius, cut = { dir, len, w } for an open gash
    add(at, r = 0.08, o = {}) {
      let slot = W.length < N ? W.length : W.reduce((b, w, i) => (w.age > W[b].age ? i : b), 0);
      W[slot] = { at: at.clone(), r, r0: 0, fresh: 1, drip: 0, dripTo: o.drip ?? 0.25 + Math.random() * 0.3, cut: o.cut || null, seed: Math.random() * 50, age: 0, grow: o.grow ?? 1.4 };
      return W[slot];
    },
    heal() { for (const w of W) { w.fresh = 0; w.r *= 0.85; if (w.cut) w.cut = null; w.dripTo *= 0.6; } },
    clear() { W.length = 0; U.uGAll.value = 0; },
    all: 0, // whole-body soak (executions)
    update(dt) {
      for (const w of W) {
        w.age += dt;
        w.r0 = Math.min(w.r, w.r0 + dt * w.r / Math.max(0.05, w.grow * 0.5));
        w.drip = Math.min(w.dripTo, w.drip + dt * 0.035); // blood running down the clothes
        w.fresh = Math.max(0, w.fresh - dt / 140);
      }
      for (let i = 0; i < N; i++) {
        const w = W[i];
        if (!w) { U.uGW.value[i].w = 0; continue; }
        U.uGW.value[i].set(w.at.x, w.at.y, w.at.z, w.r0);
        if (w.cut) U.uGC.value[i].set(w.cut.dir.x, w.cut.dir.y, w.cut.dir.z, w.cut.len * Math.min(1, w.age * 6)); else U.uGC.value[i].w = 0;
        U.uGX.value[i].set(w.fresh, w.drip, w.cut ? w.cut.w : 0, w.seed);
      }
      U.uGAll.value = G.all;
    },
  };
  return G;
}

// a point on the torso facing direction `a` (rig space: +z is the front), at height h (0 waist .. 1 shoulders)
export function torsoPoint(G, a, h) {
  const s = G.jp.spine || new THREE.Vector3(0, 1, 0);
  return new THREE.Vector3(s.x + Math.sin(a) * 0.165, s.y + 0.04 + h * 0.46, s.z + Math.cos(a) * 0.105);
}
// a slash across the surface at angle a: along the tangent, tilted
export function slashAt(a, tilt = (Math.random() - 0.5) * 1.6, len = 0.07 + Math.random() * 0.06, w = 0.011 + Math.random() * 0.006) {
  const t = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a)), dir = t.multiplyScalar(Math.cos(tilt)).add(new THREE.Vector3(0, Math.sin(tilt), 0)).normalize();
  return { dir, len, w };
}
// a hit coming from local direction a (radians, 0 = from the front): a gash and the blood round it
export function hitWound(G, a, heavy = false) {
  const aa = a + (Math.random() - 0.5) * 0.9, h = 0.15 + Math.random() * 0.7;
  return G.add(torsoPoint(G, aa, h), heavy ? 0.1 + Math.random() * 0.04 : 0.065 + Math.random() * 0.03, { cut: slashAt(aa), drip: heavy ? 0.5 : 0.3 });
}
// near a joint (bites, the hook, the trap)
export function jointWound(G, joint, off, r, o) {
  const p = (G.jp[joint] || new THREE.Vector3()).clone().add(off);
  return G.add(p, r, o);
}

// ---------------------------------------------------------------- flesh chunks
export class Gibs {
  constructor(scene, max = 140, onLand = null) {
    const geo = new THREE.IcosahedronGeometry(1, 1), P = geo.attributes.position;
    for (let i = 0; i < P.count; i++) { const k = 0.65 + Math.random() * 0.6; P.setXYZ(i, P.getX(i) * k, P.getY(i) * k * 0.75, P.getZ(i) * k); }
    geo.computeVertexNormals();
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.28, metalness: 0.04 }), max);
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.count = 0; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    scene.add(this.mesh);
    this.max = max; this.list = []; this.onLand = onLand;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
    this.cols = [new THREE.Color(0x4a0706), new THREE.Color(0x6a120e), new THREE.Color(0x8a2a24), new THREE.Color(0x2a0303), new THREE.Color(0xc8b8a0)];
  }
  // n chunks flung from (x, y, z) mostly along (dx, dz), floor at gy
  burst(x, y, z, n, dx = 0, dz = 0, speed = 3.2, gy = 0) {
    for (let i = 0; i < n; i++) {
      if (this.list.length >= this.max) this.list.shift();
      const a = Math.random() * 6.283, s = speed * (0.35 + Math.random() * 0.75);
      const ci = Math.random() < 0.06 ? 4 : Math.floor(Math.random() * 4);
      this.list.push({
        x, y, z, gy,
        vx: (dx * 0.8 + Math.cos(a) * 0.55) * s, vy: (0.5 + Math.random() * 0.9) * s * 0.7, vz: (dz * 0.8 + Math.sin(a) * 0.55) * s,
        rx: Math.random() * 6, ry: Math.random() * 6, wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18,
        r: ci === 4 ? 0.012 + Math.random() * 0.012 : 0.014 + Math.pow(Math.random(), 2) * 0.045, c: this.cols[ci], t: 0, rest: false, landed: false,
      });
    }
  }
  update(dt) {
    let k = 0;
    for (let i = this.list.length - 1; i >= 0; i--) { const g = this.list[i]; g.t += dt; if (g.t > 45) this.list.splice(i, 1); }
    for (const g of this.list) {
      if (!g.rest) {
        g.vy -= 9.8 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.rx += g.wx * dt; g.ry += g.wy * dt;
        if (g.y < g.gy + g.r * 0.6) {
          g.y = g.gy + g.r * 0.6;
          if (!g.landed) { g.landed = true; if (this.onLand) this.onLand(g.x, g.z, g.gy, g.r); }
          if (Math.abs(g.vy) < 0.6) { g.rest = true; g.vx = g.vz = g.vy = 0; }
          else { g.vy *= -0.22; g.vx *= 0.45; g.vz *= 0.45; g.wx *= 0.5; g.wy *= 0.5; }
        }
      }
      const fade = g.t > 38 ? Math.max(0.01, 1 - (g.t - 38) / 7) : 1;
      this.q.setFromEuler(this.e.set(g.rx, g.ry, 0));
      this.m4.compose(this.v.set(g.x, g.y, g.z), this.q, this.s.set(g.r * fade, g.r * fade, g.r * fade));
      this.mesh.setMatrixAt(k, this.m4);
      this.mesh.instanceColor.setXYZ(k, g.c.r, g.c.g, g.c.b);
      k++;
    }
    this.mesh.count = k;
    if (k) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceColor.needsUpdate = true; }
  }
}

// ---------------------------------------------------------------- pools, splatter, sprays, smears
// cell: 0 splatter, 1 pool, 2 spray, 3 smear (the blood atlas is 2x2)
export class BloodDecals {
  constructor(scene, max, atlas, lite) {
    this.max = max; this.i = 0; this.list = [];
    const geo = new THREE.PlaneGeometry(1, 1); geo.rotateX(-Math.PI / 2);
    this.aCell = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2);
    this.aDry = new THREE.InstancedBufferAttribute(new Float32Array(max * 2), 2); // dryness, opacity
    this.aDry.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aCell', this.aCell); geo.setAttribute('aDry', this.aDry);
    const m = lite
      ? new THREE.MeshLambertMaterial({ map: atlas, color: 0xb09090, emissive: 0x200000, emissiveMap: atlas, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })
      : new THREE.MeshStandardMaterial({ map: atlas, color: 0x9a8080, emissive: 0x1c0000, emissiveMap: atlas, transparent: true, depthWrite: false, roughness: 0.12, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2 });
    m.onBeforeCompile = sh => {
      sh.vertexShader = 'attribute vec2 aCell; attribute vec2 aDry; varying vec2 vDry;\n' + sh.vertexShader
        .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_MAP\n  vMapUv = vMapUv * 0.5 + aCell;\n#endif\n#ifdef USE_EMISSIVEMAP\n  vEmissiveMapUv = vEmissiveMapUv * 0.5 + aCell;\n#endif\n  vDry = aDry;');
      sh.fragmentShader = 'varying vec2 vDry;\n' + sh.fragmentShader
        .replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.55, 0.45, 0.45), vDry.x);\n  diffuseColor.a *= vDry.y;')
        .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= 1.0 - vDry.x * 0.75;')
        .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = mix(roughnessFactor, 0.78, vDry.x);');
    };
    m.customProgramCacheKey = () => 'gdbd-decals' + (lite ? 'L' : '');
    this.mesh = new THREE.InstancedMesh(geo, m, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 1; this.mesh.receiveShadow = true; this.mesh.count = 0;
    scene.add(this.mesh);
    this.landBudget = 0;
    this.m4 = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.v = new THREE.Vector3(); this.s = new THREE.Vector3();
  }
  add(x, z, size, cell = 0, rot = Math.random() * 6.28, y = 0) {
    const k = this.i++ % this.max;
    this.list[k] = { x, z, y: y + 0.022 + (this.i % 40) * 0.0004, rot, size, grow: cell === 1 ? 0.3 : 1, age: 0 };
    this.aCell.setXY(k, (cell % 2) * 0.5, cell < 2 ? 0.5 : 0); this.aCell.needsUpdate = true;
    this.place(k);
    this.mesh.count = Math.max(this.mesh.count, k + 1);
  }
  place(k) {
    const d = this.list[k], s = d.size * d.grow;
    this.q.setFromEuler(this.e.set(0, d.rot, 0));
    this.m4.compose(this.v.set(d.x, d.y, d.z), this.q, this.s.set(s, 1, s));
    this.mesh.setMatrixAt(k, this.m4); this.mesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    this.landBudget = Math.min(6, this.landBudget + dt * 30);
    let any = false;
    for (let k = 0; k < this.list.length; k++) {
      const d = this.list[k]; if (!d) continue;
      d.age += dt;
      if (d.grow < 1) { d.grow = Math.min(1, d.grow + dt * 0.22); this.place(k); } // a pool spreads
      const dry = Math.min(1, d.age / 60), op = d.age > 100 ? Math.max(0, 0.96 - (d.age - 100) / 40) : 0.96;
      this.aDry.setXY(k, dry, op); any = true;
      if (op <= 0) { this.list[k] = null; this.v.set(0, -100, 0); this.m4.compose(this.v, this.q.identity(), this.s.set(0.001, 1, 0.001)); this.mesh.setMatrixAt(k, this.m4); this.mesh.instanceMatrix.needsUpdate = true; }
    }
    if (any) this.aDry.needsUpdate = true;
  }
}
