var sb = 1.0594630943592953,
  noteHz = i => 440 * sb ** (i - 69),
  SCALES = {
    major: [0, 2, 4, 7, 9],
    dorian: [0, 2, 3, 5, 7, 10],
    lydian: [0, 2, 4, 6, 7, 9],
    minor: [0, 2, 3, 5, 7, 10],
    phrygian: [0, 1, 3, 5, 7, 8]
  },
  ZONE_MUSIC = {
    verdant_meadow: {
      root: 57,
      scale: "major",
      bpm: 96,
      warmth: 0.62,
      pad: 0.3
    },
    ember_ridge: {
      root: 53,
      scale: "phrygian",
      bpm: 108,
      warmth: 0.42,
      pad: 0.26
    },
    tidal_hollow: {
      root: 55,
      scale: "dorian",
      bpm: 84,
      warmth: 0.72,
      pad: 0.38
    },
    frostpeak: {
      root: 60,
      scale: "lydian",
      bpm: 76,
      warmth: 0.85,
      pad: 0.44
    },
    duskfen: {
      root: 50,
      scale: "minor",
      bpm: 88,
      warmth: 0.34,
      pad: 0.4
    },
    battle: {
      root: 52,
      scale: "minor",
      bpm: 132,
      warmth: 0.4,
      pad: 0.2
    },
    dungeon: {
      root: 48,
      scale: "phrygian",
      bpm: 116,
      warmth: 0.3,
      pad: 0.34
    },
    boss: {
      root: 45,
      scale: "minor",
      bpm: 144,
      warmth: 0.26,
      pad: 0.18
    }
  },
  SFX = {
    ember: {
      type: "sawtooth",
      base: 220,
      sweep: -0.55,
      noise: 0.5,
      len: 0.34,
      bite: 2400
    },
    tide: {
      type: "sine",
      base: 320,
      sweep: -0.3,
      noise: 0.35,
      len: 0.42,
      bite: 1400
    },
    verdant: {
      type: "triangle",
      base: 260,
      sweep: 0.18,
      noise: 0.28,
      len: 0.3,
      bite: 1800
    },
    spark: {
      type: "square",
      base: 520,
      sweep: -0.7,
      noise: 0.6,
      len: 0.22,
      bite: 4200
    },
    stone: {
      type: "sawtooth",
      base: 110,
      sweep: -0.2,
      noise: 0.7,
      len: 0.4,
      bite: 900
    },
    gale: {
      type: "triangle",
      base: 420,
      sweep: 0.4,
      noise: 0.75,
      len: 0.36,
      bite: 3200
    },
    frost: {
      type: "sine",
      base: 700,
      sweep: -0.35,
      noise: 0.3,
      len: 0.4,
      bite: 5200
    },
    shade: {
      type: "sawtooth",
      base: 150,
      sweep: -0.45,
      noise: 0.45,
      len: 0.46,
      bite: 1100
    },
    lumen: {
      type: "sine",
      base: 880,
      sweep: 0.25,
      noise: 0.15,
      len: 0.44,
      bite: 6e3
    },
    iron: {
      type: "square",
      base: 180,
      sweep: -0.25,
      noise: 0.55,
      len: 0.28,
      bite: 2e3
    }
  },
  Audio = class {
    constructor() {
      this.ctx = null, this.ready = !1, this.enabled = {
        music: !0,
        sfx: !0
      }, this.noiseBuffer = null, this.music = null, this.musicTimer = null, this.currentTrack = null, this.step = 0, this.lastFoot = 0, this.restore();
    }
    restore() {
      try {
        let e = globalThis.localStorage?.getItem("hobile.audio");
        e && Object.assign(this.enabled, JSON.parse(e));
      } catch {}
    }
    persist() {
      try {
        globalThis.localStorage?.setItem("hobile.audio", JSON.stringify(this.enabled));
      } catch {}
    }
    unlock() {
      if (this.ready) {
        this.ctx.state === "suspended" && this.ctx.resume();
        return;
      }
      let e = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!e) return;
      try {
        this.ctx = new e();
      } catch {
        return;
      }
      let t = this.ctx.createGain();
      t.gain.value = 0.9, t.connect(this.ctx.destination);
      let n = this.ctx.createDynamicsCompressor();
      n.threshold.value = -14, n.knee.value = 22, n.ratio.value = 8, n.attack.value = 0.004, n.release.value = 0.2, n.connect(t), this.musicBus = this.ctx.createGain(), this.musicBus.gain.value = this.enabled.music ? 0.34 : 0, this.musicBus.connect(n), this.sfxBus = this.ctx.createGain(), this.sfxBus.gain.value = this.enabled.sfx ? 0.85 : 0, this.sfxBus.connect(n);
      let s = Math.floor(this.ctx.sampleRate * 1.2);
      this.noiseBuffer = this.ctx.createBuffer(1, s, this.ctx.sampleRate);
      let r = this.noiseBuffer.getChannelData(0);
      for (let o = 0; o < s; o++) r[o] = Math.random() * 2 - 1;
      this.ready = !0, this.pendingTrack && this.playMusic(this.pendingTrack, !0);
    }
    setEnabled(e, t) {
      if (this.enabled[e] = t, this.persist(), !this.ready) return;
      let n = e === "music" ? this.musicBus : this.sfxBus,
        s = t ? e === "music" ? 0.34 : 0.85 : 0;
      n.gain.cancelScheduledValues(this.ctx.currentTime), n.gain.setTargetAtTime(s, this.ctx.currentTime, 0.08);
    }
    toggle(e) {
      return this.setEnabled(e, !this.enabled[e]), this.enabled[e];
    }
    get now() {
      return this.ctx ? this.ctx.currentTime : 0;
    }
    tone(e, {
      type: t = "sine",
      freq: n = 440,
      to: s = null,
      at: r = 0,
      dur: o = 0.25,
      gain: a = 0.3,
      attack: l = 0.008,
      release: c = null,
      detune: h = 0,
      cutoff: d = 0,
      q: u = 1
    }) {
      if (!this.ready) return;
      let f = this.now + r,
        p = this.ctx.createOscillator();
      p.type = t, p.frequency.setValueAtTime(n, f), s && s !== n && p.frequency.exponentialRampToValueAtTime(Math.max(20, s), f + o), h && (p.detune.value = h);
      let x = this.ctx.createGain(),
        g = c ?? o * 0.6;
      x.gain.setValueAtTime(1e-4, f), x.gain.exponentialRampToValueAtTime(Math.max(2e-4, a), f + l), x.gain.exponentialRampToValueAtTime(1e-4, f + o + g);
      let m = p;
      if (d) {
        let v = this.ctx.createBiquadFilter();
        v.type = "lowpass", v.frequency.setValueAtTime(d, f), v.Q.value = u, m.connect(v), m = v;
      }
      m.connect(x), x.connect(e), p.start(f), p.stop(f + o + g + 0.05);
    }
    noise(e, {
      at: t = 0,
      dur: n = 0.2,
      gain: s = 0.3,
      type: r = "bandpass",
      freq: o = 1200,
      to: a = null,
      q: l = 1.2,
      attack: c = 0.004
    }) {
      if (!this.ready) return;
      let h = this.now + t,
        d = this.ctx.createBufferSource();
      d.buffer = this.noiseBuffer, d.loop = !0, d.playbackRate.value = 0.8 + Math.random() * 0.4;
      let u = this.ctx.createBiquadFilter();
      u.type = r, u.frequency.setValueAtTime(o, h), a && u.frequency.exponentialRampToValueAtTime(Math.max(40, a), h + n), u.Q.value = l;
      let f = this.ctx.createGain();
      f.gain.setValueAtTime(1e-4, h), f.gain.exponentialRampToValueAtTime(Math.max(2e-4, s), h + c), f.gain.exponentialRampToValueAtTime(1e-4, h + n), d.connect(u), u.connect(f), f.connect(e), d.start(h), d.stop(h + n + 0.05);
    }
    sfx(e, t = {}) {
      if (!this.ready || !this.enabled.sfx) return;
      let n = this.sfxBus;
      switch (e) {
        case "ui":
          this.tone(n, {
            type: "triangle",
            freq: 660,
            to: 880,
            dur: 0.05,
            gain: 0.14,
            release: 0.05
          });
          break;
        case "uiBack":
          this.tone(n, {
            type: "triangle",
            freq: 520,
            to: 380,
            dur: 0.06,
            gain: 0.13,
            release: 0.05
          });
          break;
        case "deny":
          this.tone(n, {
            type: "square",
            freq: 190,
            to: 120,
            dur: 0.1,
            gain: 0.14,
            cutoff: 900
          });
          break;
        case "step":
          {
            let s = performance.now();
            if (s - this.lastFoot < 260) return;
            this.lastFoot = s;
            let r = this.step = (this.step + 1) % 2;
            this.noise(n, {
              dur: 0.08,
              gain: 0.075,
              freq: r ? 480 : 380,
              to: 180,
              q: 0.9
            });
            break;
          }
        case "attack":
          {
            let s = SFX[t.element] || SFX.iron;
            this.tone(n, {
              type: s.type,
              freq: s.base,
              to: s.base * (1 + s.sweep),
              dur: s.len * 0.6,
              gain: 0.2,
              cutoff: s.bite,
              q: 2.2
            }), this.noise(n, {
              dur: s.len,
              gain: 0.1 * s.noise,
              freq: s.bite,
              to: s.bite * 0.3,
              q: 0.9
            });
            break;
          }
        case "hit":
          {
            let s = Math.min(1.6, 0.5 + (t.power || 0.4));
            this.noise(n, {
              dur: 0.12 * s,
              gain: 0.2 * s,
              type: "lowpass",
              freq: 900,
              to: 180,
              q: 0.7
            }), this.tone(n, {
              type: "triangle",
              freq: 150 * s,
              to: 60,
              dur: 0.1,
              gain: 0.16 * s,
              cutoff: 700
            });
            break;
          }
        case "crit":
          this.noise(n, {
            dur: 0.2,
            gain: 0.3,
            type: "lowpass",
            freq: 1600,
            to: 160,
            q: 0.8
          }), this.tone(n, {
            type: "square",
            freq: 880,
            to: 220,
            dur: 0.16,
            gain: 0.16,
            cutoff: 3e3
          }), this.tone(n, {
            type: "sine",
            freq: 110,
            to: 55,
            dur: 0.3,
            gain: 0.22,
            at: 0.01
          });
          break;
        case "superEffective":
          [0, 0.07, 0.14].forEach((s, r) => this.tone(n, {
            type: "square",
            freq: noteHz(76 + r * 4),
            dur: 0.09,
            gain: 0.11,
            at: s,
            cutoff: 4e3
          }));
          break;
        case "resisted":
          this.tone(n, {
            type: "sine",
            freq: 260,
            to: 190,
            dur: 0.16,
            gain: 0.1,
            cutoff: 800
          });
          break;
        case "miss":
          this.noise(n, {
            dur: 0.16,
            gain: 0.09,
            freq: 2600,
            to: 900,
            q: 0.7
          });
          break;
        case "hurt":
          this.tone(n, {
            type: "sawtooth",
            freq: 300,
            to: 140,
            dur: 0.16,
            gain: 0.16,
            cutoff: 1200
          });
          break;
        case "heal":
          [0, 0.08, 0.16].forEach((s, r) => this.tone(n, {
            type: "sine",
            freq: noteHz(72 + r * 3),
            dur: 0.18,
            gain: 0.11,
            at: s
          }));
          break;
        case "throw":
          this.noise(n, {
            dur: 0.26,
            gain: 0.1,
            freq: 900,
            to: 2600,
            q: 1.4
          }), this.tone(n, {
            type: "sine",
            freq: 300,
            to: 700,
            dur: 0.24,
            gain: 0.1
          });
          break;
        case "sphereOpen":
          this.tone(n, {
            type: "triangle",
            freq: 900,
            to: 1500,
            dur: 0.1,
            gain: 0.13
          });
          break;
        case "suck":
          this.tone(n, {
            type: "sine",
            freq: 1100,
            to: 200,
            dur: 0.5,
            gain: 0.13,
            cutoff: 2400
          }), this.noise(n, {
            dur: 0.5,
            gain: 0.07,
            freq: 2e3,
            to: 300,
            q: 1.1
          });
          break;
        case "wobble":
          this.tone(n, {
            type: "triangle",
            freq: 400,
            to: 300,
            dur: 0.1,
            gain: 0.12,
            cutoff: 1400
          }), this.noise(n, {
            dur: 0.07,
            gain: 0.05,
            freq: 600,
            to: 300
          });
          break;
        case "caught":
          [0, 0.1, 0.2, 0.34].forEach((s, r) => this.tone(n, {
            type: "triangle",
            freq: noteHz([72, 76, 79, 84][r]),
            dur: 0.22,
            gain: 0.16,
            at: s
          })), this.noise(n, {
            at: 0.32,
            dur: 0.5,
            gain: 0.06,
            freq: 5200,
            to: 2600,
            q: 0.7
          });
          break;
        case "escape":
          this.tone(n, {
            type: "square",
            freq: 420,
            to: 180,
            dur: 0.24,
            gain: 0.14,
            cutoff: 1600
          });
          break;
        case "levelUp":
          [0, 0.09, 0.18, 0.27, 0.4].forEach((s, r) => this.tone(n, {
            type: "triangle",
            freq: noteHz([69, 73, 76, 81, 88][r]),
            dur: 0.26,
            gain: 0.17,
            at: s
          }));
          break;
        case "evolve":
          this.tone(n, {
            type: "sawtooth",
            freq: 120,
            to: 900,
            dur: 1.1,
            gain: 0.12,
            cutoff: 3e3,
            q: 3
          }), [0.9, 1, 1.12].forEach((s, r) => this.tone(n, {
            type: "triangle",
            freq: noteHz([76, 83, 88][r]),
            dur: 0.4,
            gain: 0.18,
            at: s
          }));
          break;
        case "quest":
          [0, 0.11, 0.22].forEach((s, r) => this.tone(n, {
            type: "sine",
            freq: noteHz([74, 78, 81][r]),
            dur: 0.22,
            gain: 0.15,
            at: s
          }));
          break;
        case "coin":
          this.tone(n, {
            type: "square",
            freq: 1180,
            dur: 0.05,
            gain: 0.1,
            cutoff: 6e3
          }), this.tone(n, {
            type: "square",
            freq: 1560,
            dur: 0.1,
            gain: 0.09,
            at: 0.05,
            cutoff: 6e3
          });
          break;
        case "loot":
          this.tone(n, {
            type: "triangle",
            freq: 700,
            to: 1200,
            dur: 0.16,
            gain: 0.13
          }), this.noise(n, {
            at: 0.05,
            dur: 0.3,
            gain: 0.05,
            freq: 5e3,
            to: 2e3,
            q: 0.8
          });
          break;
        case "victory":
          [0, 0.12, 0.24, 0.42].forEach((s, r) => this.tone(n, {
            type: "triangle",
            freq: noteHz([69, 76, 81, 88][r]),
            dur: 0.3,
            gain: 0.18,
            at: s
          }));
          break;
        case "defeat":
          [0, 0.16, 0.34].forEach((s, r) => this.tone(n, {
            type: "sawtooth",
            freq: noteHz([64, 60, 55][r]),
            dur: 0.4,
            gain: 0.15,
            at: s,
            cutoff: 1100
          }));
          break;
        case "encounter":
          this.tone(n, {
            type: "square",
            freq: 300,
            to: 620,
            dur: 0.16,
            gain: 0.16,
            cutoff: 2600
          }), this.tone(n, {
            type: "square",
            freq: 620,
            to: 900,
            dur: 0.2,
            gain: 0.14,
            at: 0.15,
            cutoff: 3200
          });
          break;
        case "bossRoar":
          this.tone(n, {
            type: "sawtooth",
            freq: 90,
            to: 40,
            dur: 1.4,
            gain: 0.3,
            cutoff: 700,
            q: 4
          }), this.noise(n, {
            dur: 1.5,
            gain: 0.16,
            type: "lowpass",
            freq: 500,
            to: 120,
            q: 0.6
          });
          break;
        case "portal":
          this.tone(n, {
            type: "sine",
            freq: 200,
            to: 1400,
            dur: 0.7,
            gain: 0.13,
            cutoff: 4e3,
            q: 2
          });
          break;
        case "chat":
          this.tone(n, {
            type: "sine",
            freq: 780,
            dur: 0.05,
            gain: 0.07
          });
          break;
        case "alert":
          // "!" — something out there has seen you. Two sharp rising blips.
          this.tone(n, {
            type: "square",
            freq: 740,
            to: 1180,
            dur: 0.07,
            gain: 0.13,
            cutoff: 3600
          }), this.tone(n, {
            type: "square",
            freq: 990,
            to: 1560,
            dur: 0.1,
            gain: 0.14,
            at: 0.09,
            cutoff: 4200
          });
          break;
        default:
          break;
      }
    }
    playMusic(e, t = !1) {
      if (!this.ready) {
        this.pendingTrack = e;
        return;
      }
      if (this.currentTrack === e && !t) return;
      this.currentTrack = e, this.pendingTrack = null, clearInterval(this.musicTimer);
      let n = ZONE_MUSIC[e] || ZONE_MUSIC.verdant_meadow,
        s = SCALES[n.scale],
        r = 60 / n.bpm / 2,
        o = 0;
      this.enabled.music && (this.musicBus.gain.cancelScheduledValues(this.now), this.musicBus.gain.setTargetAtTime(0.34, this.now, 0.5));
      let a = () => {
        if (!this.enabled.music || this.ctx.state !== "running") {
          o += 4;
          return;
        }
        let l = this.musicBus,
          c = Math.floor(o / 8) % 4;
        for (let h = 0; h < 4; h++) {
          let d = o + h,
            u = h * r;
          if (d % 4 === 0) {
            let f = [0, 0, 3, 4][c % 4];
            this.tone(l, {
              type: "triangle",
              freq: noteHz(n.root - 12 + s[f % s.length]),
              dur: r * 2.6,
              gain: 0.16,
              cutoff: 420,
              release: r
            });
          }
          if (d % 16 === 0) {
            let f = [0, 2, 4][c % 3];
            for (let p of [0, 4, 7]) this.tone(l, {
              type: "sine",
              freq: noteHz(n.root + s[f % s.length] + p),
              dur: r * 12,
              gain: n.pad * 0.12,
              attack: 0.5,
              release: r * 5,
              cutoff: 900 + n.warmth * 2200,
              detune: (Math.random() - 0.5) * 8
            });
          }
          if (Math.random() < 0.62) {
            let f = s[Math.floor(Math.random() * s.length)],
              p = Math.random() < 0.3 ? 12 : 0;
            this.tone(l, {
              type: n.warmth > 0.5 ? "sine" : "triangle",
              freq: noteHz(n.root + 12 + f + p),
              dur: r * 0.9,
              gain: 0.075,
              at: u,
              cutoff: 1800 + n.warmth * 3e3,
              release: r * 1.4
            });
          }
          n.bpm > 110 && d % 2 === 0 && this.noise(l, {
            at: u,
            dur: 0.05,
            gain: 0.035,
            freq: 3200,
            to: 1800,
            q: 1.4
          });
        }
        o += 4;
      };
      a(), this.musicTimer = setInterval(a, r * 4 * 1e3);
    }
    stopMusic() {
      clearInterval(this.musicTimer), this.musicTimer = null, this.currentTrack = null, this.ready && this.musicBus.gain.setTargetAtTime(0, this.now, 0.3);
    }
    setNight(e) {
      if (!this.ready) return;
      let t = Number.isFinite(e) ? Math.max(0, Math.min(1, e)) : 0,
        n = this.enabled.music ? 0.34 - t * 0.1 : 0;
      this.musicBus.gain.setTargetAtTime(n, this.now, 1.5);
    }
  };

function vibrate(i) {
  try {
    navigator.vibrate?.(i);
  } catch {}
}

export { Audio, SCALES, SFX, ZONE_MUSIC, noteHz, sb, vibrate };
