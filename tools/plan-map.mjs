/**
 * A zone's plan from above, as a PNG: terrain shaded by height, water, rock
 * faces, roads, woods, the tall grass, what is built, the landmarks — and
 * with --colliders, what stops a body (red) and where nothing can stand (grey).
 *
 *   node tools/plan-map.mjs [zoneId|all] [outDir] [--colliders]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { ZONES } from '../src/shared/gamedata.js';
import { planFor, PLANS } from '../src/shared/worldplan.js';

const which = process.argv[2] || 'all';
const outDir = process.argv[3] || 'shots/plans';
const showCol = process.argv.includes('--colliders');
const PX = 2;   // pixels per metre

function png(w, h, rgb) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 3 + 1)] = 0; rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3); }
  const crc = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1; } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const WATER = { water: [70, 150, 220], lava: [255, 110, 30], ice: [200, 235, 250], swamp: [70, 90, 70] };

for (const id of which === 'all' ? Object.keys(PLANS) : [which]) {
  const zone = ZONES[id], P = planFor(id), S = zone.size * PX, half = zone.size / 2;
  const rgb = Buffer.alloc(S * S * 3);
  const set = (px, py, c) => { if (px < 0 || py < 0 || px >= S || py >= S) return; const k = (py * S + px) * 3; rgb[k] = c[0]; rgb[k + 1] = c[1]; rgb[k + 2] = c[2]; };
  const toPx = (x, z) => [Math.round((x + half) * PX), Math.round((half - z) * PX)];
  const t0 = Date.now();
  for (let py = 0; py < S; py++) for (let px = 0; px < S; px++) {
    const x = px / PX - half, z = half - py / PX;
    if (Math.hypot(x, z) > half - 3) { set(px, py, [30, 30, 36]); continue; }
    const h = P.height(x, z), hx = P.height(x + 0.5, z) - h, hz = P.height(x, z + 0.5) - h;
    const shade = Math.max(0.55, Math.min(1.25, 1 + (-hx * 0.8 + hz * 0.6)));
    let c = mix([110, 160, 80], [190, 200, 150], Math.max(0, Math.min(1, (h + 2) / 16)));
    const tn = P.tone(x, z, h);
    c = mix(c, [225, 205, 150], tn.sand); c = mix(c, [150, 130, 120], tn.rock); c = mix(c, [175, 140, 95], tn.road);
    c = mix(c, [60, 110, 60], tn.moss * 0.6); c = mix(c, [80, 70, 70], tn.ash); c = mix(c, [240, 245, 250], tn.snow);
    if (P.grassAt(x, z) > 0.3) c = mix(c, [90, 170, 60], 0.35);
    if (P.forestAt(x, z) > 0.35) c = mix(c, [40, 100, 50], 0.45);
    c = c.map((v) => v * shade);
    if (P.water && P.waterDepth(x, z) > 0) c = mix(c, WATER[P.water.kind], Math.min(0.9, 0.45 + P.waterDepth(x, z) * 0.3));
    if (P.inChasm(x, z)) c = [25, 25, 40];
    if (P.deckAt(x, z)) c = [150, 110, 70];
    if (showCol && !P.walkable(x, z)) c = mix(c, [120, 120, 120], 0.55);
    set(px, py, c.map((v) => Math.max(0, Math.min(255, Math.round(v)))));
  }
  const dot = (x, z, r, c) => { const [cx, cy] = toPx(x, z); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) set(cx + dx, cy + dy, c); };
  for (const s of P.structures) if (!s.deck) dot(s.x, s.z, 3, [120, 60, 40]);
  for (const c of P.colliders) {
    if (!showCol) continue;
    if (c.r) { for (let a = 0; a < 40; a++) { const [px, py] = toPx(c.x + Math.cos(a / 40 * 6.283) * c.r, c.z + Math.sin(a / 40 * 6.283) * c.r); set(px, py, [230, 40, 40]); } }
    else { const cs = Math.cos(c.rot || 0), sn = Math.sin(c.rot || 0); for (let u = -1; u <= 1; u += 0.02) for (const v of [-1, 1]) for (const [a, b] of [[u, v], [v, u]]) { const lx = a * c.hw, lz = b * c.hd; const [px, py] = toPx(c.x + lx * cs + lz * sn, c.z - lx * sn + lz * cs); set(px, py, [230, 40, 40]); } }
  }
  for (const l of zone.landmarks) dot(l.x, l.z, l.kind === 'camp' ? 7 : 5, l.kind === 'camp' ? [255, 255, 255] : l.kind === 'portal' ? [160, 80, 255] : [40, 40, 40]);
  fs.mkdirSync(outDir, { recursive: true });
  const f = path.join(outDir, `${id}.png`);
  fs.writeFileSync(f, png(S, S, rgb));
  const lm = zone.landmarks.filter((l) => !P.walkable(l.x, l.z)).map((l) => l.kind + ':' + (l.to || ''));
  console.log(f, `${Date.now() - t0}ms`, lm.length ? `LANDMARKS NOT WALKABLE: ${lm.join(', ')}` : '');
}
