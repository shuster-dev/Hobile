import { Color, Group, Mesh, PointLight, SphereGeometry, TorusGeometry } from 'three';
import { HALF_PI, QUALITY, TAU, TIER, blobGeo, capsuleGeo, eyeParts, finProfile, glowMat, mat, mergeByMaterial, outlineMat, profile, taperGeo, xf2 } from './core.js';
import { UNIT_OCTA, applyElementKit, beads, buildAvian, buildBlob, buildGolem, buildInsect, buildQuad, buildSerpent, buildSprite, buildTail, curveAt, curveSampler, finPair, frills, gear, maw, palette, petals, podGeo, puff, shellHalves, speciesPalette, spikeGeo, spines, tuft, whiskers } from './parts.js';
import { AVATAR, SPECIES, hashString, seededRandom } from '../../shared/gamedata.js';
import { mixHex } from '../../shared/props.js';

var bez3 = (i, e, t) => n => {
    let s = 1 - n;
    return i * s * s + e * 2 * s * n + t * n * n;
  },
  DESIGN = {
    cindcub: {
      plan: "quad",
      mood: "curious",
      q: {
        bodyY: 0.72,
        rise: 0.05,
        chest: [0.3, 0.29, 0.31],
        chestZ: 0.14,
        waist: [0.225, 0.215, 0.2],
        waistZ: -0.12,
        rump: [0.245, 0.235, 0.23],
        rumpZ: -0.35,
        neck: {
          y: 1.16,
          z: 0.36,
          r0: 0.15,
          r1: 0.155
        },
        head: {
          r: 0.26,
          snout: 0.62,
          snoutR: 0.56,
          drop: 0.2,
          snoutMat: "b",
          eye: 0.42,
          sep: 0.44,
          eyeY: 0.12,
          eyeZ: 0.78
        },
        ear: "tuft",
        earScale: 1.15,
        legF: 0.46,
        legB: 0.46,
        legR: 0.078,
        stanceF: 0.19,
        stanceB: 0.2,
        hipYF: 0.48,
        hipYB: 0.48,
        frontZ: 0.19,
        backZ: -0.34,
        legKind: "plantigrade",
        foot: "paw"
      },
      tail: {
        y: 0.78,
        z: -0.5,
        len: 0.3,
        r: 0.052,
        rx: -0.8,
        tip: "flame"
      },
      sig(i) {
        let e = i.P;
        shellHalves(i, {
          y: 0.97,
          z: 0.24,
          r: 0.28,
          n: 13,
          len: 0.3,
          thick: 0.085,
          rx: -1.15,
          arc: 3.1
        }), shellHalves(i, {
          y: 0.95,
          z: 0.08,
          r: 0.275,
          n: 9,
          len: 0.2,
          thick: 0.065,
          rx: -1.35,
          arc: 2.6,
          mat: e.ACC,
          mat2: e.HOT
        }), spines(i, {
          n: 1,
          len: 0.24,
          r: 0.07,
          y: 1.38,
          z: 0.3,
          bend: 0.3,
          rx: -0.1,
          mat: e.DARK
        }), i.add(xf2(podGeo(0.08, 0.06, 0.035, 3.2, 6), {
          y: 1.33,
          z: 0.38,
          rx: -0.4
        }), e.HOT), i.add(xf2(blobGeo(0.15, 0.12, 0.11, 2.6, 10), {
          y: 0.94,
          z: 0.4
        }), e.B);
        for (let t of [-1, 1]) i.add(xf2(blobGeo(0.055, 0.07, 0.055, 2.8, 8), {
          x: t * 0.19,
          y: 0.09,
          z: 0.19
        }), e.B), i.add(xf2(blobGeo(0.055, 0.07, 0.055, 2.8, 8), {
          x: t * 0.2,
          y: 0.09,
          z: -0.34
        }), e.B);
      }
    },
    pyrelynx: {
      plan: "quad",
      mood: "predatory",
      q: {
        bodyY: 0.94,
        rise: 0.06,
        chest: [0.23, 0.26, 0.36],
        chestZ: 0.22,
        waist: [0.165, 0.175, 0.26],
        waistZ: -0.16,
        rump: [0.245, 0.245, 0.28],
        rumpZ: -0.5,
        neck: {
          y: 1.04,
          z: 0.56,
          r0: 0.12,
          r1: 0.14
        },
        head: {
          r: 0.205,
          snout: 1.35,
          snoutR: 0.46,
          drop: 0.26,
          snoutMat: "a",
          eye: 0.26,
          sep: 0.42,
          eyeY: 0.12,
          eyeZ: 0.74
        },
        ear: "tuft",
        earScale: 1.25,
        legF: 0.7,
        legB: 0.72,
        legR: 0.056,
        legRB: 0.065,
        stanceF: 0.155,
        stanceB: 0.18,
        hipYF: 0.7,
        hipYB: 0.72,
        frontZ: 0.28,
        backZ: -0.48,
        legKind: "digitigrade",
        foot: "paw"
      },
      tail: {
        y: 0.98,
        z: -0.7,
        len: 0.56,
        r: 0.048,
        rx: -1.15,
        tip: "flame"
      },
      sig(i) {
        spines(i, {
          n: 2,
          len: 0.32,
          r: 0.042,
          y: 1.18,
          z: 0.46,
          spread: 0.1,
          bend: 1,
          rx: -0.1
        });
        for (let e = 0; e < 11; e++) {
          let t = e / 11 * TAU;
          i.add(xf2(profile(0.34 - Math.abs(Math.sin(t)) * 0.08, 0.15, 0.45, 7), {
            x: Math.cos(t) * 0.2,
            y: 1 + Math.sin(t) * 0.2,
            z: 0.34,
            rz: t,
            rx: -0.8
          }), e % 2 ? i.P.B : i.P.ACC);
        }
      }
    },
    vulcanth: {
      plan: "quad",
      mood: "fierce",
      q: {
        bodyY: 0.8,
        rise: 0.26,
        chest: [0.46, 0.44, 0.42],
        chestZ: 0.2,
        waist: [0.27, 0.26, 0.22],
        waistZ: -0.24,
        rump: [0.26, 0.24, 0.24],
        rumpZ: -0.48,
        neck: {
          y: 1.1,
          z: 0.5,
          r0: 0.27,
          r1: 0.24
        },
        head: {
          r: 0.27,
          snout: 1,
          snoutR: 0.7,
          drop: 0.16,
          eye: 0.2,
          sep: 0.44,
          eyeY: 0.1,
          eyeZ: 0.78,
          n: 3
        },
        ear: "none",
        legF: 0.58,
        legB: 0.34,
        legR: 0.145,
        legRB: 0.095,
        stanceF: 0.35,
        stanceB: 0.21,
        hipYF: 0.58,
        hipYB: 0.34,
        frontZ: 0.3,
        backZ: -0.46,
        legKind: "column",
        legKindF: "column",
        foot: "slab",
        splayF: 0.12
      },
      tail: {
        y: 0.74,
        z: -0.64,
        len: 0.4,
        r: 0.09,
        rx: -0.5,
        tip: "club",
        mat: "b"
      },
      sig(i) {
        spines(i, {
          n: 3,
          len: 0.5,
          r: 0.08,
          y: 1.36,
          z: 0.22,
          spread: 0.18,
          bend: 0.12,
          rx: -0.02,
          mat: i.P.B
        });
        for (let e of [-1, 1]) i.add(xf2(blobGeo(0.24, 0.16, 0.28, 5.6, 9), {
          x: e * 0.4,
          y: 1.26,
          z: 0.08,
          rz: e * 0.34
        }), i.P.B), i.add(xf2(spikeGeo(0.08, 0.42, 5), {
          x: e * 0.46,
          y: 1.46,
          z: 0.04,
          rz: e * 0.5,
          rx: -0.25
        }), i.P.DARK);
      }
    },
    sparkit: {
      plan: "quad",
      mood: "eager",
      q: {
        bodyY: 0.7,
        rise: 0.02,
        chest: [0.2, 0.21, 0.22],
        chestZ: 0.1,
        waist: [0.16, 0.17, 0.16],
        waistZ: -0.1,
        rump: [0.21, 0.2, 0.18],
        rumpZ: -0.28,
        neck: {
          y: 0.9,
          z: 0.24,
          r0: 0.09,
          r1: 0.11
        },
        head: {
          r: 0.185,
          snout: 0.8,
          snoutR: 0.55,
          drop: 0.24,
          eye: 0.34,
          sep: 0.46,
          eyeY: 0.04,
          eyeZ: 0.8
        },
        ear: "antenna",
        earScale: 1.35,
        legF: 0.52,
        legB: 0.54,
        legR: 0.042,
        stanceF: 0.13,
        stanceB: 0.15,
        hipYF: 0.52,
        hipYB: 0.54,
        frontZ: 0.16,
        backZ: -0.28,
        legKind: "digitigrade",
        foot: "paw"
      },
      tail: {
        y: 0.74,
        z: -0.38,
        len: 0.34,
        r: 0.035,
        rx: -1.3,
        tip: "bolt"
      },
      sig(i) {
        for (let e = 0; e < 7; e++) {
          let t = -1 + e / 6 * 2;
          i.add(xf2(UNIT_OCTA, {
            x: Math.sin(t) * 0.17,
            y: 0.88 + Math.cos(t) * 0.1,
            z: 0.2,
            sx: 0.03,
            sy: 0.13,
            sz: 0.025,
            rz: -t * 1.1,
            rx: -0.5
          }), i.P.ACC);
        }
      }
    },
    voltmane: {
      plan: "quad",
      mood: "fierce",
      q: {
        bodyY: 0.9,
        rise: 0.07,
        chest: [0.3, 0.31, 0.34],
        chestZ: 0.18,
        waist: [0.23, 0.24, 0.24],
        waistZ: -0.16,
        rump: [0.28, 0.28, 0.26],
        rumpZ: -0.46,
        neck: {
          y: 1.08,
          z: 0.44,
          r0: 0.16,
          r1: 0.17
        },
        head: {
          r: 0.23,
          snout: 1.2,
          snoutR: 0.52,
          drop: 0.24,
          eye: 0.24,
          sep: 0.44,
          eyeY: 0.08,
          eyeZ: 0.76
        },
        ear: "tuft",
        earScale: 1,
        legF: 0.58,
        legB: 0.6,
        legR: 0.068,
        stanceF: 0.19,
        stanceB: 0.21,
        hipYF: 0.58,
        hipYB: 0.6,
        frontZ: 0.24,
        backZ: -0.44,
        legKind: "digitigrade",
        foot: "paw"
      },
      tail: {
        y: 0.94,
        z: -0.64,
        len: 0.6,
        r: 0.05,
        rx: -1.25,
        tip: "bolt"
      },
      sig(i) {
        spines(i, {
          n: 2,
          len: 0.3,
          r: 0.042,
          y: 1.22,
          z: 0.36,
          spread: 0.11,
          bend: 1.1,
          rx: 0.1,
          mat: i.P.ACC
        });
        for (let e of [-1, 1]) i.add(xf2(spikeGeo(0.07, 0.42, 5), {
          x: e * 0.27,
          y: 1.22,
          z: 0.06,
          rz: e * 0.4,
          rx: -0.25
        }), i.P.B);
        for (let e = 0; e < 9; e++) {
          let t = -1.4 + e / 8 * 2.8;
          i.add(xf2(UNIT_OCTA, {
            x: Math.sin(t) * 0.2,
            y: 1.06 + Math.cos(t) * 0.2,
            z: 0.26,
            sx: 0.035,
            sy: 0.17,
            sz: 0.03,
            rz: -t,
            rx: -0.5
          }), e % 2 ? i.P.ACC : i.P.B);
        }
        for (let e = 0; e < 5; e++) {
          let t = e / 4 - 0.5;
          i.add(xf2(UNIT_OCTA, {
            x: t * 0.48,
            y: 1.44 + (0.25 - t * t) * 0.4,
            z: 0,
            sx: 0.022,
            sy: 0.055,
            sz: 0.022,
            rz: t * 2.2
          }), i.P.HOT);
        }
      }
    },
    tidefin: {
      plan: "serpent",
      mood: "wary",
      s: {
        spine: [[0.3, 0.11, -0.66], [-0.26, 0.16, -0.34], [0.18, 0.26, 0.02], [-0.04, 0.42, 0.34], [0, 0.5, 0.56], [0, 0.52, 0.72]],
        rAt: bez3(0.035, 0.2, 0.12),
        scutes: 9,
        head: {
          y: 0.56,
          z: 0.9,
          r: 0.19,
          snout: 1.2,
          snoutR: 0.58,
          eye: 0.26,
          sep: 0.54,
          eyeY: 0.24,
          eyeZ: 0.7,
          frill: 1.2
        }
      },
      sig(i) {
        for (let e of [-1, 1]) {
          i.add(xf2(profile(0.3, 0.16, 0.4, 9), {
            x: 0.3,
            y: 0.14,
            z: -0.68,
            rz: e * 1.2,
            ry: 0.5,
            rx: -0.3
          }), i.P.ACC);
          for (let t = 0; t < 3; t++) i.add(xf2(podGeo(0.012, 0.05, 0.012, 3, 4), {
            x: e * 0.16,
            y: 0.52,
            z: 0.62 - t * 0.07,
            rz: e * 1.2
          }), i.P.DARK);
        }
      }
    },
    maelstride: {
      plan: "serpent",
      mood: "serene",
      s: {
        spine: [[-0.4, 0.1, -0.7], [0.34, 0.16, -0.34], [-0.28, 0.36, 0.06], [0.1, 0.74, 0.24], [-0.04, 1.1, 0.06], [0, 1.34, 0.2]],
        rAt: bez3(0.04, 0.22, 0.13),
        scutes: 11,
        head: {
          y: 1.5,
          z: 0.38,
          r: 0.23,
          snout: 1,
          snoutR: 0.58,
          eye: 0.24,
          sep: 0.54,
          eyeY: 0.2,
          eyeZ: 0.7,
          frill: 1.4
        }
      },
      sig(i) {
        spines(i, {
          n: 3,
          len: 0.36,
          r: 0.042,
          y: 1.64,
          z: 0.18,
          spread: 0.14,
          bend: 1,
          rx: -0.1,
          mat: i.P.LIGHT
        });
        for (let e of [-1, 1]) i.add(xf2(finProfile(0.74, 0.44), {
          x: e * 0.14,
          y: 1.04,
          z: 0.06,
          rx: 0.9,
          rz: e * 0.4,
          sx: e
        }), i.P.ACC), i.add(xf2(profile(0.42, 0.2, 0.4, 8), {
          x: e * 0.16,
          y: 0.66,
          z: 0.16,
          rz: e * 1.3,
          rx: -0.3,
          ry: e * 0.4
        }), i.P.ACC);
      }
    },
    glacilisk: {
      plan: "serpent",
      mood: "predatory",
      s: {
        spine: [[0.44, 0.13, -0.7], [-0.34, 0.17, -0.4], [0.3, 0.22, -0.06], [-0.16, 0.3, 0.28], [0.06, 0.44, 0.54], [0, 0.6, 0.7]],
        rAt: bez3(0.04, 0.21, 0.15),
        scutes: 10,
        head: {
          y: 0.68,
          z: 0.88,
          r: 0.2,
          snout: 1.25,
          snoutR: 0.52,
          n: 3.6,
          eye: 0.22,
          sep: 0.5,
          eyeY: 0.24,
          eyeZ: 0.72
        }
      },
      sig(i) {
        spines(i, {
          n: 2,
          len: 0.34,
          r: 0.05,
          y: 0.82,
          z: 0.78,
          spread: 0.12,
          bend: 0.9,
          rx: -0.1,
          mat: i.P.MET
        });
        for (let e of [0.3, 0.52, 0.74]) {
          let t = i.spine(1 - e);
          i.add(xf2(new TorusGeometry(t.r * 1.06, t.r * 0.16, 5, 10), {
            x: t.x,
            y: t.y,
            z: t.z,
            rx: 1.3
          }), i.P.MET);
        }
      }
    },
    duskmaw: {
      plan: "serpent",
      mood: "fierce",
      s: {
        spine: [[0.4, 0.12, -0.62], [-0.3, 0.18, -0.28], [0.24, 0.34, 0.06], [-0.02, 0.62, 0.2], [0, 0.86, 0.06], [0, 1, 0.16]],
        rAt: bez3(0.05, 0.24, 0.18),
        scutes: 8,
        head: {
          y: 1.16,
          z: 0.4,
          r: 0.3,
          snout: 1.25,
          snoutR: 0.68,
          n: 2.8,
          eye: 0.2,
          sep: 0.5,
          eyeY: 0.3,
          eyeZ: 0.66
        }
      },
      sig(i) {
        maw(i, {
          y: 1.06,
          z: 0.72,
          w: 0.19,
          h: 0.13,
          open: 0.5,
          teeth: 6
        }), spines(i, {
          n: 3,
          len: 0.36,
          r: 0.055,
          y: 1.3,
          z: 0.2,
          spread: 0.15,
          bend: 0.7,
          rx: -0.4
        });
      }
    },
    leviathorn: {
      plan: "serpent",
      mood: "fierce",
      s: {
        spine: [[-0.52, 0.13, -0.9], [0.48, 0.2, -0.44], [-0.4, 0.44, 0.06], [0.14, 0.86, 0.3], [-0.06, 1.26, 0.1], [0, 1.52, 0.24]],
        rAt: bez3(0.06, 0.3, 0.2),
        scutes: 13,
        head: {
          y: 1.72,
          z: 0.44,
          r: 0.3,
          snout: 1.2,
          snoutR: 0.64,
          eye: 0.2,
          sep: 0.52,
          eyeY: 0.26,
          eyeZ: 0.68,
          frill: 1.6
        }
      },
      sig(i) {
        spines(i, {
          n: 4,
          len: 0.46,
          r: 0.06,
          y: 1.88,
          z: 0.24,
          spread: 0.18,
          bend: 0.8,
          rx: -0.35,
          mat: i.P.LIGHT
        }), maw(i, {
          y: 1.6,
          z: 0.78,
          w: 0.2,
          h: 0.13,
          open: 0.35,
          teeth: 7
        });
        for (let e of [-1, 1]) i.add(xf2(profile(0.5, 0.26, 0.45, 10), {
          x: -0.5,
          y: 0.16,
          z: -0.92,
          rz: e * 1.15,
          ry: 0.6,
          rx: -0.3
        }), i.P.ACC);
      }
    },
    zephyrb: {
      plan: "avian",
      mood: "curious",
      a: {
        body: [0.29, 0.32, 0.28],
        bodyY: 0.8,
        bodyZ: 0,
        lean: 0.2,
        neckY: 1.02,
        neckZ: 0.04,
        neckR: [0.12, 0.095],
        headY: 1.18,
        headZ: 0.06,
        headR: 0.2,
        eye: 0.36,
        sep: 0.58,
        eyeY: 0.1,
        eyeZ: 0.58,
        beak: {
          len: 0.26,
          r: 0.46,
          drop: 0.16
        },
        tail: {
          n: 3,
          len: 0.42,
          w: 0.14
        },
        stance: 0.095,
        hipY: 0.32,
        legLen: 0.32,
        legR: 0.034,
        legZ: 0.02,
        legMat: "light",
        wing: {
          span: 0.66,
          chord: 0.4,
          y: 0.86,
          z: -0.02,
          layers: 2,
          root: 0.16
        }
      },
      sig(i) {
        for (let e = 0; e < 3; e++) i.add(xf2(profile(0.34 - e * 0.06, 0.11, 0.5, 8), {
          x: (e - 1) * 0.045,
          y: 1.26,
          z: -0.02,
          rx: -0.9 - e * 0.12,
          rz: (e - 1) * 0.3
        }), i.P.B);
      }
    },
    cirrowing: {
      plan: "avian",
      mood: "serene",
      a: {
        body: [0.26, 0.33, 0.26],
        bodyY: 0.92,
        lean: 0.3,
        neckY: 1.18,
        neckZ: 0.06,
        neckR: [0.11, 0.085],
        headY: 1.36,
        headZ: 0.08,
        headR: 0.185,
        eye: 0.32,
        sep: 0.58,
        eyeY: 0.08,
        eyeZ: 0.6,
        beak: {
          len: 0.32,
          r: 0.36,
          drop: 0.12
        },
        tail: {
          n: 5,
          len: 0.76,
          w: 0.11,
          rx: 0.25
        },
        stance: 0.09,
        hipY: 0.4,
        legLen: 0.4,
        legR: 0.03,
        legMat: "light",
        wing: {
          span: 1.1,
          chord: 0.38,
          y: 0.98,
          z: -0.02,
          layers: 3,
          falloff: 0.2,
          bone: !0,
          root: 0.15,
          sweep: -0.34
        }
      },
      sig(i) {
        for (let e = 0; e < 4; e++) i.add(xf2(profile(0.3, 0.07, 0.55, 7), {
          x: (e - 1.5) * 0.05,
          y: 1.44,
          z: -0.04,
          rx: -1.1,
          rz: (e - 1.5) * 0.22
        }), i.P.HOT);
      }
    },
    nocturnix: {
      plan: "avian",
      mood: "predatory",
      a: {
        body: [0.26, 0.3, 0.27],
        bodyY: 0.9,
        lean: 0.36,
        neckY: 1.12,
        neckZ: 0.1,
        neckR: [0.12, 0.1],
        headY: 1.26,
        headZ: 0.14,
        headR: 0.195,
        eye: 0.28,
        sep: 0.58,
        eyeY: 0.1,
        eyeZ: 0.6,
        beak: {
          len: 0.3,
          r: 0.48,
          drop: 0.1,
          hook: !0,
          mat: "dark"
        },
        tail: {
          n: 3,
          len: 0.6,
          w: 0.14,
          rx: 0.1
        },
        stance: 0.1,
        hipY: 0.4,
        legLen: 0.4,
        legR: 0.036,
        legMat: "dark",
        wing: {
          span: 0.92,
          chord: 0.44,
          y: 1,
          z: -0.04,
          layers: 2,
          falloff: 0.32,
          bone: !0,
          root: 0.13
        }
      },
      sig(i) {
        spines(i, {
          n: 2,
          len: 0.3,
          r: 0.04,
          y: 1.38,
          z: -0.02,
          spread: 0.1,
          bend: 0.4,
          rx: -0.2
        });
        for (let e = 0; e < 6; e++) {
          let t = -1.1 + e / 5 * 2.2;
          i.add(xf2(profile(0.26, 0.1, 0.5, 6), {
            x: Math.sin(t) * 0.2,
            y: 1.02,
            z: -0.12,
            rz: t,
            rx: -1.5
          }), i.P.DARK);
        }
      }
    },
    aurorix: {
      plan: "avian",
      mood: "serene",
      a: {
        body: [0.28, 0.34, 0.29],
        bodyY: 0.98,
        lean: 0.26,
        neckY: 1.26,
        neckZ: 0.08,
        neckR: [0.12, 0.095],
        headY: 1.46,
        headZ: 0.1,
        headR: 0.2,
        eye: 0.3,
        sep: 0.6,
        eyeY: 0.08,
        eyeZ: 0.62,
        beak: {
          len: 0.32,
          r: 0.38,
          drop: 0.12
        },
        tail: {
          n: 5,
          len: 0.86,
          w: 0.12,
          rx: 0.3
        },
        stance: 0.1,
        hipY: 0.44,
        legLen: 0.44,
        legR: 0.032,
        legMat: "light",
        wing: {
          span: 1.25,
          chord: 0.42,
          y: 1.06,
          z: -0.02,
          layers: 3,
          falloff: 0.18,
          bone: !0,
          root: 0.13
        }
      },
      sig(i) {
        spines(i, {
          n: 4,
          len: 0.34,
          r: 0.035,
          y: 1.6,
          z: -0.02,
          spread: 0.13,
          bend: 0.2,
          rx: -0.05,
          mat: i.P.LIGHT
        });
        for (let e = 0; e < 5; e++) i.add(xf2(UNIT_OCTA, {
          x: (e - 2) * 0.07,
          y: 0.88 - Math.abs(e - 2) * 0.05,
          z: -0.36,
          sx: 0.035,
          sy: 0.3 - Math.abs(e - 2) * 0.05,
          sz: 0.03,
          rx: -0.5
        }), i.P.HOT);
      }
    },
    stormcaller: {
      plan: "avian",
      mood: "fierce",
      a: {
        body: [0.34, 0.4, 0.36],
        bodyY: 1.02,
        lean: 0.34,
        neckY: 1.4,
        neckZ: 0.16,
        neckR: [0.17, 0.12],
        headY: 1.7,
        headZ: 0.2,
        headR: 0.23,
        eye: 0.26,
        sep: 0.58,
        eyeY: 0.08,
        eyeZ: 0.62,
        beak: {
          len: 0.34,
          r: 0.46,
          drop: 0.1,
          hook: !0
        },
        tail: {
          n: 5,
          len: 1.05,
          w: 0.17,
          rx: 0.1
        },
        stance: 0.14,
        hipY: 0.5,
        legLen: 0.5,
        legR: 0.05,
        legMat: "dark",
        wing: {
          span: 1.55,
          chord: 0.72,
          y: 1.18,
          z: -0.04,
          layers: 3,
          falloff: 0.2,
          bone: !0,
          root: 0.2,
          raise: 1.15,
          sweep: -0.36
        }
      },
      sig(i) {
        for (let e = 0; e < 5; e++) {
          let t = e / 4 - 0.5;
          i.add(xf2(UNIT_OCTA, {
            x: t * 0.2,
            y: 1.92 - Math.abs(t) * 0.16,
            z: 0.02,
            sx: 0.035,
            sy: 0.26 - Math.abs(t) * 0.08,
            sz: 0.03,
            rz: t * 1.5
          }), i.P.HOT);
        }
        i.add(xf2(new TorusGeometry(0.15, 0.04, 5, 12), {
          y: 1.02,
          z: 0.3,
          rx: 0.25
        }), i.P.DARK);
        for (let e of [-1, 1]) i.add(xf2(spikeGeo(0.05, 0.44, 5), {
          x: e * 0.3,
          y: 1.36,
          z: -0.18,
          rz: e * 0.7,
          rx: -0.5
        }), i.P.DARK);
      }
    },
    pebblin: {
      plan: "golem",
      mood: "wary",
      g: {
        torso: [0.34, 0.3, 0.28],
        torsoY: 0.62,
        hard: 5.6,
        shoulderW: 1,
        lopsided: 0.55,
        headY: 1.02,
        headR: 0.2,
        snout: 0.25,
        headHard: 4.2,
        eye: 0.26,
        sep: 0.42,
        eyeZ: 0.84,
        armR: 0.08,
        armLen: 0.34,
        stance: 0.17,
        hipY: 0.3,
        legLen: 0.3,
        legR: 0.105,
        foot: "slab"
      },
      sig(i) {
        for (let e = 0; e < 5; e++) {
          let t = e / 5 * TAU + 0.6,
            n = 0.5 + i.rnd();
          i.add(xf2(blobGeo(0.12 * n, 0.1 * n, 0.1 * n, 6, 7), {
            x: Math.cos(t) * 0.3,
            y: 0.62 + Math.sin(t * 1.7) * 0.2,
            z: Math.sin(t) * 0.24
          }), i.P.B);
        }
      }
    },
    boulderon: {
      plan: "golem",
      mood: "fierce",
      g: {
        torso: [0.44, 0.4, 0.34],
        torsoY: 0.86,
        hard: 5.4,
        shoulderW: 1.18,
        lopsided: 0.6,
        headY: 1.36,
        headR: 0.22,
        snout: 0.3,
        headHard: 4.4,
        eye: 0.22,
        sep: 0.42,
        eyeZ: 0.84,
        armR: 0.11,
        armLen: 0.5,
        bigArm: 1,
        bigArmScale: 1.6,
        stance: 0.22,
        hipY: 0.42,
        legLen: 0.42,
        legR: 0.14,
        foot: "slab"
      },
      sig(i) {
        spines(i, {
          n: 2,
          len: 0.3,
          r: 0.06,
          y: 1.5,
          z: -0.04,
          spread: 0.13,
          bend: 0.5,
          rx: -0.3,
          mat: i.P.MET
        });
        for (let e = 0; e < 3; e++) i.add(xf2(new TorusGeometry(0.2, 0.035, 4, 10), {
          x: 0.66,
          y: 1 - e * 0.18,
          z: 0
        }), i.P.MET);
      }
    },
    coglet: {
      plan: "golem",
      mood: "curious",
      g: {
        torso: [0.28, 0.3, 0.25],
        torsoY: 0.66,
        hard: 6,
        shoulderW: 1.05,
        headY: 1.06,
        headR: 0.19,
        snout: 0.15,
        headHard: 5,
        visor: !0,
        armR: 0.07,
        armLen: 0.32,
        stance: 0.15,
        hipY: 0.3,
        legLen: 0.3,
        legR: 0.09,
        foot: "slab"
      },
      sig(i) {
        gear(i, {
          y: 0.68,
          z: 0.26,
          r: 0.11,
          teeth: 8,
          ry: 0
        }), i.add(xf2(taperGeo(0.032, 0.05, 0.2, 6), {
          x: 0.14,
          y: 1,
          z: -0.2
        }), i.P.MET), i.add(xf2(new SphereGeometry(0.04, 6, 5), {
          x: 0.14,
          y: 1.12,
          z: -0.2
        }), i.P.HOT), beads(i, [[0.2, 0.82, 0.16], [-0.2, 0.82, 0.16], [0.2, 0.5, 0.16], [-0.2, 0.5, 0.16]], {
          mat: i.P.LIGHT
        });
      }
    },
    ferrogeist: {
      plan: "golem",
      mood: "fierce",
      g: {
        torso: [0.4, 0.34, 0.3],
        torsoY: 1.1,
        hard: 5.6,
        shoulderW: 1.3,
        headY: 1.56,
        headR: 0.2,
        snout: 0.1,
        headHard: 5.2,
        visor: !0,
        armR: 0.09,
        armLen: 0.5,
        float: !0
      },
      sig(i) {
        puff(i, {
          y: 0.5,
          z: -0.02,
          r: 0.18,
          n: 7,
          spread: 0.26,
          down: 0.3
        });
        for (let e of [-1, 1]) {
          i.add(xf2(blobGeo(0.2, 0.13, 0.2, 4.6, 9), {
            x: e * 0.5,
            y: 1.42,
            rz: e * 0.35
          }), i.P.MET);
          for (let t = 0; t < 3; t++) i.add(xf2(spikeGeo(0.045, 0.24, 5), {
            x: e * (0.42 + t * 0.06),
            y: 1.54,
            z: (t - 1) * 0.12,
            rz: e * 0.55,
            rx: -0.2
          }), i.P.DARK);
        }
        gear(i, {
          x: 0,
          y: 1.86,
          z: -0.06,
          r: 0.16,
          teeth: 9,
          ry: 0,
          hub: i.P.HOT
        });
      }
    },
    magmadon: {
      plan: "golem",
      mood: "fierce",
      g: {
        torso: [0.52, 0.44, 0.4],
        torsoY: 0.94,
        hard: 5,
        shoulderW: 1.32,
        lopsided: 0.5,
        headY: 1.3,
        headR: 0.28,
        snout: 0.55,
        snoutR: 0.72,
        headHard: 3.6,
        eye: 0.2,
        sep: 0.42,
        eyeZ: 0.82,
        armR: 0.16,
        armLen: 0.7,
        stance: 0.28,
        hipY: 0.4,
        legLen: 0.4,
        legR: 0.19,
        foot: "slab"
      },
      sig(i) {
        spines(i, {
          n: 3,
          len: 0.5,
          r: 0.085,
          y: 1.52,
          z: -0.06,
          spread: 0.19,
          bend: 0.5,
          rx: -0.4
        }), maw(i, {
          y: 1.2,
          z: 0.5,
          w: 0.24,
          h: 0.14,
          open: 0.3,
          teeth: 7
        }), i.add(xf2(blobGeo(0.5, 0.26, 0.34, 4.2, 12), {
          y: 1.3,
          z: -0.18
        }), i.P.B);
        for (let e of [-1, 1]) for (let t = 0; t < 2; t++) i.add(xf2(taperGeo(0.1, 0.15, 0.46 - t * 0.1, 6), {
          x: e * (0.22 + t * 0.24),
          y: 1.62 - t * 0.14,
          z: -0.3 - t * 0.05,
          rx: -0.35,
          rz: e * 0.2
        }), i.P.B), i.add(xf2(new SphereGeometry(0.085, 7, 6), {
          x: e * (0.22 + t * 0.24),
          y: 1.84 - t * 0.16,
          z: -0.38 - t * 0.05
        }), i.P.HOT);
      }
    },
    nullwarden: {
      plan: "golem",
      mood: "fierce",
      g: {
        torso: [0.36, 0.54, 0.3],
        torsoY: 1.16,
        hard: 6.8,
        shoulderW: 1.45,
        headY: 1.82,
        headR: 0.22,
        snout: 0.08,
        headHard: 6,
        visor: !0,
        armR: 0.1,
        armLen: 0.92,
        stance: 0.2,
        hipY: 0.54,
        legLen: 0.54,
        legR: 0.13,
        foot: "slab"
      },
      sig(i) {
        i.add(xf2(new SphereGeometry(0.22, 10, 8), {
          y: 1.2,
          z: 0.1
        }), i.P.DARK), i.add(xf2(new TorusGeometry(0.27, 0.04, 5, 14), {
          y: 1.2,
          z: 0.12,
          rx: 0.1
        }), i.P.ACC), tuft(i, {
          y: 1.2,
          z: 0.28,
          n: 5,
          r: 0.03,
          spread: 0.11,
          mat: i.P.HOT
        }), spines(i, {
          n: 3,
          len: 0.5,
          r: 0.05,
          y: 1.98,
          z: -0.06,
          spread: 0.17,
          bend: 0.35,
          rx: -0.2,
          mat: i.P.MET
        });
        let e = new Group(),
          t = [];
        for (let s = 0; s < 6; s++) {
          let r = s / 6 * TAU;
          t.push({
            geo: xf2(podGeo(0.13, 0.13, 0.025, 5, 5), {
              x: Math.cos(r) * 0.56,
              z: Math.sin(r) * 0.56,
              ry: -r
            }),
            mat: i.P.MET
          });
        }
        let n = mergeByMaterial(t);
        e.add(n), e.position.y = 2.22, e.userData.orbit = 0.22, i.group.add(e), i.rig.tail = e;
      }
    },
    rootfather: {
      plan: "golem",
      mood: "serene",
      g: {
        torso: [0.46, 0.52, 0.38],
        torsoY: 1,
        hard: 4.2,
        shoulderW: 1.1,
        lopsided: 0.45,
        headY: 1.56,
        headR: 0.24,
        snout: 0.2,
        headHard: 3.4,
        eye: 0.2,
        sep: 0.4,
        eyeZ: 0.84,
        armR: 0.1,
        armLen: 0.66,
        stance: 0.26,
        hipY: 0.44,
        legLen: 0.44,
        legR: 0.17,
        legKind: "root",
        foot: "roots",
        torsoMat: "b"
      },
      sig(i) {
        petals(i, {
          y: 1.86,
          z: -0.06,
          n: 8,
          len: 0.58,
          w: 0.28,
          spread: 0.3,
          mat: i.P.A,
          droop: 0.5
        }), petals(i, {
          y: 1.64,
          z: -0.06,
          n: 6,
          len: 0.44,
          w: 0.22,
          spread: 0.38,
          mat: i.P.A,
          droop: 1.05
        });
        for (let e = 0; e < 4; e++) {
          let t = e / 4 * TAU + 0.5;
          i.add(xf2(new SphereGeometry(0.05, 6, 5), {
            x: Math.cos(t) * 0.3,
            y: 1.74 + Math.sin(t) * 0.08,
            z: Math.sin(t) * 0.24
          }), i.P.HOT);
        }
        tuft(i, {
          y: 1.12,
          z: 0.4,
          n: 4,
          r: 0.03,
          spread: 0.14,
          mat: i.P.HOT
        });
      }
    },
    puddlet: {
      plan: "blob",
      mood: "curious",
      b: {
        axis: [[0, 0.04, 0], [0, 0.26, 0], [0, 0.56, -0.02], [0, 0.86, -0.04]],
        rAt: curveAt([0.16, 0.33, 0.375, 0.36, 0.3, 0.19, 0.05]),
        footY: 0.08,
        faceY: 0.44,
        faceT: 0.4,
        faceZ: 1,
        eye: 0.088,
        sep: 0.14,
        mouth: !0
      },
      sig(i) {
        let e = i.P;
        for (let t = 0; t < 3; t++) {
          let n = 1 - t * 0.26;
          i.add(xf2(profile(0.34 * n, 0.2 * n, 0.9, 9), {
            x: (t - 1) * 0.05,
            y: 0.84 + t * 0.03,
            z: -0.03 - t * 0.06,
            rz: (t - 1) * 0.3,
            rx: -0.55 - t * 0.22
          }), t === 1 ? e.LIGHT : e.ACC);
        }
        for (let t of [-1, 1]) {
          for (let n = 0; n < 3; n++) i.add(xf2(profile(0.17 - n * 0.02, 0.07, 0.5, 6), {
            x: t * 0.32,
            y: 0.6 - n * 0.08,
            z: 0.1 - n * 0.02,
            rz: -t * (1.15 + n * 0.14),
            rx: -0.15,
            ry: t * 0.35
          }), e.LIGHT);
          i.add(xf2(profile(0.36, 0.21, 0.5, 9), {
            x: t * 0.33,
            y: 0.42,
            z: -0.06,
            rz: -t * 1.35,
            rx: -0.3,
            ry: t * 0.3
          }), e.ACC);
        }
        for (let t of [-1, 1]) i.add(xf2(profile(0.32, 0.18, 0.5, 8), {
          x: t * 0.08,
          y: 0.2,
          z: -0.36,
          rz: t * 1.1,
          rx: -1.15,
          ry: t * 0.25
        }), e.ACC);
        i.add(xf2(blobGeo(0.26, 0.17, 0.24, 2.6, 12), {
          y: 0.15,
          z: 0.05
        }), e.B);
      }
    },
    frostnib: {
      plan: "blob",
      mood: "sleepy",
      b: {
        axis: [[0, 0.04, 0], [0, 0.22, 0], [0, 0.44, -0.03], [0, 0.62, -0.06]],
        rAt: curveAt([0.26, 0.42, 0.45, 0.41, 0.33, 0.22, 0.09]),
        squash: 0.88,
        footY: 0.08,
        faceY: 0.34,
        faceT: 0.45,
        faceZ: 0.96,
        eye: 0.085,
        sep: 0.15,
        legs: {
          stance: 0.19,
          hipY: 0.18,
          len: 0.18,
          r: 0.07,
          foot: "slab"
        }
      },
      sig(i) {
        finPair(i, {
          y: 0.56,
          z: -0.14,
          n: 5,
          len: 0.34,
          r: 0.1,
          mat: i.P.LIGHT,
          lean: -0.2
        }), i.add(xf2(new TorusGeometry(0.34, 0.035, 4, 14), {
          y: 0.24,
          rx: HALF_PI
        }), i.P.LIGHT);
      }
    },
    mossnail: {
      plan: "blob",
      mood: "sleepy",
      b: {
        axis: [[0, 0.08, 0.34], [0, 0.12, 0.12], [0, 0.13, -0.14], [0, 0.1, -0.38]],
        rAt: curveAt([0.09, 0.15, 0.17, 0.16, 0.13, 0.08]),
        squash: 0.7,
        footY: 0.06,
        faceY: 0.345,
        faceT: 0.02,
        faceZ: 3.8,
        eye: 0.05,
        sep: 0.062
      },
      sig(i) {
        for (let e = 0; e < 4; e++) {
          let t = 1 - e * 0.24;
          i.add(xf2(new TorusGeometry(0.23 * t, 0.095 * t, 6, 14), {
            x: -0.02 + e * 0.055,
            y: 0.26 + e * 0.035,
            z: -0.08 - e * 0.03,
            ry: HALF_PI,
            rz: e * 0.5
          }), e % 2 ? i.P.B : i.P.A);
        }
        for (let e = 0; e < 5; e++) {
          let t = e / 5 * TAU;
          i.add(xf2(profile(0.15, 0.1, 0.6, 6), {
            x: Math.cos(t) * 0.1,
            y: 0.5,
            z: -0.08 + Math.sin(t) * 0.18,
            rx: -1.1 + Math.sin(t),
            ry: t
          }), i.P.ACC);
        }
        for (let e of [-1, 1]) i.add(xf2(taperGeo(0.018, 0.026, 0.2, 5, 0.03), {
          x: e * 0.062,
          y: 0.25,
          z: 0.31,
          rx: 0.3,
          rz: e * 0.3
        }), i.P.A);
      }
    },
    sproutle: {
      plan: "sprite",
      mood: "eager",
      p: {
        r: [0.3, 0.36, 0.3],
        y: 0.56,
        n: 2.3,
        faceY: 0.62,
        faceZ: 0.3,
        eye: 0.075,
        sep: 0.125,
        headR: 0.3
      },
      sig(i) {
        let e = i.P;
        for (let t of [-1, 1]) i.add(xf2(blobGeo(0.23, 0.32, 0.27, 3.1, 12), {
          x: t * 0.15,
          y: 0.47,
          z: -0.07,
          rz: t * 0.26
        }), e.B);
        i.add(xf2(podGeo(0.03, 0.3, 0.05, 4, 7), {
          y: 0.52,
          z: -0.02
        }), e.HOT), petals(i, {
          y: 0.86,
          z: -0.02,
          n: 5,
          len: 0.4,
          w: 0.23,
          spread: 0.12,
          mat: e.ACC,
          droop: 0.62
        }), petals(i, {
          y: 0.94,
          z: -0.04,
          n: 3,
          len: 0.3,
          w: 0.15,
          spread: 0.07,
          mat: e.B,
          droop: 0.3
        }), i.add(xf2(taperGeo(0.014, 0.04, 0.34, 6, 0.55), {
          y: 1,
          rz: 0.25
        }), e.B), i.add(xf2(new SphereGeometry(0.05, 8, 6), {
          y: 1.32,
          x: 0.12
        }), e.HOT);
        for (let t of [-1, 1]) i.add(xf2(blobGeo(0.1, 0.06, 0.13, 2.6, 8), {
          x: t * 0.16,
          y: 0.18,
          z: 0.05,
          rz: t * 0.3
        }), e.B);
        i.add(xf2(new SphereGeometry(0.065, 9, 7), {
          y: 0.38,
          z: 0.28
        }), e.HOT), i.add(xf2(new TorusGeometry(0.23, 0.05, 5, 12), {
          y: 0.26,
          rx: HALF_PI - 0.2
        }), e.B), i.group.userData.floats = !1;
      }
    },
    thornkin: {
      plan: "sprite",
      mood: "wary",
      p: {
        r: [0.27, 0.42, 0.26],
        y: 0.66,
        n: 3.4,
        faceY: 1.14,
        faceZ: 0.22,
        eye: 0.065,
        sep: 0.105,
        headR: 0.22
      },
      sig(i) {
        i.add(xf2(blobGeo(0.23, 0.2, 0.22, 2.8, 14), {
          y: 1.14
        }), i.P.A), i.add(xf2(taperGeo(0.11, 0.16, 0.18, 8), {
          y: 0.98
        }), i.P.B), petals(i, {
          y: 1.32,
          z: -0.02,
          n: 7,
          len: 0.44,
          w: 0.22,
          spread: 0.13,
          mat: i.P.ACC,
          droop: 0.5
        });
        for (let e = 0; e < 5; e++) {
          let t = e / 5 * TAU + 0.4;
          i.add(xf2(podGeo(0.13, 0.24, 0.055, 5.4, 8), {
            x: Math.cos(t) * 0.25,
            y: 0.62 + e % 2 * 0.18,
            z: Math.sin(t) * 0.24,
            rz: -Math.cos(t) * 1.25,
            rx: Math.sin(t) * 1.25
          }), i.P.B);
        }
        for (let e of [-1, 1]) i.add(xf2(spikeGeo(0.07, 0.38, 5), {
          x: e * 0.26,
          y: 0.92,
          z: -0.02,
          rz: e * 0.9,
          rx: -0.25
        }), i.P.DARK), i.add(xf2(spikeGeo(0.05, 0.24, 5), {
          x: e * 0.24,
          y: 0.62,
          z: 0.1,
          rz: e * 1.2,
          rx: 0.2
        }), i.P.DARK), i.add(xf2(blobGeo(0.12, 0.07, 0.16, 2.6, 8), {
          x: e * 0.15,
          y: 0.18,
          z: 0.06
        }), i.P.B);
        i.group.userData.floats = !1;
      }
    },
    glimmer: {
      plan: "sprite",
      mood: "curious",
      p: {
        r: [0.25, 0.27, 0.25],
        y: 0.78,
        n: 2.1,
        faceY: 0.82,
        faceZ: 0.25,
        eye: 0.075,
        sep: 0.11,
        headR: 0.25,
        ring: {
          n: 6,
          r: 0.44,
          len: 0.19,
          w: 0.05,
          y: 0.78,
          tilt: 0.2,
          mat: "acc"
        }
      },
      sig(i) {
        let e = i.P;
        frills(i, {
          y: 0.78,
          z: 0.26,
          n: 4,
          r: 0.07,
          spread: 0.16
        });
        for (let t = 0; t < 6; t++) {
          let n = t / 6 * TAU + 0.4;
          i.add(xf2(UNIT_OCTA, {
            x: Math.cos(n) * 0.36,
            y: 0.78 + Math.sin(n) * 0.3,
            z: Math.sin(n) * 0.14,
            sx: 0.04,
            sy: 0.11,
            sz: 0.035,
            rz: n + HALF_PI,
            rx: 0.5
          }), t % 2 ? e.ACC : e.B);
        }
        i.add(xf2(new TorusGeometry(0.17, 0.024, 5, 14, Math.PI * 1.3), {
          y: 1.22,
          z: -0.12,
          rx: -0.35,
          rz: 0.75
        }), e.ACC), i.add(xf2(UNIT_OCTA, {
          y: 1,
          z: 0.16,
          sx: 0.05,
          sy: 0.1,
          sz: 0.045,
          rx: 0.3
        }), e.HOT);
      }
    },
    solaraith: {
      plan: "sprite",
      mood: "serene",
      p: {
        r: [0.28, 0.3, 0.26],
        y: 0.9,
        n: 2.2,
        faceY: 0.94,
        faceZ: 0.26,
        eye: 0.07,
        sep: 0.115,
        headR: 0.28
      },
      sig(i) {
        for (let e = 0; e < 14; e++) {
          let t = e / 14 * TAU,
            n = e % 2 ? 1 : 0.62;
          i.add(xf2(profile(0.34 * n, 0.09, 0.3, 6), {
            x: Math.cos(t) * 0.34,
            y: 0.9 + Math.sin(t) * 0.34,
            z: -0.1,
            rz: t - HALF_PI
          }), i.P.HOT);
        }
        i.add(xf2(new TorusGeometry(0.46, 0.03, 5, 20), {
          y: 0.9,
          z: -0.08
        }), i.P.HOT);
        for (let e of [-1, 1]) i.add(xf2(profile(0.42, 0.24, 0.4, 9), {
          x: e * 0.3,
          y: 0.98,
          z: -0.14,
          rz: e * 0.9,
          rx: -0.3,
          ry: e * 0.5
        }), i.P.B);
        frills(i, {
          y: 0.9,
          z: 0.27,
          n: 5,
          r: 0.075,
          spread: 0.17
        });
      }
    },
    hollowking: {
      plan: "sprite",
      mood: "fierce",
      p: {
        r: [0.3, 0.34, 0.28],
        y: 1.12,
        n: 2.6,
        faceY: 1.16,
        faceZ: 0.26,
        eye: 0.06,
        sep: 0.1,
        headR: 0.3,
        faceKind: "void",
        voidEyes: 6,
        hood: {
          axis: [[0, 0.04, 0], [0, 0.42, -0.02], [0, 0.86, -0.02], [0, 1.2, 0]],
          rAt: i => 0.58 * Math.pow(1 - i, 0.85) + 0.06,
          voidR: 0.22,
          voidY: 1.14,
          voidZ: 0
        },
        ring: {
          n: 7,
          r: 0.5,
          len: 0.22,
          w: 0.06,
          y: 0.7,
          tilt: 0.1,
          mat: "acc"
        }
      },
      sig(i) {
        spines(i, {
          n: 5,
          len: 0.42,
          r: 0.04,
          y: 1.36,
          z: -0.04,
          spread: 0.19,
          bend: 0.25,
          rx: -0.12,
          mat: i.P.B
        }), puff(i, {
          y: 0.16,
          z: -0.04,
          r: 0.2,
          n: 7,
          spread: 0.34,
          down: 0.12
        });
        for (let e = 0; e < 3; e++) whiskers(i, {
          x: (e - 1) * 0.24,
          y: 0.5,
          z: -0.2,
          len: 0.7,
          r: 0.04,
          sway: 0.2,
          drop: 0.35,
          flip: e - 1 || 1,
          mat: i.P.B
        });
      }
    },
    umbrat: {
      plan: "insect",
      mood: "predatory",
      i: {
        thorax: [0.18, 0.16, 0.2],
        thoraxZ: 0.02,
        y: 0.42,
        abdomen: {
          r: 0.15,
          n: 3,
          taper: 0.42,
          rise: -0.02
        },
        headR: 0.14,
        headRise: 0.02,
        eye: 0.66,
        sep: 0.58,
        mandibles: !0,
        antennae: !0,
        legLen: 0.34,
        legR: 0.02,
        wing: {
          span: 0.44,
          chord: 0.26,
          y: 0.56,
          z: -0.1,
          layers: 2,
          glass: !1,
          root: 0.07
        }
      },
      sig(i) {
        for (let e = 0; e < 3; e++) i.add(xf2(spikeGeo(0.03, 0.16, 4), {
          x: (e - 1) * 0.09,
          y: 0.56,
          z: -0.02,
          rx: -0.3,
          rz: (e - 1) * 0.4
        }), i.P.DARK);
      }
    },
    emberfly: {
      plan: "insect",
      mood: "eager",
      i: {
        thorax: [0.16, 0.16, 0.18],
        thoraxZ: 0.02,
        y: 0.58,
        abdomen: {
          r: 0.13,
          n: 4,
          taper: 0.5,
          rise: 0.03
        },
        headR: 0.12,
        eye: 0.68,
        sep: 0.58,
        antennae: !0,
        legLen: 0.2,
        legR: 0.016,
        wing: {
          span: 0.5,
          chord: 0.3,
          y: 0.7,
          z: -0.06,
          layers: 2,
          glass: !0,
          root: 0.06
        }
      },
      sig(i) {
        for (let e = 0; e < 3; e++) i.add(xf2(new TorusGeometry(0.1 - e * 0.014, 0.022, 4, 9), {
          y: 0.6 + e * 0.01,
          z: -0.22 - e * 0.16,
          rx: 0.1
        }), i.P.HOT);
        i.group.userData.floats = !0;
      }
    },
    verdammoth: {
      plan: "insect",
      mood: "serene",
      i: {
        thorax: [0.3, 0.3, 0.32],
        thoraxZ: 0.04,
        y: 0.86,
        abdomen: {
          r: 0.23,
          n: 4,
          taper: 0.5,
          rise: -0.04
        },
        headR: 0.2,
        eye: 0.6,
        sep: 0.58,
        antennae: "plume",
        legLen: 0.42,
        legR: 0.026,
        wing: {
          span: 1.15,
          chord: 0.82,
          y: 1,
          z: -0.02,
          layers: 2,
          falloff: 0.3,
          root: 0.12,
          raise: 1.2,
          sweep: -0.18,
          tint: "a"
        }
      },
      sig(i) {
        for (let e = 0; e < 9; e++) {
          let t = e / 9 * TAU;
          i.add(xf2(profile(0.26, 0.14, 0.5, 6), {
            x: Math.cos(t) * 0.24,
            y: 0.86 + Math.sin(t) * 0.22,
            z: 0.16,
            rz: t,
            rx: -0.5
          }), i.P.B);
        }
        for (let e of [-1, 1]) i.add(xf2(new TorusGeometry(0.1, 0.026, 4, 10), {
          x: e * 0.5,
          y: 1.32,
          z: -0.24,
          rx: 1.35
        }), i.P.HOT);
        i.group.userData.floats = !0;
      }
    }
  },
  PLAN_BUILDERS = {
    quad: buildQuad,
    serpent: buildSerpent,
    avian: buildAvian,
    golem: buildGolem,
    blob: buildBlob,
    insect: buildInsect,
    sprite: buildSprite
  },
  PLAN_SAMPLES = {
    quad: "cindcub",
    blob: "puddlet",
    avian: "zephyrb",
    serpent: "tidefin",
    golem: "pebblin",
    insect: "umbrat",
    sprite: "glimmer"
  };

