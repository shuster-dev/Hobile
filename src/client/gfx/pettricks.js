/**
 * The little scenes of playing with your creature (shared/tricks.js):
 *
 *   fetch — the trainer throws a ball; the creature runs after it (a bird
 *           takes it out of the air), brings it back, drops it at your feet;
 *   pet   — it comes round in front of you, hops for joy, hearts go up;
 *   treat — a treat tossed up; it jumps (or flies) to catch it and munches.
 *
 * Everything is worked out in the world and put into the pet's own frame
 * (it rides inside the trainer's holder) every frame, so it does not matter
 * that the trainer keeps walking or turning while it plays. The same seed on
 * every screen throws the ball the same way. Emoji float up as sprites — the
 * look the buttons have — drawn once per character onto a small canvas.
 */
import { Box3, CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SRGBColorSpace, SphereGeometry, Sprite, SpriteMaterial, Vector3 } from 'three';

const W = new Vector3(), V = new Vector3(), U = new Vector3();
const rnd = (seed, k) => { const x = Math.sin(seed * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x); };
const ease = (u) => u * u * (3 - 2 * u);

// --- emoji ---------------------------------------------------------------
const EMOJI = new Map();
function emojiTexture(ch) {
  let tex = EMOJI.get(ch);
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.textAlign = 'center', g.textBaseline = 'middle';
  g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  g.fillText(ch, 64, 70);
  tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  EMOJI.set(ch, tex);
  return tex;
}
function emojiSprite(ch, size) {
  const s = new Sprite(new SpriteMaterial({ map: emojiTexture(ch), transparent: true, depthWrite: false, depthTest: false }));
  s.scale.set(size, size, 1);
  s.renderOrder = 20;
  return s;
}

// --- props ----------------------------------------------------------------
const BALL_GEO = new SphereGeometry(0.13, 14, 10);
const BALL_MAT = new MeshStandardMaterial({ color: 0xd8ef3a, roughness: 0.55, emissive: 0x1a2200 });
const SEAM_MAT = new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
function makeBall() {
  const g = new Group(), b = new Mesh(BALL_GEO, BALL_MAT);
  const seam = new Mesh(new CylinderGeometry(0.132, 0.132, 0.022, 18, 1, true), SEAM_MAT);
  seam.rotation.z = 0.6;
  g.add(b, seam);
  return g;
}
const BONE_MAT = new MeshStandardMaterial({ color: 0xf2dcb4, roughness: 0.7 });
const BONE_ROD = new CylinderGeometry(0.045, 0.045, 0.26, 10);
const BONE_KNOB = new SphereGeometry(0.06, 10, 8);
function makeTreat() {
  const g = new Group(), rod = new Mesh(BONE_ROD, BONE_MAT);
  rod.rotation.z = Math.PI / 2;
  g.add(rod);
  for (const x of [-0.13, 0.13]) for (const z of [-0.045, 0.045]) {
    const k = new Mesh(BONE_KNOB, BONE_MAT);
    k.position.set(x, 0, z);
    g.add(k);
  }
  return g;
}

/** Plays tricks for any actor's pet; one per pet at a time. */
export class PetTricks {
  constructor(scene, groundAt, blocked) {
    this.scene = scene;
    this.groundAt = groundAt || (() => 0);
    // is there a wall, a tree, a fountain at x,z (the world's colliders)
    this.blocked = blocked || (() => false);
    this.floats = [];   // emoji going up
    this.loose = [];    // a ball left behind that fades
  }

