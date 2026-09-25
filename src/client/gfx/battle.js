import { AdditiveBlending, BoxGeometry, DodecahedronGeometry, MeshStandardMaterial, Object3D, PlaneGeometry, Box3, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Shape, ShapeGeometry, DynamicDrawUsage, Float32BufferAttribute, FogExp2, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, OctahedronGeometry, PerspectiveCamera, PointLight, Points, PointsMaterial, Quaternion, RingGeometry, Scene, ShaderMaterial, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { Audio } from '../audio.js';
import { QUALITY, glowMat, makeEnvironment, makeLights, makeRenderer, makeSky, mat, mergeByMaterial, sizeRenderer, softShadowTexture, xf2 } from './core.js';
import { animateCreature, buildAvatar, buildCreature } from './creatures.js';
import { ELEMENTS, MOVES, SPECIES } from '../../shared/gamedata.js';
import { MEADOW, flowerBase, flowerHead, meadowTuft, thinMaterial } from './world.js';

var audio = new Audio();

var np = new Vector3(0.35, 0.8, 0.5).normalize(),
  ARENA_R = 9.5,
  SIDES = ["a", "b"],
  // The two sides used to stand nearly seven metres apart, which put the
  // opponent so far up the arena that it read as a speck. A battle is a
  // face-off; the camera has to be able to hold both of them.
  SIDE_Z = {
    a: 2.3,
    b: -2.4
  },
  // A diagonal face-off. On a phone held upright the two sides used to stand
  // on one line down the middle of the screen, so your own creature sat in
  // front of the one you were fighting and every attack went behind it. Offset
  // like the handheld games — yours near and to one side, theirs far and to the
  // other — and both are always in view, facing each other.
  SIDE_X = {
    a: -0.95,
    b: 0.95
  },
  FACE_TILT = Math.atan2(1.9, 4.7),
  SIDE_DIR = {
    a: 1,
    b: -1
  },
  SLOT_POS = [[-1.95, 1.85], [1.95, 1.85], [-1, 2.8], [1, 2.8], [0, 3.5]],
  ip = [1.75, 1.15],
  sp = 0.78,
  TRAINER_ID = "__trainer",
  nt = new Vector3(),
  nr = new Vector3(),
  ir = new Box3(),
  rp = (i, e) => i.slot - e.slot,
  STAR_SHAPE = (() => {
    let q = new Shape();
    for (let k = 0; k < 10; k++) {
      let r = k % 2 ? 0.045 : 0.11, a = k / 10 * Math.PI * 2 + Math.PI / 2;
      k ? q.lineTo(Math.cos(a) * r, Math.sin(a) * r) : q.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return q.closePath(), q;
  })(),
  STAR_MAT = new MeshBasicMaterial({ color: 0xffd84a, side: DoubleSide, depthWrite: !1, transparent: !0 }),
  dizzyStars = () => {
    let g = new Group();
    for (let k = 0; k < 3; k++) {
      let m = new Mesh(new ShapeGeometry(STAR_SHAPE), STAR_MAT), a = k / 3 * Math.PI * 2;
      m.position.set(Math.cos(a) * 0.32, Math.sin(k * 2.1) * 0.05, Math.sin(a) * 0.32), m.renderOrder = 5, g.add(m);
    }
    return g;
  },
  BattleView = class {
    constructor(e) {
      this.canvas = e, this.renderer = makeRenderer(e), this.scene = new Scene(), this.camera = new PerspectiveCamera(40, 1, 0.1, 1200), this.baseCam = new Vector3(-1.4, 7.2, 14.3), this.focus = new Vector3(0.35, 1.3, -0.5), this.targetCam = this.baseCam.clone(), this.targetFocus = this.focus.clone(), this.camPos = this.baseCam.clone(), this.camAim = this.focus.clone(), this.camOffset = new Vector3(), this.aimOffset = new Vector3(), this.camera.position.copy(this.baseCam), this.camera.lookAt(this.focus), this.actors = new Map(), this.effects = [], this.shake = 0, this.time = 0, this.trainer = null, this.appearance = null, this.myTrainerId = null, this.trainerFront = !1, this.dim = 0, this.frozenUntil = 0, this.sphereFx = null, this.roleBench = new Map(), this.roleSlot = new Map(), this.activeBySide = {
        a: null,
        b: null
      }, this._seen = new Set(), this._stale = [], this._side = {
        a: [],
        b: []
      }, this._field = {
        a: [],
        b: []
      }, this._bench = {
        a: [],
        b: []
      }, this.lights = makeLights(this.scene, {
        sunDir: np,
        sunColor: 16773336,
        skyColor: 10405119,
        groundColor: 2764602,
        shadowRadius: 16
      }), this.lightBase = {
        sun: this.lights.sun.intensity,
        hemi: this.lights.hemi.intensity
      }, this.arena = new Group(), this.scene.add(this.arena), this.adapt = sizeRenderer(this.renderer), this.vignette = hb(), this.camera.add(this.vignette), this.scene.add(this.camera), this.resize(), window.addEventListener("resize", () => this.resize());
    }
    resize() {
      let e = this.canvas.clientWidth || window.innerWidth,
        t = this.canvas.clientHeight || window.innerHeight;
      if (!e || !t) return;
      this.renderer.setSize(e, t, !1), this.camera.aspect = e / t, this.camera.updateProjectionMatrix();
      let n = Math.tan(this.camera.fov * Math.PI / 360);
      this.vignette.scale.set(n * this.camera.aspect * 1.5, n * 1.5, 1);
    }
    setTheme(e = "verdant", t = !1, ctx = {}) {
      let s = (ELEMENTS[e] || ELEMENTS.verdant).color;
      this.accent = s;
      let stage = t ? "" : ctx.stage || "",
        r = `${e}|${t ? 1 : 0}|${stage}|${ctx.element || ""}|${ctx.zone || ""}`;
      if (this.themeKey === r && this.arena.children.length) return;
      this.themeKey = r, this.ringHostile = null;
      for (let y = this.arena.children.length - 1; y >= 0; y--) {
        let M = this.arena.children[y];
        this.arena.remove(M), fadeTree(M);
      }
      this.sky && (this.scene.remove(this.sky), fadeTree(this.sky));
      let o = t ? {
        top: 1183010,
        horizon: 2891591,
        ground: 525840,
        sun: 6967200
      } : {
        // Out in the world a fight happens in daylight. The open-air arena was
        // a night void — navy sky, slate floor — which made every wild
        // encounter in a sunny meadow feel like a dungeon. Dungeons keep dark.
        top: 5941488,
        horizon: 13627391,
        ground: 10277498,
        sun: 16767400
      };
      this.sky = makeSky({
        ...o,
        sunDir: np
      }), this.scene.add(this.sky), this.scene.environment && this.scene.environment.dispose(), this.scene.environment = makeEnvironment(this.renderer, this.sky), this.scene.fog = new FogExp2(t ? 1446446 : 13627391, t ? 0.011 : 0.0075), this.lights.sun.intensity = t ? 1.9 : 2.25, this.lights.hemi.color.set(o.horizon), this.lightBase.sun = this.lights.sun.intensity, this.lightBase.hemi = this.lights.hemi.intensity;
      // A wild fight in the field, or a town fight in the stadium; the rune pit
      // below is only for dungeons now.
      if (stage) {
        this.runeRing = this.innerRing = this.lamp = this.motes = null, this.arena.add(stage === "stadium" ? buildStadium(s) : buildClearing(ctx.palette, s, ctx.element));
        return;
      }
      let a = [],
        l = mat(t ? 3814232 : 5213758, {
          roughness: 0.92
        }),
        c = mat(t ? 4668526 : 15128504, {
          roughness: 0.86
        });
      a.push({
        geo: new CylinderGeometry(ARENA_R, ARENA_R + 0.4, 0.7, 64),
        mat: l
      }), a.push({
        geo: xf2(new CylinderGeometry(ARENA_R + 1.5, ARENA_R + 2.2, 0.5, 64), {
          y: -0.5
        }),
        mat: c
      });
      for (let y of [ARENA_R * 0.34, ARENA_R * 0.62, ARENA_R * 0.86]) a.push({
        geo: xf2(new TorusGeometry(y, 0.05, 6, 64), {
          y: 0.36,
          rx: Math.PI / 2
        }),
        mat: c
      });
      let h = mergeByMaterial(a, {
        castShadow: !1
      });
      h.receiveShadow = !0, this.arena.add(h);
      let d = new Mesh(new TorusGeometry(ARENA_R - 0.55, 0.1, 10, 96), glowMat(s, 0.5));
      d.rotation.x = Math.PI / 2, d.position.y = 0.37, this.arena.add(d), this.runeRing = d;
      let u = new Mesh(new RingGeometry(ARENA_R - 3.6, ARENA_R - 3.42, 80), glowMat(s, 0.35));
      u.rotation.x = -Math.PI / 2, u.position.y = 0.375, this.arena.add(u), this.innerRing = u;
      let f = mat(t ? 4866160 : 15590352, {
          roughness: 0.88
        }),
        p = [],
        x = [];
      for (let y = 0; y < 8; y++) {
        let M = y / 8 * Math.PI * 2 + 0.4,
          P = Math.cos(M) * (ARENA_R + 2.6),
          A = Math.sin(M) * (ARENA_R + 2.6);
        p.push({
          geo: xf2(new CylinderGeometry(0.5, 0.62, 0.5, 12), {
            x: P,
            y: 0.25,
            z: A
          }),
          mat: f
        }), p.push({
          geo: xf2(new CylinderGeometry(0.3, 0.36, 4, 12), {
            x: P,
            y: 2.4,
            z: A
          }),
          mat: f
        }), p.push({
          geo: xf2(new CylinderGeometry(0.46, 0.34, 0.42, 12), {
            x: P,
            y: 4.6,
            z: A
          }),
          mat: f
        }), x.push([P, 5, A]);
      }
      let g = mergeByMaterial(p, {
        castShadow: !0
      });
      g.receiveShadow = !0, this.arena.add(g);
      let m = glowMat(s, 0.55),
        v = mergeByMaterial(x.map(([y, M, P]) => ({
          geo: xf2(new SphereGeometry(0.22, 12, 10), {
            x: y,
            y: M,
            z: P
          }),
          mat: m
        })), {
          castShadow: !1
        });
      this.arena.add(v);
      let E = new PointLight(s, 6, 30, 2);
      E.position.set(0, 6.5, 0), this.arena.add(E), this.lamp = E;
      let _ = QUALITY.tier === "low" ? 40 : 120,
        S = new BufferGeometry(),
        b = new Float32Array(_ * 3);
      for (let y = 0; y < _; y++) {
        let M = Math.random() * Math.PI * 2,
          P = Math.random() * (ARENA_R + 2);
        b[y * 3] = Math.cos(M) * P, b[y * 3 + 1] = 0.5 + Math.random() * 6, b[y * 3 + 2] = Math.sin(M) * P;
      }
      S.setAttribute("position", new BufferAttribute(b, 3));
      let T = new Points(S, new PointsMaterial({
        color: s,
        size: 0.09,
        transparent: !0,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: !1
      }));
      this.arena.add(T), this.motes = T;
    }
    setTrainer(e, t) {
      this.appearance = e || {}, typeof t == "string" && t && (this.myTrainerId = t);
      let n = this.myTrainerId && this.actors.get(this.myTrainerId) || this.actors.get(TRAINER_ID);
      if (n) {
        this.reskinTrainer(n);
        return;
      }
      let s = this.spawnActor({
        id: TRAINER_ID,
        side: "a",
        kind: "trainer",
        species: "",
        hp: 1,
        maxHp: 1
      });
      s.ghost = !0, s.benched = !0, this.relayout();
    }
    reskinTrainer(e) {
      let t = buildAvatar(this.appearance || {});
      t.userData.phase = e.group.userData.phase || 0, e.holder.remove(e.group), fadeTree(e.group), e.mats = null, e.flashMats = null, e.holder.add(t), e.group = t, this.trainer && this.trainer.actorId === e.id && (this.trainer.avatar = t);
    }
    sync(e, t) {
      let n = this._side.a,
        s = this._side.b;
      n.length = 0, s.length = 0;
      for (let a = 0; a < e.length; a++) {
        let l = e[a];
        l.side === "a" ? n.push(l) : l.side === "b" && s.push(l);
      }
      this.deriveRoles(e), this._seen.clear();
      for (let a of SIDES) {
        let l = a === "a" ? n : s;
        for (let c = 0; c < l.length; c++) this.touchActor(l[c], t);
      }
      let r = this._stale;
      r.length = 0;
      for (let a of this.actors.keys()) !this._seen.has(a) && !this.actors.get(a).ghost && r.push(a);
      for (let a = 0; a < r.length; a++) this.retire(r[a]);
      let o = this.sphereFx;
      if (o && (Date.now() - (o.lastStep || o.bornAt) > 2500 || o.target && !this.actors.has(o.target.id))) {
        let a = this.effects.indexOf(o);
        a >= 0 && this.effects.splice(a, 1), this.finishSphere(o);
      }
      this.relayout();
    }
    deriveRoles(e) {
      let t = this.roleBench,
        n = this.roleSlot;
      t.clear(), n.clear();
      let s = e.length > 0;
      for (let r = 0; r < e.length; r++) if (typeof e[r].benched != "boolean") {
        s = !1;
        break;
      }
      if (s) {
        for (let r = 0; r < e.length; r++) {
          let o = e[r];
          t.set(o.id, o.benched), n.set(o.id, Number.isFinite(o.slot) ? o.slot : 0);
        }
        return;
      }
      for (let r of SIDES) {
        let o = this._side[r],
          a = this.activeBySide[r],
          l = !1,
          c = null,
          h = 0;
        for (let d = 0; d < o.length; d++) {
          let u = o[d];
          if (u.id === a && (l = !0), u.kind === "trainer") {
            n.set(u.id, -1);
            continue;
          }
          n.set(u.id, h++), c === null && u.hp > 0 && (c = u.id);
        }
        l || (a = c, this.activeBySide[r] = a);
        for (let d = 0; d < o.length; d++) {
          let u = o[d];
          t.set(u.id, u.id !== a);
        }
      }
    }
    touchActor(e, t) {
      this._seen.add(e.id);
      let n = this.actors.get(e.id);
      n && (n.species !== e.species || n.kind !== e.kind) && (this.retire(e.id), n = null), n || (n = this.spawnActor(e)), n.side = e.side, n.hp = e.hp, n.maxHp = e.maxHp, n.level = e.level, n.isYou = e.id === t;
      let s = this.roleBench.get(e.id);
      n.benched = s === void 0 ? n.benched : s;
      let r = this.roleSlot.get(e.id);
      n.slot = r === void 0 ? n.slot : r;
      let o = e.hp <= 0;
      return o !== n.downed && (n.downed = o, o ? this.onFaint?.(n) : this.puff(nt.copy(n.holder.position).setY(0.8), 10223561, 10)), n.kind === "trainer" && e.side === "a" && this.claimTrainer(n), n;
    }
    spawnActor(e) {
      let t = new Group(),
        n = e.kind === "trainer",
        s = n ? buildAvatar(this.appearance || {}) : buildCreature(e.species, {
          hi: !0
        });
      s.userData.phase = lb(e.id), ir.setFromObject(s);
      let r = Number.isFinite(ir.max.y) ? Math.max(0.6, ir.max.y) : 1.6,
        o = Math.max(0.45, Math.max(ir.max.x - ir.min.x, ir.max.z - ir.min.z) * 0.5),
        a = softShadowTexture(n ? 0.5 : Math.min(2.6, o * 1.1), 0.4);
      t.add(s, a), this.scene.add(t);
      let l = {
        id: e.id,
        holder: t,
        group: s,
        shadow: a,
        species: e.species,
        kind: e.kind,
        side: e.side,
        hp: e.hp,
        maxHp: e.maxHp,
        level: e.level || 1,
        home: new Vector3(),
        faceY: e.side === "a" ? Math.PI : 0,
        targetScale: 1,
        slot: 0,
        benched: !1,
        downed: e.hp <= 0,
        downK: e.hp <= 0 ? 1 : 0,
        downApplied: -1,
        height: r,
        lock: 0,
        react: 0,
        walking: 0,
        fresh: !0,
        hidden: !1,
        shadowOn: !0,
        mats: null,
        flashMats: null
      };
      return this.actors.set(e.id, l), n && e.side === "a" && this.claimTrainer(l), l;
    }
    claimTrainer(e) {
      if (this.trainer && this.trainer.actorId === e.id || this.myTrainerId && this.myTrainerId !== e.id || e.id === TRAINER_ID) return;
      let t = this.actors.get(TRAINER_ID);
      t && t !== e && this.retire(TRAINER_ID), this.myTrainerId = e.id, this.trainer = {
        holder: e.holder,
        avatar: e.group,
        actorId: e.id
      };
    }
    retire(e) {
      let t = this.actors.get(e);
      t && (this.scene.remove(t.holder), fadeTree(t.holder), this.actors.delete(e), this.trainer && this.trainer.actorId === e && (this.trainer = null), this.myTrainerId === e && (this.myTrainerId = null));
    }
    /**
     * A battle is a portrait, not a diorama.
     *
     * A creature that stands knee-high in the world is correct at world scale
     * and unreadable across an arena. Small creatures are brought up towards
     * being a subject the camera can see. Nothing is ever shrunk: a boss that
     * fills the frame is the entire point of a boss.
     */
    heroScale(e) {
      if (e.kind === "trainer") return 1;
      // Small creatures are drawn up toward a readable size, and the far side
      // a little larger again, so a pebble-sized foe is not a speck.
      let t = e.height || 1.6;
      return Math.min(1.9, Math.max(1, (1.6 / t) ** 0.5)) * (e.side === "b" ? 1.18 : 1);
    }
    relayout() {
      for (let s of SIDES) {
        let r = this._field[s],
          o = this._bench[s];
        r.length = 0, o.length = 0;
        let a = null;
        for (let u of this.actors.keys()) {
          let f = this.actors.get(u);
          if (f.side === s) {
            if (f.kind === "trainer" && f.benched) {
              a = f;
              continue;
            }
            (f.benched ? o : r).push(f);
          }
        }
        r.sort(rp), o.sort(rp);
        let l = 0;
        for (let u = 0; u < r.length; u++) r[u].downed || l++;
        let c = l > 1 ? Math.min(2.4, 4.6 / (l - 1)) : 0,
          h = 0,
          d = 0;
        for (let u = 0; u < r.length; u++) {
          let f = r[u];
          f.targetScale = this.heroScale(f), f.faceY = s === "a" ? Math.PI - FACE_TILT : -FACE_TILT, f.downed ? (f.home.set(SIDE_X[s] + (2.2 + d * 1.2) * SIDE_DIR[s], 0.35, SIDE_Z[s] - 0.6 * SIDE_DIR[s]), d++) : (f.home.set(SIDE_X[s] + (h - (l - 1) / 2) * c, 0.35, SIDE_Z[s]), h++);
        }
        for (let u = 0; u < o.length; u++) {
          let f = o[u];
          slotPosition(u, nt), f.home.set(nt.x + SIDE_X[s] * 0.6, 0.35, SIDE_Z[s] + nt.z * SIDE_DIR[s]), f.targetScale = sp * this.heroScale(f), f.faceY = (s === "a" ? Math.PI : 0) - Math.sign(nt.x) * 0.24 * SIDE_DIR[s];
        }
        a && (a.home.set(ip[0] * SIDE_DIR[s], 0.35, SIDE_Z[s] + ip[1] * SIDE_DIR[s]), a.targetScale = 1, a.faceY = (s === "a" ? Math.PI : 0) - 0.3 * SIDE_DIR[s]);
      }
      // A fainted creature lies on the open side of its own half, where it can
      // be seen — not in the near corner, which is under the health cards.
      let e = this.myTrainerId ? this.actors.get(this.myTrainerId) : null;
      this.trainerFront = !!e && e.kind === "trainer" && !e.benched;
      let t = 1.8;
      for (let s of this.actors.keys()) {
        let r = this.actors.get(s),
          o = !r.benched && !r.downed;
        o && r.height > t && (t = r.height), o !== r.shadowOn && (r.shadowOn = o, r.group.traverse(a => {
          a.isMesh && !a.userData.noOutline && (a.castShadow = o);
        }));
      }
      // Low and close, over your creature's shoulder: 16.6m back made the far
      // side a speck on a narrow screen. Big things still push the camera out —
      // a boss that fills the frame is the point of a boss.
      let n = Math.min(6.5, Math.max(0, t - 2.4));
      // A longer lens from further back: your creature stays the size it was
      // and the one across from you grows, which is how the handheld games get
      // both into a tall screen at a size you can read.
      this.targetFocus.set(0.35, 1.3 + n * 0.4, -0.5), this.targetCam.set(-1.4, 7.2 + n * 0.6, 14.3 + n * 1.2);
    }
    playEvent(e) {
      let t = this.actors.get(e.target),
        n = this.actors.get(e.actor);
      if (e.kind === "switch") {
        this.playSwitch(e);
        return;
      }
      if (e.kind === "captureStart") {
        this.beginCapture(e);
        return;
      }
      if (e.kind === "capture") {
        this.resolveCapture(e);
        return;
      }
      if (e.kind === "trainerHit") {
        this.playTrainerHit(e, t);
        return;
      }
      if (e.kind === "end") {
        this.endCapture();
        return;
      }
      if (e.kind === "hit" && t) {
        let s = MOVES[e.skill],
          r = s?.type || null,
          o = r ? ELEMENTS[r].color : 14477055,
          a = fxFor(r),
          l = !!s && s.kind === "special";
        n && (l ? (this.telegraph(n, o, a), this.effects.push({
          kind: "delayed",
          t: 0,
          at: 0.16,
          fn: () => this.projectile(n, t, o, a, s.aoe)
        })) : this.melee(n, t, o, a));
        let c = n && l ? 0.42 : 0.14;
        this.effects.push({
          kind: "delayed",
          t: 0,
          at: c,
          fn: () => {
            this.impact(t, o, a, e.crit, e.eff), this.shake = Math.max(this.shake, Math.min(0.55, 0.14 + (e.crit ? 0.22 : 0) + (e.eff > 1 ? 0.1 : 0))), this.rally(t.side, e.crit ? 1 : 0.6);
          }
        });
      } else e.kind === "heal" && t ? (this.column(t, 7334042, 1), this.sparkle(t, 10223561, 1.2)) : e.kind === "buff" && t ? (this.column(t, 10147839, 1.2), this.rally(t.side, 0.5)) : e.kind === "miss" && t ? this.puff(nt.copy(t.holder.position).setY(1.2), 12568532, 10) : e.kind === "faint" && t && this.fall(t);
    }
    rally(e, t = 1) {
      for (let n of this.actors.keys()) {
        let s = this.actors.get(n);
        s.side !== e || s.downed || (s.react = Math.max(s.react, t * (s.benched ? 0.85 : 0.4)));
      }
    }
    fall(e) {
      if (e.downed && e.downK > 0.5) return;
      e.downed = !0, audio.sfx("hurt"), this.puff(nt.copy(e.holder.position).setY(0.6), 9344936, 14);
      let t = new Mesh(ringGeo(), fxMat(7041926, 0.32));
      t.rotation.x = -Math.PI / 2, t.position.set(e.holder.position.x, 0.42, e.holder.position.z), this.scene.add(t), this.effects.push({
        kind: "ring",
        mesh: t,
        t: 0,
        life: 0.7,
        spin: 0.4,
        from: 0.4,
        to: 1.9,
        peak: 0.32,
        ease: 3
      });
    }
    playSwitch(e) {
      let t = e.side === "b" ? "b" : "a",
        n = e.out ? this.actors.get(e.out) : null,
        s = e.in ? this.actors.get(e.in) : null;
      if (this.activeBySide[t] = e.in || null, n && (n.benched = !0), s && (s.benched = !1), this.relayout(), n && (n.lock++, n.downed ? this.effects.push({
        kind: "withdraw",
        actor: n,
        t: 0,
        life: 0.6,
        recall: !1
      }) : (this.recallBeam(n), this.effects.push({
        kind: "withdraw",
        actor: n,
        t: 0,
        life: 0.42,
        recall: !0
      }), audio.sfx("suck"))), !!s) {
        if (s.kind === "trainer") {
          this.trainerStepUp(s);
          return;
        }
        s.lock++, s.walking = 1, this.effects.push({
          kind: "entrance",
          actor: s,
          t: 0,
          life: 0.44,
          from: s.holder.position.clone(),
          scale0: s.holder.scale.x || sp
        }), this.camPunch(s, 0.75);
      }
    }
    recallBeam(e) {
      let t = new Mesh(beamGeo(), fxMat(speciesColor(e.species), 0.5, 0.45));
      t.position.copy(e.holder.position).setY(0.42), t.scale.set(0.9, 0.8, 0.9), this.scene.add(t), this.effects.push({
        kind: "ring",
        mesh: t,
        t: 0,
        life: 0.42,
        from: 0.9,
        to: 0.25,
        peak: 0.5,
        ease: 2
      });
    }
    trainerStepUp(e) {
      e.lock++, e.walking = 1, this.effects.push({
        kind: "stepUp",
        actor: e,
        t: 0,
        life: 1,
        from: e.holder.position.clone()
      }), audio.sfx("bossRoar"), this.camPunch(e, 1.25), this.flashVignette(16733744, 0.8, 1.1);
    }
    playTrainerHit(e, t) {
      let n = Math.min(1, (e.dmg || 0) / Math.max(24, t?.maxHp || 90));
      this.shake = Math.max(this.shake, Math.min(1.1, 0.44 + n * 0.66)), this.flashVignette(16723231, 0.45 + n * 0.55, 0.5), audio.sfx("hurt"), t && (this.flash(t, 16734794), this.knock(t), this.rally(t.side, 0.9));
    }
    melee(e, t, n, s) {
      let r = e.home.clone(),
        o = t.home.clone().sub(r).setY(0).normalize();
      this.effects.push({
        kind: "dash",
        actor: e,
        t: 0,
        from: r,
        dir: o
      });
      let a = t.holder.position.clone().add(new Vector3(0, 1.1, 0));
      this.effects.push({
        kind: "delayed",
        t: 0,
        at: 0.05,
        fn: () => this.slashArc(a, o, n, s)
      }), this.effects.push({
        kind: "delayed",
        t: 0,
        at: 0.11,
        fn: () => this.streakBurst(a, n, s, 0.95)
      });
    }
    projectile(e, t, n, s, r) {
      let o = e.holder.position.clone().add(new Vector3(0, 1.15, 0)),
        a = t.holder.position.clone().add(new Vector3(0, 1.05, 0)),
        l = new Group();
      l.add(new Mesh(_b(), fxMat(16772300, 0.36))), l.add(new Mesh(bb(), fxMat(n, 0.34)));
      let c = new Mesh(flashGeo(), fxMat(n, 0.3, 0.4));
      c.scale.setScalar(0.65), l.add(c), l.position.copy(o), this.scene.add(l);
      let h = new PointLight(n, 2, 6, 2);
      l.add(h), this.shardBurst(o, n, s, 0.45), this.effects.push({
        kind: "projectile",
        orb: l,
        flare: c,
        from: o,
        to: a,
        t: 0,
        dur: 0.26,
        lift: s.orbArc,
        aoe: r,
        color: n,
        prof: s,
        prev: o.clone()
      });
    }
    impact(e, t, n, s, r) {
      let o = e.holder.position.clone().add(new Vector3(0, 1, 0));
      if (this.flash(e, r > 1 ? 16769658 : 16747146), this.knock(e), this.shardBurst(o, t, n, s ? 1.4 : 1), this.shockRing(o, t, n, s), this.coreFlash(o, t, s), s && (this.groundShock(o, t, n), this.streakBurst(o, t, n, 1.4)), QUALITY.tier !== "low" || s) {
        let a = new PointLight(t, s ? 3.4 : 2.2, 7, 2);
        a.position.copy(o), this.scene.add(a), this.effects.push({
          kind: "flashLight",
          light: a,
          t: 0,
          life: 0.22,
          peak: s ? 3.4 : 2.2
        });
      }
    }
    shockRing(e, t, n, s) {
      let r = new Mesh(ringGeo(), fxMat(t, s ? 0.55 : 0.42));
      if (r.position.copy(e), r.lookAt(this.camera.position), r.rotateX(0.95), r.rotateY((Math.random() - 0.5) * 0.5), r.scale.setScalar(0.3), this.scene.add(r), this.effects.push({
        kind: "ring",
        mesh: r,
        t: 0,
        life: s ? 0.42 : 0.32,
        spin: 1.6,
        from: 0.3,
        to: n.ring * (s ? 2.1 : 1.55),
        peak: s ? 0.55 : 0.42,
        ease: 3
      }), QUALITY.tier === "low") return;
      let o = new Mesh(dashGeo(11), fxMat(t, 0.3));
      o.position.copy(e), o.lookAt(this.camera.position), o.rotateZ(Math.random() * Math.PI), this.scene.add(o), this.effects.push({
        kind: "ring",
        mesh: o,
        t: 0,
        life: s ? 0.34 : 0.28,
        spin: -7,
        from: 0.3,
        to: n.ring * (s ? 1.05 : 0.8),
        peak: 0.3,
        ease: 2
      });
    }
    coreFlash(e, t, n) {
      let s = new Mesh(flashGeo(), fxMat(t, n ? 0.55 : 0.4, 0.55));
      s.position.copy(e), s.lookAt(this.camera.position), this.scene.add(s), this.effects.push({
        kind: "ring",
        mesh: s,
        t: 0,
        life: n ? 0.15 : 0.11,
        from: n ? 0.35 : 0.26,
        to: n ? 1.15 : 0.85,
        peak: n ? 0.55 : 0.4,
        ease: 2
      });
    }
    groundShock(e, t, n) {
      let s = new Mesh(ringGeo(), fxMat(t, 0.34));
      s.rotation.x = -Math.PI / 2, s.position.set(e.x, 0.42, e.z), this.scene.add(s), this.effects.push({
        kind: "ring",
        mesh: s,
        t: 0,
        life: 0.46,
        spin: 0.9,
        from: 0.4,
        to: 3 * n.ring,
        peak: 0.34,
        ease: 3
      });
    }
    slashArc(e, t, n, s) {
      let r = 0.45 + s.tail * 0.55,
        o = new Mesh(yb(s.arc), lp(n, r));
      o.position.copy(e), o.lookAt(this.camera.position), o.rotateZ(Math.PI * (0.2 + Math.random() * 0.6) * (Math.random() < 0.5 ? 1 : -1)), o.rotateY(t.x * 0.3 - 0.22), o.translateY(-0.7 * s.arcR), this.scene.add(o), this.effects.push({
        kind: "sweep",
        mesh: o,
        t: 0,
        life: 0.3,
        base: s.arcR,
        grow: 0.35,
        tail: r,
        peak: 0.78
      });
    }
    streakBurst(e, t, n, s = 1) {
      if (QUALITY.tier === "low" && s < 1.2) return;
      let r = Math.round(n.streaks * (QUALITY.tier === "low" ? 0.5 : 1)),
        o = new Mesh(xb(r, Math.random() * 3 | 0), lp(t, 0.55));
      o.position.copy(e), o.lookAt(this.camera.position), o.rotateZ(Math.random() * Math.PI * 2), this.scene.add(o), this.effects.push({
        kind: "sweep",
        mesh: o,
        t: 0,
        life: 0.28,
        base: n.streakR * s,
        grow: 0.9,
        tail: 0.55,
        peak: 0.5
      });
    }
    shardBurst(e, t, n, s = 1) {
      let r = Math.max(4, Math.round(n.shards * s * (QUALITY.tier === "low" ? 0.45 : 1))),
        o = new InstancedMesh(vb(), fxMat(t, 0.5), r);
      o.instanceMatrix.setUsage(DynamicDrawUsage), o.frustumCulled = !1;
      let a = [];
      for (let l = 0; l < r; l++) {
        let c = Math.random() * Math.PI * 2,
          h = (Math.random() - 0.28) * 1.2,
          d = new Vector3(Math.cos(c) * Math.cos(h), Math.sin(h), Math.sin(c) * Math.cos(h)),
          u = d.clone().multiplyScalar(n.speed * (0.55 + Math.random() * 0.9) * s);
        u.x += -Math.sin(c) * n.swirl, u.z += Math.cos(c) * n.swirl, u.y += n.rise * (0.5 + Math.random() * 0.7), a.push({
          p: e.clone().addScaledVector(d, 0.14),
          v: u,
          q: new Quaternion().random(),
          ax: new Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
          w: n.spin * (0.6 + Math.random()),
          s: n.size * (0.6 + Math.random() * 0.8) * (0.8 + s * 0.35)
        }), o.setColorAt(l, fb.setScalar(0.72 + Math.random() * 0.6));
      }
      this.scene.add(o), this.effects.push({
        kind: "shards",
        mesh: o,
        bits: a,
        t: 0,
        life: 0.6 + n.size,
        peak: 0.5,
        grav: n.grav,
        drag: n.drag
      });
    }
    telegraph(e, t, n) {
      let s = e.holder.position.clone().setY(0.41),
        r = new Mesh(ringGeo(), fxMat(t, 0.3));
      if (r.rotation.x = -Math.PI / 2, r.position.copy(s), this.scene.add(r), this.effects.push({
        kind: "rune",
        mesh: r,
        t: 0,
        life: 0.6,
        hold: 0.3,
        r: 1.3,
        peak: 0.3,
        spin: 0.9
      }), QUALITY.tier === "low") return;
      let o = new Mesh(dashGeo(10), fxMat(t, 0.36));
      o.rotation.x = -Math.PI / 2, o.position.copy(s), this.scene.add(o), this.effects.push({
        kind: "rune",
        mesh: o,
        t: 0,
        life: 0.6,
        hold: 0.3,
        r: 0.85 * n.ring,
        peak: 0.36,
        spin: -2.1
      });
    }
    column(e, t, n = 1) {
      let s = new Mesh(Mb(), glowMat(t, 0.5));
      s.scale.set(n, 1, n), s.position.copy(e.holder.position).add(nt.set(0, 1.6, 0)), this.scene.add(s);
      let r = new Mesh(wb(), glowMat(t, 0.8));
      r.rotation.x = -Math.PI / 2, r.scale.set(n, n, n), r.position.set(s.position.x, 0.42, s.position.z), this.scene.add(r), this.effects.push({
        kind: "column",
        mesh: s,
        disc: r,
        t: 0,
        scale: n
      });
    }
    sparkle(e, t, n = 1) {
      let s = e.holder.position.clone().add(new Vector3(0, 1, 0));
      this.shardBurst(s, t, fxFor("lumen"), n);
    }
    puff(e, t, n) {
      let s = new BufferGeometry(),
        r = new Float32Array(n * 3),
        o = [];
      for (let l = 0; l < n; l++) {
        r[l * 3] = e.x, r[l * 3 + 1] = e.y, r[l * 3 + 2] = e.z;
        let c = Math.random() * Math.PI * 2,
          h = 2 + Math.random() * 5;
        o.push(new Vector3(Math.cos(c) * h * 0.6, Math.random() * 5 + 1.5, Math.sin(c) * h * 0.6));
      }
      s.setAttribute("position", new BufferAttribute(r, 3)), s.userData.owned = !0;
      let a = new Points(s, new PointsMaterial({
        color: t,
        size: 0.13,
        transparent: !0,
        opacity: 0.85,
        blending: AdditiveBlending,
        depthWrite: !1
      }));
      this.scene.add(a), this.effects.push({
        kind: "burst",
        pts: a,
        vel: o,
        t: 0
      });
    }
    ownMaterials(e) {
      if (e.mats) return e.mats;
      let t = [];
      return e.group.traverse(n => {
        if (!n.isMesh || !n.material) return;
        let s = Array.isArray(n.material),
          o = (s ? n.material : [n.material]).map(a => {
            let l = a.clone();
            return l.userData = {
              ...a.userData,
              shared: !1
            }, l;
          });
        n.material = s ? o : o[0];
        for (let a of o) t.push({
          m: a,
          e: a.emissive ? a.emissive.getHex() : 0,
          i: a.emissiveIntensity ?? 1,
          o: a.opacity,
          tr: a.transparent,
          dw: a.depthWrite
        });
      }), e.mats = t, e.flashMats = t, t;
    }
    flash(e, t) {
      for (let n of this.ownMaterials(e)) n.m.emissive && (n.m.emissive.setHex(t), n.m.emissiveIntensity = 0.85);
      this.effects.push({
        kind: "unflash",
        actor: e,
        t: 0
      });
    }
    fade(e, t) {
      let n = t > 0.995;
      for (let s of this.ownMaterials(e)) s.m.transparent = n ? s.tr : !0, s.m.opacity = s.o * t, s.m.depthWrite = n ? s.dw : !1;
    }
    knock(e) {
      this.effects.push({
        kind: "knock",
        actor: e,
        t: 0,
        from: e.holder.position.clone()
      });
    }
    dropFx(e) {
      this.scene.remove(e), fadeTree(e);
    }
    beginCapture(e) {
      let t = this.actors.get(e.target);
      if (!t || this.sphereFx) return;
      let n = this.trainer ? nt.copy(this.trainer.holder.position).add(nr.set(-0.35, 1.25, 0)).clone() : new Vector3(2.1, 1.6, 6.6),
        s = t.holder.position.clone().add(nr.set(0, 1.05, 0)),
        r = buildSphereProp(e.sphere);
      r.position.copy(n), this.scene.add(r), audio.sfx("throw"), r.add(new PointLight(16766602, 3, 7, 2)), this.frozenUntil = Number.isFinite(e.until) ? e.until : Date.now() + 2400;
      let o = Math.max(1.5, Math.min(3.2, (this.frozenUntil - Date.now()) / 1e3 - 0.25)),
        a = {
          kind: "sphere",
          ball: r,
          target: t,
          chance: Number.isFinite(e.chance) ? e.chance : 50,
          success: null,
          shakes: null,
          start: n,
          land: s,
          rest: new Vector3(s.x, 0.62, s.z + 0.9),
          phase: "fly",
          t: 0,
          wobble: 0,
          stretch: o / 2.15,
          vy: 0,
          beam: null,
          bornAt: Date.now()
        };
      this.sphereFx = a, this.effects.push(a), this.trainer && this.effects.push({
        kind: "throwPose",
        t: 0
      });
      let l = new PointLight(16773324, 6, 9, 2);
      l.position.copy(s).add(nr.set(0, 1.2, 0)), this.scene.add(l), a.spot = l;
    }
    resolveCapture(e) {
      this.sphereFx || this.beginCapture({
        target: e.target,
        chance: e.chance,
        sphere: e.sphere,
        until: Date.now() + 950
      });
      let t = this.sphereFx;
      t && (t.success = !!e.success, t.shakes = Math.max(0, Math.min(3, Number.isFinite(e.shakes) ? e.shakes : 3)), Number.isFinite(e.chance) && (t.chance = e.chance));
    }
    endCapture() {
      this.sphereFx || (this.frozenUntil = 0);
    }
    update(e, t) {
      this.adapt(e), e = Math.min(0.06, Math.max(0, e || 0)), this.time += e;
      let n = !!this.sphereFx || Date.now() < this.frozenUntil;
      this.stepStage(e, t, n), this.stepEffects(e), this.stepCamera(e), this.sky && this.sky.position.copy(this.camera.position), this.renderer.render(this.scene, this.camera);
    }
    stepStage(e, t, n) {
      for (let r of this.actors.keys()) {
        let o = this.actors.get(r);
        o.fresh && (o.fresh = !1, o.holder.position.copy(o.home), o.holder.rotation.y = o.faceY, o.holder.scale.setScalar(o.targetScale));
        let a = o.downed ? 1 : 0;
        if (o.downK !== a) {
          let c = a ? 2 : 3.4;
          o.downK = a ? Math.min(1, o.downK + e * c) : Math.max(0, o.downK - e * c);
        }
        // A fainted creature lies down and fades, which on its own read as a
        // model that had fallen over. Dizzy stars say "out of the fight" in the
        // one language every player of this genre already reads.
        o.downK > 0.5 && !o.stars ? (o.stars = dizzyStars(), o.stars.position.y = (o.height || 1.2) * 0.7 + 0.2, o.holder.add(o.stars)) : o.downK <= 0.5 && o.stars && (o.holder.remove(o.stars), o.stars.traverse(q => q.geometry?.dispose()), o.stars = null);
        o.stars && (o.stars.rotation.y += e * 2.6, o.stars.children.forEach(q => q.lookAt(this.camera.position)));
        if (Math.abs(o.downK - o.downApplied) > 0.01 && (o.downApplied = o.downK, this.fade(o, 1 - o.downK * 0.42)), o.react > 0 && (o.react = Math.max(0, o.react - e * 2.6)), o.downK > 0.02) o.group.rotation.z = o.downK * 1.35 * (o.side === "a" ? 1 : -1), o.group.rotation.x = 0, o.group.position.y = -o.downK * 0.16;else if (!n) if (o.group.rotation.z = 0, o.group.userData.baseY = 0, animateCreature(o.group, t, o.walking > 0, o.walking > 0 ? 1.1 : 1), o.react > 0) {
          let c = o.react * o.react;
          o.group.rotation.x = -c * 0.28, o.group.position.y += c * 0.14;
        } else o.group.rotation.x !== 0 && (o.group.rotation.x = 0);
        if (o.lock > 0) continue;
        let l = Math.min(1, e * 7);
        o.holder.position.lerp(o.home, l), o.holder.scale.setScalar(o.holder.scale.x + (o.targetScale - o.holder.scale.x) * l), o.holder.rotation.y += angleDelta(o.holder.rotation.y, o.faceY) * l;
      }
      if (this.trainerFront !== this.ringHostile) {
        this.ringHostile = this.trainerFront;
        let r = this.trainerFront;
        this.runeRing && this.runeRing.material.color.set(r ? 16738885 : this.accent), this.innerRing && this.innerRing.material.color.set(r ? 16747100 : this.accent), this.lamp && this.lamp.color.set(r ? 16742986 : this.accent);
      }
      if (this.runeRing && (this.runeRing.rotation.z += e * (this.trainerFront ? 0.52 : 0.22)), this.innerRing) {
        let r = this.trainerFront ? 3.6 : 1.7;
        this.innerRing.material.opacity = 0.28 + Math.sin(this.time * r) * (this.trainerFront ? 0.19 : 0.1);
      }
      this.motes && !n && (this.motes.rotation.y += e * 0.03, this.motes.position.y = Math.sin(this.time * 0.4) * 0.3);
      let s = this.sphereFx ? 1 : 0;
      if (this.dim !== s) {
        this.dim = s ? Math.min(1, this.dim + e * 4.5) : Math.max(0, this.dim - e * 2.6);
        let r = 1 - this.dim * 0.58;
        this.lights.sun.intensity = this.lightBase.sun * r, this.lights.hemi.intensity = this.lightBase.hemi * r, this.renderer.toneMappingExposure = 1.02 * (1 - this.dim * 0.34);
      }
    }
    stepEffects(e) {
      for (let t = this.effects.length - 1; t >= 0; t--) {
        let n = this.effects[t];
        n.t += e;
        let s = !1;
        try {
          s = this.stepEffect(n, e);
        } catch (r) {
          console.error("[arena] effect failed", n.kind, r), s = !0;
        }
        s && this.effects.splice(t, 1);
      }
    }
    stepEffect(e, t) {
      {
        let n = !1;
        switch (e.kind) {
          case "delayed":
            e.t >= e.at && (e.fn(), n = !0);
            break;
          case "burst":
            {
              let s = e.pts.geometry.attributes.position;
              for (let r = 0; r < e.vel.length; r++) e.vel[r].y -= 11 * t, s.setXYZ(r, s.getX(r) + e.vel[r].x * t, Math.max(0.45, s.getY(r) + e.vel[r].y * t), s.getZ(r) + e.vel[r].z * t);
              s.needsUpdate = !0, e.pts.material.opacity = Math.max(0, 0.85 - e.t * 1.3), e.t > 0.75 && (this.dropFx(e.pts), n = !0);
              break;
            }
          case "ring":
            {
              let s = Math.min(1, e.t / e.life);
              e.mesh.scale.setScalar(e.from + (e.to - e.from) * (1 - Math.pow(1 - s, e.ease))), e.spin && e.mesh.rotateZ(e.spin * t), e.mesh.material.opacity = e.peak * Math.pow(1 - s, 1.7), e.t >= e.life && (this.dropFx(e.mesh), n = !0);
              break;
            }
          case "rune":
            {
              let s = Math.min(1, e.t / 0.16);
              e.mesh.scale.setScalar(e.r * (0.5 + 0.5 * (1 - Math.pow(1 - s, 3)))), e.mesh.rotateZ(e.spin * t);
              let r = e.t < e.hold ? Math.min(1, e.t / 0.09) : Math.max(0, 1 - (e.t - e.hold) / (e.life - e.hold));
              e.mesh.material.opacity = e.peak * r, e.t >= e.life && (this.dropFx(e.mesh), n = !0);
              break;
            }
          case "sweep":
            {
              let s = Math.min(1, e.t / e.life),
                r = e.mesh.material.uniforms;
              r.uHead.value = s * (1 + e.tail), r.uOpacity.value = e.peak * Math.min(1, (1 - s) * 2.6), e.mesh.scale.setScalar(e.base * (1 + s * e.grow)), e.t >= e.life && (this.dropFx(e.mesh), n = !0);
              break;
            }
          case "shards":
            {
              let s = Math.min(1, e.t / e.life);
              for (let r = 0; r < e.bits.length; r++) {
                let o = e.bits[r];
                o.v.y += e.grav * t, o.v.multiplyScalar(Math.max(0, 1 - e.drag * t)), o.p.addScaledVector(o.v, t), o.p.y < 0.44 && (o.p.y = 0.44, o.v.y = Math.abs(o.v.y) * 0.28), o.q.multiply(db.setFromAxisAngle(o.ax, o.w * t)), ap.compose(o.p, o.q, ub.setScalar(o.s * (1 - s * s))), e.mesh.setMatrixAt(r, ap);
              }
              e.mesh.instanceMatrix.needsUpdate = !0, e.mesh.material.opacity = e.peak * (1 - s * 0.8), e.t >= e.life && (this.dropFx(e.mesh), n = !0);
              break;
            }
          case "column":
            e.mesh.scale.set(1, 1 + e.t * 0.6, 1), e.mesh.material.opacity = Math.max(0, 0.5 - e.t * 0.75), e.disc.scale.setScalar(1 + e.t * 1.6), e.disc.material.opacity = Math.max(0, 0.8 - e.t * 1.2), e.t > 0.7 && (this.dropFx(e.mesh), this.dropFx(e.disc), n = !0);
            break;
          case "flashLight":
            e.light.intensity = Math.max(0, (e.peak ?? 6) * (1 - e.t / e.life)), e.t > e.life && (this.scene.remove(e.light), n = !0);
            break;
          case "unflash":
            if (e.t > 0.14) {
              for (let s of e.actor.flashMats || []) s.m.emissive && (s.m.emissive.setHex(s.e), s.m.emissiveIntensity = s.i);
              n = !0;
            }
            break;
          case "dash":
            {
              let s = e.t < 0.1 ? e.t / 0.1 : Math.max(0, 1 - (e.t - 0.1) / 0.24);
              e.actor.holder.position.copy(e.from).addScaledVector(e.dir, s * 1.9), e.t > 0.36 && (e.actor.holder.position.copy(e.actor.home), n = !0);
              break;
            }
          case "knock":
            {
              let s = Math.max(0, 1 - e.t / 0.24),
                r = e.actor.side === "a" ? 1 : -1;
              e.actor.holder.position.z = e.from.z + s * 0.42 * r, e.actor.group.rotation.x = s * 0.22, e.t > 0.26 && (e.actor.holder.position.copy(e.actor.home), e.actor.group.rotation.x = 0, n = !0);
              break;
            }
          case "projectile":
            {
              let s = Math.min(1, e.t / e.dur),
                r = nt.copy(e.from).lerp(e.to, s);
              if (r.y += Math.sin(s * Math.PI) * e.lift, r.distanceToSquared(e.prev) > 1e-5 && e.orb.lookAt(e.prev), e.orb.position.copy(r), e.prev.copy(r), e.flare.lookAt(this.camera.position), e.flare.scale.setScalar(0.55 + Math.sin(s * Math.PI) * 0.35), s >= 1) {
                for (let o of e.orb.children) o.material && !o.material.userData.shared && o.material.dispose();
                if (this.scene.remove(e.orb), e.aoe) {
                  let o = new Mesh(ringGeo(), fxMat(e.color, 0.4));
                  o.rotation.x = -Math.PI / 2, o.position.set(e.to.x, 0.42, e.to.z), this.scene.add(o), this.effects.push({
                    kind: "ring",
                    mesh: o,
                    t: 0,
                    life: 0.6,
                    spin: 1.1,
                    from: 0.7,
                    to: 4.2 * e.prof.ring,
                    peak: 0.4,
                    ease: 3
                  });
                }
                n = !0;
              }
              break;
            }
          case "withdraw":
            {
              let s = e.actor,
                r = Math.min(1, e.t / e.life);
              if (e.recall) {
                if (r < 0.55) {
                  let o = r / 0.55;
                  s.holder.position.y = 0.35 + o * 0.55, s.holder.rotation.y += t * 18, s.holder.scale.setScalar(Math.max(0.05, 1 - o));
                } else {
                  e.placed || (e.placed = !0, s.holder.position.copy(s.home), s.holder.rotation.y = s.faceY);
                  let o = (r - 0.55) / 0.45;
                  s.holder.scale.setScalar(0.05 + (s.targetScale - 0.05) * Xd(o));
                }
              } else s.holder.position.lerp(s.home, Math.min(1, t * 4.5)), s.holder.scale.setScalar(s.holder.scale.x + (s.targetScale - s.holder.scale.x) * Math.min(1, t * 4.5));
              e.t >= e.life && (s.holder.position.copy(s.home), s.holder.scale.setScalar(s.targetScale), s.holder.rotation.y = s.faceY, s.lock--, n = !0);
              break;
            }
          case "entrance":
            {
              let s = e.actor,
                r = Math.min(1, e.t / e.life);
              if (r < 0.68) {
                let o = r / 0.68;
                nt.copy(e.from).lerp(s.home, Xd(o)), nt.y = 0.35 + Math.sin(o * Math.PI) * 0.72, s.holder.position.copy(nt), s.holder.scale.setScalar(e.scale0 + (s.targetScale - e.scale0) * o), s.holder.rotation.y += angleDelta(s.holder.rotation.y, s.faceY) * Math.min(1, t * 9);
              } else {
                e.landed || (e.landed = !0, s.walking = 0, this.arrival(s));
                let o = (r - 0.68) / 0.32,
                  a = Math.sin(o * Math.PI) * 0.17;
                s.holder.position.copy(s.home), s.holder.scale.set(s.targetScale * (1 + a * 0.7), s.targetScale * (1 - a), s.targetScale * (1 + a * 0.7));
              }
              e.t >= e.life && (s.holder.position.copy(s.home), s.holder.scale.setScalar(s.targetScale), s.lock--, n = !0);
              break;
            }
          case "stepUp":
            {
              let s = e.actor,
                r = Math.min(1, e.t / e.life),
                o = Math.min(1, r / 0.82);
              nt.copy(e.from).lerp(s.home, cb(o)), nt.y = 0.35, s.holder.position.copy(nt), s.holder.rotation.y += angleDelta(s.holder.rotation.y, s.faceY) * Math.min(1, t * 5), o >= 1 && !e.landed && (e.landed = !0, s.walking = 0, this.trainerArrival(s)), e.t >= e.life && (s.holder.position.copy(s.home), s.lock--, n = !0);
              break;
            }
          case "vignette":
            {
              let s = Math.min(1, e.t / e.life);
              this.vignette.material.opacity = e.peak * Math.pow(1 - s, 1.8), e.t >= e.life && (this.vignette.visible = !1, n = !0);
              break;
            }
          case "throwPose":
            {
              let s = this.trainer?.avatar.userData.rig?.arms?.[0];
              if (s) {
                let r = e.t < 0.12 ? e.t / 0.12 : Math.max(0, 1 - (e.t - 0.12) / 0.4);
                s.rotation.x = -r * 2.3;
              }
              e.t > 0.6 && (n = !0);
              break;
            }
          case "sphere":
            n = this.stepSphere(e, t);
            break;
          default:
            e.t > 2 && (n = !0);
        }
        return n;
      }
    }
    stepCamera(e) {
      let t = Math.min(1, e * 1.6);
      this.baseCam.lerp(this.targetCam, t), this.focus.lerp(this.targetFocus, t);
      let n = Math.max(0, 1 - e * 2.4);
      this.camOffset.multiplyScalar(n), this.aimOffset.multiplyScalar(n), nt.copy(this.baseCam).add(this.camOffset), nr.copy(this.focus).add(this.aimOffset);
      let s = this.sphereFx;
      s && s.ball && (nr.lerp(s.ball.position, 0.45), nt.lerp(s.ball.position, 0.1)), this.camPos.lerp(nt, Math.min(1, e * 5)), this.camAim.lerp(nr, Math.min(1, e * 3.2)), this.shake > 0 ? (this.shake = Math.max(0, this.shake - e * 2.4), this.camera.position.set(this.camPos.x + (Math.random() - 0.5) * this.shake * 2.2, this.camPos.y + (Math.random() - 0.5) * this.shake * 1.4, this.camPos.z + (Math.random() - 0.5) * this.shake * 0.7)) : this.camera.position.copy(this.camPos), this.camera.lookAt(this.camAim);
    }
    camPunch(e, t = 1) {
      nt.copy(e.home).sub(this.baseCam), nt.y = 0, nt.lengthSq() < 1e-4 && nt.set(0, 0, -1), nt.normalize().multiplyScalar(1.5 * t), this.camOffset.set(nt.x * 0.6, -0.5 * t, nt.z), this.aimOffset.set(e.home.x * 0.32, 0.22 * t, (e.home.z - this.focus.z) * 0.18);
    }
    flashVignette(e, t, n = 0.6) {
      let s = Math.min(0.85, t);
      this.vignette.material.color.set(e), this.vignette.material.opacity = s, this.vignette.visible = !0, this.effects.push({
        kind: "vignette",
        t: 0,
        life: n,
        peak: s
      });
    }
    arrival(e) {
      let t = speciesColor(e.species),
        n = fxFor(SPECIES[e.species]?.types?.[0] || null),
        s = new Mesh(ringGeo(), fxMat(t, 0.45));
      s.rotation.x = -Math.PI / 2, s.position.set(e.home.x, 0.42, e.home.z), this.scene.add(s), this.effects.push({
        kind: "ring",
        mesh: s,
        t: 0,
        life: 0.5,
        spin: 1.3,
        from: 0.4,
        to: 2.7,
        peak: 0.45,
        ease: 3
      }), this.shardBurst(nt.copy(e.home).setY(0.75), t, n, 0.9), this.puff(nt.copy(e.home).setY(0.45), 14279410, 12), this.shake = Math.max(this.shake, 0.2), audio.sfx("encounter");
    }
    trainerArrival(e) {
      let t = new Mesh(ringGeo(), fxMat(16738885, 0.5));
      t.rotation.x = -Math.PI / 2, t.position.set(e.home.x, 0.42, e.home.z), this.scene.add(t), this.effects.push({
        kind: "ring",
        mesh: t,
        t: 0,
        life: 0.75,
        spin: 0.8,
        from: 0.4,
        to: 4.2,
        peak: 0.5,
        ease: 3
      }), this.puff(nt.copy(e.home).setY(0.4), 13156270, 18), this.shake = Math.max(this.shake, 0.45), this.flashVignette(16733744, 0.55, 0.9), audio.sfx("crit");
    }
    stepSphere(e, t) {
      let n = e.ball,
        s = e.stretch;
      if (e.lastStep = Date.now(), e.lastStep - e.bornAt > 3e4) return this.finishSphere(e);
      switch (e.spot && e.spot.position.set(n.position.x, n.position.y + 1.15, n.position.z), e.phase) {
        case "fly":
          {
            let r = Math.min(1, e.t / (0.46 * s));
            nt.copy(e.start).lerp(e.land, r), nt.y += Math.sin(r * Math.PI) * 2.4, n.position.copy(nt), n.rotation.x += t * 16, n.rotation.z += t * 9, r >= 1 && (e.phase = "open", e.t = 0, this.puff(nt.copy(e.land), 16773312, 16), this.shake = Math.max(this.shake, 0.16), audio.sfx("sphereOpen"));
            break;
          }
        case "open":
          {
            let r = Math.min(1, e.t / (0.2 * s));
            if (n.userData.top.position.y = r * 0.34, n.userData.top.rotation.x = -r * 0.9, n.userData.bottom.position.y = -r * 0.14, r >= 1) {
              e.phase = "suck", e.t = 0;
              let o = new Mesh(beamGeo(), fxMat(16771496, 0.62, 0.5));
              o.position.copy(e.land).add(nt.set(0, 0.35, 0)), this.scene.add(o), e.beam = o, e.target && !e.locked && (e.target.lock++, e.locked = !0), audio.sfx("suck");
            }
            break;
          }
        case "suck":
          {
            let r = Math.min(1, e.t / (0.58 * s)),
              o = e.target;
            o && (o.holder.scale.setScalar(Math.max(0.02, (o.targetScale || 1) * (1 - r))), o.holder.rotation.y += t * 14, o.holder.position.lerp(n.position, r * 0.35)), e.beam && (e.beam.material.opacity = 0.62 * (1 - r * 0.5), e.beam.scale.set(1 - r * 0.7, 1, 1 - r * 0.7)), r >= 1 && (o && (o.holder.visible = !1, o.hidden = !0), e.beam && (this.dropFx(e.beam), e.beam = null), e.phase = "close", e.t = 0, this.puff(nt.copy(n.position), 16766602, 20));
            break;
          }
        case "close":
          {
            let r = Math.min(1, e.t / (0.17 * s));
            n.userData.top.position.y = (1 - r) * 0.34, n.userData.top.rotation.x = -(1 - r) * 0.9, n.userData.bottom.position.y = -(1 - r) * 0.14, r >= 1 && (e.phase = "drop", e.t = 0, e.vy = 0);
            break;
          }
        case "drop":
          {
            e.vy = (e.vy || 0) - 16 * t, n.position.y += e.vy * t, n.position.x += (e.rest.x - n.position.x) * Math.min(1, t * 4), n.position.z += (e.rest.z - n.position.z) * Math.min(1, t * 4), n.rotation.x += t * 4, n.position.y <= e.rest.y && (n.position.y = e.rest.y, Math.abs(e.vy) > 2.2 ? (e.vy = -e.vy * 0.42, this.puff(nt.copy(n.position), 14211288, 6)) : (e.phase = "hold", e.t = 0, n.rotation.set(0, 0, 0), n.userData.core && (n.userData.core.material.opacity = 0.35 + e.chance / 100 * 0.6)));
            break;
          }
        case "hold":
          {
            let r = 1 + Math.sin(e.t * 7) * 0.02;
            n.scale.setScalar(r), e.shakes !== null ? (n.scale.setScalar(1), e.phase = "wobble", e.t = 0, e.wobble = 0, e.clicked = !1) : e.t > 4 && (e.success = !1, e.shakes = 1);
            break;
          }
        case "wobble":
          {
            if (e.wobble >= e.shakes) {
              n.rotation.z = 0, e.phase = e.success ? "caught" : "escape", e.t = 0;
              break;
            }
            let r = 0.6 * Math.pow(0.82, e.wobble);
            if (!e.clicked) {
              e.clicked = !0, audio.sfx("wobble");
              let l = new Mesh(ringGeo(), fxMat(16765020, 0.42));
              l.rotation.x = -Math.PI / 2, l.position.set(n.position.x, 0.42, n.position.z), this.scene.add(l), this.effects.push({
                kind: "ring",
                mesh: l,
                t: 0,
                life: 0.42,
                spin: 1.4,
                from: 0.35,
                to: 1.4,
                peak: 0.42,
                ease: 2
              });
              let c = 1 - e.chance / 100;
              c > 0.35 && this.shardBurst(nt.copy(n.position).setY(n.position.y + 0.1), speciesColor(e.target?.species), fxFor("metal"), 0.35 + c * 0.5);
            }
            let o = Math.min(1, e.t / r),
              a = (0.3 + 0.4 * (1 - e.chance / 100)) * (1 - e.wobble * 0.14);
            n.rotation.z = Math.sin(o * Math.PI * 2) * a * (1 - o * 0.3), n.position.y = e.rest.y + Math.abs(Math.sin(o * Math.PI * 2)) * 0.05, e.t >= r + 0.1 && (e.wobble += 1, e.t = 0, e.clicked = !1);
            break;
          }
        case "caught":
          {
            if (e.t < t * 1.5) {
              audio.sfx("caught"), nt.copy(n.position).add(nr.set(0, 0.3, 0)), this.puff(nt, 16771496, 26), this.shardBurst(nt, 16767114, fxFor("lumen"), 1.2);
              let r = new Mesh(ringGeo(), fxMat(16765020, 0.45));
              r.rotation.x = -Math.PI / 2, r.position.set(n.position.x, 0.45, n.position.z), this.scene.add(r), this.effects.push({
                kind: "ring",
                mesh: r,
                t: 0,
                life: 0.8,
                spin: 2.2,
                from: 0.4,
                to: 3.4,
                peak: 0.45,
                ease: 3
              });
              let o = new PointLight(16771496, 7, 11, 2);
              o.position.copy(n.position), this.scene.add(o), this.effects.push({
                kind: "flashLight",
                light: o,
                t: 0,
                life: 0.8,
                peak: 7
              }), this.shake = Math.max(this.shake, 0.3);
            }
            if (n.scale.setScalar(1 + Math.sin(e.t * 14) * 0.06), e.t > 1.2) return this.finishSphere(e);
            break;
          }
        case "escape":
          {
            let r = Math.min(1, e.t / 0.3);
            n.userData.top.position.y = r * 0.5, n.userData.top.rotation.x = -r * 1.6;
            let o = e.target;
            if (e.escapeFrom || (e.escapeFrom = n.position.clone(), audio.sfx("escape"), this.puff(nt.copy(n.position), 16751210, 26), this.shake = Math.max(this.shake, 0.24), o && (this.flash(o, 16738890), this.rally(o.side, 1))), o) {
              o.holder.visible = !0, o.hidden = !1;
              let a = o.targetScale || 1;
              o.holder.scale.setScalar(Math.min(a * 1.12, r * 1.4 * a)), o.holder.position.lerpVectors(e.escapeFrom, o.home, Xd(r));
            }
            if (e.t > 0.55) return o && (o.holder.scale.setScalar(o.targetScale || 1), o.holder.position.copy(o.home)), this.finishSphere(e);
            break;
          }
        default:
          return this.finishSphere(e);
      }
      return !1;
    }
    finishSphere(e) {
      return e.target && e.locked && (e.target.lock--, e.locked = !1), e.beam && (this.dropFx(e.beam), e.beam = null), e.spot && (this.scene.remove(e.spot), e.spot = null), this.scene.remove(e.ball), fadeTree(e.ball), this.sphereFx === e && (this.sphereFx = null), this.frozenUntil = 0, !0;
    }
    project(e) {
      let t = e.clone().project(this.camera);
      return {
        x: (t.x * 0.5 + 0.5) * this.canvas.clientWidth,
        y: (-t.y * 0.5 + 0.5) * this.canvas.clientHeight,
        visible: t.z < 1
      };
    }
    combatantOf(e) {
      return this.actors.get(e);
    }
    actorScreenPos(e) {
      let t = this.actors.get(e);
      return t ? this.project(t.holder.position.clone().add(new Vector3(0, 2.1, 0))) : null;
    }
  },
  SPHERE_COLORS = {
    sphere_basic: 7330047,
    sphere_great: 10124287,
    sphere_ultra: 16761415
  };

// --- stages -----------------------------------------------------------------
// Where a fight happens says what kind of fight it is. A wild encounter is in
// the field you were walking through: its own ground, grass, flowers and trees,
// a chalk circle scuffed into the grass. A fight in town, or a duel, is in a
// stadium — a court, stands, banners in the challenger's colour. Only dungeons
// keep the dark rune pit.
function seeded(n) {
  let t = n >>> 0 || 1;
  return () => (t = t * 1664525 + 1013904223 >>> 0) / 4294967296;
}

function buildClearing(pal = {}, accent = 16777215, element = "verdant") {
  let g = new Group(),
    R = seeded(911),
    low = new Color(pal.groundLow ?? 6202439),
    high = new Color(pal.groundHigh ?? 10342498),
    sand = new Color(pal.path ?? 15126166),
    c = new Color(),
    tone = (x, z) => {
      let k = 0.5 + 0.28 * Math.sin(x * 0.21 + 1.3) * Math.cos(z * 0.17) + 0.18 * Math.sin((x + z) * 0.09),
        r = Math.hypot(x, z);
      return c.copy(low).lerp(high, Math.min(1, Math.max(0, k))), r < 6.8 && c.lerp(sand, 0.42 * (1 - Math.max(0, r - 4.6) / 2.2)), c;
    };
  // Ground: flat, coloured like the zone's, worn to sand where the fight is.
  let pg = new PlaneGeometry(130, 130, 72, 72);
  pg.rotateX(-Math.PI / 2);
  let pos = pg.attributes.position,
    col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    let t = tone(pos.getX(i), pos.getZ(i));
    col[i * 3] = t.r, col[i * 3 + 1] = t.g, col[i * 3 + 2] = t.b;
  }
  pg.setAttribute("color", new BufferAttribute(col, 3));
  let ground = new Mesh(pg, new MeshStandardMaterial({
    vertexColors: !0,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.3
  }));
  ground.receiveShadow = !0, g.add(ground);
  // The chalk circle, and a mark where each side stands.
  let chalk = mat(16316911, {
      roughness: 0.9
    }),
    marks = [{
      geo: xf2(new RingGeometry(5.62, 5.84, 72), {
        y: 0.03,
        rx: -Math.PI / 2
      }),
      mat: chalk
    }];
  for (let z of [SIDE_Z.a + 0.9, SIDE_Z.b - 0.9]) marks.push({
    geo: xf2(new PlaneGeometry(1.7, 0.14), {
      y: 0.03,
      z,
      rx: -Math.PI / 2
    }),
    mat: chalk
  });
  let m = mergeByMaterial(marks, {
    castShadow: !1
  });
  m.receiveShadow = !0, g.add(m);
  // Grass and flowers outside the circle, the same tufts the field grows.
  let lowTier = QUALITY.tier === "low",
    o = new Object3D(),
    tufts = [];
  for (let i = 0; i < (lowTier ? 380 : 900); i++) {
    let a = R() * Math.PI * 2,
      r = 6.4 + Math.pow(R(), 0.8) * 36,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    // Nothing between the camera and the fight.
    z > 3.5 && Math.abs(x + 1) < 5 || tufts.push([x, z, 0.8 + R() * 0.7, R() * 6.28]);
  }
  let gm = new InstancedMesh(meadowTuft(), thinMaterial({
    vertexColors: !0,
    roughness: 0.95,
    envMapIntensity: 0.28
  }), tufts.length);
  tufts.forEach(([x, z, sc, rot], i) => {
    o.position.set(x, 0, z), o.rotation.set(0, rot, 0), o.scale.setScalar(sc), o.updateMatrix(), gm.setMatrixAt(i, o.matrix), gm.setColorAt(i, tone(x, z));
  }), gm.receiveShadow = !0, g.add(gm);
  let M = MEADOW[element] || MEADOW.verdant,
    flowers = [];
  for (let b = 0; b < 14; b++) {
    let a = R() * Math.PI * 2,
      r = 7 + R() * 22,
      bx = Math.cos(a) * r,
      bz = Math.sin(a) * r,
      pet = M.petals[Math.floor(R() * M.petals.length)];
    if (bz > 3 && Math.abs(bx + 1) < 6) continue;
    for (let k = 0; k < 11; k++) {
      let aa = R() * Math.PI * 2,
        rr = Math.sqrt(R()) * 2;
      flowers.push([bx + Math.cos(aa) * rr, bz + Math.sin(aa) * rr, pet, 0.17 + R() * 0.07]);
    }
  }
  let fh = new InstancedMesh(flowerHead(), thinMaterial({
      vertexColors: !0,
      roughness: 0.7
    }), flowers.length),
    fb = new InstancedMesh(flowerBase(M.heart, pal.leaf ?? 4630604), thinMaterial({
      vertexColors: !0,
      roughness: 0.8
    }), flowers.length);
  flowers.forEach(([x, z, pet, sc], i) => {
    o.position.set(x, 0, z), o.rotation.set((R() - 0.5) * 0.5, R() * 6.28, (R() - 0.5) * 0.5), o.scale.setScalar(sc), o.updateMatrix(), fh.setMatrixAt(i, o.matrix), fb.setMatrixAt(i, o.matrix), fh.setColorAt(i, c.set(pet));
  }), g.add(fh, fb);
  // Trees round the far side and the flanks, bushes and rocks nearer in, and
  // hills beyond — so the clearing is somewhere, not a disc in the sky.
  let leafA = mat(pal.leaf ?? 4630604, {
      roughness: 0.85
    }),
    leafB = mat(new Color(pal.leaf ?? 4630604).lerp(new Color(16777215), 0.18).getHex(), {
      roughness: 0.85
    }),
    bark = mat(pal.bark ?? 7032130, {
      roughness: 0.9
    }),
    rock = mat(pal.rock ?? 9277330, {
      roughness: 0.9,
      flat: !0
    }),
    parts = [];
  for (let i = 0; i < 20; i++) {
    let a = -Math.PI * 0.08 - R() * Math.PI * 1.16,
      r = 17 + R() * 16,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      s = 0.9 + R() * 0.6,
      lm = R() < 0.5 ? leafA : leafB;
    parts.push({
      geo: xf2(new CylinderGeometry(0.26 * s, 0.4 * s, 3 * s, 7), {
        x,
        y: 1.5 * s,
        z
      }),
      mat: bark
    });
    for (let k = 0; k < 3; k++) parts.push({
      geo: xf2(new IcosahedronGeometry(1, 1), {
        x: x + (R() - 0.5) * 1.6 * s,
        y: (3.4 + k * 0.9 + R() * 0.4) * s,
        z: z + (R() - 0.5) * 1.6 * s,
        sx: (2 - k * 0.45) * s,
        sy: (1.6 - k * 0.3) * s,
        sz: (2 - k * 0.45) * s
      }),
      mat: lm
    });
  }
  for (let i = 0; i < 12; i++) {
    let a = -Math.PI * 0.05 - R() * Math.PI * 1.1,
      r = 8.5 + R() * 7,
      x = Math.cos(a) * r,
      z = Math.sin(a) * r,
      big = R() < 0.5;
    parts.push(big ? {
      geo: xf2(new IcosahedronGeometry(1, 1), {
        x,
        y: 0.55,
        z,
        sx: 1.3,
        sy: 0.95,
        sz: 1.2
      }),
      mat: leafB
    } : {
      geo: xf2(new DodecahedronGeometry(0.8, 0), {
        x,
        y: 0.35,
        z,
        ry: R() * 3
      }),
      mat: rock
    });
  }
  let hill = mat(new Color(pal.groundHigh ?? 10342498).lerp(new Color(13627391), 0.35).getHex(), {
    roughness: 1
  });
  for (let i = 0; i < 6; i++) {
    let a = -Math.PI * 0.15 - i / 5 * Math.PI * 0.7,
      r = 78 + R() * 14;
    parts.push({
      geo: xf2(new SphereGeometry(1, 20, 12), {
        x: Math.cos(a) * r,
        y: -6,
        z: Math.sin(a) * r,
        sx: 30 + R() * 16,
        sy: 16 + R() * 10,
        sz: 22
      }),
      mat: hill
    });
  }
  let props = mergeByMaterial(parts, {
    castShadow: !0
  });
  return props.receiveShadow = !0, g.add(props), g;
}

function buildStadium(accent = 3106512) {
  let parts = [],
    concrete = mat(15590362, {
      roughness: 0.92
    }),
    seatC = mat(16762967, {
      roughness: 0.6
    }),
    court = mat(4161494, {
      roughness: 0.8
    }),
    inner = mat(5937126, {
      roughness: 0.8
    }),
    line = mat(16777215, {
      roughness: 0.6
    }),
    seatA = mat(accent, {
      roughness: 0.6
    }),
    seatB = mat(16052714, {
      roughness: 0.7
    }),
    steel = mat(10134453, {
      roughness: 0.5
    }),
    wall = mat(15262420, {
      roughness: 0.85
    }),
    glass = new MeshStandardMaterial({
      color: 12117503,
      emissive: 7322623,
      emissiveIntensity: 0.35,
      roughness: 0.15,
      metalness: 0.2
    }),
    lamp = new MeshStandardMaterial({
      color: 16777215,
      emissive: 16775392,
      emissiveIntensity: 1.2
    }),
    box = (w, h, d, o, m) => parts.push({
      geo: xf2(new BoxGeometry(w, h, d), o),
      mat: m
    });
  // The court: blue, a lighter field inside it, white lines, and our own
  // mark in the middle — the shard from the logo, not anyone else's.
  box(80, 0.3, 80, {
    y: -0.15
  }, concrete), box(14, 0.06, 21, {
    y: 0.03
  }, court), box(11.6, 0.07, 18.6, {
    y: 0.04
  }, inner);
  for (let [w, d, x, z] of [[11.6, 0.12, 0, 9.3], [11.6, 0.12, 0, -9.3], [0.12, 18.6, 5.8, 0], [0.12, 18.6, -5.8, 0], [11.6, 0.1, 0, 0]]) box(w, 0.02, d, {
    x,
    y: 0.085,
    z
  }, line);
  parts.push({
    geo: xf2(new RingGeometry(2.3, 2.44, 64), {
      y: 0.09,
      rx: -Math.PI / 2
    }),
    mat: line
  });
  let star = new Shape();
  for (let k = 0; k < 8; k++) {
    let a = k / 8 * Math.PI * 2,
      r = k % 2 ? 0.34 : 1.05;
    star[k ? "lineTo" : "moveTo"](Math.sin(a) * r, Math.cos(a) * r);
  }
  parts.push({
    geo: xf2(new ShapeGeometry(star), {
      y: 0.095,
      rx: -Math.PI / 2
    }),
    mat: seatA
  });
  // Stands: stepped, on the far side and both flanks, seats in two colours.
  let stand = (cx, cz, len, ry) => {
    for (let k = 0; k < 6; k++) {
      let y = 0.35 + k * 0.62,
        back = 1.5 * k,
        rot = (dx, dz) => ({
          x: cx + Math.cos(ry) * dx + Math.sin(ry) * dz,
          z: cz - Math.sin(ry) * dx + Math.cos(ry) * dz
        }),
        b = rot(0, -back);
      box(len, y * 2, 1.5, {
        ...b,
        y: y * 0.5 + 0.05,
        ry
      }, concrete);
      for (let q = 0; q < len / 1.2 - 1; q++) {
        let s2 = rot(-len / 2 + 0.9 + q * 1.2, -back + 0.2);
        box(1.05, 0.34, 0.7, {
          ...s2,
          y: y + 0.22,
          ry
        }, [seatA, seatC, seatB][k % 3]);
      }
    }
  };
  stand(0, -16, 34, 0), stand(-15, -2, 26, Math.PI / 2), stand(15, -2, 26, -Math.PI / 2);
  // Boards along the foot of the stands, in the challenger's colour.
  box(34, 0.9, 0.2, {
    y: 0.45,
    z: -15.1
  }, seatA), box(0.2, 0.9, 26, {
    x: -14.1,
    y: 0.45,
    z: -2
  }, seatA), box(0.2, 0.9, 26, {
    x: 14.1,
    y: 0.45,
    z: -2
  }, seatA);
  // The building behind the stands, windows lit, like the halls at the harbour.
  box(58, 16, 5, {
    y: 8,
    z: -31
  }, wall), box(59, 1, 6, {
    y: 16.4,
    z: -31
  }, steel);
  for (let r = 0; r < 3; r++)
    for (let q = 0; q < 12; q++) box(2.8, 2.2, 0.2, {
      x: -24.2 + q * 4.4,
      y: 5.5 + r * 3.6,
      z: -28.4
    }, glass);
  // Banners and floodlights.
  for (let [x, z] of [[-9, -12], [9, -12], [-12, 4], [12, 4]]) box(0.14, 9, 0.14, {
    x,
    y: 4.5,
    z
  }, steel), box(1.5, 2.6, 0.06, {
    x: x + 0.8 * Math.sign(-x),
    y: 7.4,
    z
  }, seatA);
  for (let [x, z] of [[-19, -20], [19, -20], [-21, 2], [21, 2]]) box(0.4, 17, 0.4, {
    x,
    y: 8.5,
    z
  }, steel), box(3.4, 1.4, 0.5, {
    x,
    y: 17.3,
    z: z + 0.4,
    rx: 0.35
  }, lamp);
  let g = new Group(),
    m = mergeByMaterial(parts, {
      castShadow: !0
    });
  return m.receiveShadow = !0, g.add(m), g;
}

function buildSphereProp(i) {
  let e = new Group(),
    t = 0.34,
    n = mat(15266303, {
      roughness: 0.18,
      metalness: 0.35,
      env: 1.6
    }),
    s = mat(2766160, {
      roughness: 0.22,
      metalness: 0.5,
      env: 1.6
    }),
    r = glowMat(SPHERE_COLORS[i] || SPHERE_COLORS.sphere_basic, 0.95),
    o = new Mesh(shellGeo("top", t), n),
    a = new Mesh(shellGeo("bottom", t), s),
    l = new Mesh(Eb(t), r);
  l.rotation.x = Math.PI / 2;
  let c = new Mesh(Tb(t), glowMat(16777215, 0.95));
  return o.castShadow = !0, a.castShadow = !0, e.add(o, a, l, c), e.userData.top = o, e.userData.bottom = a, e.userData.core = c, e;
}

function slotPosition(i, e) {
  if (i < SLOT_POS.length) return e.set(SLOT_POS[i][0], 0, SLOT_POS[i][1]);
  let t = i - SLOT_POS.length;
  return e.set((t % 3 - 1) * 1.8, 0, 4.3 + Math.floor(t / 3) * 0.95);
}

function lb(i) {
  let e = 0;
  for (let t = 0; t < i.length; t++) e = e * 31 + i.charCodeAt(t) >>> 0;
  return e % 1e3 / 1e3 * Math.PI * 2;
}

function speciesColor(i) {
  let e = SPECIES[i]?.types?.[0];
  return e && ELEMENTS[e] ? ELEMENTS[e].color : 14477055;
}

function angleDelta(i, e) {
  let t = (e - i) % (Math.PI * 2);
  return t > Math.PI && (t -= Math.PI * 2), t < -Math.PI && (t += Math.PI * 2), t;
}

var cb = i => 1 - (1 - i) * (1 - i),
  Xd = i => 1 - Math.pow(1 - i, 3);

function fadeTree(i) {
  i.traverse(e => {
    let t = Array.isArray(e.material) ? e.material : e.material ? [e.material] : [];
    for (let n of t) !n || n.userData?.shared || (n.map && n.map.dispose(), n.dispose());
    e.isInstancedMesh && e.dispose(), e.geometry && !xp.has(e.geometry) && !e.geometry.userData?.shared && e.geometry.dispose();
  });
}

function hb() {
  let i = new Mesh(Sb(), new MeshBasicMaterial({
    color: 16726831,
    transparent: !0,
    opacity: 0,
    vertexColors: !0,
    blending: AdditiveBlending,
    depthWrite: !1,
    depthTest: !1,
    side: DoubleSide
  }));
  return i.position.z = -1, i.renderOrder = 999, i.frustumCulled = !1, i.visible = !1, i;
}

var db = new Quaternion(),
  ap = new Matrix4(),
  ub = new Vector3(),
  fb = new Color(),
  pp = new Color(16777215),
  FX_DEFAULT = {
    ring: 1,
    shards: 11,
    size: 0.07,
    speed: 4.4,
    rise: 1.4,
    grav: -7,
    drag: 2.4,
    swirl: 0,
    spin: 7,
    arc: 2.2,
    arcR: 1.15,
    tail: 0.5,
    streaks: 14,
    streakR: 0.95,
    orbArc: 1.1
  },
  ELEMENT_FX = {
    ember: {
      shards: 14,
      size: 0.065,
      speed: 4.8,
      rise: 2.6,
      grav: -3.4,
      drag: 2.8,
      spin: 9,
      arc: 2.5,
      tail: 0.4
    },
    aqua: {
      shards: 13,
      size: 0.085,
      speed: 3.6,
      rise: 1,
      grav: -4.5,
      drag: 3.6,
      swirl: 2.4,
      spin: 4,
      arc: 2.9,
      arcR: 1.3,
      tail: 0.78,
      orbArc: 1.9,
      ring: 1.15
    },
    verdant: {
      shards: 12,
      size: 0.08,
      speed: 3.8,
      rise: 1.8,
      grav: -6,
      drag: 2.8,
      swirl: 1.2,
      spin: 5,
      arc: 2.3
    },
    volt: {
      shards: 16,
      size: 0.05,
      speed: 8.4,
      rise: 1.2,
      grav: -2,
      drag: 5.4,
      spin: 17,
      arc: 1.5,
      arcR: 0.95,
      tail: 0.16,
      streaks: 20,
      streakR: 1.15,
      orbArc: 0.3,
      ring: 1.1
    },
    terra: {
      shards: 8,
      size: 0.135,
      speed: 3.2,
      rise: 2.2,
      grav: -13,
      drag: 1.4,
      spin: 3,
      arc: 1.9,
      arcR: 1.25,
      tail: 0.6,
      streaks: 8,
      ring: 1.2
    },
    gale: {
      shards: 13,
      size: 0.06,
      speed: 4.4,
      rise: 0.9,
      grav: -1.2,
      drag: 2.2,
      swirl: 4.6,
      spin: 11,
      arc: 3.4,
      arcR: 1.25,
      tail: 0.85,
      orbArc: 1.6
    },
    frost: {
      shards: 10,
      size: 0.1,
      speed: 3.4,
      rise: 0.9,
      grav: -3,
      drag: 3.4,
      spin: 2,
      arc: 1.8,
      tail: 0.3,
      ring: 1.05
    },
    umbra: {
      shards: 11,
      size: 0.085,
      speed: 2.9,
      rise: 0.5,
      grav: -1.4,
      drag: 3.8,
      swirl: -1.6,
      spin: 4,
      arc: 2.6,
      arcR: 1.25,
      tail: 0.9,
      ring: 0.9
    },
    lumen: {
      shards: 16,
      size: 0.055,
      speed: 6,
      rise: 2,
      grav: -3,
      drag: 3.2,
      spin: 12,
      arc: 2.4,
      streaks: 18,
      streakR: 1.05,
      ring: 1.1
    },
    metal: {
      shards: 10,
      size: 0.07,
      speed: 5.6,
      rise: 1.4,
      grav: -9,
      drag: 2.2,
      spin: 15,
      arc: 1.6,
      arcR: 1,
      tail: 0.25,
      streaks: 16
    }
  };

function fxFor(i) {
  return ELEMENT_FX[i] || FX_DEFAULT;
}

function brighten(i, e = 0.12) {
  return new Color(i).lerp(pp, e);
}

function fxMat(i, e, t) {
  return new MeshBasicMaterial({
    color: brighten(i, t),
    transparent: !0,
    opacity: e,
    vertexColors: !0,
    blending: AdditiveBlending,
    depthWrite: !1,
    side: DoubleSide
  });
}

var pb = `
  attribute float aU;
  attribute float aTint;
  varying float vU;
  varying float vTint;
  void main() {
    vU = aU;
    vTint = aTint;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,
  mb = `
  uniform vec3 uColor;
  uniform vec3 uHot;
  uniform float uHead;
  uniform float uTail;
  uniform float uOpacity;
  varying float vU;
  varying float vTint;

  void main() {
    float ahead = 1.0 - smoothstep(uHead, uHead + 0.025, vU);
    float behind = smoothstep(uHead - uTail, uHead - uTail * 0.25, vU);
    float band = ahead * behind;
    if (band < 0.002) discard;
    // the leading edge runs hotter than the body — that gradient is what makes
    // a slash read as a blade passing through rather than a painted stripe
    float tip = pow(clamp(1.0 - (uHead - vU) / max(uTail, 0.001), 0.0, 1.0), 5.0);
    gl_FragColor = vec4(uColor + uHot * tip, uOpacity * vTint * band);
  }
`;

function lp(i, e) {
  let t = brighten(i, 0.32);
  return new ShaderMaterial({
    uniforms: {
      uColor: {
        value: t
      },
      uHot: {
        value: t.clone().lerp(pp, 0.8).multiplyScalar(0.55)
      },
      uHead: {
        value: -1
      },
      uTail: {
        value: e
      },
      uOpacity: {
        value: 0
      }
    },
    vertexShader: pb,
    fragmentShader: mb,
    transparent: !0,
    blending: AdditiveBlending,
    depthWrite: !1,
    side: DoubleSide
  });
}

var cp = new Map(),
  xp = new Set();

function cachedGeo(i, e) {
  let t = cp.get(i);
  return t || (t = e(), cp.set(i, t), xp.add(t)), t;
}

function makeGeo(i, e, t, n) {
  let s = new BufferGeometry();
  if (s.setAttribute("position", new Float32BufferAttribute(i, 3)), s.setAttribute("color", new Float32BufferAttribute(e, 3)), n) for (let [r, o] of Object.entries(n)) s.setAttribute(r, new Float32BufferAttribute(o, 1));
  return s.setIndex(t), s;
}

function gb(i) {
  let e = i >>> 0;
  return () => {
    e = e + 1831565813 >>> 0;
    let t = Math.imul(e ^ e >>> 15, 1 | e);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function latheFx(i, e) {
  let t = i.length,
    n = [],
    s = [],
    r = [];
  for (let [o, a] of i) for (let l = 0; l <= e; l++) {
    let c = l / e * Math.PI * 2;
    n.push(Math.cos(c) * o, Math.sin(c) * o, 0), s.push(a, a, a);
  }
  for (let o = 0; o < t - 1; o++) for (let a = 0; a < e; a++) {
    let l = o * (e + 1) + a;
    r.push(l, l + e + 1, l + 1, l + 1, l + e + 1, l + e + 2);
  }
  return makeGeo(n, s, r);
}

function ringGeo(i = 68) {
  return cachedGeo(`ring${i}`, () => latheFx([[0.8, 0], [0.93, 0.35], [0.985, 1.3], [1.06, 0]], i));
}

function dashGeo(i = 14) {
  return cachedGeo(`dash${i}`, () => {
    let e = [],
      t = [],
      n = [],
      s = Math.PI * 2 / i,
      r = s * 0.46,
      o = 3,
      a = [[0.955, 0], [0.985, 1.25], [1.01, 0]];
    for (let l = 0; l < i; l++) {
      let c = e.length / 3;
      for (let h = 0; h <= o; h++) {
        let d = h / o,
          u = l * s - r / 2 + r * d,
          f = Math.sin(d * Math.PI);
        for (let [p, x] of a) e.push(Math.cos(u) * p, Math.sin(u) * p, 0), t.push(f * x, f * x, f * x);
      }
      for (let h = 0; h < o; h++) for (let d = 0; d < a.length - 1; d++) {
        let u = c + h * a.length + d,
          f = u + a.length;
        n.push(u, f, u + 1, u + 1, f, f + 1);
      }
    }
    return makeGeo(e, t, n);
  });
}

function flashGeo() {
  return cachedGeo("flash", () => latheFx([[1e-4, 1.6], [0.13, 0.8], [0.36, 0.06], [1, 0]], 22));
}

function xb(i, e) {
  return cachedGeo(`streak${i}_${e}`, () => {
    let t = gb(e * 9871 + i * 131 + 7),
      n = [],
      s = [],
      r = [],
      o = [],
      a = [];
    for (let l = 0; l < i; l++) {
      let c = (l + t() * 0.75) / i * Math.PI * 2,
        h = 0.62 + t() * 0.35,
        d = 0.55 + t() * 1.5,
        u = 0.012 + t() * 0.018,
        f = Math.cos(c),
        p = Math.sin(c),
        x = n.length / 3;
      for (let g = 0; g < 2; g++) {
        let m = g ? h + d : h,
          v = g ? u * 0.3 : u;
        for (let E of [-1, 0, 1]) n.push(f * m - p * v * E, p * m + f * v * E, 0), s.push(1, 1, 1), o.push(g), a.push(E === 0 ? 1 : 0);
      }
      r.push(x, x + 3, x + 1, x + 1, x + 3, x + 4), r.push(x + 1, x + 4, x + 2, x + 2, x + 4, x + 5);
    }
    return makeGeo(n, s, r, {
      aU: o,
      aTint: a
    });
  });
}

function yb(i) {
  let e = `ribbon${i.toFixed(2)}`;
  return cachedGeo(e, () => {
    let n = [[-1, 0], [0.15, 0.6], [0.78, 1.5], [1, 0]],
      s = [],
      r = [],
      o = [],
      a = [],
      l = [];
    for (let c = 0; c <= 26; c++) {
      let h = c / 26,
        d = (h - 0.5) * i,
        u = Math.pow(Math.sin(Math.PI * h), 0.55) * 0.26;
      for (let [f, p] of n) {
        let x = 1 + f * u;
        s.push(Math.sin(d) * x, Math.cos(d) * x, (h - 0.5) * 0.3), r.push(1, 1, 1), a.push(h), l.push(p);
      }
    }
    for (let c = 0; c < 26; c++) for (let h = 0; h < n.length - 1; h++) {
      let d = c * n.length + h,
        u = d + n.length;
      o.push(d, u, d + 1, d + 1, u, u + 1);
    }
    return makeGeo(s, r, o, {
      aU: a,
      aTint: l
    });
  });
}

function vb() {
  return cachedGeo("shard", () => {
    let i = new OctahedronGeometry(1, 0),
      e = i.index ? i.toNonIndexed() : i;
    e.scale(0.4, 1, 0.4);
    let t = e.attributes.position,
      n = new Float32Array(t.count * 3),
      s = new Vector3(),
      r = new Vector3(),
      o = new Vector3(),
      a = new Vector3(0.4, 0.75, 0.5).normalize();
    for (let l = 0; l < t.count; l += 3) {
      s.fromBufferAttribute(t, l), r.fromBufferAttribute(t, l + 1).sub(s), o.fromBufferAttribute(t, l + 2).sub(s);
      let c = 0.45 + 0.85 * Math.abs(r.cross(o).normalize().dot(a));
      for (let h = 0; h < 3; h++) n[(l + h) * 3] = n[(l + h) * 3 + 1] = n[(l + h) * 3 + 2] = c;
    }
    return e.setAttribute("color", new BufferAttribute(n, 3)), e.deleteAttribute("normal"), e.deleteAttribute("uv"), e;
  });
}

function _b() {
  return cachedGeo("orb", () => {
    let i = new IcosahedronGeometry(0.19, 1),
      e = i.attributes.position,
      t = new Float32Array(e.count * 3);
    for (let n = 0; n < e.count; n++) {
      let s = 0.8 + 0.5 * Math.abs(e.getY(n)) / 0.19;
      t[n * 3] = t[n * 3 + 1] = t[n * 3 + 2] = s;
    }
    return i.setAttribute("color", new BufferAttribute(t, 3)), i;
  });
}

function bb(i = 12, e = 1.5) {
  return cachedGeo(`tail${i}_${e}`, () => {
    let t = [0, 0, e],
      n = [0, 0, 0],
      s = [];
    for (let r = 0; r <= i; r++) {
      let o = r / i * Math.PI * 2;
      t.push(Math.cos(o) * 0.2, Math.sin(o) * 0.2, 0), n.push(1.1, 1.1, 1.1);
    }
    for (let r = 1; r <= i; r++) s.push(0, r, r + 1);
    return makeGeo(t, n, s);
  });
}

function beamGeo(i = 20) {
  return cachedGeo(`beam${i}`, () => {
    let e = [],
      t = [],
      n = [],
      s = [[0.1, -1.05, 1.4], [1, 1.05, 0.25]];
    for (let [r, o, a] of s) for (let l = 0; l <= i; l++) {
      let c = l / i * Math.PI * 2;
      e.push(Math.cos(c) * r, o, Math.sin(c) * r), t.push(a, a, a);
    }
    for (let r = 0; r < i; r++) {
      let o = r,
        a = r + i + 1;
      n.push(o, a, o + 1, o + 1, a, a + 1);
    }
    return makeGeo(e, t, n);
  });
}

function Mb() {
  return cachedGeo("column", () => {
    let i = new CylinderGeometry(0.85, 1.1, 3.4, 24, 1, !0),
      e = i.attributes.position,
      t = new Float32Array(e.count * 3);
    for (let n = 0; n < e.count; n++) {
      let s = 0.25 + 0.95 * (1 - (e.getY(n) + 1.7) / 3.4);
      t[n * 3] = t[n * 3 + 1] = t[n * 3 + 2] = s;
    }
    return i.setAttribute("color", new BufferAttribute(t, 3)), i;
  });
}

function wb() {
  return cachedGeo("disc", () => latheFx([[0.5, 0], [0.82, 1], [1.15, 0]], 36));
}

function Sb() {
  return cachedGeo("vignette", () => latheFx([[0.3, 0], [0.66, 0.12], [0.88, 0.5], [1, 1.25]], 32));
}

function shellGeo(i, e) {
  return cachedGeo(`shell_${i}_${e}`, () => new SphereGeometry(e, 24, 12, 0, Math.PI * 2, i === "top" ? 0 : Math.PI / 2, Math.PI / 2));
}

function Eb(i) {
  return cachedGeo(`band${i}`, () => new TorusGeometry(i * 1.005, 0.035, 8, 28));
}

function Tb(i) {
  return cachedGeo(`core${i}`, () => new SphereGeometry(i * 0.3, 14, 10));
}

// fx defaults (were bundle bootstrap side effects)
for (let k of Object.keys(ELEMENT_FX)) ELEMENT_FX[k] = { ...FX_DEFAULT, ...ELEMENT_FX[k] };

export { ARENA_R, BattleView, ELEMENT_FX, Eb, FX_DEFAULT, Mb, SIDES, SIDE_DIR, SIDE_Z, SLOT_POS, SPHERE_COLORS, Sb, TRAINER_ID, Tb, Xd, _b, angleDelta, ap, audio, bb, beamGeo, brighten, buildSphereProp, cachedGeo, cb, cp, dashGeo, db, fadeTree, fb, flashGeo, fxFor, fxMat, gb, hb, ip, ir, latheFx, lb, lp, makeGeo, mb, np, nr, nt, pb, pp, ringGeo, rp, shellGeo, slotPosition, sp, speciesColor, ub, vb, wb, xb, xp, yb };
