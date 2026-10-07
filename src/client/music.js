// The soundtrack: a tune of its own for every zone, and for the fights.
//
// Nothing is recorded: each song is written here as a few numbers — key,
// mode, tempo, the chords under it, which instruments play, how the drums go
// — and its melody is composed from them once, the same way every time (a
// seeded hand), so the meadow always sounds like the meadow and the canyon
// like the canyon. A song is two eight-bar halves: the tune, then a second
// part over the next chords, and back. Notes are scheduled a little ahead on
// the audio clock, so they land on time whatever the frame rate is doing.
//
// Each zone also has its own air under the music: birds over the meadow,
// surf at the hollow, wind on the heights, embers crackling in the canyon,
// water dripping in the grove.

const MODES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  minor: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
};

/**
 * The songs. `prog` is two halves of chords, as scale degrees (0 = the key's
 * own chord), one per bar. `lead`: the melody's voice; `bass`: how the bass
 * moves; `drums`: which kit pattern; `arp`: an arpeggio under the tune;
 * `pad`: how loud the held chords are; `amb`: the zone's own air.
 */
export const SONGS = {
  aetherport: { key: 60, mode: 'major', bpm: 104, vol: 1.2, prog: [[0, 4, 5, 3, 0, 4, 3, 4], [5, 3, 0, 4, 5, 3, 1, 4]], lead: 'pluck', bass: 'bounce', drums: 'town', arp: 'up', pad: 0.5, swing: 0.12, amb: 'harbour', seed: 11 },
  verdant_meadow: { key: 62, mode: 'lydian', bpm: 92, prog: [[0, 1, 0, 4, 0, 1, 3, 4], [3, 4, 0, 5, 3, 4, 1, 4]], lead: 'flute', bass: 'root', drums: 'shaker', arp: 'none', pad: 0.6, swing: 0.08, amb: 'birds', seed: 23 },
  stonewake_mesa: { key: 57, mode: 'dorian', bpm: 86, prog: [[0, 3, 0, 6, 0, 3, 4, 0], [5, 3, 6, 0, 5, 3, 4, 4]], lead: 'twang', bass: 'gallop', drums: 'trot', arp: 'none', pad: 0.4, swing: 0.18, amb: 'wind', seed: 37 },
  stormreach_heights: { key: 55, mode: 'minor', bpm: 118, prog: [[0, 5, 6, 4, 0, 5, 3, 4], [3, 6, 0, 4, 3, 6, 4, 4]], lead: 'square', bass: 'drive', drums: 'march', arp: 'up', pad: 0.35, swing: 0, amb: 'gusts', seed: 41 },
  emberfall_canyon: { key: 52, mode: 'phrygian', bpm: 108, vol: 1.5, prog: [[0, 1, 0, 6, 0, 1, 2, 1], [3, 2, 1, 0, 3, 2, 6, 1]], lead: 'saw', bass: 'drive', drums: 'toms', arp: 'none', pad: 0.3, swing: 0.05, amb: 'crackle', seed: 53 },
  tidal_hollow: { key: 58, mode: 'dorian', bpm: 80, prog: [[0, 3, 0, 4, 5, 3, 1, 4], [3, 0, 5, 4, 3, 0, 1, 4]], lead: 'marimba', bass: 'sway', drums: 'shaker', arp: 'wave', pad: 0.55, swing: 0.14, amb: 'surf', seed: 67 },
  frostpeak_ridge: { key: 64, mode: 'lydian', bpm: 70, prog: [[0, 1, 5, 4, 0, 1, 3, 4], [5, 1, 0, 4, 5, 3, 1, 4]], lead: 'bell', bass: 'root', drums: 'none', arp: 'sparkle', pad: 0.7, swing: 0, amb: 'snow', seed: 71 },
  umbral_grove: { key: 50, mode: 'harmonic', bpm: 66, prog: [[0, 5, 3, 4, 0, 5, 1, 4], [3, 0, 5, 4, 3, 1, 4, 4]], lead: 'glass', bass: 'root', drums: 'heart', arp: 'down', pad: 0.75, swing: 0, amb: 'drip', seed: 89 },
  battle: { key: 52, mode: 'minor', bpm: 140, prog: [[0, 0, 5, 6, 0, 0, 3, 4], [5, 6, 0, 4, 5, 3, 4, 4]], lead: 'square', bass: 'drive', drums: 'battle', arp: 'up', pad: 0.25, swing: 0, amb: 'none', seed: 101 },
  dungeon: { key: 48, mode: 'phrygian', bpm: 112, prog: [[0, 1, 0, 1, 0, 1, 6, 1], [3, 2, 1, 0, 3, 2, 1, 1]], lead: 'saw', bass: 'drive', drums: 'toms', arp: 'down', pad: 0.4, swing: 0, amb: 'drip', seed: 113 },
  boss: { key: 45, mode: 'harmonic', bpm: 152, prog: [[0, 0, 5, 4, 0, 0, 5, 4], [3, 3, 0, 4, 5, 5, 1, 4]], lead: 'saw', bass: 'drive', drums: 'battle', arp: 'up', pad: 0.3, swing: 0, amb: 'none', seed: 127 },
  saga: { key: 50, mode: 'dorian', bpm: 64, vol: 0.8, prog: [[0, 5, 3, 4, 0, 5, 1, 4], [3, 4, 0, 5, 3, 4, 1, 0]], lead: 'flute', bass: 'root', drums: 'none', arp: 'none', pad: 0.9, swing: 0, amb: 'none', seed: 131 },
};
// tracks that are another's: the town's quieter districts, the arena
const ALIAS = { arena: 'battle', tower: 'dungeon' };