  /** Start `trick` on this actor's pet. `style` is 'walk' | 'fly' | 'swim'. */
  start(actor, trick, seed = 0, style = 'walk') {
    const pet = actor?.pet;
    if (!pet || actor.mount) return false;
    this.stop(actor);
    actor.holder.updateMatrixWorld(true);
    const box = new Box3().setFromObject(pet.group);
    const h = Math.max(0.35, box.max.y - box.min.y);
    const me = actor.holder.position;
    // the way the trainer faces — or, if a wall or a fountain is right there,
    // the nearest way round that has room for the throw
    const want = trick === 'fetch' ? 5.2 + rnd(seed, 1) * 1.6 : trick === 'treat' ? 2.3 : 1.2;
    const room = (yw) => {
      let far = 0;
      for (let d = 0.8; d <= want + 0.6; d += 0.4) {
        if (this.blocked(me.x + Math.sin(yw) * d, me.z + Math.cos(yw) * d)) break;
        far = d;
      }
      return far;
    };
    let yaw = actor.holder.rotation.y, best = room(yaw), dist = want;
    if (best < want) {
      for (const k of [0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
        const r = room(actor.holder.rotation.y + k);
        if (r > best + 0.3) best = r, yaw = actor.holder.rotation.y + k;
        if (r >= want) break;
      }
      dist = Math.max(trick === 'fetch' ? 1.8 : 1.1, Math.min(want, best - 0.4));
    }
    const fwd = new Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new Vector3(fwd.z, 0, -fwd.x);
    const T = { kind: trick, seed, style, t: 0, h, phase: 'go', pw: pet.holder.getWorldPosition(new Vector3()), fwd, side, yaw: 0, lift: 0, done: false };
    if (trick === 'fetch') {
      const d = dist, off = (rnd(seed, 2) - 0.5) * Math.min(2.4, d * 0.35);
      T.from = me.clone().add(fwd.clone().multiplyScalar(0.35)).add(new Vector3(0, 1.3, 0));
      T.to = me.clone().add(fwd.clone().multiplyScalar(d)).add(side.clone().multiplyScalar(off));
      T.to.y = this.groundAt(T.to.x, T.to.z) + 0.13;
      T.peak = 2.1 + rnd(seed, 3) * 0.6;
      T.ball = makeBall();
      T.ball.position.copy(T.from);
      this.scene.add(T.ball);
    } else if (trick === 'treat') {
      T.from = me.clone().add(fwd.clone().multiplyScalar(0.3)).add(new Vector3(0, 1.25, 0));
      T.to = me.clone().add(fwd.clone().multiplyScalar(Math.min(2.3, dist))).add(side.clone().multiplyScalar((rnd(seed, 4) - 0.5) * 0.6));
      T.to.y = this.groundAt(T.to.x, T.to.z);
      T.peak = 2.4;
      T.ball = makeTreat();
      T.ball.position.copy(T.from);
      this.scene.add(T.ball);
    } else {
      // pet: round in front of the trainer
      T.to = me.clone().add(fwd.clone().multiplyScalar(1.15));
    }
    T.dir = yaw;
    pet.trick = T;
    return true;
  }

  stop(actor) {
    const T = actor?.pet?.trick;
    if (!T) return;
    T.ball && (this.scene.remove(T.ball), T.ball = null);
    actor.pet.trick = null;
    actor.pet.group.userData.baseY = 0;
    actor.pet.group.scale.setScalar(actor.pet.group.userData._s0 || actor.pet.group.scale.x);
    // carry on following from where it is now, not from where it was
    actor.pet.lag.copy(actor.pet.holder.position);
    actor.pet._lp?.copy(actor.pet.lag);
  }

  float(ch, at, { size = 0.55, life = 1.4, rise = 1.1, delay = 0, drift = 0 } = {}) {
    const s = emojiSprite(ch, size);
    s.position.copy(at);
    s.visible = delay <= 0;
    this.scene.add(s);
    this.floats.push({ s, t: -delay, life, rise, size, drift, x0: at.x });
  }

  /**
   * Drive this actor's pet for one frame. Returns false when it has nothing
   * to play (the caller then does the ordinary follow).
   */
  drive(actor, dt, now, animate) {
    const pet = actor.pet, T = pet?.trick;
    if (!T) return false;
    if (actor.mount) return this.stop(actor), false;
    T.t += dt;
    const me = actor.holder.position, pw = T.pw;
    const ground = (p) => this.groundAt(p.x, p.z);
    let speed = 0, face = null, lift = 0;
    // too far behind (the trainer ran off, or a warp): call it a day
    if (Math.hypot(pw.x - me.x, pw.z - me.z) > 16 || T.t > 9) return this.end(actor), false;

    const moveTo = (target, v, stopAt = 0.25) => {
      V.set(target.x - pw.x, 0, target.z - pw.z);
      const d = V.length();
      if (d <= stopAt) return true;
      const step = Math.min(d - stopAt * 0.5, v * dt);
      V.multiplyScalar(step / d);
      pw.add(V);
      speed = v, face = Math.atan2(V.x, V.z);
      return d - step <= stopAt;
    };
    const facePlayer = () => { face = Math.atan2(me.x - pw.x, me.z - pw.z); };
    const fly = T.style === 'fly';

    if (T.kind === 'fetch') {
      const flight = 0.8;
      // the ball: thrown, then a couple of bounces, then still (or carried)
      if (T.phase !== 'carry' && T.phase !== 'drop') {
        const u = Math.min(1, T.t / flight);
        if (u < 1) {
          T.ball.position.lerpVectors(T.from, T.to, u);
          T.ball.position.y = T.from.y + (T.to.y - T.from.y) * u + Math.sin(u * Math.PI) * T.peak;
        } else {
          const b = T.t - flight, bounce = Math.max(0, Math.sin(b * 9) * Math.exp(-b * 4) * 0.5);
          W.copy(T.to).add(U.copy(T.fwd).multiplyScalar(Math.min(0.7, b * 0.9)));
          T.ball.position.set(W.x, ground(W) + 0.13 + Math.abs(bounce), W.z);
        }
        T.ball.rotation.x += dt * 9;
      }
      if (T.phase === 'go' && T.t > 0.18) T.phase = 'chase';
      if (T.phase === 'chase') {
        const b = T.ball.position;
        if (fly) {
          // up after it, and take it out of the air if it can
          const reached = moveTo(b, 8.5, 0.35);
          const want = Math.max(0, b.y - ground(pw) - T.h * 0.45);
          T.lift += (want - T.lift) * Math.min(1, dt * 6);
          lift = T.lift;
          if (reached && Math.abs(want - T.lift) < 0.5) T.phase = 'carry', T.caughtAt = T.t, this.float('✨', b.clone(), { size: 0.4, life: 0.8 });
        } else if (moveTo(b, 7.2, 0.45) && T.t > flight * 0.9) {
          T.phase = 'carry', T.caughtAt = T.t;
        }
      } else if (T.phase === 'carry') {
        T.lift += (0 - T.lift) * Math.min(1, dt * 3);
        lift = T.lift;
        // the trainer may have turned: bring it to wherever they face now
        const yaw = actor.holder.rotation.y;
        W.set(me.x + Math.sin(yaw) * 1.15, 0, me.z + Math.cos(yaw) * 1.15);
        if (moveTo(W, 5.6, 0.3)) T.phase = 'drop', T.dropAt = T.t;
      } else if (T.phase === 'drop') {
        facePlayer();
        const k = T.t - T.dropAt;
        lift = Math.abs(Math.sin(k * 8)) * 0.18 * Math.max(0, 1 - k);
        if (!T.hearts) {
          T.hearts = true;
          const top = pw.clone().setY(ground(pw) + T.h + 0.3);
          this.float('❤️', top, { size: 0.5 });
          this.float('🎾', top.clone().add(U.set(0.25, 0.1, 0)), { size: 0.38, delay: 0.25 });
          // the ball let go at the trainer's feet, to fade there
          const pos = T.ball.position.clone();
          pos.y = ground(pos) + 0.13;
          T.ball.position.copy(pos);
          this.loose.push({ m: T.ball, t: 0 });
          T.ball = null;
        }
        if (k > 0.9) return this.end(actor), false;
      }
      if (T.ball && T.phase === 'carry') {
        // in its mouth: in front of it, at about two thirds of its height
        const yawW = actor.holder.rotation.y + (pet.holder.rotation.y || 0);
        T.ball.position.set(pw.x + Math.sin(yawW) * 0.32, ground(pw) + lift + T.h * 0.6, pw.z + Math.cos(yawW) * 0.32);
      }
    } else if (T.kind === 'treat') {
      const flight = 1.05, u = Math.min(1, T.t / flight);
      if (T.phase === 'go' || T.phase === 'chase') {
        T.ball.position.lerpVectors(T.from, T.to, u);
        T.ball.position.y = T.from.y + (T.to.y + 0.1 - T.from.y) * u + Math.sin(u * Math.PI) * T.peak;
        T.ball.rotation.z += dt * 7;
        T.phase = 'chase';
        const at = moveTo(T.to, 5.5, 0.2);
        facePlayer();
        // a jump to meet it as it comes down (a bird just goes up to it)
        const toCatch = flight * 0.78 - T.t;
        if (fly) {
          const want = Math.max(0, T.ball.position.y - ground(pw) - T.h * 0.5);
          T.lift += (want - T.lift) * Math.min(1, dt * 5), lift = T.lift;
        } else if (at && toCatch < 0.3) {
          lift = Math.max(0, Math.sin(Math.min(1, (0.3 - toCatch) / 0.6) * Math.PI)) * 0.9;
        }
        if (T.t >= flight * 0.78) {
          T.phase = 'munch', T.munchAt = T.t;
          this.scene.remove(T.ball), T.ball = null;
          this.float('😋', pw.clone().setY(ground(pw) + T.h + 0.35), { size: 0.55, life: 1.5 });
        }
      } else if (T.phase === 'munch') {
        const k = T.t - T.munchAt;
        T.lift += (0 - T.lift) * Math.min(1, dt * 5), lift = T.lift;
        facePlayer();
        // three bites
        const s0 = pet.group.userData._s0 ||= pet.group.scale.x;
        const bite = Math.max(0, Math.sin(k * 14)) * 0.08 * (k < 1.2 ? 1 : 0);
        pet.group.scale.set(s0 * (1 + bite * 0.6), s0 * (1 - bite), s0 * (1 + bite * 0.6));
        if (!T.crumbs && k > 0.3) {
          T.crumbs = true;
          this.float('✨', pw.clone().setY(ground(pw) + T.h * 0.6), { size: 0.3, life: 0.7, rise: 0.4 });
        }
        if (k > 1.5) return this.end(actor), false;
      }
    } else {
      // pet
      if (T.phase === 'go') {
        const yaw = actor.holder.rotation.y;
        W.set(me.x + Math.sin(yaw) * 1.15, 0, me.z + Math.cos(yaw) * 1.15);
        if (moveTo(W, 4.5, 0.25) || T.t > 1.4) T.phase = 'joy', T.joyAt = T.t;
      } else {
        const k = T.t - T.joyAt;
        facePlayer();
        lift = Math.abs(Math.sin(k * 7.5)) * 0.35 * Math.max(0, 1 - k / 1.6);
        if (!T.h1) {
          T.h1 = true;
          const top = pw.clone().setY(ground(pw) + T.h + 0.25);
          for (let i = 0; i < 4; i++) this.float(i === 2 ? '💕' : '❤️', top.clone().add(U.set((rnd(T.seed, 10 + i) - 0.5) * 0.7, 0, (rnd(T.seed, 20 + i) - 0.5) * 0.4)), { size: 0.36 + i * 0.04, delay: i * 0.22, drift: (rnd(T.seed, 30 + i) - 0.5) * 0.5 });
        }
        if (k > 1.9) return this.end(actor), false;
      }
    }

    // into the pet's frame (it lives inside the trainer's holder)
    pw.y = ground(pw);
    actor.holder.updateMatrixWorld(true);
    W.copy(pw);
    actor.holder.worldToLocal(W);
    pet.holder.position.copy(W);
    if (face != null) {
      const want = face - actor.holder.rotation.y;
      let d = ((want - pet.holder.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
      pet.holder.rotation.y += d * Math.min(1, dt * 12);
    }
    pet.group.userData.baseY = lift;
    pet.group.userData.groundSpeed = speed;
    animate?.(pet.group, now + 400, speed > 0.4 || fly && lift > 0.2);
    return true;
  }

  end(actor) {
    this.stop(actor);
  }

  /** Emoji going up, balls fading: once a frame. */
  tick(dt) {
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.t += dt;
      if (f.t < 0) continue;
      f.s.visible = true;
      const u = f.t / f.life;
      f.s.position.y += f.rise * dt / f.life;
      f.s.position.x = f.x0 + Math.sin(f.t * 3) * 0.08 + f.drift * u;
      const pop = Math.min(1, f.t / 0.18), sc = f.size * (0.6 + 0.4 * pop + (pop < 1 ? 0 : Math.sin(Math.min(1, (f.t - 0.18) * 4) * Math.PI) * 0.12));
      f.s.scale.set(sc, sc, 1);
      f.s.material.opacity = u < 0.7 ? 1 : Math.max(0, 1 - (u - 0.7) / 0.3);
      if (u >= 1) { this.scene.remove(f.s); f.s.material.dispose(); this.floats.splice(i, 1); }
    }
    for (let i = this.loose.length - 1; i >= 0; i--) {
      const l = this.loose[i];
      l.t += dt;
      if (l.t > 1.2) l.m.scale.setScalar(Math.max(0.01, 1 - (l.t - 1.2) / 0.5));
      if (l.t > 1.7) { this.scene.remove(l.m); this.loose.splice(i, 1); }
    }
  }
}
