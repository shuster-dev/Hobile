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

class MongoStore {
  constructor({ url, dbName = 'hobile' }) { this.url = url; this.dbName = dbName; }
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
  async close() { await this.client?.close(); }
  async findUser(username) { return this.usersC.findOne({ username }, { projection: { _id: 0 } }); }
  async findUserById(id) { return this.usersC.findOne({ id }, { projection: { _id: 0 } }); }
  async createUser(user) { await this.usersC.insertOne({ ...user }); return user; }
  async replaceUser(prevUsername, user) {
    await this.usersC.replaceOne({ id: user.id }, { ...user });
    return user;
  }
  async getDoc(userId) { return this.docsC.findOne({ id: userId }, { projection: { _id: 0 } }); }
  async saveDoc(doc) { await this.docsC.replaceOne({ id: doc.id }, doc, { upsert: true }); return doc; }
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