/** A small seeded hand (the same tune every time). */
function hand(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// the rhythms a bar of melody can take: 16ths at which a note starts, and how long it is
const RHYTHMS = [
  [[0, 4], [4, 4], [8, 4], [12, 4]],
  [[0, 6], [6, 2], [8, 8]],
  [[0, 3], [3, 3], [6, 2], [8, 4], [12, 4]],
  [[0, 8], [8, 2], [10, 2], [12, 4]],
  [[0, 2], [2, 2], [4, 4], [8, 6], [14, 2]],
  [[0, 12], [12, 4]],
  [[2, 2], [4, 4], [8, 2], [10, 6]],
];

/**
 * The melody of a song, composed once: a motif, the motif answered, a
 * contrast, a cadence — for each half. Notes are scale steps from the key,
 * leaning on the chord's own notes where the beat is strong.
 */
export function compose(song) {
  const r = hand(song.seed), out = [];
  const chordTones = (deg) => [deg, deg + 2, deg + 4];
  for (let half = 0; half < 2; half++) {
    const prog = song.prog[half];
    // the motif: a rhythm and a contour, used again in bar 2 and 5
    const motifR = RHYTHMS[Math.floor(r() * RHYTHMS.length)], contour = motifR.map(() => Math.floor(r() * 5) - 2);
    const answerR = RHYTHMS[Math.floor(r() * RHYTHMS.length)];
    let last = 7 + chordTones(prog[0])[Math.floor(r() * 3)] % 7;
    for (let bar = 0; bar < 8; bar++) {
      const deg = prog[bar], tones = chordTones(deg).map((t) => t % 7);
      const cadence = bar === 7, rest = bar === 3 && r() < 0.35;
      const rh = cadence ? [[0, 8], [8, 8]] : rest ? [[0, 4], [4, 4]] : bar === 1 || bar === 4 ? motifR : bar === 0 ? motifR : answerR;
      const notes = [];
      rh.forEach(([at, len], i) => {
        const strong = at % 8 === 0;
        let step;
        // a tune leans back toward the middle of its range rather than wandering off it
        const pull = last < 7 ? 1 : last > 11 ? -1 : 0;
        if (bar === 1 || bar === 4) step = last + (contour[i] ?? 0) + pull;    // the motif again, from where it is
        else step = last + Math.floor(r() * 5) - 2 + pull;
        // and does not say the same note three times running
        if (step === last && notes.length && notes[notes.length - 1].step === last) step += r() < 0.5 ? 1 : -1;
        if (strong) {
          // land on a note of the chord, the nearest one
          let best = step, bd = 99;
          for (const t of tones) for (const o of [0, 7, 14]) { const c = t + o; if (Math.abs(c - step) < bd) { bd = Math.abs(c - step); best = c; } }
          step = best;
        }
        if (cadence && i === rh.length - 1) step = 7 + (half ? 0 : tones[1]);   // home at the end, a question at the half
        step = Math.max(3, Math.min(15, step));
        last = step;
        notes.push({ at, len, step });
      });
      out.push({ deg, notes });
    }
  }
  return out;
}

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Sequencer {
  constructor(audio) {
    this.audio = audio;
    this.song = null;
    this.id = null;
    this.timer = null;
    this.cache = new Map();
  }

  /** The note `step` steps up the song's scale from its key (0 = the key). */
  pitch(song, step, oct = 0) {
    const sc = MODES[song.mode] || MODES.major, n = sc.length;
    const o = Math.floor(step / n), i = ((step % n) + n) % n;
    return song.key + sc[i] + 12 * (o + oct);
  }

  play(id) {
    const key = ALIAS[id] || id, song = SONGS[key] || SONGS.verdant_meadow;
    this.stop();
    this.id = id;
    this.song = song;
    this.melody = this.cache.get(key) || this.cache.set(key, compose(song)).get(key);
    const A = this.audio;
    // its own level into the music bus: some are quieter by nature (vol)
    this.out || (this.out = A.ctx.createGain(), this.out.connect(A.musicBus));
    this.out.gain.setTargetAtTime(1.7 * (song.vol || 1), A.now, 0.3);
    this.sixteenth = 60 / song.bpm / 4;
    this.pos = 0;                                  // 16ths since the start
    this.next = A.now + 0.12;
    this.ambNext = A.now + 1;
    // schedule what falls in the next 0.35s, every 0.1s
    this.timer = setInterval(() => this.tick(), 100);
    this.tick();
  }

  stop() {
    clearInterval(this.timer);
    this.timer = null;
    this.song = null;
  }

  tick() {
    const A = this.audio, S = this.song;
    if (!S || !A.ready) return;
    if (!A.enabled.music || A.ctx.state !== 'running') { this.next = A.now + 0.1; return; }
    const until = A.now + 0.35;
    while (this.next < until) {
      this.step(this.pos, this.next - A.now);
      const swing = this.pos % 2 === 0 ? 1 + S.swing : 1 - S.swing;
      this.next += this.sixteenth * swing;
      this.pos++;
    }
    if (S.amb !== 'none' && A.now >= this.ambNext) this.ambience(S.amb);
  }

  /** Everything that sounds on one 16th: `at` is seconds from now. */
  step(pos, at) {
    const S = this.song, A = this.audio, bus = this.out, s16 = this.sixteenth;
    const barN = Math.floor(pos / 16), inBar = pos % 16, bar = this.melody[barN % this.melody.length];
    const deg = bar.deg, root = this.pitch(S, deg, -1), third = this.pitch(S, deg + 2, -1), fifth = this.pitch(S, deg + 4, -1);
    // the held chord, each bar
    if (inBar === 0 && S.pad > 0) {
      for (const m of [root + 12, third + 12, fifth + 12]) A.tone(bus, { type: 'sine', freq: hz(m), at, dur: s16 * 15, gain: 0.05 * S.pad, attack: 0.25, release: s16 * 6, detune: (Math.random() - 0.5) * 10, cutoff: 1600 });
      A.tone(bus, { type: 'triangle', freq: hz(root + 24), at, dur: s16 * 14, gain: 0.018 * S.pad, attack: 0.4, release: s16 * 6, cutoff: 1200 });
    }
    // the bass
    const B = { root: [0], bounce: [0, 6, 8, 14], gallop: [0, 3, 4, 8, 11, 12], drive: [0, 2, 4, 6, 8, 10, 12, 14], sway: [0, 10] }[S.bass] || [0];
    if (B.includes(inBar)) {
      const m = S.bass === 'bounce' && inBar === 8 ? fifth : S.bass === 'sway' && inBar === 10 ? fifth : S.bass === 'gallop' && (inBar === 8 || inBar === 11) ? fifth : root;
      A.tone(bus, { type: S.bass === 'drive' ? 'sawtooth' : 'triangle', freq: hz(m - 12), at, dur: s16 * (S.bass === 'root' ? 14 : S.bass === 'drive' ? 1.6 : 2.6), gain: S.bass === 'drive' ? 0.08 : 0.14, cutoff: S.bass === 'drive' ? 520 : 420, release: s16 });
    }
    // the arpeggio
    if (S.arp !== 'none' && inBar % 2 === 0) {
      const ch = [root + 12, third + 12, fifth + 12, root + 24], k = inBar / 2;
      const m = S.arp === 'up' ? ch[k % 4] : S.arp === 'down' ? ch[3 - (k % 4)] : S.arp === 'wave' ? ch[[0, 1, 2, 3, 2, 1, 2, 1][k % 8]] : (k % 3 === 0 ? ch[(k / 3) % 4 | 0] + 12 : null);
      m && A.tone(bus, { type: S.arp === 'sparkle' ? 'sine' : 'triangle', freq: hz(m), at, dur: s16 * 1.2, gain: S.arp === 'sparkle' ? 0.035 : 0.03, cutoff: 2600, release: s16 * 2 });
    }
    // the tune
    for (const n of bar.notes) if (n.at === inBar) this.lead(S.lead, hz(this.pitch(S, n.step)), at, n.len * s16);
    // the drums
    this.drums(S.drums, inBar, at);
  }

  lead(kind, f, at, dur) {
    const A = this.audio, bus = this.out;
    if (kind === 'pluck') A.tone(bus, { type: 'triangle', freq: f, at, dur: Math.min(dur, 0.32), gain: 0.085, cutoff: 3200, release: 0.18 });
    else if (kind === 'flute') { A.tone(bus, { type: 'sine', freq: f, at, dur: dur * 0.95, gain: 0.08, attack: 0.05, release: 0.16, detune: 6 }); A.tone(bus, { type: 'sine', freq: f * 2, at, dur: dur * 0.9, gain: 0.012, attack: 0.08 }); }
    else if (kind === 'twang') A.tone(bus, { type: 'sawtooth', freq: f, to: f * 0.995, at, dur: Math.min(dur, 0.45), gain: 0.06, cutoff: 1400, q: 4, release: 0.25 });
    else if (kind === 'square') A.tone(bus, { type: 'square', freq: f, at, dur: dur * 0.85, gain: 0.04, cutoff: 2400, release: 0.08 });
    else if (kind === 'saw') A.tone(bus, { type: 'sawtooth', freq: f, at, dur: dur * 0.85, gain: 0.045, cutoff: 1800, q: 2, release: 0.1 });
    else if (kind === 'marimba') { A.tone(bus, { type: 'sine', freq: f, at, dur: 0.22, gain: 0.1, attack: 0.003, release: 0.25 }); A.tone(bus, { type: 'sine', freq: f * 4, at, dur: 0.05, gain: 0.02, attack: 0.002 }); }
    else if (kind === 'bell') { A.tone(bus, { type: 'sine', freq: f * 2, at, dur: 0.6, gain: 0.06, attack: 0.003, release: 1.1 }); A.tone(bus, { type: 'sine', freq: f * 5.04, at, dur: 0.2, gain: 0.012, attack: 0.002, release: 0.6 }); }
    else if (kind === 'glass') A.tone(bus, { type: 'triangle', freq: f * 2, at, dur: dur * 0.8, gain: 0.04, attack: 0.12, release: 0.8, detune: 12, cutoff: 2200 });
  }

  drums(kit, i, at) {
    const A = this.audio, bus = this.out;
    const kick = () => A.tone(bus, { type: 'sine', freq: 130, to: 42, at, dur: 0.14, gain: 0.22, attack: 0.002 });
    const snare = (g = 0.07) => A.noise(bus, { at, dur: 0.12, gain: g, type: 'bandpass', freq: 1900, to: 900, q: 0.8 });
    const hat = (g = 0.025) => A.noise(bus, { at, dur: 0.035, gain: g, type: 'highpass', freq: 7000, q: 0.7 });
    const shaker = (g = 0.02) => A.noise(bus, { at, dur: 0.06, gain: g, type: 'bandpass', freq: 5200, q: 1.5 });
    const tom = (f) => A.tone(bus, { type: 'sine', freq: f, to: f * 0.6, at, dur: 0.2, gain: 0.14, attack: 0.003 });
    switch (kit) {
      case 'town': (i === 0 || i === 8) && kick(); (i === 4 || i === 12) && snare(0.05); i % 2 === 0 && hat(0.02); break;
      case 'shaker': i % 2 === 0 && shaker(i % 4 === 0 ? 0.025 : 0.014); i === 0 && kick(); break;
      case 'trot': (i === 0 || i === 6 || i === 8 || i === 14) && tom(110); (i === 4 || i === 12) && A.noise(bus, { at, dur: 0.04, gain: 0.04, type: 'bandpass', freq: 2600, q: 3 }); break;
      case 'march': (i === 0 || i === 8 || i === 10) && kick(); (i === 4 || i === 12) && snare(); i % 2 === 0 && hat(); i === 14 && snare(0.03); break;
      case 'toms': (i === 0 || i === 3 || i === 8) && tom(i === 3 ? 140 : 95); (i === 6 || i === 12 || i === 14) && tom(180); i % 4 === 2 && hat(0.018); break;
      case 'battle': (i % 4 === 0 || i === 10) && kick(); (i === 4 || i === 12) && snare(0.09); hat(i % 2 ? 0.015 : 0.03); break;
      case 'heart': (i === 0 || i === 3) && A.tone(bus, { type: 'sine', freq: 70, to: 40, at, dur: 0.2, gain: i ? 0.12 : 0.18 }); break;
      default: break;
    }
  }

  /** The zone's own air, now and then. */
  ambience(kind) {
    const A = this.audio, bus = this.out, R = Math.random;
    let gap = 4;
    if (kind === 'birds') { const n = 2 + (R() * 3 | 0), f = 2200 + R() * 1400; for (let k = 0; k < n; k++) A.tone(bus, { type: 'sine', freq: f, to: f * (1.2 + R() * 0.3), at: k * 0.11, dur: 0.07, gain: 0.03, attack: 0.005 }); gap = 3 + R() * 5; }
    else if (kind === 'surf' || kind === 'harbour') { A.noise(bus, { dur: 3.2, gain: kind === 'surf' ? 0.05 : 0.03, type: 'lowpass', freq: 500, to: 1400, q: 0.4, attack: 1.4 }); kind === 'harbour' && R() < 0.3 && A.tone(bus, { type: 'sine', freq: 1568, at: 1, dur: 0.9, gain: 0.02, release: 1.5 }); gap = 5 + R() * 3; }
    else if (kind === 'wind' || kind === 'gusts' || kind === 'snow') { A.noise(bus, { dur: 4, gain: kind === 'gusts' ? 0.045 : 0.03, type: 'bandpass', freq: 400 + R() * 300, to: 900 + R() * 600, q: 2.5, attack: 1.8 }); gap = 4 + R() * 4; }
    else if (kind === 'crackle') { for (let k = 0; k < 5; k++) A.noise(bus, { at: R() * 0.8, dur: 0.02, gain: 0.04, type: 'highpass', freq: 3000, q: 0.8 }); gap = 1.2 + R() * 2; }
    else if (kind === 'drip') { const f = 900 + R() * 700; A.tone(bus, { type: 'sine', freq: f, to: f * 0.55, dur: 0.12, gain: 0.04, attack: 0.002 }); gap = 2 + R() * 4; }
    this.ambNext = A.now + gap;
  }
}

/** For tests and the GM panel: which songs exist. */
export const SONG_IDS = Object.keys(SONGS);
