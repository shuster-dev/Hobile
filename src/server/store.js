// Persistence. One interface, two drivers.
//
// `memory` is the default so `npm run dev` and the QA suite need no database.
// `mongo` is loaded dynamically, so the mongodb package is only required when
// DB_DRIVER=mongo — the server starts fine without it installed.
import fs from 'node:fs';
import path from 'node:path';

class MemoryStore {
  constructor({ file = process.env.DATA_FILE || '' } = {}) {
    this.file = file;
    this.users = new Map();     // username -> user
    this.docs = new Map();      // userId -> doc
    this.guilds = new Map();    // guildId -> guild
    if (this.file && fs.existsSync(this.file)) this._load();
  }
  _load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const u of raw.users || []) this.users.set(u.username, u);
      for (const d of raw.docs || []) this.docs.set(d.id, d);
      for (const g of raw.guilds || []) this.guilds.set(g.id, g);
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
  async leaderboard(kind = 'level', limit = 50) {
    const key = kind === 'gold' ? 'gold' : kind === 'captures' ? null : 'level';
    const rows = [...this.docs.values()];
    rows.sort((a, b) => key ? (b[key] || 0) - (a[key] || 0)
      : (b.stats?.captures || 0) - (a.stats?.captures || 0));
    return rows.slice(0, limit).map((d, i) => ({
      rank: i + 1, id: d.id, name: d.name, level: d.level, gold: d.gold, stats: d.stats,
    }));
  }
  async listGuilds() { return [...this.guilds.values()]; }
  async saveGuild(g) { this.guilds.set(g.id, g); this._flush(); return g; }
}

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
    await this.usersC.createIndex({ username: 1 }, { unique: true });
    await this.usersC.createIndex({ id: 1 }, { unique: true });
    await this.docsC.createIndex({ id: 1 }, { unique: true });
    await this.docsC.createIndex({ level: -1 });
    await this.docsC.createIndex({ gold: -1 });
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
  async leaderboard(kind = 'level', limit = 50) {
    const sort = kind === 'gold' ? { gold: -1 } : kind === 'captures' ? { 'stats.captures': -1 } : { level: -1 };
    const rows = await this.docsC.find({}, { projection: { _id: 0, id: 1, name: 1, level: 1, gold: 1, stats: 1 } })
      .sort(sort).limit(limit).toArray();
    return rows.map((d, i) => ({ rank: i + 1, ...d }));
  }
  async listGuilds() { return this.guildsC.find({}, { projection: { _id: 0 } }).toArray(); }
  async saveGuild(g) { await this.guildsC.replaceOne({ id: g.id }, g, { upsert: true }); return g; }
}

export async function openStore(env = process.env) {
  const driver = (env.DB_DRIVER || 'memory').toLowerCase();
  if (driver === 'mongo') {
    if (!env.MONGO_URL) throw new Error('DB_DRIVER=mongo needs MONGO_URL');
    return new MongoStore({ url: env.MONGO_URL, dbName: env.MONGO_DB || 'hobile' }).connect();
  }
  return new MemoryStore({ file: env.DATA_FILE || '' }).connect();
}
