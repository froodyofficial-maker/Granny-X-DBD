// Granny (Granny chapter, fan-made crossover).
//  - Model: "Granny official model pc (Granny 3)" by alessio.fnf.bf (sketchfab.com/alessio.fnf.bf),
//    CC BY 4.0: a clean T-posed rig with no animations.
//  - Animations: from "Granny (7)" by Yandu27 (sketchfab.com/Yandu27), CC BY 4.0 (its skin is
//    broken, so only its skeleton and clips are kept: granny_anims.glb). Both use the game's Bip01
//    skeleton: the clips play on an invisible copy of that skeleton and every bone of the model
//    follows it (world-space rotation from rest), so she moves with her own animations: idle, Walk,
//    Hit (bat swing), arrowHit (staggered), pepperHit (blinded), freezeTrap, Look, lookBed (bending).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { auraSkinMat } from './foremanGlb.js';
import { GFX } from './gfx.js';
import { b64buf, heavy } from './heavy.js';
import { freddyOver } from './realism.js';
import { fixModelBlood } from './bloodfx.js';
import { enhanceCharacter } from './matfx.js';

const M = {}, loading = {}, waiters = {};
async function bytes(name) {
  const el = document.getElementById('nb-' + name + '-glb');
  if (el && el.textContent.trim()) { return b64buf(el.textContent.trim()); }
  const dev = !!document.querySelector('script[type=importmap]');
  let last;
  for (const url of dev ? [`models/${name}.glb`, `public/models/${name}.glb`] : [`public/models/${name}.glb`, `models/${name}.glb`]) {
    try { const r = await fetch(url); if (r.ok) return await r.arrayBuffer(); last = new Error(url + ' ' + r.status); } catch (e) { last = e; }
  }
  throw last;
}
// height (m) and which way the raw model faces
const SPEC = { granny: { h: 1.82, yaw: 0 }, granny_anims: { anim: true }, grandpa: { h: 1.86, yaw: 0 }, spidermom: { h: 1.15, yaw: 0 }, slendrina: { h: 1.95, yaw: 0 }, slendrina_child: { h: 0.62, yaw: 0 }, angeline: { h: 1.88, yaw: Math.PI }, nosferatu: { h: 1.98, yaw: Math.PI },
  // 1.4.4 outfits (their own meshes on Granny's / Grandpa's rig): bind = how to straighten the file's skeleton first
  grandpa_thug: { mesh: true }, victim_car: { mesh: true },
  slenderman: { mesh: true }, teddy: { mesh: true },
  monster_can: { mesh: true }, phone_case: { mesh: true } }; // (1.5.3: collectables, GTA VI (PlayStation))
