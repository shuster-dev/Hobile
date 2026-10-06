// A planned zone's built things, drawn (shared/worldplan.js says what and
// where; zonebuild.js says how each kind looks). Everything that stands still
// is merged into one cel-shaded geometry and two lit ones, then cut into 48m
// squares so the camera only draws what it faces. What moves — mill sails,
// turbine blades, the airship — is its own small mesh; chimneys and the
// volcano smoke; the lighthouse sweeps its beam after dark.
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Points, PointsMaterial,
} from 'three';
import { softShadowTexture } from './core.js';
import { BUILDERS } from './zonebuild.js';
import { Kit, chunkMeshes, glowVC, toonVC } from './zonekit.js';

export function buildPlanArt(P, pal = {}) {
  const group = new Group();
  group.name = 'plan-art';
  const solid = [], nightGlow = [], litGlow = [];
  const world = new Kit(), worldGlow = new Kit(), worldLit = new Kit();
  const parts = [], smokes = [], beacons = [];
  for (const s of P.structures) {
    const B = BUILDERS[s.kind];
    if (!B) continue;
    const at = { x: s.x, y: s.y ?? P.height(s.x, s.z), z: s.z, rot: s.rot || 0 };
    const k = new Kit(at), g = new Kit(at), lit = new Kit(at);
    const c = Math.cos(at.rot), sn = Math.sin(at.rot);
    const toWorld = (x, y, z) => ({ x: at.x + x * c + z * sn, y: at.y + y, z: at.z - x * sn + z * c });
    const o = {
      P, pal, world, glow: worldGlow, lit,
      part(name, pivot, mode, speed) {
        const kit = new Kit(), glow = new Kit();
        parts.push({ name, kit, glow, at: toWorld(pivot.x, pivot.y, pivot.z), rot: at.rot, mode, speed, phase: s.i * 1.7 });
        return kit;
      },
      partGlow(name) { return parts.filter((p) => p.name === name).at(-1)?.glow; },
      smoke(x, y, z, kind = 'chimney') { smokes.push({ ...toWorld(x, y, z), kind }); },
      beacon(x, y, z) { beacons.push(toWorld(x, y, z)); },
    };
    B(k, g, s, o);
    for (const [kit, list] of [[k, solid], [g, nightGlow], [lit, litGlow]]) { const geo = kit.geometry(); geo && list.push(geo); }
  }
  for (const [kit, list] of [[world, solid], [worldGlow, nightGlow], [worldLit, litGlow]]) { const geo = kit.geometry(); geo && list.push(geo); }

  const merge = (list) => {
    if (!list.length) return null;
    const one = new Kit();
    one.parts = list;
    return one.geometry();
  };
  const solidMat = toonVC(), nightMat = glowVC(), litMat = glowVC();
  for (const m of chunkMeshes(merge(solid), solidMat)) group.add(m);
  for (const m of chunkMeshes(merge(nightGlow), nightMat, { cast: false, receive: false })) group.add(m);
  for (const m of chunkMeshes(merge(litGlow), litMat, { cast: false, receive: false })) group.add(m);

  // what moves
  const movers = [];
  for (const p of parts) {
    const holder = new Group();
    holder.position.set(p.at.x, p.at.y, p.at.z);
    holder.rotation.y = p.rot;
    const geo = p.kit.geometry();
    if (!geo) continue;
    const mesh = new Mesh(geo, solidMat);
    mesh.castShadow = true;
    holder.add(mesh);
    const gg = p.glow.geometry();
    let gm = null;
    if (gg) { gm = new Mesh(gg, nightMat); holder.add(gm); }
    group.add(holder);
    movers.push({ ...p, holder, mesh, gm, baseY: p.at.y });
  }

  // smoke: a few soft puffs per chimney, rising and drifting off
  let smoke = null;
  if (smokes.length) {
    const PER = 7, n = smokes.length * PER, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(pos, 3));
    g.setAttribute('color', new BufferAttribute(col, 3));
    const big = smokes.some((e) => e.kind === 'volcano');
    const m = new PointsMaterial({ size: big ? 9 : 2.4, map: softShadowTexture(), transparent: true, depthWrite: false, vertexColors: true, opacity: 0.55, sizeAttenuation: true });
    smoke = new Points(g, m);
    smoke.frustumCulled = false;
    smoke.userData = { PER };
    group.add(smoke);
  }

  // the lighthouse's beam
  const beams = [];
  for (const b of beacons) {
    const geo = new ConeGeometry(6, 70, 16, 1, true);
    geo.translate(0, -35, 0);
    geo.rotateZ(Math.PI / 2);
    const mesh = new Mesh(geo, new MeshBasicMaterial({ color: 0xFFF2C0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }));
    mesh.position.set(b.x, b.y, b.z);
    group.add(mesh);
    beams.push(mesh);
  }

  return {
    group,
    update(t, night = 0) {
      // windows are dark glass by day and lit at night; embers always glow
      nightMat.color.setScalar(0.32 + night * 0.95);
      litMat.color.setScalar(0.85 + night * 0.35);
      for (const m of movers) {
        if (m.mode === 'spinZ') m.mesh.rotation.z = t * m.speed + m.phase;
        else if (m.mode === 'bob') { m.holder.position.y = m.baseY + Math.sin(t * 0.45 + m.phase) * 0.7; m.holder.rotation.y = m.rot + Math.sin(t * 0.07) * 0.12; m.holder.rotation.z = Math.sin(t * 0.3) * 0.03; }
      }
      if (smoke) {
        const pos = smoke.geometry.attributes.position, col = smoke.geometry.attributes.color, PER = smoke.userData.PER;
        smokes.forEach((e, i) => {
          const tall = e.kind === 'volcano' ? 40 : 6, dark = e.kind === 'dark' || e.kind === 'volcano';
          for (let k = 0; k < PER; k++) {
            const ph = (t * (e.kind === 'volcano' ? 0.05 : 0.22) + k / PER + i * 0.37) % 1, q = i * PER + k;
            pos.setXYZ(q, e.x + ph * ph * (e.kind === 'volcano' ? 30 : 3) + Math.sin(t + k) * 0.2, e.y + ph * tall, e.z + ph * (e.kind === 'volcano' ? 8 : 1.2));
            const v = (dark ? 0.38 : 0.86) * (1 - ph * 0.5);
            col.setXYZ(q, v, v, v * (dark ? 0.95 : 1));
          }
        });
        pos.needsUpdate = col.needsUpdate = true;
      }
      for (const b of beams) { b.rotation.y = t * 0.6; b.material.opacity = 0.16 * Math.max(0, night - 0.15); b.visible = night > 0.15; }
    },
  };
}
