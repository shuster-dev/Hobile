// What a creature's training stars look like. A star from the pods at the farm
// makes it stronger (shared/gamedata.js STARS) and it should show:
//   ★2  a little bigger; its tips (ears, horns, crest) in its element's colour
//   ★3  bigger again; stripes down the flanks; a ring of light at its feet
//   ★4  the markings glow; motes of its element circle it
//   ★5  the biggest; gold tips, gold motes, and a crown floating over it
// The markings are painted by the figurine's own shader (figurine.js, uStar);
// the ring, motes and crown are added here and keep themselves moving, so the
// same call dresses a creature anywhere it is drawn — the battle, the pet at
// your heel, the pod at the farm.
import {
  Box3, CanvasTexture, Color, ConeGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial,
  PlaneGeometry, SphereGeometry, TorusGeometry,
} from 'three';
import { ELEMENTS, SPECIES } from '../../shared/gamedata.js';

export const STAR_SCALE = [1, 1, 1.06, 1.12, 1.18, 1.25];
export const GOLD = 0xFFD54A;

// Each element's marks: the tips in a colour that stands out on bodies of
// that element (a fire cub is already orange — its tips go flame-yellow),
// the stripes darker, and the glow (ring, motes, edges) its own colour.
const MARKS = {
  ember: { tip: 0xFFE14A, stripe: 0x7A1A0A },
  aqua: { tip: 0xE6FBFF, stripe: 0x1C4FA8 },
  verdant: { tip: 0xFF8FB8, stripe: 0x2E6B2A },
  volt: { tip: 0x52E3FF, stripe: 0x2A2A44 },
  terra: { tip: 0xF2E3B8, stripe: 0x5A361A },
  gale: { tip: 0xFFFFFF, stripe: 0x3F8FAF },
  frost: { tip: 0x7FEBFF, stripe: 0x2F5FAA },
  umbra: { tip: 0xC08CFF, stripe: 0x24142F },
  lumen: { tip: 0xFFF6B0, stripe: 0xC98A1A },
  metal: { tip: 0xE8F0FF, stripe: 0x3A4250 },
};

/** The colour a species' stars glow in: its first element's. */
export function starColor(species) {
  const el = SPECIES[species]?.types?.[0];
  return ELEMENTS[el]?.color ?? 0xFFFFFF;
}

/** The colours of its marks: tips, stripes. */
export function starMarks(species) {
  return MARKS[SPECIES[species]?.types?.[0]] || { tip: 0xFFFFFF, stripe: 0x333333 };
}

let RING_TEX = null;
/** A soft ring with runes round it, white, tinted by the material. */
function ringTexture() {
  if (RING_TEX) return RING_TEX;
  if (typeof document === 'undefined') return null;     // headless checks
  const S = 128, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d'), m = S / 2;
  const grad = g.createRadialGradient(m, m, S * 0.18, m, m, S * 0.5);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.62, 'rgba(255,255,255,0.05)');
  grad.addColorStop(0.8, 'rgba(255,255,255,0.9)');
  grad.addColorStop(0.88, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  g.strokeStyle = 'rgba(255,255,255,0.85)';
  g.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = k / 8 * Math.PI * 2;
    g.beginPath();
    g.moveTo(m + Math.cos(a) * S * 0.31, m + Math.sin(a) * S * 0.31);
    g.lineTo(m + Math.cos(a + 0.12) * S * 0.35, m + Math.sin(a + 0.12) * S * 0.35);
    g.stroke();
  }
  RING_TEX = new CanvasTexture(c);
  return RING_TEX;
}

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;

/** The measurements of a built creature, in its own (unscaled) frame. */
function measure(group) {
  const m = group.userData.model;
  if (m?.height) return { h: m.height, w: m.size || m.height };
  return { h: group.userData.height || 1, w: 1 };
}

function dispose(o) {
  o.traverse((c) => { c.geometry?.dispose(); if (c.material && !c.material.userData?.shared) c.material.dispose(); });
}

/**
 * At most `maxH` metres tall, whatever its species. The bosses are built to
 * fill a raid (twenty metres and more); one a player keeps — given by a GM,
 * or caught — walks beside them, stands in their fights and sits in their
 * cards at a size that leaves the rest of the screen to see. Kept through a
 * change of stars (it lowers the base the stars scale from).
 */
export function capHeight(group, maxH) {
  if (!group || !(maxH > 0)) return group;
  const ud = group.userData;
  if (ud.baseScale === undefined) ud.baseScale = group.scale.x;
  const k = STAR_SCALE[Math.max(1, Math.min(5, ud.star || 1))];
  let h = group.userData.model?.height;
  if (!h) {
    // no measurements on it: what it actually spans, back in its own frame
    const box = new Box3().setFromObject(group);
    h = Number.isFinite(box.max.y) ? (box.max.y - Math.min(0, box.min.y)) / (group.scale.x || 1) : 0;
  }
  const tall = h * ud.baseScale * k;
  if (!(tall > maxH)) return group;
  ud.baseScale *= maxH / tall;
  group.scale.setScalar(ud.baseScale * k);
  return group;
}