function load(name) {
  if (loading[name]) return loading[name];
  loading[name] = bytes(name).then(buf => heavy(() => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej)))).then(g => {
    const S = SPEC[name];
    fixModelBlood(g.scene); // (1.6.0: Granny's bat was white, Grandpa's club had a paint blob)
    if (S.reskin) { toBindPose(g.scene); g.scene.updateMatrixWorld(true); }
    if (S.anim || S.mesh || S.reskin) { M[name] = { g }; for (const cb of (waiters[name] || []).splice(0)) { try { cb(); } catch (e) { console.error(e); } } return M[name]; }
    if (S.bind === 'fit') toBindPose(g.scene); else if (S.bind === 'pure') pureBind(g.scene); // (their skeletons are bent out of shape in the files)
    if (S.rx) { g.scene.rotation.x = S.rx; g.scene.updateMatrixWorld(true); } // (Z-up files)
    if (name === 'angeline') { toBindPose(g.scene); if (!GFX.lite) enhanceCharacter(g.scene, { strength: 2.6, sheen: 0.7, tone: 0.86, folds: 9 }); } // animated in code from her T-pose (see animateAngeline); 1.6.0: relief + sheen
    if (name === 'nosferatu') g.scene.traverse(o => { if (o.isMesh && /skugga/i.test(o.material && o.material.name || '')) o.visible = false; }); // his file's painted ground shadow
    // measure in the first frame of the idle clip (the rest pose isn't a standing pose)
    const probe = cloneSkinned(g.scene), mx = new THREE.AnimationMixer(probe);
    const idle = name === 'angeline' || S.bind ? null : g.animations.find(c => /^idle$/i.test(c.name)) || g.animations[0];
    if (idle) { mx.clipAction(idle).play(); mx.update(0); }
    probe.updateMatrixWorld(true);
    if (name === 'slendrina') seatHair(probe, g.scene);
    const box = new THREE.Box3();
    probe.traverse(o => { if (o.isMesh && o.visible) { o.geometry.computeBoundingBox(); box.union(o.isSkinnedMesh ? skinnedBox(o) : new THREE.Box3().copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld)); } });
    const h = box.max.y - box.min.y, k = S.h / h, c = box.getCenter(new THREE.Vector3());
    M[name] = { g, fit: { s: k, x: -c.x * k, y: -box.min.y * k, z: -c.z * k }, yaw: S.yaw };
    for (const cb of (waiters[name] || []).splice(0)) { try { cb(); } catch (e) { console.error(e); } }
    return M[name];
  }).catch(e => { console.warn(name + ' model unavailable:', e); return null; });
  return loading[name];
}
// Angeline's file: the skeleton's bind matrices are about 1.8x taller than the mesh (an FBX conversion left a stretched
// node in between), so every joint sits above the part of her it moves and turning a bone swings that part around the
// wrong point. Measure the stretch from the mesh itself (where each bone meets its parent, against where the bind matrices
// put that joint), take it out of the bind matrices, and put the skeleton into that corrected T-pose.
function toBindPose(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, P = o.geometry.attributes.position, J = o.geometry.attributes.skinIndex, W = o.geometry.attributes.skinWeight;
    // joints in the mesh: the middle of the vertices shared by a bone and its parent
    const acc = new Map();
    for (let i = 0; i < P.count; i++) {
      const inf = []; for (let k = 0; k < 4; k++) if (W.getComponent(i, k) > 0.15) inf.push(J.getComponent(i, k));
      for (const a of inf) for (const b of inf) if (sk.bones[a].parent === sk.bones[b]) { const e = acc.get(a) || [0, 0, 0, 0]; e[0] += P.getX(i); e[1] += P.getY(i); e[2] += P.getZ(i); e[3]++; acc.set(a, e); }
    }
    // per axis, a least-squares line from the bind matrices' joints to the mesh's
    const pairs = [];
    for (const [j, e] of acc) if (e[3] >= 6) pairs.push([new THREE.Vector3().setFromMatrixPosition(new THREE.Matrix4().copy(sk.boneInverses[j]).invert()), [e[0] / e[3], e[1] / e[3], e[2] / e[3]]]);
    const fit = ax => {
      const n = pairs.length; let sx = 0, sy = 0, sxx = 0, sxy = 0;
      for (const [p, c] of pairs) { const x = p.getComponent(ax), y = c[ax]; sx += x; sy += y; sxx += x * x; sxy += x * y; }
      const den = n * sxx - sx * sx; let a = Math.abs(den) > 1e-9 ? (n * sxy - sx * sy) / den : 1;
      if (!(a > 0.2 && a < 5)) a = 1;
      return [a, (sy - a * sx) / n];
    };
    const [fx, fy, fz] = [0, 1, 2].map(fit);
    const K = pairs.length >= 6 ? new THREE.Matrix4().set(fx[0], 0, 0, fx[1], 0, fy[0], 0, fy[1], 0, 0, fz[0], fz[1], 0, 0, 0, 1) : new THREE.Matrix4();
    const Ki = new THREE.Matrix4().copy(K).invert();
    const bind = new Map();
    // each joint goes where the mesh has it (K applied to its position) but keeps a plain rotation: no stretch in the
    // bone matrices, or every turned bone (her head, her arms) would come out squashed
    const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
    sk.bones.forEach((b, i) => {
      new THREE.Matrix4().copy(sk.boneInverses[i]).invert().decompose(_p, _q, _s);
      const w = new THREE.Matrix4().compose(_p.applyMatrix4(K), _q, one);
      bind.set(b, w); sk.boneInverses[i].copy(w).invert();                           // the mesh stays where it was
    });
    const m = new THREE.Matrix4();
    for (const b of sk.bones) {
      if (bind.has(b.parent)) m.copy(bind.get(b.parent)).invert().multiply(bind.get(b));
      else m.copy(b.parent.matrixWorld).invert().multiply(bind.get(b)); // the top bone
      m.decompose(b.position, b.quaternion, b.scale);
    }
  });
  scene.updateMatrixWorld(true);
}
// the plain bind pose: every bone exactly where the file's inverse bind matrices say (Santa Granny's file: its joints are
// right, its rest pose is not)
function pureBind(scene) {
  scene.updateMatrixWorld(true);
  scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const sk = o.skeleton, bind = new Map(), base = o.parent.matrixWorld;
    sk.bones.forEach((b, i) => bind.set(b, new THREE.Matrix4().copy(base).multiply(o.bindMatrix).multiply(new THREE.Matrix4().copy(sk.boneInverses[i]).invert())));
    const m = new THREE.Matrix4();
    for (const b of sk.bones) {
      const P = bind.has(b.parent) ? bind.get(b.parent) : b.parent.matrixWorld;
      m.copy(P).invert().multiply(bind.get(b)); m.decompose(b.position, b.quaternion, b.scale); b.updateMatrixWorld(true);
    }
  });
  scene.updateMatrixWorld(true);
}
// bounding box of a skinned mesh as currently posed
function skinnedBox(m) {
  const b = new THREE.Box3(), v = new THREE.Vector3(), P = m.geometry.attributes.position;
  for (let i = 0; i < P.count; i += 3) { v.fromBufferAttribute(P, i); m.applyBoneTransform(i, v); v.applyMatrix4(m.matrixWorld); b.expandByPoint(v); }
  return b;
}
// Slendrina's hair mesh sits above her head in the file: move it down onto her head (in the template)
function seatHair(probe, scene) {
  let hairP = null, hairT = null, body = null;
  probe.traverse(o => { if (o.isMesh && /hair/i.test(o.name)) hairP = o; if (o.isSkinnedMesh) body = o; });
  scene.traverse(o => { if (o.isMesh && /hair/i.test(o.name)) hairT = o; });
  if (!hairP || !hairT || !body) return;
  const bb = skinnedBox(body), hb = new THREE.Box3().setFromObject(hairP);
  const headTop = bb.max.y, drop = hb.max.y - (headTop + (bb.max.y - bb.min.y) * 0.015);
  // the offset is in world units: convert into the hair's parent space
  const w = hairT.parent.getWorldScale(new THREE.Vector3()), p = hairT.parent;
  const dLocal = p.worldToLocal(new THREE.Vector3(hb.getCenter(new THREE.Vector3()).x, hb.getCenter(new THREE.Vector3()).y - drop, hb.getCenter(new THREE.Vector3()).z)).sub(p.worldToLocal(hb.getCenter(new THREE.Vector3())));
  hairT.position.add(dLocal);
  void w;
}
export const loadGranny = () => Promise.all([load('granny'), load('granny_anims')]).then(() => M.granny);
// Grandpa (outfit): "Grandpa Shotgun (G3 And Recaptured)" by DVUnit (sketchfab.com/DVUnit), CC BY 4.0, with his own clips
export const loadGrandpa = () => load('grandpa');
// Spider Mom (helper): "Spider Mom - Granny" by DVUnit (sketchfab.com/DVUnit), CC BY 4.0, with her own clips
export const loadSpiderMom = () => load('spidermom');
export const spiderMomReady = () => !!M.spidermom;
// Slendrina (killer): "Slendrina (Granny 3)" by DVUnit (sketchfab.com/DVUnit), CC BY 4.0, with her own clip
export const loadSlendrina = () => load('slendrina');
export const slendrinaReady = () => !!M.slendrina;
// Nosferatu (killer, 1.4.3): "Nosferatu Trailer version/Slendrina The Forest" by Mr.Prizz (sketchfab.com/Rodolfoisreal1423),
// CC BY 4.0, with his own clips: idle, Walk, attack, hurt
export const loadNosferatu = () => load('nosferatu');
export const nosferatuReady = () => !!M.nosferatu;
export function makeNosferatuGlb(sk = {}, lite = false) {
  if (!M.nosferatu) return null;
  const R = new AnimRig('nosferatu', sk, lite);
  Object.assign(R, { kind: 'killer', killer: 'nosferatu', glb: true, nosferatu: true });
  return R;
}
// his clips for the game state: crouched while he coils for a leap, claws out in the air, the whole swing on a strike
export function animateNosferatu(R, s, dt) {
  R.t += dt;
  if (s.atk === 1 && R.prevAtk !== 1 && s.leap == null) R.hitT = 0; else if (R.hitT != null) R.hitT += dt * 1.6;
  if (!s.atk) R.hitT = null;
  R.prevAtk = s.atk;
  const A = R.acts, sp = s.speed || 0;
  let want = 'idle', rate = 1, scrub = null, fast = false, crouch = 0, lean = 0;
  if (s.exec && s.exec.role === 'killer') { want = 'attack'; scrub = 0.25 + Math.min(1, s.exec.f) * 0.3; fast = true; lean = 0.25; }
  else if (s.leap != null) { want = 'attack'; scrub = 0.32 + s.leap * 0.25; fast = true; lean = 0.55; }      // claws out, flying
  else if (s.stun) { want = 'hurt'; rate = 1; fast = true; }
  else if ((s.atk === 1 || s.atk === 2) && R.hitT != null && R.hitT < 2.47) { want = 'attack'; scrub = R.hitT / 2.47; fast = true; }
  else if (s.aim) { want = sp > 0.3 ? 'Walk' : 'idle'; rate = Math.max(0.6, sp / 1.4); crouch = 0.32; lean = 0.35; } // coiling: low and leaning in
  else if (s.act === 'pickup' || s.act === 'cage' || s.act === 'break' || s.act === 'kick') { want = 'attack'; scrub = 0.3; lean = 0.3; }
  else if (sp > 0.3) { want = 'Walk'; rate = Math.min(2.4, Math.max(0.7, sp / 1.45)); lean = sp > 3 ? 0.12 : 0; }
  if (!A[want]) want = A.idle ? 'idle' : Object.keys(A)[0];
  const k = 1 - Math.exp(-dt * (fast ? 20 : 9));
  for (const n in A) {
    const a = A[n], target = n === want ? 1 : 0;
    R.w[n] += (target - R.w[n]) * k;
    if (R.w[n] < 0.002 && !target) R.w[n] = 0;
    a.setEffectiveWeight(R.w[n]);
    if (n === want) { if (scrub != null) { a.paused = true; a.time = scrub * a.getClip().duration; } else { a.paused = false; a.timeScale = rate; } }
    else if (R.w[n] === 0) a.paused = true;
  }
  R.mixer.update(dt);
  const kk = Math.min(1, dt * 10);
  R.holder.position.y += (-crouch - R.holder.position.y) * kk;
  R.holder.rotation.x += (lean - R.holder.rotation.x) * kk;
}
// Angeline (killer): "Angeline Unity" by A_Forogotten_Studio (sketchfab.com/A_Forogotten_Studio), CC BY 4.0: idle, Walk, attack
export const loadAngeline = () => load('angeline');
export const angelineReady = () => !!M.angeline;
export function makeAngelineGlb(sk = {}, lite = false) {
  if (!M.angeline) return null;
  const R = new AnimRig('angeline', sk, lite);
  Object.assign(R, { kind: 'killer', killer: 'angeline', glb: true, angeline: true });
  angBones(R); // record her rest (T-) pose before anything moves a bone
  // size her as she actually stands (in the coded pose, not the file's): 1.88 m, feet on the ground, centred
  const model = R.holder.children[0], fit = M.angeline.standFit || (M.angeline.standFit = (() => {
    animateAngeline(R, {}, 0); R.root.updateMatrixWorld(true);
    let sm = null; R.root.traverse(o => { if (o.isSkinnedMesh && !sm) sm = o; });
    const b = skinnedBox(sm), k = SPEC.angeline.h / (b.max.y - b.min.y), c = b.getCenter(new THREE.Vector3());
    return { k, x: -c.x * k, y: -b.min.y * k, z: -c.z * k, x0: model.position.x, y0: model.position.y, z0: model.position.z };
  })());
  model.scale.multiplyScalar(fit.k);
  model.position.set(fit.x0 * fit.k + fit.x, fit.y0 * fit.k + fit.y, fit.z0 * fit.k + fit.z);
  R.t = Math.random() * 10;
  return R;
}
// Angeline is animated in code. The file's own clips twist her body when she walks and stretch her arm to twice its
// length in the attack, and its rest pose holds her arms up at her face, which stands her sleeves up like flat wings.
// So: her bones start from the rest pose every frame and are aimed in world space: arms hanging (sleeves hang with
// them), a slight hunch, a floating glide, a two-handed lunge for the strike, arms spread and head forward for
// Yellow Eyes.
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q1 = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
function angBones(R) {
  if (R.ab) return R.ab;
  const by = {};
  R.root.traverse(o => { if (o.isBone) by[o.name.replace(/[^A-Za-z]/g, '').toLowerCase()] = o; });
  const f = re => { for (const k in by) if (re.test(k)) return by[k]; return null; };
  const B = { pelvis: f(/^bippelvis/), neck: f(/^bipneck/), head: f(/^biphead$/), headNub: f(/^bipheadnub/) };
  // the spine bones (Spine, Spine1..3) all read "bipspine" without digits: take them from the chain instead
  const chain = []; for (let b = B.neck; b && b !== B.pelvis; b = b.parent) if (b.isBone) chain.unshift(b);
  B.spines = chain.filter(b => b !== B.neck);
  for (const sd of ['l', 'r']) {
    B[sd] = { cl: f(new RegExp('^bip' + sd + 'clavicle')), up: f(new RegExp('^bip' + sd + 'upperarm')), fo: f(new RegExp('^bip' + sd + 'forearm')), ha: f(new RegExp('^bip' + sd + 'hand')) };
  }
  B.all = []; R.root.traverse(o => { if (o.isBone) B.all.push(o); });
  B.rest = new Map(B.all.map(b => [b, b.quaternion.clone()]));
  R.ab = B; return B;
}
// turn bone b (weight k) so the line from it to its child `to` points along world direction dir.
// Worked out in the parent's space (her skeleton sits under scaled nodes, so world rotations don't decompose cleanly).
const _m = new THREE.Matrix4(), _m3 = new THREE.Matrix3();
function toParent(b, dir, out) {
  b.parent.updateWorldMatrix(true, false);
  _m3.setFromMatrix4(_m.copy(b.parent.matrixWorld).invert());
  return out.copy(dir).applyMatrix3(_m3).normalize();
}
function aimBone(b, to, dir, k) {
  if (!b || !to || k <= 0) return;
  const cur = _v1.copy(to.position).multiply(b.scale).applyQuaternion(b.quaternion).normalize(); // child direction, parent space
  const want = toParent(b, dir, _v2);
  _q1.setFromUnitVectors(cur, want); if (k < 1) _q1.slerp(_q3.identity(), 1 - k);
  b.quaternion.premultiply(_q1);
  b.updateMatrixWorld(true);
}
// rotate bone b by angle a about world axis ax
function turnBone(b, ax, a) {
  if (!b || !a) return;
  _q1.setFromAxisAngle(toParent(b, ax, _v2), a);
  b.quaternion.premultiply(_q1);
  b.updateMatrixWorld(true);
}
const smooth = (x, a, b) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export function animateAngeline(R, s, dt) {
  const B = angBones(R);
  R.t += dt;
  if (s.atk === 1 && R.prevAtk !== 1) R.hitT = 0; else if (R.hitT != null) R.hitT += dt;
  if (!s.atk) R.hitT = null;
  R.prevAtk = s.atk;
  // smoothed drives: how fast she glides, how far into Yellow Eyes, the strike (0..1 through the swing)
  const e = k => 1 - Math.exp(-dt * k);
  const sp = Math.min(1, (s.speed || 0) / 3);
  R.gl = (R.gl || 0) + (sp - (R.gl || 0)) * e(6);
  R.ey = (R.ey || 0) + ((s.aim ? 1 : 0) - (R.ey || 0)) * e(7);
  R.st = (R.st || 0) + ((s.stun ? 1 : 0) - (R.st || 0)) * e(10);
  let atk = -1;
  if (s.exec && s.exec.role === 'killer') atk = Math.min(1, s.exec.f * 1.4);
  else if (R.hitT != null && R.hitT < 0.75) atk = R.hitT / 0.75;
  const t = R.t, gl = R.gl, ey = R.ey;
  // every frame from the rest pose
  for (const b of B.all) b.quaternion.copy(B.rest.get(b));
  R.root.updateWorldMatrix(true, false);
  const rq = R.root.getWorldQuaternion(new THREE.Quaternion());
  const F = new THREE.Vector3(0, 0, 1).applyQuaternion(rq), UP = new THREE.Vector3(0, 1, 0), RT = new THREE.Vector3().crossVectors(F, UP).normalize();
  const d = (f, u, r) => new THREE.Vector3().addScaledVector(F, f).addScaledVector(UP, u).addScaledVector(RT, r).normalize();
  // the strike: wind up (arms up and back), lunge (both claws forward and down), recover
  const wind = atk < 0 ? 0 : smooth(atk, 0, 0.25) * (1 - smooth(atk, 0.25, 0.45));
  const lunge = atk < 0 ? 0 : smooth(atk, 0.22, 0.45) * (1 - smooth(atk, 0.7, 1));
  // body: upright, a slight hunch; leans into the glide and the lunge; head forward for Yellow Eyes
  const hunch = 0.04 + gl * 0.2 + lunge * 0.5 - wind * 0.15 + ey * 0.06 - R.st * 0.3;
  const sway = Math.sin(t * 1.3) * 0.035 + Math.sin(t * 3.1) * gl * 0.05;
  // her T-pose already stands upright: lean the spine and tilt the head by small turns from it
  const PITCH = RT.clone().negate();                        // turning about this leans her forward
  const sp0 = B.spines;
  for (let i = 0; i < sp0.length; i++) { turnBone(sp0[i], PITCH, hunch * 0.22); turnBone(sp0[i], F, sway * 0.5); }
  const tilt = (Math.sin(t * 0.7) * 0.14 + Math.sin(t * 2.3) * 0.03) * (1 - ey * 0.8) + R.st * Math.sin(t * 17) * 0.2;
  turnBone(B.neck, PITCH, hunch * 0.3 - ey * 0.1);
  turnBone(B.head, F, tilt);
  turnBone(B.head, PITCH, -0.05 + lunge * 0.15 - R.st * 0.3);
  // arms
  for (const sd of ['l', 'r']) {
    const A = B[sd]; if (!A.up || !A.fo || !A.ha) continue;
    // which side this arm is on (in her own frame)
    A.up.updateWorldMatrix(true, false); B.neck.updateWorldMatrix(true, false);
    const out = Math.sign(_v1.setFromMatrixPosition(A.up.matrixWorld).sub(_v2.setFromMatrixPosition(B.neck.matrixWorld)).dot(RT)) || (sd === 'l' ? -1 : 1);
    const ph = sd === 'l' ? 0 : Math.PI;
    // hanging out from her sides and a little forward, like a ghost's reaching hands: her dress flares out like a
    // bell, and arms held close (as before 1.3.3) sank into it. Trailing back a little as she glides; swaying
    let up = d(0.3 - gl * 0.2 + Math.sin(t * 1.1 + ph) * 0.06, -1, out * (0.72 + gl * 0.1));
    let fo = d(0.55 - gl * 0.25 + Math.sin(t * 1.1 + ph + 0.6) * 0.06, -1, out * (0.55 + gl * 0.1));
    // Yellow Eyes: arms spread wide, palms out
    if (ey > 0.01) { up.lerp(d(0.35, -0.35, out * 0.9), ey).normalize(); fo.lerp(d(0.5, -0.1, out * 0.8), ey).normalize(); }
    if (wind > 0) { up.lerp(d(-0.25, 0.9, out * 0.35), wind).normalize(); fo.lerp(d(0.3, 0.9, out * 0.15), wind).normalize(); }
    if (lunge > 0) { up.lerp(d(1, -0.05, out * 0.3), lunge).normalize(); fo.lerp(d(1, -0.28, out * 0.1), lunge).normalize(); }
    if (R.st > 0.01) { up.lerp(d(0.2, 0.8, out * 0.6), R.st).normalize(); fo.lerp(d(0, 1, out * 0.3), R.st).normalize(); }
    // the collarbones are shrugged up in the file's pose: level them out (a little up in the wind-up)
    aimBone(A.cl, A.up, d(lunge * 0.25, -0.12 + wind * 0.35, out), 1);
    aimBone(A.up, A.fo, up, 1);
    aimBone(A.fo, A.ha, fo, 1);
  }
  // a ghost's float: a slow bob, a little higher and steadier while gliding
  R.holder.position.y = 0.03 + Math.sin(t * 1.6) * 0.025 + gl * 0.03;
  // dress sway while she moves
  turnBone(B.pelvis, F, Math.sin(t * 3.1) * gl * 0.05);
}
export const grandpaReady = () => !!M.grandpa;
export const grannyReady = () => !!(M.granny && M.granny_anims);
export function onGrannyReady(cb) { if (grannyReady()) cb(); else loadGranny().then(() => grannyReady() && cb()); }

