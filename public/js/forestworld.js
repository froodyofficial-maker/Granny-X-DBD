// Slendrina: The Forest (1.4.3): draws the forest from forest_map.glb (tools/forest/build_forest.py): every tree the map
// kept (M.forestTrees: trunk + crown, instanced), its rocks, and the landmark buildings in their cells (M.forestGroups).
import * as THREE from 'three';
import { cloneScene } from './sceneGlb.js';
import { FOREST } from './forestdata.js';

export function buildForest(W, M, lite) {
  const root = cloneScene('forest_map', lite);
  if (!root) return;
  const scene = W.scene, node = n => root.getObjectByName(n);
  const proto = n => { const o = node('proto_' + n); let m = null; if (o) o.traverse(c => { if (c.isMesh && !m) m = c; }); return m; };
  const inst = (src, mats, shadow) => {
    if (!src || !mats.length) return;
    const im = new THREE.InstancedMesh(src.geometry, src.material, mats.length), m4 = new THREE.Matrix4();
    mats.forEach((a, i) => im.setMatrixAt(i, m4.fromArray(a)));
    im.castShadow = shadow; im.receiveShadow = true; im.frustumCulled = false;
    scene.add(im); return im;
  };
  const trees = (M.forestTrees || []).map(i => FOREST.trees[i]);
  const crown = proto('Grenar');
  if (crown) { crown.material.alphaTest = 0.45; crown.material.side = THREE.DoubleSide; crown.material.transparent = false; }
  inst(proto('Stam'), trees.map(t => t.t), true);
  inst(crown, trees.filter(t => t.b).map(t => t.b), !lite);
  inst(proto('RockMesh'), (M.forestRocks || []).map(i => FOREST.rocks[i].m), true);
  for (const g of M.forestGroups || []) {
    const src = node('group_' + g.g); if (!src) continue;
    const o = src.clone(true); o.position.set(g.x, 0, g.z); o.updateMatrixWorld(true);
    o.traverse(c => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; c.matrixAutoUpdate = false; c.updateMatrix(); } });
    scene.add(o);
  }
  W.forest = true;
}
