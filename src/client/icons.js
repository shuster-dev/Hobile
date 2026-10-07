// Drawn icons for the things in your bag (shared/gamedata ITEMS), instead of
// emoji that look different on every phone. Each is a small SVG drawn here
// in code — a sphere with its band and button, a flask with its liquid, a
// shard or a cut crystal in its element's colour, a blade, a vest, a charm —
// and handed to the page as an image (so its gradients never clash).
import { ELEMENTS, ITEMS } from '../shared/gamedata.js';

const hex = (n) => `#${(n >>> 0).toString(16).padStart(6, '0').slice(-6)}`;
const mix = (a, b, t) => {
  const A = typeof a === 'number' ? a : parseInt(a.slice(1), 16), B = typeof b === 'number' ? b : parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(((A >> s) & 255) * (1 - t) + ((B >> s) & 255) * t);
  return hex((ch(16) << 16) | (ch(8) << 8) | ch(0));
};
const light = (c, t = 0.45) => mix(c, 0xffffff, t);
const dark = (c, t = 0.4) => mix(c, 0x000000, t);
const INK = '#1d2238';

/** A shadow under every icon, so they sit on the card the same way. */
const shadow = '<ellipse cx="32" cy="57" rx="17" ry="3.6" fill="#000" opacity=".22"/>';
const grad = (id, a, b, vertical = true) => `<linearGradient id="${id}" x1="0" y1="0" x2="${vertical ? 0 : 1}" y2="${vertical ? 1 : 0}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
const radial = (id, a, b, cx = 0.35, cy = 0.3) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="0.75"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;

const DRAW = {
  sphere(core, ring = '#c9a24a', glow = null) {
    // an aether sphere: a glass ball with light in it, held in two crossed
    // metal hoops, a little gem on top where the hoops meet
    return `<defs>${radial('t', light(core, 0.85), dark(core, 0.35), 0.4, 0.38)}</defs>${shadow}
      ${glow ? `<circle cx="32" cy="31" r="25" fill="${glow}" opacity=".25"/>` : ''}
      <circle cx="32" cy="31" r="20" fill="url(#t)" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="32" cy="31" r="9" fill="${light(core, 0.7)}" opacity=".45"/>
      <ellipse cx="32" cy="31" rx="8" ry="20.5" fill="none" stroke="${INK}" stroke-width="5"/>
      <ellipse cx="32" cy="31" rx="8" ry="20.5" fill="none" stroke="${ring}" stroke-width="2.6"/>
      <ellipse cx="32" cy="31" rx="20.5" ry="7" fill="none" stroke="${INK}" stroke-width="5" transform="rotate(-18 32 31)"/>
      <ellipse cx="32" cy="31" rx="20.5" ry="7" fill="none" stroke="${ring}" stroke-width="2.6" transform="rotate(-18 32 31)"/>
      <path d="M32 6 36 11 32 15 28 11z" fill="${light(core, 0.4)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="24" cy="21" rx="4.5" ry="2.6" fill="#fff" opacity=".6" transform="rotate(-35 24 21)"/>`;
  },
  flask(liquid, size = 1) {
    // a round-bottomed flask: a neck, a bulb (bigger for the bigger potion), the liquid in it
    const R = 14 + size * 1.6, cy = 21 + Math.sqrt(R * R - 25), body = `M27 8H37V21A${R} ${R} 0 1 1 27 21Z`;
    return `<defs>${grad('l', light(liquid, 0.25), dark(liquid, 0.25))}<clipPath id="k"><path d="${body}"/></clipPath></defs>${shadow}
      <path d="${body}" fill="#eef5ff" opacity=".92"/>
      <rect x="0" y="${cy - R * 0.25}" width="64" height="64" fill="url(#l)" clip-path="url(#k)"/>
      <path d="${body}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <rect x="25.5" y="3.5" width="13" height="7" rx="2" fill="#b07a48" stroke="${INK}" stroke-width="2.2"/>
      <ellipse cx="${32 - R * 0.5}" cy="${cy - 2}" rx="2.4" ry="5" fill="#fff" opacity=".6"/>
      <circle cx="35" cy="${cy + 4}" r="1.8" fill="#fff" opacity=".5"/><circle cx="29" cy="${cy}" r="1.2" fill="#fff" opacity=".5"/>`;
  },
  feather(c, glow = false) {
    return `<defs>${grad('f', light(c, 0.55), c)}</defs>${shadow}
      ${glow ? `<circle cx="32" cy="30" r="24" fill="${c}" opacity=".22"/>` : ''}
      <path d="M44 7C30 10 18 24 17 44l4 4c18-2 30-16 27-38z" fill="url(#f)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M44 9 14 52" stroke="${dark(c, 0.3)}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M38 16l-6-2M34 22l-8-2M30 29l-8-1M37 23l5 1M33 30l6 1" stroke="${dark(c, 0.15)}" stroke-width="1.5" stroke-linecap="round" opacity=".7"/>`;
  },
  shard(c) {
    return `<defs>${grad('s', light(c, 0.5), dark(c, 0.2))}</defs>${shadow}
      <path d="M34 6 46 26 40 50 24 54 18 34 26 20z" fill="url(#s)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M34 6 31 30 24 54M31 30 46 26M31 30 18 34" stroke="${dark(c, 0.35)}" stroke-width="1.4" fill="none" opacity=".55"/>
      <path d="M33 10 28 21 30 28z" fill="#fff" opacity=".55"/>`;
  },
  crystal(c) {
    return `<defs>${grad('c', light(c, 0.55), dark(c, 0.15))}${grad('c2', light(c, 0.2), dark(c, 0.4))}</defs>${shadow}
      <path d="M32 5 48 22 32 55 16 22z" fill="url(#c)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M16 22h32L32 55z" fill="url(#c2)" opacity=".85"/>
      <path d="M16 22 25 14 32 22 39 14 48 22M25 14 32 5 39 14M32 22v33M25 22l7 33 7-33" stroke="${dark(c, 0.3)}" stroke-width="1.3" fill="none" opacity=".6"/>
      <path d="M25 14 32 5 29 20z" fill="#fff" opacity=".6"/>
      <circle cx="44" cy="10" r="2" fill="#fff"/><path d="M44 5v10M39 10h10" stroke="#fff" stroke-width="1.2" opacity=".8"/>`;
  },
  blade(c) {
    return `<defs>${grad('b', light(c, 0.7), dark(c, 0.15), false)}</defs>${shadow}
      <path d="M46 6 52 12 26 40 22 36z" fill="url(#b)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M48 8 25 37" stroke="#fff" stroke-width="1.4" opacity=".7"/>
      <path d="M16 34l14 14" stroke="${INK}" stroke-width="8" stroke-linecap="round"/><path d="M16 34l14 14" stroke="#c9a24a" stroke-width="4.5" stroke-linecap="round"/>
      <path d="M22 42 12 52" stroke="#6a4428" stroke-width="5.5" stroke-linecap="round"/>
      <circle cx="11" cy="53" r="3.6" fill="#c9a24a" stroke="${INK}" stroke-width="2"/>`;
  },
  vest(c) {
    return `<defs>${grad('v', light(c, 0.3), dark(c, 0.25))}</defs>${shadow}
      <path d="M22 8 32 14 42 8 52 16 48 26 46 52H18L16 26 12 16z" fill="url(#v)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M32 14v38" stroke="${dark(c, 0.4)}" stroke-width="2"/>
      <circle cx="36" cy="24" r="1.8" fill="#e8c05a"/><circle cx="36" cy="33" r="1.8" fill="#e8c05a"/><circle cx="36" cy="42" r="1.8" fill="#e8c05a"/>`;
  },
  shield(c) {
    return `<defs>${grad('h', light(c, 0.4), dark(c, 0.25))}</defs>${shadow}
      <path d="M32 6 50 12v16c0 13-8 21-18 26-10-5-18-13-18-26V12z" fill="url(#h)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M32 12 44 16v12c0 9-5 15-12 19z" fill="#fff" opacity=".22"/>
      <path d="M32 18v22M24 27h16" stroke="#e8c05a" stroke-width="3.2" stroke-linecap="round"/>`;
  },
  charm(c) {
    return `<defs>${radial('g', light(c, 0.6), dark(c, 0.2))}</defs>${shadow}
      <path d="M18 10c4 12 24 12 28 0" stroke="#c9a24a" stroke-width="2.6" fill="none"/>
      <circle cx="32" cy="18" r="2.6" fill="#c9a24a"/>
      <path d="M32 21 44 34 32 52 20 34z" fill="#e8c05a" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M32 27 39 35 32 46 25 35z" fill="url(#g)"/>
      <circle cx="29.5" cy="32" r="1.8" fill="#fff" opacity=".8"/>`;
  },
  bandage() {
    return `${shadow}<g transform="rotate(-35 32 30)"><rect x="12" y="23" width="40" height="15" rx="7" fill="#f2dcc0" stroke="${INK}" stroke-width="2.5"/><rect x="25" y="23" width="14" height="15" fill="#e8c8a4" stroke="${INK}" stroke-width="1.6"/><circle cx="29" cy="28" r="1" fill="#c8a07a"/><circle cx="35" cy="28" r="1" fill="#c8a07a"/><circle cx="29" cy="33" r="1" fill="#c8a07a"/><circle cx="35" cy="33" r="1" fill="#c8a07a"/></g>`;
  },
  medkit() {
    return `<defs>${grad('k', '#ff6a6a', '#c82a3a')}</defs>${shadow}<rect x="24" y="8" width="16" height="8" rx="3" fill="none" stroke="${INK}" stroke-width="2.6"/>
      <rect x="10" y="14" width="44" height="36" rx="7" fill="url(#k)" stroke="${INK}" stroke-width="2.5"/>
      <path d="M32 22v20M22 32h20" stroke="#fff" stroke-width="7" stroke-linecap="round"/>`;
  },
  orb(c, rings = true) {
    return `<defs>${radial('o', light(c, 0.75), dark(c, 0.3))}</defs>${shadow}
      <circle cx="32" cy="30" r="24" fill="${c}" opacity=".18"/>
      <circle cx="32" cy="30" r="15" fill="url(#o)" stroke="${INK}" stroke-width="2.5"/>
      ${rings ? `<ellipse cx="32" cy="30" rx="24" ry="7" fill="none" stroke="${light(c, 0.4)}" stroke-width="2.2" transform="rotate(-20 32 30)"/><ellipse cx="32" cy="30" rx="22" ry="6" fill="none" stroke="${light(c, 0.6)}" stroke-width="1.6" transform="rotate(35 32 30)"/>` : ''}
      <ellipse cx="27" cy="24" rx="4.5" ry="3" fill="#fff" opacity=".6" transform="rotate(-30 27 24)"/>`;
  },
  cog(c) {
    const teeth = Array.from({ length: 8 }, (_, i) => `<rect x="28.5" y="8" width="7" height="9" rx="1.5" fill="${c}" stroke="${INK}" stroke-width="2" transform="rotate(${i * 45} 32 30)"/>`).join('');
    return `<defs>${radial('q', light(c, 0.5), dark(c, 0.25))}</defs>${shadow}${teeth}
      <circle cx="32" cy="30" r="15" fill="url(#q)" stroke="${INK}" stroke-width="2.5"/><circle cx="32" cy="30" r="5.5" fill="#2a2f44" stroke="${INK}" stroke-width="2"/>`;
  },
  spool(c) {
    return `<defs>${grad('p', light(c, 0.4), dark(c, 0.2), false)}</defs>${shadow}
      <rect x="16" y="10" width="32" height="6" rx="2.5" fill="#b07a48" stroke="${INK}" stroke-width="2.2"/>
      <rect x="16" y="44" width="32" height="6" rx="2.5" fill="#b07a48" stroke="${INK}" stroke-width="2.2"/>
      <rect x="20" y="16" width="24" height="28" fill="url(#p)" stroke="${INK}" stroke-width="2.2"/>
      <path d="M20 22h24M20 28h24M20 34h24M20 40h24" stroke="${dark(c, 0.3)}" stroke-width="1.3" opacity=".6"/>
      <path d="M44 34c6 4 6 10 2 16" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
  },
  pearl(c) {
    return `<defs>${radial('r', '#ffffff', c)}</defs>${shadow}
      <path d="M10 40c6-14 38-14 44 0-8 8-36 8-44 0z" fill="${dark(c, 0.15)}" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="32" cy="30" r="12" fill="url(#r)" stroke="${INK}" stroke-width="2.5"/>
      <circle cx="28" cy="26" r="3.5" fill="#fff" opacity=".8"/>`;
  },
  seed(c) {
    return `<defs>${grad('d', light(c, 0.3), dark(c, 0.3))}</defs>${shadow}
      <path d="M32 54c-12-4-16-18-8-30 4-6 12-6 16 0 8 12 4 26-8 30z" fill="url(#d)" stroke="${INK}" stroke-width="2.5"/>
      <path d="M32 20c-2-8 4-14 12-14-1 8-6 12-12 14z" fill="#5bc76a" stroke="${INK}" stroke-width="2.2"/>
      <path d="M32 26v24" stroke="${dark(c, 0.4)}" stroke-width="1.6" opacity=".6"/>`;
  },
  dust(c) {
    return `<defs>${radial('u', light(c, 0.5), dark(c, 0.2))}</defs>${shadow}
      <path d="M12 50c2-12 10-20 20-20s18 8 20 20z" fill="url(#u)" stroke="${INK}" stroke-width="2.5"/>
      ${[[22, 22, 2.4], [34, 16, 3], [44, 24, 2], [28, 10, 1.8], [40, 9, 1.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${light(c, 0.3)}" stroke="${INK}" stroke-width="1.2"/>`).join('')}`;
  },
  vial(c) {
    return `<defs>${grad('e', light(c, 0.55), dark(c, 0.2))}</defs>${shadow}
      <path d="M26 6h12v8l8 10-14 30-14-30 8-10z" fill="url(#e)" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M18 24h28" stroke="${dark(c, 0.3)}" stroke-width="1.4" opacity=".6"/>
      <path d="M27 18 22 26 30 44z" fill="#fff" opacity=".5"/>`;
  },
};

/** The SVG body for an item, or null when there is no drawing for it. */
function drawItem(it) {
  const id = it.id, el = (k) => ELEMENTS[k]?.color ?? 0x8898aa;
  if (it.kind === 'sphere') return id === 'sphere_ultra' ? DRAW.sphere(0xff9a2a, '#f2e6c8', '#ffd27a') : id === 'sphere_great' ? DRAW.sphere(0x8a5ae8, '#d8dee8') : DRAW.sphere(0x2fb8e8, '#c9a24a');
  if (it.kind === 'heal') return DRAW.flask(id === 'potion_l' ? 0xb04ae8 : id === 'potion_m' ? 0x2f8ae8 : 0x3fd98b, id === 'potion_l' ? 2 : id === 'potion_m' ? 1 : 0);
  if (id === 'revive') return DRAW.feather(0xf2b84a);
  if (id === 'revive_full') return DRAW.feather(0xffd23d, true);
  if (id === 'ether') return DRAW.vial(0x2fe6d0);
  if (id === 'bandage') return DRAW.bandage();
  if (id === 'medkit') return DRAW.medkit();
  if (id.startsWith('blade_')) return DRAW.blade(id === 'blade_storm' ? 0x6ab8ff : 0xb8c2d0);
  if (id === 'vest_hide') return DRAW.vest(0x9a6a40);
  if (id === 'vest_aegis') return DRAW.shield(0x3a6ad8);
  if (id.startsWith('charm_')) return DRAW.charm(id === 'charm_swift' ? 0x6ad8ff : 0xff6a9a);
  if (id.startsWith('shard_')) return DRAW.shard(el(id.slice(6)));
  if (id.startsWith('crystal_')) return DRAW.crystal(el(id.slice(8)));
  if (id === 'aether_core') return DRAW.orb(0x9a6aff);
  if (id === 'scrap_iron') return DRAW.cog(0x9aa4b4);
  if (id === 'fiber') return DRAW.spool(0x7ac85a);
  if (id === 'mat_emberdust') return DRAW.dust(0xff8a3a);
  if (id === 'mat_tidepearl') return DRAW.pearl(0x7fd8ff);
  if (id === 'mat_verdseed') return DRAW.seed(0xb08a48);
  if (id === 'mat_voidshard') return DRAW.shard(0x6a3ac8);
  return null;
}

const CACHE = new Map();
/** The icon as a data URL (cached), or null. */
export function iconUrl(id) {
  if (CACHE.has(id)) return CACHE.get(id);
  const it = ITEMS[id];
  const body = it && drawItem(it);
  const url = body ? `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`)}` : null;
  CACHE.set(id, url);
  return url;
}

/** HTML for an item's icon: the drawing, or its emoji if it has none. */
export function itemIcon(id, size = 'md') {
  const url = iconUrl(id);
  return url ? `<img class="iicon ${size}" src="${url}" alt="" draggable="false" />` : `<span class="iicon-e">${ITEMS[id]?.icon || '📦'}</span>`;
}

export const ICON_IDS = () => Object.keys(ITEMS).filter((id) => drawItem(ITEMS[id]));
