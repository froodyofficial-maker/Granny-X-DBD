// 1.6.0 (performance): fuse the static parts of an object into one mesh per material.
// A generator was 49 separate meshes, a street lamp 22, a hook 60: ~1,400 draw calls a frame (half of them again for the
// shadow map), which held even an RTX 4070 to ~50 fps (WebGL pays per draw call, not per triangle). Parts that move or are
// changed on their own (anything the game holds a reference to: pistons, bulbs, outline meshes, gate doors, lamp glows...)
// are left alone, as are skinned / instanced meshes, sprites, points and lines.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// every Object3D reachable from `v` (objects / arrays, a few levels deep)
export function collectRefs(v, out = new Set(), depth = 0) {
  if (!v || typeof v !== 'object' || depth > 4) return out;
  if (v.isObject3D) { out.add(v); return out; }
  if (v.isMaterial || v.isTexture || v.isBufferGeometry || v.isColor || v.isVector3) return out;
  if (Array.isArray(v)) { for (const x of v) collectRefs(x, out, depth + 1); return out; }
  if (v instanceof Map || v instanceof Set) { for (const x of v.values()) collectRefs(x, out, depth + 1); return out; }
  for (const k of Object.keys(v)) collectRefs(v[k], out, depth + 1);
  return out;
}

const sig = g => Object.keys(g.attributes).filter(n => n === 'position' || n === 'normal' || n === 'uv').sort().join(',');
export function mergeStatic(root, keep = new Set(), minParts = 2) {
  // what must stay as it is: referenced objects (and everything under them), except the root itself
  const held = new Set();
  const hold = o => o.traverse(c => held.add(c));
  for (const o of collectRefs(root.userData)) if (o !== root) hold(o);
  for (const o of keep) if (o !== root) { let p = o, inside = false; while (p) { if (p === root) { inside = true; break; } p = p.parent; } if (inside) hold(o); }
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse(o => {
    if (o === root || held.has(o) || !o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.visible) return;
    if (Array.isArray(o.material) || !o.material || !o.geometry || !o.geometry.attributes.position || o.geometry.morphAttributes.position) return;
    if (o.userData.noMerge || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    // anything under an invisible parent is skipped (it may be shown later)
    for (let p = o.parent; p && p !== root; p = p.parent) if (!p.visible) return;
    const key = o.material.uuid + '|' + sig(o.geometry) + '|' + (o.castShadow ? 1 : 0) + (o.receiveShadow ? 1 : 0) + '|' + o.renderOrder;
    (groups.get(key) || groups.set(key, []).get(key)).push(o);
  });
  let removed = 0;
  for (const list of groups.values()) {
    if (list.length < minParts) continue;
    const names = sig(list[0].geometry).split(',');
    const geos = list.map(o => {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const n of Object.keys(g.attributes)) if (!names.includes(n)) g.deleteAttribute(n);
      g.morphAttributes = {};
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
      // a mirrored part (negative scale) would come out inside-out
      if (o.matrixWorld.determinant() * root.matrixWorld.determinant() < 0) { const P = g.attributes.position; for (let i = 0; i < P.count; i += 3) { for (const a of Object.values(g.attributes)) { for (let c = 0; c < a.itemSize; c++) { const t = a.getComponent(i + 1, c); a.setComponent(i + 1, c, a.getComponent(i + 2, c)); a.setComponent(i + 2, c, t); } } } }
      g.clearGroups();
      return g;
    });
    let merged = null;
    try { merged = mergeGeometries(geos, false); } catch (e) { merged = null; }
    for (const g of geos) if (g !== merged) g.dispose();
    if (!merged) continue;
    merged.computeBoundingSphere(); merged.computeBoundingBox();
    const m = new THREE.Mesh(merged, list[0].material);
    m.castShadow = list[0].castShadow; m.receiveShadow = list[0].receiveShadow; m.renderOrder = list[0].renderOrder; m.name = 'merged';
    root.add(m);
    for (const o of list) { o.parent.remove(o); removed++; }
  }
  // a moving part that is itself a group (a gate door, a pallet board, a lever) is merged inside, as one piece
  for (const o of collectRefs(root.userData)) {
    if (o === root || o.isMesh || o.isLight || !o.children.length) continue;
    let n = 0; o.traverse(c => { if (c.isMesh) n++; }); if (n < minParts) continue;
    removed += mergeStatic(o, keep, minParts);
  }
  return removed;
}
// small props don't need to cast moon shadows (at that size they're a few pixels), and each caster is a draw call in the shadow pass
export function trimShadows(root, minR = 0.22) {
  const v = new THREE.Vector3();
  root.traverse(o => {
    if (!o.isMesh || !o.castShadow || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry) return;
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    o.getWorldScale(v);
    if (o.geometry.boundingSphere.radius * Math.max(v.x, v.y, v.z) < minR) o.castShadow = false;
  });
}