class AnimRig {
  constructor(name, sk = {}, lite = false) {
    const D = M[name];
    this.root = new THREE.Group(); this.aura = []; this.meshes = []; this.t = Math.random() * 10;
    const holder = new THREE.Group(); holder.rotation.y = D.yaw; this.root.add(holder); this.holder = holder;
    const model = cloneSkinned(D.g.scene);
    model.scale.setScalar(D.fit.s); model.position.set(D.fit.x, D.fit.y, D.fit.z);
    holder.add(model);
    const mats = new Map(), skinned = [];
    model.traverse(o => {
      if (!o.isMesh || !o.visible) return;
      o.castShadow = true; o.frustumCulled = false;
      if (/hat_santa/i.test(o.name)) o.visible = !!sk.santa; // her Christmas hat, only for that outfit
      if (/EyesLock/i.test(o.name)) o.visible = false;       // (shut eyelids in the outfit files)
      if (!mats.has(o.material)) mats.set(o.material, this.material(o.material, sk, lite));
      o.material = mats.get(o.material);
      this.meshes.push(o);
      if (o.isSkinnedMesh) skinned.push(o);
    });
    for (const m of skinned) {
      const a = new THREE.SkinnedMesh(m.geometry, auraSkinMat(0xffffff));
      a.bind(m.skeleton, m.bindMatrix); a.position.copy(m.position); a.quaternion.copy(m.quaternion); a.scale.copy(m.scale);
      a.visible = false; a.renderOrder = 10; a.frustumCulled = false; m.parent.add(a); this.aura.push(a);
    }
    this.mixer = new THREE.AnimationMixer(model);
    this.acts = {};
    for (const clip of name === 'angeline' || (SPEC[name] && SPEC[name].bind) ? [] : D.g.animations) { const a = this.mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play(); this.acts[clip.name] = a; }
    this.w = Object.fromEntries(Object.keys(this.acts).map(k => [k, 0]));
    const first = this.acts.idle ? 'idle' : Object.keys(this.acts)[0];
    if (first) { this.w[first] = 1; this.acts[first].setEffectiveWeight(1); }
  }
  material(src, sk, lite) {
    // Grandpa's file darkens his body and gun to 30-40% and adds a flat grey glow: at night that drew a black
    // silhouette. Use the texture as it is.
    const fix = /^(TextureAtlasGrandpa|Shotgun)$/.test(src.name || '');
    const col = fix ? new THREE.Color(0.92, 0.92, 0.92) : src.color;
    let m = lite ? new THREE.MeshLambertMaterial({ color: col, map: src.map || null, side: src.side, transparent: src.transparent, alphaTest: src.alphaTest }) : src.clone();
    m.name = src.name || '';
    if (fix) { m.color = col.clone(); if (m.emissive) m.emissive.setRGB(0, 0, 0); }
    for (const t of [m.map, m.normalMap]) if (t && t.anisotropy !== GFX.aniso) { t.anisotropy = GFX.aniso; t.needsUpdate = true; }
    if (sk.tint != null) m.color = new THREE.Color(col).lerp(new THREE.Color(sk.tint), sk.tintK ?? 0.5);
    if (sk.glow != null && 'emissive' in m) { m.emissive = new THREE.Color(sk.glow); m.emissiveIntensity = sk.glowK ?? 0.4; }
    return m;
  }
  setAura(color) { for (const a of this.aura) { if (color == null) a.visible = false; else { a.visible = true; a.material = auraSkinMat(color); } } }
  setOpacity(o) {
    for (const m of this.meshes) {
      if (!m.userData.baseMat) m.userData.baseMat = m.material;
      if (o >= 0.999) { m.material = m.userData.baseMat; m.castShadow = true; continue; }
      if (!m.userData.fadeMat) { m.userData.fadeMat = m.userData.baseMat.clone(); m.userData.fadeMat.transparent = true; m.userData.fadeMat.depthWrite = false; }
      m.userData.fadeMat.opacity = o; m.material = m.userData.fadeMat; m.castShadow = o > 0.5;
    }
  }
}
const base = n => n.replace(/_\d+$/, '').replace(/_/g, ' ').trim();
class GrannyRig extends AnimRig {
  constructor(sk, lite, model = 'granny') {
    super(model, sk, lite);
    this.skinGlb = model !== 'granny' ? model : '';
    this.kind = 'killer'; this.killer = 'granny'; this.glb = true; this.granny = true;
    // the puppet: Granny (7)'s skeleton playing her clips, never drawn
    const src = M.granny_anims.g.scene.clone(true), sh = new THREE.Group();
    sh.rotation.y = Math.PI / 2; sh.add(src); this.root.add(sh); sh.visible = false; this.src = sh;
    this.mixer = new THREE.AnimationMixer(src); this.acts = {};
    for (const clip of M.granny_anims.g.animations) { const a = this.mixer.clipAction(clip); a.enabled = true; a.setEffectiveWeight(0); a.play(); this.acts[clip.name] = a; }
    this.w = Object.fromEntries(Object.keys(this.acts).map(k => [k, 0]));
    if (this.acts.idle) { this.w.idle = 1; this.acts.idle.setEffectiveWeight(1); }
    const sb = {}; src.traverse(o => { sb[base(o.name)] = o; });
    const tb = []; this.holder.traverse(o => { if (o.isBone && sb[base(o.name)] && /Bip01|SlendrinaMom/.test(o.name)) tb.push(o); });
    // line the puppet up with the model: same spine height and place
    this.root.updateMatrixWorld(true);
    const tSp = tb.find(b => base(b.name) === 'Bip01 Spine'), sSp = sb['Bip01 Spine'];
    const tp = tSp.getWorldPosition(new THREE.Vector3()), sp0 = sSp.getWorldPosition(new THREE.Vector3());
    const k = tp.y / Math.max(1e-6, sp0.y); src.scale.multiplyScalar(k); this.root.updateMatrixWorld(true);
    const sp1 = sSp.getWorldPosition(new THREE.Vector3()); src.position.add(sh.worldToLocal(tp.clone()).sub(sh.worldToLocal(sp1.clone()))); this.root.updateMatrixWorld(true);
    // rest rotations (world, relative to the rig's root) of every mapped pair, parents first
    const depth = o => { let d = 0; while (o.parent) { o = o.parent; d++; } return d; };
    tb.sort((a, b) => depth(a) - depth(b));
    const q = () => new THREE.Quaternion();
    // the puppet's T-pose comes from its bind matrices (stored as extras.bindQ: world rotation in the file)
    const shq = sh.quaternion.clone();
    const tposeOf = o => o.userData && o.userData.bindQ ? shq.clone().multiply(new THREE.Quaternion().fromArray(o.userData.bindQ)) : o.getWorldQuaternion(q());
    this.pairs = tb.map(t => ({ t, s: sb[base(t.name)], rt: t.getWorldQuaternion(q()), rs: tposeOf(sb[base(t.name)]), wq: q() }));
    this.spine = { t: tSp, s: sSp, rt: tp.clone(), rs: sSp.getWorldPosition(new THREE.Vector3()) };
    // one constant frame correction for the stored T-pose rotations: in the first frame of her idle
    // clip the puppet's spine stands upright, like the model's in its T-pose
    if (this.acts.idle) {
      this.mixer.update(0); sh.updateMatrixWorld(true);
      const P0 = this.pairs.find(P => P.t === tSp);
      const E = sSp.getWorldQuaternion(q()).multiply(P0.rs.clone().invert());
      for (const P of this.pairs) P.rs.premultiply(E);
    }
    this._q = q(); this._p = q(); this._v = new THREE.Vector3();
  }
  // copy the puppet's pose onto the model
  follow() {
    this.src.updateMatrixWorld(true);
    const root = this.root, rq = root.getWorldQuaternion(this._p), rqi = rq.clone().invert();
    const byBone = new Map();
    for (const P of this.pairs) {
      // the puppet's rotation now, relative to its T-pose, applied to the model's T-pose (world space)
      const sw = P.s.getWorldQuaternion(this._q).premultiply(rqi);
      P.wq.copy(sw).multiply(P.rs.clone().invert()).multiply(P.rt);
      const parent = P.t.parent, pw = byBone.get(parent) || parent.getWorldQuaternion(new THREE.Quaternion()).premultiply(rqi);
      P.t.quaternion.copy(pw.clone().invert().multiply(P.wq));
      byBone.set(P.t, P.wq);
    }
    // hips: follow the puppet's spine up and down (bending, crouching, staggering)
    const S = this.spine, sp = root.worldToLocal(S.s.getWorldPosition(this._v)).sub(S.rs);
    const want = S.rt.clone().add(sp);
    S.t.parent.updateMatrixWorld(true);
    S.t.position.copy(S.t.parent.worldToLocal(root.localToWorld(want)));
  }
}
export function makeSlendrinaGlb(sk = {}, lite = false) {
  if (!M.slendrina) return null;
  const R = new AnimRig('slendrina', sk, lite);
  Object.assign(R, { kind: 'killer', killer: 'slendrina', glb: true, slendrina: true, float: true });
  return R;
}
// Slendrina floats: a slow bob, her one clip (arms drifting) looping, faster when she strikes or stares
export function animateSlendrina(R, s, dt) {
  R.t += dt;
  const a = R.acts.SlendrinaMoves || Object.values(R.acts)[0];
  if (a) { a.setEffectiveWeight(1); a.paused = false; a.timeScale = s.atk === 1 ? 3.2 : s.gaze ? 1.8 : s.speed > 0.3 ? 1.3 : 0.8; }
  R.mixer.update(dt);
  R.holder.position.y = 0.16 + Math.sin(R.t * 1.7) * 0.07;
  // she leans into a strike, and tips back when stunned
  const lean = s.atk === 1 ? 0.28 : s.stun ? -0.22 : s.speed > 2 ? 0.1 : 0;
  R.holder.rotation.x += (lean - R.holder.rotation.x) * Math.min(1, dt * 8);
}
export function makeGrannyGlb(sk = {}, lite = false) {
  if (sk.grandpa) {
    if (!M.grandpa) return null;
    const R = new AnimRig('grandpa', sk, lite);
    Object.assign(R, { kind: 'killer', killer: 'grandpa', glb: true, granny: true, grandpa: true });
    // Granny's states -> his clips
    R.clipMap = { idle: 'idle', Walk: 'walk', Hit: 'attack', Shoot: 'shootGun', arrowHit: 'arrowHit', pepperHit: 'peppered', freezeTrap: 'frozen', Look: 'search', lookBed: 'underbed' };
    R.root.traverse(o => { if (o.isMesh && /Glasses|Hat_Santa|RedEyes|Ragdoll/i.test(o.name)) o.visible = false; });
    if (sk.thug && M.grandpa_thug) { try { reskin(R, 'grandpa_thug', sk, lite, false); R.skinGlb = 'grandpa_thug'; } catch (e) { console.warn('Sigma Grandpa', e); } }
    return R;
  }
  if (!grannyReady()) return null;
  if (sk.glb && M[sk.glb] && SPEC[sk.glb] && SPEC[sk.glb].reskin) {
    const R = new GrannyRig(sk, lite);
    try { reskin(R, sk.glb, sk, lite, true); R.skinGlb = sk.glb; } catch (e) { console.warn(sk.glb, e); }
    return R;
  }
  if (sk.glb === 'freddy') { const R = new GrannyRig(sk, lite); freddyOver(R); return R; } // (legendary outfit from a Discord code; plain Granny until his model has loaded)
  return sk.glb && M[sk.glb] ? new GrannyRig(sk, lite, sk.glb) : new GrannyRig(sk, lite);
}
// 1.4.4 outfits that bring their own model, loaded only when someone wears one
// Sigma Grandpa: "GRANNY 3 GRANDPA THUG" by Dark Phantom Thunderball (sketchfab.com/dpt), CC BY 4.0. (The four Granny outfits
// made this way in 1.5.0 were taken out again before release at the owner's request: they didn't look good in game.)
// ---------------- Slendrina's Father (Season 2) ----------------
// "SlenderMan" by Voidircel (sketchfab.com/teethisyum), CC BY 4.0: one static mesh, arms held out. It gets a small rig
// made here: a root and, per arm, an upper arm and a forearm (weights from how far along the arm each vertex is), so
// he can let his arms hang, swing them, reach for a survivor and throw them up when stunned. Black tendrils grow
// out of his back while he winds up his Tendril Lash.
export const loadFather = () => load('slenderman');
export const fatherReady = () => !!M.slenderman;
let fatherProto = null;
function fatherGeo() {
  if (fatherProto) return fatherProto;
  const scene = M.slenderman.g.scene; scene.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(scene), H = 2.62, k = H / (box.max.y - box.min.y);
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const toM = v => new THREE.Vector3((v.x - cx) * k, (v.y - box.min.y) * k, (v.z - cz) * k);
  // arms (model units, measured): shoulder -> hand
  const arms = [-1, 1].map(sd => { const S = toM(new THREE.Vector3(sd * 3.3, 3.6, 0)), Hd = toM(new THREE.Vector3(sd * 16.4, -15.6, -0.7)); return { sd, S, Hd, E: S.clone().lerp(Hd, 0.5), u: Hd.clone().sub(S).normalize(), len: Hd.distanceTo(S) }; });
  const parts = [];
  scene.traverse(o => {
    if (!o.isMesh) return;
    const g = o.geometry.clone(); g.applyMatrix4(o.matrixWorld);
    const P = g.attributes.position, n = P.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), v = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(P, i); const m = toM(v); P.setXYZ(i, m.x, m.y, m.z);
      const A = arms[m.x < 0 ? 0 : 1], rel = m.clone().sub(A.S), t = rel.dot(A.u) / A.len, perp = rel.clone().sub(A.u.clone().multiplyScalar(t * A.len)).length();
      const sm = (a, b, x) => { const q = Math.max(0, Math.min(1, (x - a) / (b - a))); return q * q * (3 - 2 * q); };
      const wa = Math.abs(m.x) > 0.12 && perp < 0.16 ? sm(-0.02, 0.09, t) : 0, wf = sm(0.42, 0.56, t);
      const up = 1 + (A.sd < 0 ? 0 : 2), fo = up + 1;
      si[i * 4] = 0; si[i * 4 + 1] = up; si[i * 4 + 2] = fo;
      sw[i * 4] = 1 - wa; sw[i * 4 + 1] = wa * (1 - wf); sw[i * 4 + 2] = wa * wf;
    }
    P.needsUpdate = true; g.computeVertexNormals();
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
    parts.push({ g, mat: o.material });
  });
  return (fatherProto = { parts, arms });
}
class FatherRig {
  constructor(sk = {}, lite = false) {
    const F = fatherGeo();
    this.root = new THREE.Group(); this.aura = []; this.meshes = []; this.t = Math.random() * 10; this.tend = 0;
    Object.assign(this, { kind: 'killer', killer: 'father', glb: true, father: true });
    const root = new THREE.Bone(), bones = [root];
    this.arm = F.arms.map(A => {
      const up = new THREE.Bone(), fo = new THREE.Bone();
      up.position.copy(A.S); fo.position.copy(A.E.clone().sub(A.S)); root.add(up); up.add(fo); bones.push(up, fo);
      return { up, fo, u: A.u, sd: A.sd };
    });
    const holder = new THREE.Group(); this.root.add(holder); this.holder = holder;
    holder.add(root); root.updateMatrixWorld(true);
    const skel = new THREE.Skeleton(bones);
    const mats = new Map();
    for (const P of F.parts) {
      if (!mats.has(P.mat)) mats.set(P.mat, AnimRig.prototype.material.call(this, P.mat, sk, lite));
      const m = new THREE.SkinnedMesh(P.g, mats.get(P.mat)); m.bind(skel); m.castShadow = true; m.frustumCulled = false; holder.add(m); this.meshes.push(m);
      const a = new THREE.SkinnedMesh(P.g, auraSkinMat(0xffffff)); a.bind(skel); a.visible = false; a.renderOrder = 10; a.frustumCulled = false; holder.add(a); this.aura.push(a);
    }
    // tendrils: chains of tapering segments from his shoulder blades
    const tm = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.5, metalness: 0.1 });
    this.tendrils = [];
    for (let i = 0; i < 6; i++) {
      const base = new THREE.Group(), side = i % 2 ? 1 : -1, row = Math.floor(i / 2);
      base.position.set(side * 0.1, 1.95 - row * 0.12, -0.12); base.rotation.set(-0.6 - row * 0.2, side * (0.6 + row * 0.35), side * 0.4);
      holder.add(base);
      let parent = base; const segs = [];
      for (let j = 0; j < 8; j++) {
        const r = 0.035 * (1 - j / 9) + 0.006, L = 0.22;
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.8, r, L, 6).translate(0, L / 2, 0), tm);
        const pivot = new THREE.Group(); pivot.add(seg); parent.add(pivot); if (j) pivot.position.y = L;
        segs.push(pivot); parent = pivot;
      }
      base.visible = false; this.tendrils.push({ base, segs, ph: i * 1.3 });
    }
  }
  setAura(color) { AnimRig.prototype.setAura.call(this, color); }
  setOpacity(o) { AnimRig.prototype.setOpacity.call(this, o); }
}
export function makeFatherGlb(sk = {}, lite = false) { return M.slenderman ? new FatherRig(sk, lite) : null; }
const _fq = new THREE.Quaternion(), _fq2 = new THREE.Quaternion(), _fd = new THREE.Vector3(), _fd2 = new THREE.Vector3();
export function animateFather(R, s, dt) {
  R.t += dt; const t = R.t, sp = s.speed || 0;
  if (s.atk === 1 && R.prevAtk !== 1) R.hitT = 0; else if (R.hitT != null) R.hitT += dt;
  if (!s.atk) R.hitT = null; R.prevAtk = s.atk;
  R.ph = (R.ph || 0) + dt * (1.2 + sp * 1.1);
  const swing = Math.min(1, sp / 3) * Math.sin(R.ph);
  for (const A of R.arm) {
    const sd = A.sd, lead = sd > 0; // (his right arm strikes)
    let d1 = [sd * 0.13, -1, 0.06 + swing * sd * 0.45], d2 = [sd * 0.08, -1, 0.2 + swing * sd * 0.5];
    if (s.stun) { d1 = [sd * 0.5, 0.7, 0.55]; d2 = [-sd * 0.5, 0.55, 0.3]; }
    else if (s.exec) { d1 = [sd * 0.25, 0.1, 1]; d2 = [-sd * 0.3, -0.2, 1]; }
    else if (s.aim) { d1 = [sd * 1, 0.15, 0.35]; d2 = [sd * 0.7, 0.45, 0.6]; }
    else if (R.hitT != null && R.hitT < 0.7 && lead) { const f = Math.min(1, R.hitT / 0.18); d1 = [0.2 * f + sd * 0.13 * (1 - f), -1 + 1.0 * f, 1.2 * f]; d2 = [0.05, -0.1 * f - (1 - f), 1.3 * f + 0.2]; }
    else if (s.act) { d1 = [sd * 0.2, -0.5, 0.9]; d2 = [sd * 0.1, -0.7, 0.8]; }
    _fd.set(...d1).normalize(); _fd2.set(...d2).normalize();
    _fq.setFromUnitVectors(A.u, _fd); _fq2.setFromUnitVectors(A.u, _fd2);
    const k = 1 - Math.exp(-dt * (s.stun || R.hitT != null ? 18 : 8));
    A.up.quaternion.slerp(_fq, k);
    // the forearm's turn in the upper arm's frame
    const want = A.up.quaternion.clone().invert().multiply(_fq2);
    A.fo.quaternion.slerp(want, k);
  }
  // glide: barely any bob, a slow sway; leaning in while he lashes or strikes
  const lean = s.aim ? 0.12 : R.hitT != null && R.hitT < 0.6 ? 0.2 : sp > 3 ? 0.08 : 0;
  R.holder.rotation.x += (lean - R.holder.rotation.x) * Math.min(1, dt * 8);
  R.holder.rotation.z = Math.sin(t * 0.7) * 0.02;
  R.holder.position.y = Math.sin(R.ph * 2) * 0.012 * Math.min(1, sp / 2);
  // tendrils
  R.tend += ((s.aim || s.exec ? 1 : 0) - R.tend) * Math.min(1, dt * (s.aim ? 6 : 3));
  for (const T of R.tendrils) {
    T.base.visible = R.tend > 0.03; if (!T.base.visible) continue;
    T.base.scale.setScalar(Math.max(0.05, R.tend) * 1.25);
    T.segs.forEach((g, j) => { g.rotation.x = Math.sin(t * 3 + T.ph + j * 0.7) * 0.32 + (s.aim ? 0.1 : 0); g.rotation.z = Math.cos(t * 2.3 + T.ph * 1.7 + j * 0.5) * 0.28; });
  }
}

