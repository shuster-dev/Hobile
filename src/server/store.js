// Persistence. One interface, two drivers.
//
// `memory` is the default so `npm run dev` and the QA suite need no database.
// `mongo` is loaded dynamically, so the mongodb package is only required when
// DB_DRIVER=mongo — the server starts fine without it installed.
import fs from 'node:fs';
import { seasonStamp, weekStamp } from '../shared/endgame.js';
import path from 'node:path';

// Boards that turn over: the arena by season, the tower and the world bosses
// by week (shared/endgame.js). A document from last week counts for nothing.
const LIVE = {
  arena: { field: 'arena.rating', value: (d) => d.arena?.rating || 0, ok: (d) => d.arena?.season === seasonStamp() && (d.arena?.games || 0) > 0,
    filter: () => ({ 'arena.season': seasonStamp(), 'arena.games': { $gt: 0 } }) },
  tower: { field: 'weekly.tower', value: (d) => d.weekly?.tower || 0, ok: (d) => d.weekly?.week === weekStamp(),
    filter: () => ({ 'weekly.week': weekStamp(), 'weekly.tower': { $gt: 0 } }) },
  boss: { field: 'weekly.boss', value: (d) => d.weekly?.boss || 0, ok: (d) => d.weekly?.week === weekStamp(),
    filter: () => ({ 'weekly.week': weekStamp(), 'weekly.boss': { $gt: 0 } }) },
};
const row = (d, i) => ({
  rank: i + 1, id: d.id, name: d.name, level: d.level, gold: d.gold, stats: d.stats,
  rating: d.arena?.rating || 0, tower: d.weekly?.tower || 0, boss: d.weekly?.boss || 0,
});