function buildCreature(i, {
  outline: e = !0,
  detail: t = 1
} = {}) {
  let n = SPECIES[i],
    s = new Group();
  if (!n) return s;
  let r = n.model,
    o = DESIGN[i] || DESIGN[PLAN_SAMPLES[r.shape]] || DESIGN.glimmer,
    a = speciesPalette(n),
    l = [],
    c = {
      legs: [],
      wings: [],
      tail: null,
      aux: []
    },
    h = {
      sp: n,
      m: r,
      d: o,
      P: a,
      group: s,
      core: l,
      rig: c,
      el: n.types[0],
      el2: n.types[1] || null,
      tier: TIER[n.rarity] ?? 0.3,
      grand: (TIER[n.rarity] ?? 0.3) >= 0.9,
      rnd: seededRandom(hashString(i)),
      anchors: {},
      add(u, f) {
        l.push({
          geo: u,
          mat: f
        });
      },
      add2(u) {
        for (let f of u) l.push(f);
      },
      seg: u => Math.max(5, Math.round(u * (t < 1 ? 0.72 : 1))),
      segK: t < 1 ? 0.72 : 1,
      spine: curveSampler([[0, 0.8, 0.2, 0.3], [0, 0.7, -0.3, 0.28]])
    };
  (PLAN_BUILDERS[o.plan] || buildBlob)(h), o.sig?.(h), applyElementKit(h), buildTail(h, o.tail);
  let d = mergeByMaterial(l, {
    castShadow: !0
  });
  if (s.add(d), c.core = d, r.glow) {
    if (QUALITY.tier !== "low") {
      let p = new PointLight(a.accent, 2.2, 5, 2);
      p.position.set(0, h.anchors.head?.y ?? 1, 0), s.add(p);
    }
    let u = Math.max(h.anchors.chest?.r ?? 0.3, h.anchors.head?.r ?? 0.3),
      f = new Mesh(new SphereGeometry(u * 1.35, 18, 12), glowMat(a.accent, 0.06));
    f.position.set(0, ((h.anchors.head?.y ?? 1) + (h.anchors.chest?.y ?? 1)) * 0.5, 0), f.userData.noOutline = !0, s.add(f), c.halo = f;
  }
  return e && outlineMat(s, {
    thickness: 0.03
  }), s.scale.setScalar(r.scale || 1), s.userData.rig = c, s.userData.speciesId = i, s.userData.phase = Math.random() * Math.PI * 2, s.userData.element = n.types[0], s;
}

