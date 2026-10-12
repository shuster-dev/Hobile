/**
 * Portraits for the cards — my creatures, the collection, a species' page, a
 * creature's card. Each is the creature's own figurine, drawn by
 * gfx/stage.js `portraits`, a few at a time as their cards come into view
 * (a collection of a hundred and twenty is not drawn all at once), and kept:
 * in memory for the session and in IndexedDB between sessions, so the second
 * time the collection opens it opens on its pictures.
 *
 * In the markup a card asks for one with `<img data-face="species">`;
 * `lazyFaces(root)` fills every such image under `root` once it is near the
 * screen. An uncaught one is the same picture with CSS making a shadow of it.
 */
import { portraits } from './gfx/stage.js';

// Bump when the figurines change, so stored pictures are drawn again.
const VERSION = 1;
const SIZE = 224;
const BATCH = 6;

const MEM = new Map();
const WAIT = new Map();
const queue = [];
let busy = false;

// --- IndexedDB, best effort: a private window or a full disk only means
// drawing again next time
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res) => {
    try {
      const r = indexedDB.open('hobile-faces', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f');
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
      r.onblocked = () => res(null);
    } catch { res(null); }
  });
  return dbp;
}
const keyOf = (id) => `${VERSION}:${SIZE}:${id}`;
async function load(id) {
  const d = await db();
  if (!d) return null;
  return new Promise((res) => {
    try {
      const q = d.transaction('f', 'readonly').objectStore('f').get(keyOf(id));
      q.onsuccess = () => res(typeof q.result === 'string' ? q.result : null);
      q.onerror = () => res(null);
    } catch { res(null); }
  });
}
async function save(id, url) {
  const d = await db();
  if (!d) return;
  try { d.transaction('f', 'readwrite').objectStore('f').put(url, keyOf(id)); } catch { /* full, private: fine */ }
}

function done(id, url) {
  url && MEM.set(id, url);
  const w = WAIT.get(id);
  WAIT.delete(id);
  w?.res(url || '');
}

async function pump() {
  if (busy) return;
  busy = true;
  try {
    while (queue.length) {
      const ids = queue.splice(0, BATCH);
      let out = {};
      try { out = await portraits(ids, SIZE); } catch { out = {}; }
      for (const id of ids) {
        const url = out[id] || '';
        done(id, url);
        url && save(id, url);
      }
      // a breath between batches: the panel stays smooth to scroll
      await new Promise((r) => setTimeout(r, 30));
    }
  } finally { busy = false; }
}

/** The picture if it is already here, or null. */
export function faceNow(id) { return MEM.get(id) || null; }

/** The picture of a species, drawn (or read back) if it has to be. */
export function face(id) {
  if (!id) return Promise.resolve('');
  if (MEM.has(id)) return Promise.resolve(MEM.get(id));
  if (WAIT.has(id)) return WAIT.get(id).p;
  let res;
  const p = new Promise((r) => { res = r; });
  WAIT.set(id, { p, res });
  load(id).then((url) => {
    if (url) return done(id, url);
    queue.push(id);
    pump();
  });
  return p;
}

function show(img, url) {
  if (!url || !img.isConnected) return;
  img.src = url;
  img.classList.add('in');
}

let io = null;
/** Fill every `img[data-face]` under `root` as it comes near the screen. */
export function lazyFaces(root) {
  if (!root) return;
  const imgs = [...root.querySelectorAll('img[data-face]')].filter((i) => !i.getAttribute('src'));
  if (!imgs.length) return;
  const fill = (img) => face(img.dataset.face).then((u) => show(img, u));
  if (typeof IntersectionObserver !== 'function') { imgs.forEach(fill); return; }
  io ||= new IntersectionObserver((es) => {
    for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); fill(e.target); }
  }, { rootMargin: '240px 0px' });
  for (const img of imgs) {
    const now = MEM.get(img.dataset.face);
    now ? show(img, now) : io.observe(img);
  }
}