// Season 2: the Teddy ("Teddy" by iskaa!, sketchfab.com/iskaalovely, CC BY 4.0), 0.36 m tall, feet at 0, facing +z
let teddyProto = null;
export const loadTeddy = () => load('teddy');
export function makeTeddy() {
  if (!M.teddy) return null;
  if (!teddyProto) {
    const src = M.teddy.g.scene.clone(true), g = new THREE.Group(); src.rotation.y = -Math.PI / 2; g.add(src); g.updateMatrixWorld(true); // (the file's bear faces +x)
    let b = new THREE.Box3().setFromObject(g); const k = 0.36 / (b.max.y - b.min.y); src.scale.multiplyScalar(k); g.updateMatrixWorld(true);
    b = new THREE.Box3().setFromObject(g); const c = b.getCenter(new THREE.Vector3()); src.position.sub(new THREE.Vector3(c.x, b.min.y, c.z));
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    teddyProto = g;
  }
  return teddyProto.clone(true);
}
// City Mode: the Victim's Car ("DVloper - Granny's Car (Official Model)"), 4.4 m long, wheels on the ground, its
// bonnet toward +z, centred; every car is a clone of one prepared copy (shared meshes and textures)
let carProto = null;
export const loadVictimCar = () => load('victim_car');
export function makeVictimCar() {
  if (!M.victim_car) return null;
  if (!carProto) {
    const src = M.victim_car.g.scene.clone(true), inner = new THREE.Group();
    inner.add(src); src.updateMatrixWorld(true);
    let box = new THREE.Box3().setFromObject(src);
    const size = box.getSize(new THREE.Vector3()), c0 = box.getCenter(new THREE.Vector3());
    // long axis -> z; which end is the front: where the bonnet is
    const longX = size.x > size.z;
    let hood = null; src.traverse(o => { if (!hood && /motorhuv/i.test(o.name) && o.isMesh) hood = o; }); // (Swedish: the bonnet)
    const hc = hood ? new THREE.Box3().setFromObject(hood).getCenter(new THREE.Vector3()) : c0.clone().add(new THREE.Vector3(longX ? 1 : 0, 0, longX ? 0 : 1));
    const ahead = longX ? Math.sign(hc.x - c0.x) || 1 : Math.sign(hc.z - c0.z) || 1;
    inner.rotation.y = longX ? (ahead > 0 ? -Math.PI / 2 : Math.PI / 2) : (ahead > 0 ? 0 : Math.PI); // (a turn of +90deg about y takes -x to +z)
    inner.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(inner);
    const L = box.max.z - box.min.z, k = 4.4 / L;
    const outer = new THREE.Group(); outer.add(inner); inner.scale.setScalar(k);
    inner.updateMatrixWorld(true); outer.updateMatrixWorld(true);
    box = new THREE.Box3().setFromObject(outer);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.set(-c.x, -box.min.y, -c.z);
    outer.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = true; } });
    carProto = outer;
  }
  return carProto.clone(true);
}
export const loadSkinModel = name => load(name);
export const skinModelReady = name => !!M[name];
export const glbScene = name => M[name] ? M[name].g.scene : null; // (1.5.3: static props, vice.js)
// An outfit model moved onto the game's own rig (Granny's / Grandpa's), so it plays exactly their animations: the outfit is
// taken as it stands in its own rest pose (Sigma Grandpa's Thug mesh has no skeleton at all; Bloody / Nightmare / Witch
// Granny's skeletons are straightened by toBindPose), fitted over the rig's body (same height, feet and middle), and every
// vertex takes the bone weights of the nearest vertex of the rig's body and is moved into its bind space.
// Worked out once per outfit, shared by everyone wearing it.
const reskinCache = {};
function bodyOf(root) { let b = null; root.traverse(o => { if (o.isSkinnedMesh && !/Ragdoll/i.test(o.material && o.material.name || '') && (!b || o.geometry.attributes.position.count > b.geometry.attributes.position.count)) b = o; }); return b; }
function reskin(R, name, sk, lite, hideAll) {
  const body = bodyOf(R.holder);
  if (!body) return;
  R.root.updateMatrixWorld(true);
  const key = name + ':' + R.killer;
  if (!reskinCache[key]) {
    // the rig's body as it stands now (rest), in world space
    const P = body.geometry.attributes.position, n = P.count, gw = new Float32Array(n * 3), v = new THREE.Vector3(), box = new THREE.Box3();
    for (let i = 0; i < n; i++) { v.fromBufferAttribute(P, i); body.applyBoneTransform(i, v); v.applyMatrix4(body.matrixWorld); gw.set([v.x, v.y, v.z], i * 3); box.expandByPoint(v); }
    // the outfit's meshes where they stand (skinned ones as posed), in its own space
    const src = M[name].g.scene; src.updateMatrixWorld(true);
    const parts = [], sb = new THREE.Box3(), srcBody = bodyOf(src);
    src.traverse(o => {
      if (!o.isMesh || /EyesLock|Hat_Santa|Ragdoll/i.test(o.name) || /Hat_Santa/i.test(o.material && o.material.name || '')) return;
      const g = o.geometry, pp = g.attributes.position, wp = new Float32Array(pp.count * 3);
      for (let i = 0; i < pp.count; i++) { v.fromBufferAttribute(pp, i); if (o.isSkinnedMesh) o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); wp.set([v.x, v.y, v.z], i * 3); if (!srcBody || o === srcBody) sb.expandByPoint(v); }
      parts.push({ o, wp });
    });
    const k = (box.max.y - box.min.y) / Math.max(1e-6, sb.max.y - sb.min.y), sc = sb.getCenter(new THREE.Vector3()), gc = box.getCenter(new THREE.Vector3());
    // which way the outfit faces: turn it (in quarter turns about the vertical) so its eyes and its bat sit where the rig's do
    let turn = 0;
    {
      const at = (root, re) => { const c = new THREE.Vector3(); let n2 = 0; root.traverse(o => { if (o.isMesh && re.test(o.material && o.material.name || '')) { c.add(new THREE.Box3().setFromObject(o, true).getCenter(new THREE.Vector3())); n2++; } }); return n2 ? c.divideScalar(n2) : null; };
      let best = -Infinity;
      for (let q = 0; q < 4; q++) {
        const a = q * Math.PI / 2, rot = (p, c) => { const ox = p.x - c.x, oz = p.z - c.z; return [ox * Math.cos(a) + oz * Math.sin(a), -ox * Math.sin(a) + oz * Math.cos(a)]; };
        let sc2 = 0;
        for (const re of [/^material$/, /ASHSEN|Blood/]) {
          const se = at(src, re), te = at(R.holder, re); if (!se || !te) continue;
          const [rx, rz] = rot(se, sc), tx = te.x - gc.x, tz = te.z - gc.z, L = Math.hypot(rx, rz) * Math.hypot(tx, tz) || 1;
          sc2 += (rx * tx + rz * tz) / L;
        }
        // and the arms (the wide way) along the rig's arms
        const ex = sb.max.x - sb.min.x, ez = sb.max.z - sb.min.z, wide = (q % 2 ? ez : ex) >= (q % 2 ? ex : ez);
        sc2 += wide === ((box.max.x - box.min.x) >= (box.max.z - box.min.z)) ? 2 : 0;
        if (sc2 > best) { best = sc2; turn = a; }
      }
    }
    const ct = Math.cos(turn), st = Math.sin(turn);
    const SI = body.geometry.attributes.skinIndex, SW = body.geometry.attributes.skinWeight, skel = body.skeleton;
    const bm = body.bindMatrix, bmi = body.bindMatrixInverse, mw = body.matrixWorld;
    const boneM = skel.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices(b.matrixWorld, skel.boneInverses[i]));
    // nearest vertex of the rig's body (a few thousand of them: a straight search is quick enough, once per outfit)
    // the 4 nearest (blended by distance: seams between the arms and the dress bend smoothly)
    const nq = [0, 0, 0, 0], nd = [0, 0, 0, 0];
    const nearest4 = (x, y, z) => {
      nd.fill(Infinity);
      for (let q = 0; q < n; q++) {
        const dx = gw[q * 3] - x, dy = gw[q * 3 + 1] - y, dz = gw[q * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz;
        if (d < nd[3]) { let k2 = 3; while (k2 > 0 && nd[k2 - 1] > d) { nd[k2] = nd[k2 - 1]; nq[k2] = nq[k2 - 1]; k2--; } nd[k2] = d; nq[k2] = q; }
      }
      const acc = new Map();
      for (let c = 0; c < 4; c++) { const wv = 1 / (Math.sqrt(nd[c]) + 1e-3); for (let e = 0; e < 4; e++) { const bi = SI.getComponent(nq[c], e), bw = SW.getComponent(nq[c], e); if (bw > 0) acc.set(bi, (acc.get(bi) || 0) + bw * wv); } }
      const top = [...acc].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((a, t) => a + t[1], 0) || 1;
      return top.map(([bi, bw]) => [bi, bw / sum]);
    };
    reskinCache[key] = parts.map(({ o, wp }) => {
      const g = new THREE.BufferGeometry();
      for (const a of ['normal', 'uv']) if (o.geometry.attributes[a]) g.setAttribute(a, o.geometry.attributes[a].clone());
      if (o.geometry.index) g.setIndex(o.geometry.index.clone());
      const cnt = wp.length / 3, pos = new Float32Array(cnt * 3), si = new Uint16Array(cnt * 4), sw = new Float32Array(cnt * 4);
      const A = new THREE.Matrix4(), S = new THREE.Matrix4(), w = new THREE.Vector3(), nrm = new THREE.Vector3(), N3 = new THREE.Matrix3(), nn = g.attributes.normal;
      // the outfit's normals are in its own mesh space: carry them to world first
      const nm = new THREE.Matrix3().getNormalMatrix(o.matrixWorld);
      // separate pieces (bat, hat, broom, hair, eyes, legs) ride rigidly on the bone they hang from in their own file
      let rigid = -1;
      if (!o.isSkinnedMesh) {
        const norm = nm2 => nm2.replace(/[_ ]\d+$/, '').replace(/[_ ]+/g, ' ').trim().toLowerCase();
        let a = o.parent; while (a && !a.isBone) a = a.parent;
        if (a) rigid = skel.bones.findIndex(b => norm(b.name) === norm(a.name));
      }
      for (let i = 0; i < cnt; i++) {
        { const ox = wp[i * 3] - sc.x, oz = wp[i * 3 + 2] - sc.z; w.set((ox * ct + oz * st) * k + gc.x, (wp[i * 3 + 1] - sb.min.y) * k + box.min.y, (-ox * st + oz * ct) * k + gc.z); }
        const ws = rigid >= 0 ? [[rigid, 1]] : nearest4(w.x, w.y, w.z);
        S.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
        for (let c = 0; c < 4; c++) { const bi = ws[c] ? ws[c][0] : 0, bw = ws[c] ? ws[c][1] : 0; si[i * 4 + c] = bi; sw[i * 4 + c] = bw; if (bw > 0) for (let e = 0; e < 16; e++) S.elements[e] += boneM[bi].elements[e] * bw; }
        A.copy(mw).multiply(bmi).multiply(S).multiply(bm).invert();
        w.applyMatrix4(A); pos.set([w.x, w.y, w.z], i * 3);
        if (nn) { N3.setFromMatrix4(A); nrm.fromBufferAttribute(nn, i).applyMatrix3(nm); nrm.set(nrm.x * ct + nrm.z * st, nrm.y, -nrm.x * st + nrm.z * ct).applyMatrix3(N3).normalize(); nn.setXYZ(i, nrm.x, nrm.y, nrm.z); }
      }
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(sw, 4));
      g.computeBoundingSphere();
      return { g, mat: o.material };
    });
  }
  if (hideAll) R.holder.traverse(o => { if (o.isMesh && !R.aura.includes(o)) o.visible = false; }); else body.visible = false;
  R.meshes = R.meshes.filter(m => m.visible);
  for (const part of reskinCache[key]) {
    const m = new THREE.SkinnedMesh(part.g, R.material(part.mat, sk, lite));
    m.bind(body.skeleton, body.bindMatrix); m.position.copy(body.position); m.quaternion.copy(body.quaternion); m.scale.copy(body.scale);
    m.castShadow = true; m.frustumCulled = false; body.parent.add(m); R.meshes.push(m);
  }
}
// Spider Mom: crawls, sniffs about, screeches
// The Child of Slendrina (killer sidekick): "DVloper - Slendrina's Child (Official Model)" by danielthesecond
// (sketchfab.com/danielthesecond), CC BY 4.0, with its own clips (idle, walk, attack, eat, sleep, ...)
export const loadChild = () => load('slendrina_child');
export const childReady = () => !!M.slendrina_child;
export function makeChild(lite = false) {
  if (!M.slendrina_child) return null;
  const R = new AnimRig('slendrina_child', {}, lite);
  R.kind = 'npc';
  R.play = (name, dt, rate = 1) => {
    const k = 1 - Math.exp(-dt * 8);
    for (const n in R.acts) { const t = n === name ? 1 : 0; R.w[n] += (t - R.w[n]) * k; R.acts[n].setEffectiveWeight(R.w[n]); R.acts[n].paused = false; if (n === name) R.acts[n].timeScale = rate; }
    R.mixer.update(dt);
  };
  return R;
}
export function makeSpiderMom(lite = false) {
  if (!M.spidermom) return null;
  const R = new AnimRig('spidermom', {}, lite);
  R.kind = 'npc';
  R.play = (name, dt) => {
    const k = 1 - Math.exp(-dt * 8);
    for (const n in R.acts) { const t = n === name ? 1 : 0; R.w[n] += (t - R.w[n]) * k; R.acts[n].setEffectiveWeight(R.w[n]); R.acts[n].paused = false; }
    R.mixer.update(dt);
  };
  return R;
}

