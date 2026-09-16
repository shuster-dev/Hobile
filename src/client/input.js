import { ACESFilmicToneMapping, Box3, PerspectiveCamera, SRGBColorSpace, Scene, Vector3, WebGLRenderer } from 'three';
import { makeEnvironment, makeLights, makeSky } from './gfx/core.js';
import { buildCreature } from './gfx/creatures.js';

var CameraRig = class {
  constructor(e, t, n, {
    maxRadius: s = 52
  } = {}) {
    this.zone = e, this.base = t, this.knob = n, this.maxRadius = s, this.value = {
      x: 0,
      y: 0,
      magnitude: 0
    }, this.pointerId = null;
    let r = l => {
        if (this.pointerId !== null) return;
        let c = pointerInfo(l);
        this.pointerId = c.id, this.origin = {
          x: c.x,
          y: c.y
        };
        let h = this.zone.getBoundingClientRect();
        this.base.style.left = `${c.x - h.left}px`, this.base.style.top = `${c.y - h.top}px`, this.base.classList.add("active"), this.move(c), l.preventDefault();
      },
      o = l => {
        let c = pointerInfo(l, this.pointerId);
        !c || c.id !== this.pointerId || (this.move(c), l.preventDefault());
      },
      a = l => {
        let c = pointerInfo(l, this.pointerId, !0);
        this.pointerId === null || c && c.id !== this.pointerId || (this.pointerId = null, this.value = {
          x: 0,
          y: 0,
          magnitude: 0
        }, this.base.classList.remove("active"), this.knob.style.transform = "translate(-50%, -50%)");
      };
    e.addEventListener("pointerdown", r, {
      passive: !1
    }), window.addEventListener("pointermove", o, {
      passive: !1
    }), window.addEventListener("pointerup", a), window.addEventListener("pointercancel", a);
  }
  move(e) {
    let t = e.x - this.origin.x,
      n = e.y - this.origin.y,
      s = Math.hypot(t, n),
      r = Math.min(s, this.maxRadius);
    s > 0 && (t = t / s * r, n = n / s * r), this.knob.style.transform = `translate(calc(-50% + ${t}px), calc(-50% + ${n}px))`, this.value = {
      x: t / this.maxRadius,
      y: n / this.maxRadius,
      magnitude: r / this.maxRadius
    };
  }
};

function pointerInfo(i, e = null, t = !1) {
  if (i.pointerId !== void 0) return {
    id: i.pointerId,
    x: i.clientX,
    y: i.clientY
  };
  let n = t ? i.changedTouches : i.touches;
  if (!n) return null;
  for (let s of n) if (e === null || s.identifier === e) return {
    id: s.identifier,
    x: s.clientX,
    y: s.clientY
  };
  return null;
}

var Keyboard = class {
    constructor() {
      this.keys = new Set(), window.addEventListener("keydown", e => {
        e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || this.keys.add(e.key.toLowerCase());
      }), window.addEventListener("keyup", e => this.keys.delete(e.key.toLowerCase())), window.addEventListener("blur", () => this.keys.clear());
    }
    get value() {
      let e = this.keys,
        t = (e.has("d") || e.has("arrowright") ? 1 : 0) - (e.has("a") || e.has("arrowleft") ? 1 : 0),
        n = (e.has("s") || e.has("arrowdown") ? 1 : 0) - (e.has("w") || e.has("arrowup") ? 1 : 0),
        s = Math.hypot(t, n);
      return s ? {
        x: t / s,
        y: n / s,
        magnitude: 1
      } : {
        x: 0,
        y: 0,
        magnitude: 0
      };
    }
  },
  Joystick = class {
    constructor(e, t) {
      if (!e) return;
      this.pointerId = null, this.last = null;
      let n = o => {
          if (this.pointerId !== null) return;
          let a = pointerInfo(o);
          this.pointerId = a.id, this.last = {
            x: a.x,
            y: a.y
          };
        },
        s = o => {
          if (this.pointerId === null) return;
          let a = pointerInfo(o, this.pointerId);
          a && (t(a.x - this.last.x, a.y - this.last.y), this.last = {
            x: a.x,
            y: a.y
          }, o.preventDefault());
        },
        r = () => {
          this.pointerId = null, this.last = null;
        };
      e.addEventListener("pointerdown", n, {
        passive: !0
      }), window.addEventListener("pointermove", s, {
        passive: !1
      }), window.addEventListener("pointerup", r), window.addEventListener("pointercancel", r);
    }
  };

var MINIMAP_SIZE = 320,
  Yd = new Map(),
  zc = null;

function Ab() {
  if (zc) return zc;
  let i = document.createElement("canvas");
  i.width = MINIMAP_SIZE, i.height = MINIMAP_SIZE;
  let e = new WebGLRenderer({
    canvas: i,
    antialias: !0,
    alpha: !0,
    preserveDrawingBuffer: !0
  });
  e.setPixelRatio(1), e.setSize(MINIMAP_SIZE, MINIMAP_SIZE, !1), e.outputColorSpace = SRGBColorSpace, e.toneMapping = ACESFilmicToneMapping, e.toneMappingExposure = 1.15;
  let t = new Scene(),
    n = new PerspectiveCamera(30, 1, 0.1, 60),
    s = new Vector3(0.5, 0.8, 0.9).normalize(),
    r = makeSky({
      top: 2831696,
      horizon: 10465484,
      ground: 2764600,
      sun: 16773853,
      sunDir: s
    });
  return t.environment = makeEnvironment(e, r), makeLights(t, {
    sunDir: s,
    sunColor: 16774370,
    skyColor: 11061503,
    groundColor: 3816004,
    shadowRadius: 6
  }), zc = {
    renderer: e,
    scene: t,
    camera: n
  }, zc;
}

function zoneMinimap(i) {
  if (Yd.has(i)) return Yd.get(i);
  let e = "";
  try {
    let {
        renderer: t,
        scene: n,
        camera: s
      } = Ab(),
      r = buildCreature(i, {
        outline: !0
      });
    n.add(r);
    let o = new Box3().setFromObject(r),
      a = o.getSize(new Vector3()),
      l = o.getCenter(new Vector3()),
      c = Math.max(a.x, a.y, a.z) || 1,
      h = c / (2 * Math.tan(s.fov * Math.PI / 360)) * 1.12;
    r.rotation.y = 0.6, s.position.set(h * 0.42, l.y + c * 0.18, h), s.lookAt(l.x, l.y, l.z), t.render(n, s), e = t.domElement.toDataURL("image/png"), n.remove(r), r.traverse(d => {
      if (d.isMesh) {
        d.geometry?.dispose();
        for (let u of [].concat(d.material || [])) u && !u.userData?.shared && u.dispose();
      }
    });
  } catch {
    e = "";
  }
  return Yd.set(i, e), e;
}

export { Ab, CameraRig, Joystick, Keyboard, MINIMAP_SIZE, Yd, pointerInfo, zc, zoneMinimap };
