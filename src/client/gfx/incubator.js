// The training pods at your farm, with whoever is training in them.
//
// A creature sent to train (server/game/combat.js startTraining) leaves the
// team and goes to the farm. Here it floats in a glass pod of its element's
// colour, the liquid rising as the training goes on, a label over it counting
// down. When it is done the liquid turns gold and a beam stands over the pod;
// collect it (walk up to it, or from the base panel) and the glass lifts, it
// comes out with its new star — bigger, marked, ringed (starlook.js) — and
// hops down beside the pod before going back to walk with you.
//
// Every player sees their own farm: the pods are drawn from this player's
// base (the "base" message), not from the room. Where the pods stand, and that
// they are solid, is shared/props.js (incubatorSpots).
import {
  AdditiveBlending, CanvasTexture, Color, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial,
  Points, PointsMaterial, BufferGeometry, BufferAttribute, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial,
  UniformsLib, UniformsUtils, RingGeometry, Vector3,
} from 'three';
import { BUILDINGS, ELEMENTS, SPECIES } from '../../shared/gamedata.js';
import { incubatorSpots } from '../../shared/props.js';
import { displayFrag, softShadowTexture } from './core.js';
import { animateCreature, buildCreature, setCreatureLod } from './creatures.js';
import { STAR_SCALE, setStarLook } from './starlook.js';
import { Kit, glowVC, toonVC } from './zonekit.js';

const MAX = BUILDINGS.pod?.maxLevel ?? 5;
const LIQ_Y = 0.55, LIQ_H = 1.95, LIQ_R = 0.84, GLASS_R = 0.95, CAP_Y = 2.5;
// what is in a pod is sized to it: a big one shrunk to fit, a small one
// brought up to where it can be seen; it floats in the middle of the glass
const FIT_H = 1.15, FIT_W = 1.4, FIT_UP = 1.6, FLOAT_Y = 0.85;
const IDLE_LIQUID = 0x5FD8E8, READY = 0xFFD54A;

// ---------------------------------------------------------------- materials
const GLASS_VERT = `
varying vec3 vN; varying vec3 vV;
#include <fog_pars_vertex>
void main() {
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mvPosition.xyz);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const GLASS_FRAG = `
uniform vec3 uTint; uniform float uGlow;
varying vec3 vN; varying vec3 vV;
#include <fog_pars_fragment>
void main() {
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0);
  vec3 col = mix(uTint * 0.5 + 0.35, vec3(1.0), f * 0.7) + uTint * uGlow * 0.4;
  float a = 0.08 + f * 0.5 + uGlow * 0.12;
  // a streak of light down the glass
  gl_FragColor = vec4(col, a);
  #include <fog_fragment>
}`;
const LIQ_VERT = `
varying vec3 vP; varying vec3 vNo;
#include <fog_pars_vertex>
void main() {
  vP = position; vNo = normal;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const LIQ_FRAG = `
uniform vec3 uCol; uniform float uTime, uReady;
varying vec3 vP; varying vec3 vNo;
#include <fog_pars_fragment>
void main() {
  float ang = atan(vP.z, vP.x);
  float band = 0.5 + 0.5 * sin(vP.y * 13.0 - uTime * 2.2 + sin(ang * 3.0 + uTime * 0.8) * 1.3);
  vec3 c = uCol * (0.55 + 0.45 * vP.y) + uCol * band * 0.25 + 0.08;
  c = mix(c, vec3(1.0, 0.86, 0.38) * (1.05 + 0.25 * sin(uTime * 4.0)), uReady * 0.6);
  // clear enough to see who is in it
  float a = 0.2 + 0.1 * band;
  if (vNo.y > 0.5) { c = c * 1.2 + 0.15; a = 0.45; }
  gl_FragColor = vec4(c, a);
  #include <fog_fragment>
}`;

function glassMaterial() {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uTint: { value: new Color(0xBFEFFF) }, uGlow: { value: 0 } }]),
    vertexShader: GLASS_VERT, fragmentShader: displayFrag(GLASS_FRAG),
    transparent: true, depthWrite: false, side: DoubleSide, fog: true,
  });
}
function liquidMaterial() {
  return new ShaderMaterial({
    uniforms: UniformsUtils.merge([UniformsLib.fog, { uCol: { value: new Color(IDLE_LIQUID) }, uTime: { value: 0 }, uReady: { value: 0 } }]),
    vertexShader: LIQ_VERT, fragmentShader: displayFrag(LIQ_FRAG),
    transparent: true, depthWrite: false, fog: true,
  });
}