class MemoryStore {
  constructor({ file = process.env.DATA_FILE || '' } = {}) {
    this.file = file;
    this.users = new Map();     // username -> user
    this.docs = new Map();      // userId -> doc
    this.guilds = new Map();    // guildId -> guild
    this.gmLog = [];            // GM actions, newest last (server/game/gm.js)
    this.config = {};           // server settings kept across restarts (the push keys)
    this.pushSubs = new Map();  // endpoint -> { userId, sub, prefs, at } (server/push.js)
    this.pushQ = [];            // notifications waiting for their time
    if (this.file && fs.existsSync(this.file)) this._load();
  }
  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const u of raw.users || []) this.users.set(u.username, u);
      for (const d of raw.docs || []) this.docs.set(d.id, d);
      for (const g of raw.guilds || []) this.guilds.set(g.id, g);
      this.gmLog = Array.isArray(raw.gmLog) ? raw.gmLog : [];
      this.config = raw.config || {};
      for (const r of raw.pushSubs || []) this.pushSubs.set(r.sub.endpoint, r);
      this.pushQ = Array.isArray(raw.pushQ) ? raw.pushQ : [];
    } catch (e) { console.warn('[store] could not read', this.file, e.message); }
  }
  _flush() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify({
        users: [...this.users.values()],
        docs: [...this.docs.values()],
        guilds: [...this.guilds.values()],
        gmLog: this.gmLog,
        config: this.config,
        pushSubs: [...this.pushSubs.values()],
        pushQ: this.pushQ,
      }));
    } catch (e) { console.warn('[store] could not write', this.file, e.message); }
  }
  async connect() { return this; }
  async close() { this._flush(); }
  async findUser(username) { return this.users.get(username) || null; }
  async findUserById(id) {
    for (const u of this.users.values()) if (u.id === id) return u;
    return null;
  }
  async createUser(user) { this.users.set(user.username, user); this._flush(); return user; }
  /** Claiming a guest renames it, and this map is keyed by username. */
  async replaceUser(prevUsername, user) {
    if (prevUsername !== user.username) this.users.delete(prevUsername);
    this.users.set(user.username, user);
    this._flush();
    return user;
  }
  async getDoc(userId) { return this.docs.get(userId) || null; }
  async saveDoc(doc) { this.docs.set(doc.id, doc); this._flush(); return doc; }
  /** A character by its name, any case (for "add friend" by name). */
  async findDocIdByName(name) {
    const n = String(name || '').trim().toLowerCase();
    if (!n) return null;
    for (const d of this.docs.values()) if (String(d.name || '').toLowerCase() === n) return d.id;
    return null;
  }
  async leaderboard(kind = 'level', limit = 50, exclude = []) {
    const skip = new Set(exclude);
    let rows = [...this.docs.values()].filter((d) => !skip.has(d.id));
    // the seasonal and weekly boards count only this season's and this week's
    const live = LIVE[kind];
    if (live) rows = rows.filter((d) => live.ok(d) && live.value(d) > 0);
    const value = live ? live.value : kind === 'gold' ? (d) => d.gold || 0 : kind === 'captures' ? (d) => d.stats?.captures || 0 : (d) => d.level || 0;
    rows.sort((a, b) => value(b) - value(a));
    return rows.slice(0, limit).map((d, i) => row(d, i));
  }
  async listGuilds() { return [...this.guilds.values()]; }
  async saveGuild(g) { this.guilds.set(g.id, g); this._flush(); return g; }
  async deleteGuild(id) { this.guilds.delete(id); this._flush(); }
  async logAdmin(row) {
    this.gmLog.push(row);
    if (this.gmLog.length > GM_LOG_KEEP) this.gmLog.splice(0, this.gmLog.length - GM_LOG_KEEP);
    this._flush();
    return row;
  }
  async adminLog(limit = 40) { return this.gmLog.slice(-limit).reverse(); }
  // --- settings and phone notifications (server/push.js) ---------------------
  async getConfig(key) { return this.config[key] ?? null; }
  async setConfig(key, value) { this.config[key] = value; this._flush(); return value; }
  async savePushSub(row) { this.pushSubs.set(row.sub.endpoint, row); this._flush(); return row; }
  async deletePushSub(endpoint) { this.pushSubs.delete(endpoint); this._flush(); }
  async pushSubsFor(userId) { return [...this.pushSubs.values()].filter((r) => r.userId === userId); }
  async pushSubsWanting(pref, limit = 2000) { return [...this.pushSubs.values()].filter((r) => r.prefs?.[pref] !== false).slice(0, limit); }
  async queuePush(row) { this.pushQ = this.pushQ.filter((q) => !(q.userId === row.userId && q.tag === row.tag)); this.pushQ.push(row); this._flush(); return row; }
  async cancelPush(userId, tag) { this.pushQ = this.pushQ.filter((q) => !(q.userId === userId && q.tag === tag)); this._flush(); }
  async takeDuePush(now = Date.now(), limit = 200) {
    const due = this.pushQ.filter((q) => q.at <= now).slice(0, limit);
    if (due.length) { const set = new Set(due); this.pushQ = this.pushQ.filter((q) => !set.has(q)); this._flush(); }
    return due;
  }
}

// The memory store keeps the newest GM actions; Mongo keeps them all.
const GM_LOG_KEEP = 1000;

// Player documents are held as one live object per player, exactly as the
// memory store holds them, and written through to Mongo.
//
// Without this, every getDoc was a fresh copy and whoever saved last won. The
// memory store hands every room the same object, and every test in the repo ran
// on it, so nothing noticed: a battle, a dungeon, /api/me and a second session
// each took a copy, and a copy saved after the real one quietly put the old
// state back. The case that bites is ordinary — iOS keeps a backgrounded tab's
// socket open for a while, the player reopens the game, the new session loads
// what the 20-second autosave last wrote, and when the old one finally drops,
// the two overwrite each other. tools/store-test.mjs measures it: a purchase
// made in one session was gone after both left.
//
// One object per player makes the Mongo store behave like the store the whole
// codebase was written against. Writes for a player are chained so they reach
// the database in the order they were made, and the cache is bounded — a player
// in a room is saved every 20 seconds, which keeps them at the young end of it,
// so what falls off the old end is nobody anything is holding.
const DOC_CACHE = 5000;