function buildAvatar(i = {}, {
  outline: e = !0
} = {}) {
  let t = AVATAR.bodies.includes(i.body) ? i.body : "slim",
    n = new Color(i.skin || AVATAR.skins[0]).getHex(),
    s = new Color(i.hair || AVATAR.hair[0]).getHex(),
    r = AVATAR.outfits.find(L => L.id === i.outfit) || AVATAR.outfits[0],
    o = new Color(r.a).getHex(),
    a = new Color(r.b).getHex(),
    l = mat(n, {
      roughness: 0.62,
      env: 0.8
    }),
    c = mat(s, {
      roughness: 0.52,
      env: 0.9
    }),
    h = mat(o, {
      roughness: 0.68
    }),
    d = mat(mixHex(o, 790552, 0.35), {
      roughness: 0.7
    }),
    u = mat(a, {
      roughness: 0.75
    }),
    f = mat(mixHex(a, 658706, 0.55), {
      roughness: 0.6
    }),
    p = mat(mixHex(n, 4200732, 0.66), {
      roughness: 0.55
    }),
    x = palette(2764605),
    g = {
      slim: {
        w: 1,
        bulk: 1
      },
      stocky: {
        w: 1.14,
        bulk: 1.1
      },
      tall: {
        w: 0.95,
        bulk: 0.95
      }
    }[t],
    m = t === "tall" ? 1.86 : t === "stocky" ? 1.7 : 1.78,
    v = m / 7.6 / 2,
    E = new Group(),
    _ = {
      arms: [],
      legs: [],
      wings: []
    },
    S = [],
    b = m * 0.5,
    T = m * 0.72,
    y = m * 0.845,
    M = m * 0.925,
    P = g.w;
  S.push({
    geo: xf2(blobGeo(0.15 * P, 0.12, 0.086, 3.4, 22), {
      y: T + 0.018
    }),
    mat: h
  }), S.push({
    geo: xf2(blobGeo(0.107 * P, 0.09, 0.068, 3.4, 18), {
      y: T - 0.152
    }),
    mat: h
  }), S.push({
    geo: xf2(blobGeo(0.126 * P, 0.1, 0.082, 3.2, 18), {
      y: b + 0.082
    }),
    mat: h
  }), S.push({
    geo: xf2(blobGeo(0.118 * P, 0.026, 0.078, 4.2, 16), {
      y: T - 0.235
    }),
    mat: d
  }), S.push({
    geo: xf2(blobGeo(0.062 * P, 0.04, 0.052, 3, 14), {
      y: y - 0.035,
      z: 0.02
    }),
    mat: d
  });
  for (let L of [-1, 1]) S.push({
    geo: xf2(blobGeo(0.052 * P, 0.044, 0.052, 2.6, 12), {
      x: L * 0.142 * P,
      y: T + 0.078
    }),
    mat: h
  });
  S.push({
    geo: xf2(capsuleGeo(0.038, 0.05), {
      y
    }),
    mat: l
  }), S.push({
    geo: xf2(blobGeo(v * 0.92, v * 1.03, v * 0.95, 2.6, 22), {
      y: M
    }),
    mat: l
  }), S.push({
    geo: xf2(blobGeo(v * 0.66, v * 0.4, v * 0.4, 2.9, 16), {
      y: M - v * 0.44,
      z: v * 0.3
    }),
    mat: l
  }), S.push({
    geo: xf2(blobGeo(v * 0.3, v * 0.19, v * 0.22, 2.7, 12), {
      y: M - v * 0.72,
      z: v * 0.46
    }),
    mat: l
  }), S.push({
    geo: xf2(blobGeo(v * 0.1, v * 0.09, v * 0.13, 2.4, 10), {
      y: M - v * 0.24,
      z: v * 0.95
    }),
    mat: l
  }), S.push({
    geo: xf2(blobGeo(v * 0.16, v * 0.028, v * 0.05, 3, 10), {
      y: M - v * 0.55,
      z: v * 0.8
    }),
    mat: p
  }), S.push({
    geo: xf2(blobGeo(v * 1.02, v * 0.55, v * 1.03, 2.6, 22), {
      y: M + v * 0.55
    }),
    mat: c
  }), S.push({
    geo: xf2(blobGeo(v * 0.86, v * 0.16, v * 0.34, 2.6, 16), {
      y: M + v * 0.52,
      z: v * 0.62
    }),
    mat: c
  }), S.push({
    geo: xf2(blobGeo(v * 0.4, v * 0.22, v * 0.24, 2.4, 12), {
      x: v * 0.44,
      y: M + v * 0.6,
      z: v * 0.66,
      rz: 0.42
    }),
    mat: c
  });
  for (let L of [-1, 1]) S.push({
    geo: xf2(blobGeo(v * 0.24, v * 0.44, v * 0.54, 2.6, 14), {
      x: L * v * 0.84,
      y: M + v * 0.1,
      z: -v * 0.12
    }),
    mat: c
  });
  S.push({
    geo: xf2(blobGeo(v * 0.86, v * 0.74, v * 0.46, 2.6, 16), {
      y: M - v * 0.1,
      z: -v * 0.7
    }),
    mat: c
  });
  for (let L of [-1, 1]) S.push({
    geo: xf2(blobGeo(v * 0.14, v * 0.26, v * 0.16, 2.4, 10), {
      x: L * v * 0.92,
      y: M - v * 0.05
    }),
    mat: l
  });
  let A = v * 0.2;
  S.push(...eyeParts(x, {
    x: -v * 0.36,
    y: M - v * 0.04,
    z: v * 0.9,
    r: A,
    look: -1
  })), S.push(...eyeParts(x, {
    x: v * 0.36,
    y: M - v * 0.04,
    z: v * 0.9,
    r: A,
    look: 1
  }));
  for (let L of [-1, 1]) S.push({
    geo: xf2(blobGeo(v * 0.17, v * 0.026, v * 0.04, 3, 8), {
      x: L * v * 0.36,
      y: M + v * 0.17,
      z: v * 0.88,
      rz: L * 0.14
    }),
    mat: c
  });
  let k = mergeByMaterial(S, {
    castShadow: !0
  });
  E.add(k), _.core = k;
  for (let L of [-1, 1]) {
    let O = mergeByMaterial([{
      geo: xf2(capsuleGeo(0.036 * g.bulk, 0.17), {
        y: -0.1
      }),
      mat: h
    }, {
      geo: xf2(capsuleGeo(0.031 * g.bulk, 0.16), {
        y: -0.29
      }),
      mat: l
    }, {
      geo: xf2(blobGeo(0.036, 0.048, 0.028, 2.6, 10), {
        y: -0.4
      }),
      mat: l
    }]);
    O.position.set(L * 0.158 * g.w, T + 0.07, 0), E.add(O), _.arms.push(O);
  }
  for (let L of [-1, 1]) {
    let O = mergeByMaterial([{
      geo: xf2(capsuleGeo(0.055 * g.bulk, 0.2), {
        y: -0.13
      }),
      mat: u
    }, {
      geo: xf2(capsuleGeo(0.044 * g.bulk, 0.2), {
        y: -0.38
      }),
      mat: u
    }, {
      geo: xf2(blobGeo(0.05, 0.05, 0.085, 3, 12), {
        y: -0.52,
        z: 0.028
      }),
      mat: f
    }]);
    O.position.set(L * 0.062 * g.w, b - 0.02, 0), E.add(O), _.legs.push(O);
  }
  return e && outlineMat(E, {
    thickness: 0.02,
    opacity: 0.45
  }), E.userData.rig = _, E.userData.phase = Math.random() * Math.PI * 2, E.userData.height = m, E;
}

