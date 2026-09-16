import * as THREE from 'three';
import { SPECIES } from '../../src/shared/gamedata.js';
import { buildCreature } from '../../src/client/gfx/creatures.js';

const out = [];
for (const id of Object.keys(SPECIES)) {
  let g;
  try { g = buildCreature(id, { outline: true, detail: 1 }); }
  catch (e) { out.push({ id, error: e.message, box: [0, 0, 0], body: [0, 0, 0], outlierRatio: 0, worst: 'build failed' }); continue; }
  const full = new THREE.Box3().setFromObject(g);
  const fullSize = full.getSize(new THREE.Vector3());

  // Body = the median extent of the individual meshes, so one stray part
  // cannot define it.
  const parts = [];
  g.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const b = new THREE.Box3().setFromObject(o);
    const c = b.getCenter(new THREE.Vector3());
    parts.push({ name: o.name || o.type, c, b, r: c.length() });
  });
  parts.sort((a, b) => a.r - b.r);
  const core = parts.slice(0, Math.max(1, Math.round(parts.length * 0.8)));
  const bodyBox = new THREE.Box3();
  for (const p of core) bodyBox.union(p.b);
  const bodySize = bodyBox.getSize(new THREE.Vector3());
  const worst = parts[parts.length - 1];
  out.push({
    id,
    box: [fullSize.x, fullSize.y, fullSize.z],
    body: [bodySize.x, bodySize.y, bodySize.z],
    outlierRatio: Math.max(fullSize.x, fullSize.y, fullSize.z) / Math.max(0.001, Math.max(bodySize.x, bodySize.y, bodySize.z)),
    worst: `${worst?.name || '?'} @ ${worst?.r.toFixed(2)}`,
    parts: parts.length,
  });
  g.traverse((o) => o.geometry?.dispose?.());
}
window.__audit = out;
window.__auditReady = true;