class MongoStore {
  constructor({ url, dbName = 'hobile', cacheSize = DOC_CACHE }) {
    this.url = url; this.dbName = dbName; this.cacheSize = cacheSize;
    this.docs = new Map();     // id -> the live doc, least recently used first
    this.loading = new Map();  // id -> the read in flight, so two callers share one object
    this.writes = new Map();   // id -> the last write queued for that player
  }
  async connect() {
    const { MongoClient } = await import('mongodb');
    this.client = new MongoClient(this.url);
    await this.client.connect();
    const db = this.client.db(this.dbName);
    this.usersC = db.collection('users');
    this.docsC = db.collection('docs');
    this.guildsC = db.collection('guilds');
    this.gmLogC = db.collection('gmlog');
    this.configC = db.collection('config');
    this.pushSubsC = db.collection('pushsubs');
    this.pushQC = db.collection('pushq');
    await this.usersC.createIndex({ username: 1 }, { unique: true });
    await this.usersC.createIndex({ id: 1 }, { unique: true });
    await this.docsC.createIndex({ id: 1 }, { unique: true });
    await this.docsC.createIndex({ level: -1 });
    await this.docsC.createIndex({ gold: -1 });
    await this.docsC.createIndex({ 'arena.season': 1, 'arena.rating': -1 });
    await this.docsC.createIndex({ 'weekly.week': 1, 'weekly.tower': -1 });
    await this.docsC.createIndex({ 'weekly.week': 1, 'weekly.boss': -1 });
    await this.docsC.createIndex({ name: 1 });
    await this.gmLogC.createIndex({ at: -1 });
    await this.configC.createIndex({ key: 1 }, { unique: true });
    await this.pushSubsC.createIndex({ endpoint: 1 }, { unique: true });
    await this.pushSubsC.createIndex({ userId: 1 });
    await this.pushQC.createIndex({ at: 1 });
    await this.pushQC.createIndex({ userId: 1, tag: 1 });
    return this;
  }
  async close() {
    // Rooms save on dispose, but the autosave does not wait for its writes.
    await Promise.allSettled([...this.writes.values()]);
    await this.client?.close();
  }
  async findUser(username) { return this.usersC.findOne({ username }, { projection: { _id: 0 } }); }
  async findUserById(id) { return this.usersC.findOne({ id }, { projection: { _id: 0 } }); }
  async createUser(user) { await this.usersC.insertOne({ ...user }); return user; }
  async replaceUser(prevUsername, user) {
    await this.usersC.replaceOne({ id: user.id }, { ...user });
    return user;
  }
  _remember(doc) {
    this.docs.delete(doc.id);
    this.docs.set(doc.id, doc);
    while (this.docs.size > this.cacheSize) this.docs.delete(this.docs.keys().next().value);
  }
  async getDoc(userId) {
    const live = this.docs.get(userId);
    if (live) { this._remember(live); return live; }
    let read = this.loading.get(userId);
    if (!read) {
      read = this.docsC.findOne({ id: userId }, { projection: { _id: 0 } })
        .then((found) => {
          // A save that landed while this read was out is newer than the read.
          const current = this.docs.get(userId);
          if (current) return current;
          if (found) this._remember(found);
          return found || null;
        })
        .finally(() => this.loading.delete(userId));
      this.loading.set(userId, read);
    }
    return read;
  }
  async saveDoc(doc) {
    this._remember(doc);
    // The driver serialises when the write runs, not when it is queued, so each
    // write in the chain carries the newest state and the last one wins.
    const write = (this.writes.get(doc.id) || Promise.resolve())
      .catch(() => {})
      .then(() => this.docsC.replaceOne({ id: doc.id }, doc, { upsert: true }));
    this.writes.set(doc.id, write);
    write.finally(() => { if (this.writes.get(doc.id) === write) this.writes.delete(doc.id); }).catch(() => {});
    await write;
    return doc;
  }
  async findDocIdByName(name) {
    const n = String(name || '').trim();
    if (!n) return null;
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const d = await this.docsC.findOne({ name: { $regex: `^${esc}$`, $options: 'i' } }, { projection: { _id: 0, id: 1 } });
    return d?.id || null;
  }
  async leaderboard(kind = 'level', limit = 50, exclude = []) {
    const live = LIVE[kind];
    const sort = live ? { [live.field]: -1 } : kind === 'gold' ? { gold: -1 } : kind === 'captures' ? { 'stats.captures': -1 } : { level: -1 };
    const filter = { ...(exclude.length ? { id: { $nin: exclude } } : {}), ...(live ? live.filter() : {}) };
    const rows = await this.docsC.find(filter, { projection: { _id: 0, id: 1, name: 1, level: 1, gold: 1, stats: 1, arena: 1, weekly: 1, guildId: 1 } })
      .sort(sort).limit(limit).toArray();
    return rows.map((d, i) => row(d, i));
  }
  async listGuilds() { return this.guildsC.find({}, { projection: { _id: 0 } }).toArray(); }
  async saveGuild(g) { await this.guildsC.replaceOne({ id: g.id }, g, { upsert: true }); return g; }
  async deleteGuild(id) { await this.guildsC.deleteOne({ id }); }
  async logAdmin(row) { await this.gmLogC.insertOne({ ...row }); return row; }
  async adminLog(limit = 40) {
    return this.gmLogC.find({}, { projection: { _id: 0 } }).sort({ at: -1 }).limit(limit).toArray();
  }
  // --- settings and phone notifications (server/push.js) ---------------------
  async getConfig(key) { return (await this.configC.findOne({ key }, { projection: { _id: 0 } }))?.value ?? null; }
  async setConfig(key, value) { await this.configC.replaceOne({ key }, { key, value }, { upsert: true }); return value; }
  async savePushSub(row) { await this.pushSubsC.replaceOne({ endpoint: row.sub.endpoint }, { ...row, endpoint: row.sub.endpoint }, { upsert: true }); return row; }
  async deletePushSub(endpoint) { await this.pushSubsC.deleteOne({ endpoint }); }
  async pushSubsFor(userId) { return this.pushSubsC.find({ userId }, { projection: { _id: 0 } }).toArray(); }
  async pushSubsWanting(pref, limit = 2000) { return this.pushSubsC.find({ [`prefs.${pref}`]: { $ne: false } }, { projection: { _id: 0 } }).limit(limit).toArray(); }
  async queuePush(row) { await this.pushQC.replaceOne({ userId: row.userId, tag: row.tag }, { ...row }, { upsert: true }); return row; }
  async cancelPush(userId, tag) { await this.pushQC.deleteMany({ userId, tag }); }
  async takeDuePush(now = Date.now(), limit = 200) {
    const due = await this.pushQC.find({ at: { $lte: now } }, { projection: { _id: 0 } }).sort({ at: 1 }).limit(limit).toArray();
    for (const q of due) await this.pushQC.deleteOne({ userId: q.userId, tag: q.tag, at: q.at });
    return due;
  }
}

export async function openStore(env = process.env) {
  const driver = (env.DB_DRIVER || 'memory').toLowerCase();
  if (driver === 'mongo') {
    if (!env.MONGO_URL) throw new Error('DB_DRIVER=mongo needs MONGO_URL');
    return new MongoStore({ url: env.MONGO_URL, dbName: env.MONGO_DB || 'hobile' }).connect();
  }
  return new MemoryStore({ file: env.DATA_FILE || '' }).connect();
}