function setCreatureLod(i, e) {
  let t = i.userData.rig;
  if (!t) return;
  let n = e > 28;
  if (i.userData._far !== n) {
    i.userData._far = n;
    for (let s of [...(t.legs || []), ...(t.arms || [])]) s.visible = !n;
    for (let s of t.wings || []) (s.node || s).visible = !n;
    t.tail && (t.tail.visible = !n);
  }
}

function animateCreature(i, e, t = !1, n = 1) {
  let s = i.userData.rig;
  if (!s) return;
  let r = e * 0.001 + (i.userData.phase || 0),
    o = r * (t ? 7.5 * n : 1.5),
    a = t ? Math.sin(o) * 0.72 : Math.sin(r * 1.3) * 0.06,
    l = t ? Math.abs(Math.sin(o)) * 0.035 : 0,
    c = Math.sin(r * 1.9) * 0.014,
    h = i.userData.baseY || 0;
  if (i.userData.floats ? i.position.y = h + 0.28 + Math.sin(r * 1.4) * 0.08 : i.position.y = h + l, s.core && (s.core.scale.set(1 + c * 0.5, 1 - c * 0.4, 1 + c * 0.5), s.core.rotation.x = t ? 0.06 : Math.sin(r * 1.1) * 0.01), s.legs?.forEach((d, u) => {
    let f = u % 2 === 0 ? 1 : -1,
      p = s.legs.length > 2 && u >= 2 ? Math.PI : 0;
    d.rotation.x = Math.sin(o + p) * f * (t ? 0.62 : 0.05);
  }), s.arms?.forEach((d, u) => {
    let f = u % 2 === 0 ? -1 : 1;
    d.rotation.x = a * f * 0.8, d.rotation.z = (u === 0 ? 1 : -1) * (0.09 + (t ? 0.03 : 0));
  }), s.wings?.forEach(d => {
    if (d.isArm) d.node.rotation.x = a * (d.side > 0 ? -1 : 1) * 0.5 - 0.12, d.node.rotation.z = d.side * 0.3;else {
      let u = Math.sin(t ? r * 11 : r * 3.4);
      d.node.rotation.z = d.side * (0.18 + u * 0.42), d.node.rotation.x = u * 0.12;
    }
  }), s.tail) {
    let d = s.tail.userData.orbit;
    d ? s.tail.rotation.y = r * d : (s.tail.rotation.y = Math.sin(r * 2.1) * 0.3, s.tail.rotation.z = Math.sin(r * 1.7) * 0.14);
  }
  if (s.halo) {
    let d = 1 + Math.sin(r * 2.2) * 0.06;
    s.halo.scale.setScalar(d);
  }
}

export { DESIGN, PLAN_BUILDERS, PLAN_SAMPLES, animateCreature, bez3, buildAvatar, buildCreature, setCreatureLod };