/**
 * Dress a creature (from buildCreature) for its stars. Safe to call again
 * with another number: it takes off what the old one put on.
 */
export function setStarLook(group, star = 1) {
  if (!group) return group;
  star = Math.max(1, Math.min(5, Math.round(Number(star) || 1)));
  const ud = group.userData;
  if (ud.star === star) return group;
  if (ud.baseScale === undefined) ud.baseScale = group.scale.x;
  group.scale.setScalar(ud.baseScale * STAR_SCALE[star]);
  const col = starColor(ud.speciesId), marks = starMarks(ud.speciesId);
  const u = ud.model?.u;
  if (u?.uStar) {
    u.uStar.value = star - 1;
    u.uStarCol.value.set(marks.stripe);
    u.uTipCol.value.set(star >= 5 ? GOLD : marks.tip);
    u.uGlowCol && u.uGlowCol.value.set(col);
  }
  if (ud.starFx) { ud.starFx.parent?.remove(ud.starFx); dispose(ud.starFx); ud.starFx = null; }
  ud.star = star;
  if (star < 3) return group;

  const { h, w } = measure(group);
  const fx = new Group();
  fx.name = 'star-fx';
  fx.userData.noOutline = true;
  const phase = Math.random() * 6.28;

  // the ring at its feet
  const ringMat = new MeshBasicMaterial({
    map: ringTexture(), color: new Color(star >= 5 ? GOLD : col), transparent: true, opacity: 0.85,
    depthWrite: false, side: DoubleSide, toneMapped: false, fog: true,
  });
  const R = Math.max(0.45, w * 0.62);
  const ring = new Mesh(new PlaneGeometry(R * 2, R * 2), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.04;
  ring.renderOrder = 2;
  ring.onBeforeRender = () => {
    const t = now() + phase;
    ring.rotation.z = t * 0.5;
    ringMat.opacity = 0.62 + Math.sin(t * 2.2) * 0.22;
  };
  fx.add(ring);

  // motes of its element (gold at five), circling at its middle
  if (star >= 4) {
    const n = star >= 5 ? 5 : 3, moteCol = star >= 5 ? GOLD : col;
    const moteMat = new MeshBasicMaterial({ color: new Color(moteCol), toneMapped: false });
    const geo = new SphereGeometry(Math.max(0.045, w * 0.045), 8, 6);
    for (let k = 0; k < n; k++) {
      const m = new Mesh(geo, moteMat);
      const off = k / n * Math.PI * 2;
      m.onBeforeRender = () => {
        const t = now() + phase, a = t * 1.1 + off;
        m.position.set(Math.cos(a) * R * 0.95, h * (0.35 + 0.18 * Math.sin(t * 1.7 + off * 2)), Math.sin(a) * R * 0.95);
        m.updateMatrix(); m.updateMatrixWorld();
      };
      m.position.set(Math.cos(off) * R, h * 0.4, Math.sin(off) * R);
      fx.add(m);
    }
  }

  // and at five, a crown floating over it
  if (star >= 5) {
    const crown = new Group();
    const gold = new MeshStandardMaterial({ color: GOLD, metalness: 0.75, roughness: 0.28, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
    const cr = Math.max(0.13, w * 0.2);
    const band = new Mesh(new TorusGeometry(cr, cr * 0.16, 6, 20), gold);
    band.rotation.x = Math.PI / 2;
    crown.add(band);
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * Math.PI * 2;
      const spike = new Mesh(new ConeGeometry(cr * 0.2, cr * 0.55, 5), gold);
      spike.position.set(Math.cos(a) * cr, cr * 0.26, Math.sin(a) * cr);
      crown.add(spike);
      const gem = new Mesh(new SphereGeometry(cr * 0.1, 6, 4), new MeshBasicMaterial({ color: col, toneMapped: false }));
      gem.position.set(Math.cos(a) * cr, cr * 0.58, Math.sin(a) * cr);
      crown.add(gem);
    }
    crown.position.y = h + cr * 0.9;
    band.onBeforeRender = () => {
      const t = now() + phase;
      crown.rotation.y = t * 0.7;
      crown.position.y = h + cr * 0.9 + Math.sin(t * 1.6) * cr * 0.25;
      crown.updateMatrixWorld();
    };
    fx.add(crown);
  }
  group.add(fx);
  ud.starFx = fx;
  return group;
}