// ---------------------------------------------------------------- the label
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); };
const fmt = (ms) => {
  const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(x).padStart(2, '0')}` : `${m}:${String(x).padStart(2, '0')}`;
};
function makeLabel() {
  const c = document.createElement('canvas');
  c.width = 320; c.height = 136;
  const tex = new CanvasTexture(c);
  const sp = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, fog: false }));
  sp.scale.set(2.3, 0.98, 1);
  sp.renderOrder = 6;
  sp.userData = { c, tex, text: '' };
  return sp;
}
function paintLabel(sp, { name, from, to, left, frac, ready }) {
  const key = `${name}|${from}|${to}|${ready ? 'R' : fmt(left)}|${Math.round(frac * 60)}`;
  if (sp.userData.text === key) return;
  sp.userData.text = key;
  const { c, tex } = sp.userData, g = c.getContext('2d'), W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const r = 22;
  g.fillStyle = ready ? 'rgba(58,40,6,0.82)' : 'rgba(14,22,34,0.78)';
  rr(g, 6, 6, W - 12, H - 12, r); g.fill();
  g.strokeStyle = ready ? 'rgba(255,213,74,0.95)' : 'rgba(127,243,255,0.55)';
  g.lineWidth = 3; g.stroke();
  g.textAlign = 'center'; g.direction = 'rtl';
  g.fillStyle = '#ffffff'; g.font = 'bold 26px sans-serif';
  g.fillText(name, W / 2, 40);
  g.direction = 'ltr';
  g.font = 'bold 24px sans-serif';
  g.fillStyle = '#ffd54a';
  g.fillText(`${'★'.repeat(from)}  ➜  ${'★'.repeat(to)}`, W / 2, 72);
  if (ready) {
    g.direction = 'rtl'; g.fillStyle = '#ffe9a0'; g.font = 'bold 26px sans-serif';
    g.fillText('מוכן! בוא לקחת', W / 2, 110);
  } else {
    g.fillStyle = 'rgba(255,255,255,0.18)'; rr(g, 30, 88, W - 60, 12, 6); g.fill();
    g.fillStyle = '#7ff3ff'; rr(g, 30, 88, Math.max(12, (W - 60) * frac), 12, 6); g.fill();
    g.fillStyle = '#d8f6ff'; g.font = 'bold 20px monospace';
    g.fillText(fmt(left), W / 2, 124);
  }
  tex.needsUpdate = true;
}

const loc = (o) => o?.he || o?.name || '';
const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

// ---------------------------------------------------------------- the pods
export class Incubators {
  constructor(world) {
    this.world = world;
    this.zone = world.zone;
    this.spots = incubatorSpots(this.zone).map((s) => ({ ...s, y: world.heightAt(s.x, s.z) }));
    this.group = new Group();
    this.group.name = 'incubators';
    this.built = -1;
    this.pods = [];
    this.base = null;
    this.offset = 0;
    this.time = 0;
    this.bubbles = null;
    this.setBuilt(1);
  }

  /** The frames: a pad for each spot, a pod on each one built. */
  setBuilt(n) {
    n = Math.max(0, Math.min(MAX, n));
    if (n === this.built) return;
    this.built = n;
    if (this.static) for (const m of this.static) { this.group.remove(m); m.geometry.dispose(); }
    for (const p of this.pods) this.dropPod(p);
    this.pods = [];
    const solid = new Kit(), lit = new Kit();
    for (const s of this.spots) {
      const k = new Kit({ x: s.x, y: s.y, z: s.z, rot: s.rot }), g = new Kit({ x: s.x, y: s.y, z: s.z, rot: s.rot });
      k.cyl(1.35, 1.42, 0.14, { y: 0.07 }, 0x8E939C, 20);
      if (s.k < n) {
        k.cyl(1.04, 1.14, 0.4, { y: 0.34 }, 0x3B4656, 22);
        k.cyl(1.0, 1.02, 0.06, { y: 0.56 }, 0x9AA7B8, 22);
        g.ring(0.99, 0.035, { y: 0.5, rx: Math.PI / 2 }, 0x7FF3FF, 30);
        for (let q = 0; q < 3; q++) {
          const a = Math.PI + (q - 1) * 2.1;
          k.box(0.09, CAP_Y - 0.55, 0.09, { x: Math.sin(a) * 1.0, y: (CAP_Y + 0.55) / 2, z: Math.cos(a) * 1.0, ry: a }, 0x5A6678);
        }
        k.cyl(1.04, 1.04, 0.06, { y: CAP_Y }, 0x9AA7B8, 22);
        k.cyl(0.98, 1.02, 0.24, { y: CAP_Y + 0.15 }, 0x3B4656, 22);
        k.ball(0.42, { y: CAP_Y + 0.27, sy: 0.45 }, 0x4A5566, 14);
        g.ball(0.11, { y: CAP_Y + 0.5 }, 0xFFE9A8, 10);
        g.ring(1.0, 0.03, { y: CAP_Y + 0.05, rx: Math.PI / 2 }, 0x7FF3FF, 30);
        // the console beside it, and the pipe that feeds it
        k.box(0.62, 1.05, 0.42, { x: 1.62, y: 0.53, z: -0.25 }, 0x4A5566);
        k.box(0.7, 0.08, 0.5, { x: 1.62, y: 1.07, z: -0.25 }, 0x9AA7B8);
        g.box(0.48, 0.34, 0.02, { x: 1.62, y: 0.78, z: -0.03 }, 0x6FE8FF);
        g.box(0.08, 0.08, 0.02, { x: 1.5, y: 0.45, z: -0.03 }, 0x8CFF9A);
        g.box(0.08, 0.08, 0.02, { x: 1.74, y: 0.45, z: -0.03 }, 0xFFB04A);
        k.cyl(0.07, 0.07, 0.5, { x: 1.18, y: 0.32, z: -0.25, rz: Math.PI / 2 }, 0x6A7486, 8);
      } else {
        // a spot to build on: a stake and a blank board
        k.box(0.08, 0.9, 0.08, { y: 0.5 }, 0x7A5A3A);
        k.box(0.72, 0.42, 0.05, { y: 1.0 }, 0xC8A878);
        g.ring(1.25, 0.025, { y: 0.15, rx: Math.PI / 2 }, 0x5FA8B8, 30);
      }
      const sg = k.geometry(), gg = g.geometry();
      sg && solid.parts.push(sg); gg && lit.parts.push(gg);
    }
    const sm = new Mesh(solid.geometry(), toonVC()), lm = new Mesh(lit.geometry(), glowVC());
    sm.castShadow = true; sm.receiveShadow = true;
    lm.material.color.setScalar(0.95);
    this.group.add(sm, lm);
    this.static = [sm, lm];
    for (let k = 0; k < n; k++) this.pods.push(this.makePod(this.spots[k]));
    if (!this.bubbles) {
      const N = MAX * 12, geo = new BufferGeometry();
      geo.setAttribute('position', new BufferAttribute(new Float32Array(N * 3), 3));
      this.bubbles = new Points(geo, new PointsMaterial({ size: 0.09, color: 0xEFFFFF, transparent: true, opacity: 0.75, depthWrite: false, map: softShadowTexture(), sizeAttenuation: true }));
      this.bubbles.frustumCulled = false;
      this.bubbles.renderOrder = 4;
      this.group.add(this.bubbles);
    }
    this.base && this.sync(this.base);
  }

  makePod(s) {
    const holder = new Group();
    holder.position.set(s.x, s.y, s.z);
    holder.rotation.y = s.rot;
    const liq = new Mesh(new CylinderGeometry(LIQ_R, LIQ_R, 1, 26, 1, false).translate(0, 0.5, 0), liquidMaterial());
    liq.position.y = LIQ_Y; liq.scale.y = 0.2; liq.renderOrder = 3;
    const glassGeo = new CylinderGeometry(GLASS_R, GLASS_R, CAP_Y - LIQ_Y, 30, 1, true).translate(0, (CAP_Y - LIQ_Y) / 2, 0);
    const glass = new Mesh(glassGeo, glassMaterial());
    glass.position.y = LIQ_Y; glass.renderOrder = 5;
    const beamMat = new MeshBasicMaterial({ color: READY, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false });
    const beam = new Mesh(new CylinderGeometry(0.7, 0.95, 7, 20, 1, true).translate(0, 3.5, 0), beamMat);
    beam.position.y = CAP_Y + 0.3; beam.visible = false; beam.renderOrder = 7;
    const label = makeLabel();
    label.position.y = CAP_Y + 1.15; label.visible = false;
    holder.add(liq, glass, beam, label);
    this.group.add(holder);
    return { spot: s, holder, liq, glass, beam, label, slot: null, creature: null, species: '', anim: null, seed: Math.random() * 10 };
  }

  dropPod(p) {
    this.group.remove(p.holder);
    p.holder.traverse((o) => { o.geometry?.dispose(); if (o.material && !o.material.userData?.shared) { o.material.map?.dispose?.(); o.material.dispose(); } });
  }

  /** The player's base (baseView), as it came from the server. */
  sync(base) {
    this.base = base;
    if (base?.now) this.offset = base.now - Date.now();
    const level = base?.buildings?.find?.((b) => b.id === 'pod')?.level ?? base?.buildings?.pod ?? 1;
    if (Math.max(1, level) !== this.built) { this.setBuilt(Math.max(1, level)); return; }
    // each stays in the pod it went into; a new one takes the first free pod
    const slots = base?.training || [], placed = new Set();
    const put = (p, t) => {
      placed.add(t?.id);
      p.slot = t;
      const want = t?.species || '';
      if (want !== p.species) this.setOccupant(p, want, t);
      else if (p.creature && t) setStarLook(p.creature, t.fromStar || 1);
    };
    for (const p of this.pods) {
      if (p.anim?.kind === 'emerge') { placed.add(p.slot?.id); continue; }   // let it finish coming out
      const same = p.slot && slots.find((t) => t.id === p.slot.id);
      if (same) put(p, same);
      else { p.slot = null; }
    }
    for (const t of slots) {
      if (placed.has(t.id)) continue;
      const free = this.pods.find((p) => !p.slot && p.anim?.kind !== 'emerge');
      if (free) put(free, t);
    }
    for (const p of this.pods) if (!p.slot && p.anim?.kind !== 'emerge' && p.species) this.setOccupant(p, '', null);
  }

  setOccupant(p, species, slot) {
    // (its mesh is the species' shared one: taken off, not disposed)
    if (p.creature) { p.holder.remove(p.creature); p.creature = null; }
    p.species = species;
    if (!species || !SPECIES[species]) return;
    const c = buildCreature(species, { outline: false });
    setStarLook(c, slot?.fromStar || 1);
    // fit it in the glass, whatever its size: shrink its base and dress it again
    const m = c.userData.model, h = (m?.height || 1) * c.scale.x, w = (m?.size || 1) * c.scale.x;
    const k = Math.min(FIT_UP, FIT_H / h, FIT_W / w);
    if (Math.abs(k - 1) > 0.02) { c.userData.baseScale *= k; const st = c.userData.star; c.userData.star = 0; setStarLook(c, st); }
    c.userData.podH = (m?.height || 1) * c.scale.x;
    c.position.y = LIQ_Y + FLOAT_Y - c.userData.podH / 2;
    c.userData.fit = c.scale.x;
    p.holder.add(c);
    p.creature = c;
    p.anim = { kind: 'arrive', t: 0 };
  }

  /** Collected: the glass lifts, it comes out with its new star. */
  emerge(result) {
    const p = this.pods.find((q) => q.slot && q.slot.id === result?.slotId) || this.pods.find((q) => q.species === result?.species && q.creature);
    if (!p || !p.creature) return false;
    p.anim = { kind: 'emerge', t: 0, star: result.star || 2, done: false };
    return true;
  }

  /** The pod nearest a point, with what is in it, if within reach. */
  /** The species coming out of a pod right now, if one is. */
  emerging() {
    return this.pods.find((p) => p.anim?.kind === 'emerge')?.species || null;
  }

  near(x, z, reach = 4.2) {
    let best = null;
    for (const p of this.pods) {
      const d = Math.hypot(p.spot.x - x, p.spot.z - z);
      if (d < reach && (!best || d < best.d)) best = { d, pod: p, slot: p.slot, ready: !!p.slot && this.left(p.slot) <= 0 };
    }
    return best;
  }

  left(slot) { return slot.readyAt - (Date.now() + this.offset); }

  update(dt, tMs, camera) {
    this.time += dt;
    const t = this.time, bub = this.bubbles?.geometry.attributes.position;
    let bi = 0;
    for (const p of this.pods) {
      const s = p.slot, frac = s ? Math.min(1, Math.max(0, 1 - this.left(s) / Math.max(1, s.readyAt - s.startedAt))) : 0;
      const ready = !!s && frac >= 1;
      const u = p.liq.material.uniforms;
      u.uTime.value = t;
      const el = s ? ELEMENTS[SPECIES[s.species]?.types?.[0]] : null;
      u.uCol.value.set(el?.color ?? IDLE_LIQUID);
      if (!s) u.uCol.value.multiplyScalar(0.55);
      u.uReady.value += ((ready ? 1 : 0) - u.uReady.value) * Math.min(1, dt * 3);
      let fill = s ? 0.3 + 0.7 * frac : 0.12;
      p.glass.material.uniforms.uGlow.value = ready ? 0.6 + 0.4 * Math.sin(t * 3.5) : s ? 0.15 : 0;
      p.glass.material.uniforms.uTint.value.set(ready ? READY : el?.color ?? 0xBFEFFF).lerp(WHITE, 0.45);
      p.beam.visible = ready && p.anim?.kind !== 'emerge';
      p.beam.material.opacity = 0.12 + 0.08 * Math.sin(t * 2.4);
      // the label: who, to how many stars, how long
      p.label.visible = !!s && p.anim?.kind !== 'emerge';
      if (s) paintLabel(p.label, { name: loc(SPECIES[s.species]), from: s.fromStar || 1, to: s.star, left: this.left(s), frac, ready });
      p.label.position.y = CAP_Y + 1.15 + Math.sin(t * 1.4 + p.seed) * 0.05;

      const c = p.creature;
      if (c) {
        const a = p.anim;
        const y0 = Math.max(LIQ_Y + 0.08, LIQ_Y + FLOAT_Y - (c.userData.podH || 1) / 2);
        let y = y0 + Math.sin(t * 1.2 + p.seed) * 0.07, sc = 1, z = 0, rotY = Math.sin(t * 0.35 + p.seed) * 0.5;
        if (a?.kind === 'arrive') {
          a.t += dt;
          sc = ease(a.t / 0.7);
          if (a.t > 0.7) p.anim = null;
        } else if (a?.kind === 'emerge') {
          a.t += dt;
          const T = a.t;
          fill *= 1 - ease(T / 0.6);                       // drains
          p.glass.position.y = LIQ_Y + ease((T - 0.2) / 0.6) * 2.3;   // lifts
          p.glass.material.uniforms.uGlow.value = 1;
          if (T > 0.8 && !a.done) {
            a.done = true;
            setStarLook(c, a.star);
            this.flash(p);
          }
          if (T > 0.8) sc = 1 + Math.max(0, 0.35 * Math.sin(Math.min(1, (T - 0.8) / 0.45) * Math.PI));
          // a hop forward and down beside the pod
          if (T > 1.3) {
            const h = Math.min(1, (T - 1.3) / 0.6);
            z = ease(h) * 1.9; y = y0 + Math.sin(h * Math.PI) * 0.9 - h * y0; rotY = 0;
          }
          if (T > 1.9) { y = Math.abs(Math.sin((T - 1.9) * 7)) * 0.25 * Math.max(0, 1 - (T - 1.9) / 1.1); z = 1.9; rotY = 0; }
          if (T > 3.2) sc *= Math.max(0, 1 - (T - 3.2) / 0.5);
          if (T > 3.7) {
            p.holder.remove(c); p.creature = null; p.species = ''; p.anim = null; p.slot = null;
            p.glass.position.y = LIQ_Y;
            this.base && this.sync(this.base);
          }
        }
        if (p.creature) {
          c.position.set(0, y, z);
          c.rotation.y = rotY;
          const base = c.userData.baseScale * STAR_SCALE[c.userData.star || 1];
          c.scale.setScalar(base * Math.max(0.001, sc));
          animateCreature(c, tMs, a?.kind === 'emerge' && a.t > 1.3 && a.t < 1.9, 1);
          camera && setCreatureLod(c, c.getWorldPosition(TMPV).distanceTo(camera.position));
        }
      }
      p.liq.scale.y = Math.max(0.02, fill * LIQ_H);
      // bubbles rising through the liquid
      if (bub) for (let q = 0; q < 12; q++, bi++) {
        if (!s || p.anim?.kind === 'emerge') { bub.setXYZ(bi, 0, -50, 0); continue; }
        const ph = (t * 0.32 + q / 12 + p.seed) % 1, ang = q * 2.4 + p.seed, r = 0.25 + (q % 4) * 0.13;
        const lx = Math.cos(ang + ph * 2) * r, lz = Math.sin(ang + ph * 2) * r, ly = LIQ_Y + ph * fill * LIQ_H;
        const cr = Math.cos(p.spot.rot), sr = Math.sin(p.spot.rot);
        bub.setXYZ(bi, p.spot.x + lx * cr + lz * sr, p.spot.y + ly, p.spot.z - lx * sr + lz * cr);
      }
    }
    if (bub) { for (; bi < bub.count; bi++) bub.setXYZ(bi, 0, -50, 0); bub.needsUpdate = true; }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / 0.9;
      f.mesh.scale.setScalar(0.4 + k * 4.2);
      f.mesh.material.opacity = Math.max(0, 0.9 * (1 - k));
      f.ring.scale.setScalar(0.5 + k * 3.2);
      f.ring.material.opacity = Math.max(0, 1 - k);
      if (k >= 1) { this.group.remove(f.mesh, f.ring); f.mesh.geometry.dispose(); f.mesh.material.dispose(); f.ring.geometry.dispose(); f.ring.material.dispose(); this.flashes.splice(i, 1); }
    }
  }

  /** A burst of light where the new star lands. */
  flash(p) {
    const at = p.holder.position, col = new Color(READY);
    const mesh = new Mesh(new SphereGeometry(0.5, 16, 10), new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, toneMapped: false }));
    mesh.position.set(at.x, at.y + 1.3, at.z);
    const ring = new Mesh(new RingGeometry(0.8, 1.0, 40), new MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, toneMapped: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.set(at.x, at.y + 0.2, at.z);
    this.group.add(mesh, ring);
    this.flashes.push({ mesh, ring, t: 0 });
  }

  get flashes() { return this._flashes || (this._flashes = []); }
}

const TMPV = new Vector3();
const WHITE = new Color(0xffffff);