// pick Granny's clip for the game state, blend toward it, scrub one-shots
export function animateGranny(R, s, dt) {
  R.t += dt;
  if (s.atk === 1 && R.prevAtk !== 1 && !s.dash && !s.aim) R.hitT = 0; else if (R.hitT != null) R.hitT += dt * 1.85;
  if (!s.atk) R.hitT = null;
  R.prevAtk = s.atk;
  const A = R.acts, sp = s.speed || 0;
  let want = 'idle', rate = 1, scrub = null, fast = false;
  if (s.exec && s.exec.role === 'killer') {
    // Bedtime Trap: bend down and set the trap, then the shove, then stand over them
    const f = s.exec.f;
    if (f < 0.34) { want = 'lookBed'; rate = 1.2; } else if (f < 0.6) { want = 'Hit'; scrub = 0.25 + (f - 0.34) / 0.26 * 0.6; fast = true; } else want = 'Look';
  }
  else if (R.grandpa && s.pump != null) { want = 'Shoot'; scrub = 0.4; fast = true; }  // 1.6.0: back on the shoulder while the left hand pumps
  else if (R.grandpa && s.shot != null) { want = 'Shoot'; scrub = 0.42 + s.shot * 0.5; fast = true; } // the blast
  else if (R.grandpa && s.aim) { want = 'Shoot'; scrub = 0.4; fast = true; }   // shotgun raised to the shoulder
  else if (s.dash) { want = 'Hit'; scrub = 0.45; fast = true; }        // Bat Rush: mid-swing, charging forward
  else if (s.aim) { want = 'Hit'; scrub = 0.18; fast = true; }         // winding up the bat
  else if (s.blind) { want = 'pepperHit'; rate = 1; fast = true; }
  else if (s.frozen) { want = 'freezeTrap'; rate = 1; fast = true; }
  else if (s.stun) { want = 'arrowHit'; rate = 0.9; fast = true; }
  // her original swing from the Granny game, played whole: from the start of the lunge, 1.85x speed so the
  // bat lands (~0.77s into the clip) as the lunge strikes, then the full follow-through
  else if ((s.atk === 1 || s.atk === 2) && R.hitT != null && R.hitT < 2.43) { want = 'Hit'; scrub = R.hitT / 2.43; fast = true; }
  else if (s.act === 'pickup' || s.act === 'cage' || s.act === 'bear' || s.act === 'break' || s.act === 'kick') { want = 'lookBed'; rate = s.act === 'break' || s.act === 'kick' ? 1.6 : 1.2; }
  else if (s.listen) { want = 'Look'; rate = 1.2; }
  else if (sp > 0.3) { want = 'Walk'; rate = Math.min(2.6, Math.max(0.7, sp / 1.7)); }
  if (R.clipMap) want = R.clipMap[want] || 'idle';
  if (!A[want]) want = A.idle ? 'idle' : Object.keys(A)[0];
  const k = 1 - Math.exp(-dt * (fast ? 20 : 9));
  for (const n in A) {
    const a = A[n], target = n === want ? 1 : 0;
    R.w[n] += (target - R.w[n]) * k;
    if (R.w[n] < 0.002 && !target) R.w[n] = 0;
    a.setEffectiveWeight(R.w[n]);
    if (n === want) { if (scrub != null) { a.paused = true; a.time = scrub * a.getClip().duration; } else { a.paused = false; a.timeScale = rate; } }
    else if (R.w[n] === 0) a.paused = true;
  }
  R.mixer.update(dt);
  if (R.grandpa && s.pump != null) grandpaPump(R, s.pump);
  if (R.follow) R.follow();
}
// 1.6.0: Grandpa racks the shotgun with his left hand after a shot: the hand goes onto the fore-end under the barrel and slides
// back toward him and forward again (two-bone IK on the left arm), the slide (ShotgunPipa) going with it. Bone names lose their
// dots in three.js (lowArm.L -> lowArmL).
const _ik = { s: new THREE.Vector3(), e: new THREE.Vector3(), h: new THREE.Vector3(), t: new THREE.Vector3(), rh: new THREE.Vector3(), f: new THREE.Vector3(), side: new THREE.Vector3(), d: new THREE.Vector3(), pole: new THREE.Vector3(), q: new THREE.Quaternion() };
function grandpaPump(R, f) {
  if (!R._pump) {
    const find = re => { let b = null; R.root.traverse(o => { if (!b && re.test(o.name || '')) b = o; }); return b; };
    R._pump = { up: find(/^upArm\.?L/), lo: find(/^lowArm\.?L/), hand: find(/^hand\.?L/), rhand: find(/^hand\.?R/), slide: find(/^ShotgunPipaGP$/) };
    if (R._pump.slide) R._pump.slide0 = R._pump.slide.position.clone();
  }
  const P = R._pump; if (!P.up || !P.lo || !P.hand || !P.rhand) return;
  const k = Math.sin(Math.min(1, Math.max(0, f)) * Math.PI); // 0 -> pulled back -> 0
  R.root.updateMatrixWorld(true);
  const V = _ik;
  R.root.getWorldQuaternion(V.q); V.f.set(0, 0, 1).applyQuaternion(V.q).normalize(); V.side.set(1, 0, 0).applyQuaternion(V.q).normalize();
  P.up.getWorldPosition(V.s); P.lo.getWorldPosition(V.e); P.hand.getWorldPosition(V.h); P.rhand.getWorldPosition(V.rh);
  const L1 = V.s.distanceTo(V.e), L2 = V.e.distanceTo(V.h);
  // the fore-end: ahead of the right hand along the gun, a little under it; pulled back by k
  V.t.copy(V.rh).addScaledVector(V.f, 0.3 - 0.14 * k).addScaledVector(V.side, 0.03); V.t.y -= 0.1;
  V.d.copy(V.t).sub(V.s); let d = V.d.length(); d = Math.min(d, (L1 + L2) * 0.999); V.d.normalize();
  // elbow: out to his left side and down
  V.pole.copy(V.side).multiplyScalar(0.6).add(new THREE.Vector3(0, -1, 0)); V.pole.addScaledVector(V.d, -V.pole.dot(V.d)).normalize();
  const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  const elbow = V.s.clone().addScaledVector(V.d, a).addScaledVector(V.pole, hgt);
  aimBone(P.up, P.lo, elbow.clone().sub(V.s).normalize(), 1);
  P.lo.getWorldPosition(V.e);
  aimBone(P.lo, P.hand, V.t.clone().sub(V.e).normalize(), 1);
  if (P.slide && P.slide0 && P.slide.parent) {
    const w = P.slide.parent.localToWorld(P.slide0.clone()).addScaledVector(V.f, -0.08 * k);
    P.slide.position.copy(P.slide.parent.worldToLocal(w));
  }
}
