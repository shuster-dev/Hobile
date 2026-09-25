import { Client } from 'colyseus.js';

var TOKEN_KEY = "hobile.token";

// "Remember me" keeps the token in localStorage, which outlives the browser;
// without it the token lives in sessionStorage and goes when the tab does.
var REMEMBER_KEY = "hobile.remember";

function remembering() {
  try {
    return localStorage.getItem(REMEMBER_KEY) !== "0";
  } catch {
    return !0;
  }
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function writeToken(i) {
  try {
    localStorage.removeItem(TOKEN_KEY), sessionStorage.removeItem(TOKEN_KEY), i && (remembering() ? localStorage : sessionStorage).setItem(TOKEN_KEY, i);
  } catch {}
}

function setRemember(i) {
  try {
    localStorage.setItem(REMEMBER_KEY, i ? "1" : "0");
  } catch {}
}

var Net = class {
    constructor({
      httpBase: e = "",
      wsBase: t = null
    } = {}) {
      this.httpBase = e, this.wsBase = t || (location.protocol === "https:" ? "wss://" : "ws://") + location.host, this.token = readToken(), this.room = null, this.offline = !1, this.handlers = new Map();
    }
    async api(e, t, n = "POST") {
      let s = await fetch(this.httpBase + "/api" + e, {
          method: t || n !== "GET" ? n : "GET",
          headers: {
            "content-type": "application/json",
            ...(this.token ? {
              authorization: `Bearer ${this.token}`
            } : {})
          },
          ...(t ? {
            body: JSON.stringify(t)
          } : {})
        }),
        r = await s.json().catch(() => ({}));
      if (!s.ok) throw Object.assign(new Error(r.error || "request_failed"), {
        code: r.error,
        status: s.status
      });
      return r;
    }
    async register(e, t) {
      return this._auth(await this.api("/register", {
        username: e,
        password: t
      }));
    }
    async login(e, t) {
      return this._auth(await this.api("/login", {
        username: e,
        password: t
      }));
    }
    async guest() {
      return this._auth(await this.api("/guest", {}));
    }
    _auth(e) {
      return this.token = e.token, writeToken(e.token), e;
    }
    logout() {
      this.token = null, writeToken(null);
    }
    hasSession() {
      return !!this.token;
    }
    async me() {
      let e = await this.api("/me", null, "GET");
      // The server hands back a fresh token on every visit. A guest has no
      // password to fall back on, so letting the old one lapse would strand
      // them — keep whatever came back.
      return e.token && this._auth(e), e;
    }
    /** Put a name and a password on the guest account already in play. */
    async claim(e, t) {
      let n = await this.api("/claim", {
        username: e,
        password: t
      });
      return this._auth(n), n;
    }
    async createCharacter(e) {
      return this.api("/character", e);
    }
    async leaderboard(e = "level") {
      return this.api(`/leaderboard?kind=${e}`, null, "GET");
    }
    async guilds() {
      return this.api("/guilds", null, "GET");
    }
    get client() {
      return this._client || (this._client = new Client(this.wsBase)), this._client;
    }
    async joinWorld(e, t) {
      return this._attach(await this.client.joinOrCreate("world", {
        zone: e,
        fromZone: t,
        token: this.token
      }));
    }
    async joinRoomById(e) {
      return this._attach(await this.client.joinById(e, {
        token: this.token
      }));
    }
    _attach(e) {
      this.room = e;
      for (let t of NET_EVENTS) e.onMessage(t, n => this.emit(t, n));
      return e.onMessage("*", (t, n) => {
        NET_EVENTS.includes(t) || this.emit(String(t), n);
      }), e.onLeave(t => this.emit("left", {
        code: t,
        // leaveRoom() lets go of the room before leaving it, so a room that
        // is still ours when it closes is one we lost, not one we left.
        unexpected: this.room === e
      })), e.onError((t, n) => this.emit("roomError", {
        code: t,
        message: n
      })), e.send("ready"), e;
    }
    async leaveRoom(e = !0) {
      let t = this.room;
      if (this.room = null, !!t) try {
        await Promise.race([t.leave(e), new Promise(n => setTimeout(n, 1200))]);
      } catch {}
    }
    send(e, t) {
      try {
        this.room?.send(e, t);
      } catch {}
    }
    on(e, t) {
      return this.handlers.has(e) || this.handlers.set(e, new Set()), this.handlers.get(e).add(t), () => this.handlers.get(e)?.delete(t);
    }
    emit(e, t) {
      for (let n of this.handlers.get(e) || []) try {
        n(t);
      } catch (s) {
        console.error("[net]", e, s);
      }
      for (let n of this.handlers.get("*") || []) try {
        n(e, t);
      } catch {}
    }
  },
  NET_EVENTS = ["profile", "zone", "chat", "goto", "error", "healed", "dialogue", "inventory", "party", "partyInvite", "friends", "friendRequest", "friendResult", "guild", "guildList", "questClaimed", "battleInit", "battleStart", "battleEvent", "battleEnd", "actionRejected", "emote", "dungeonInit", "dungeonEnd", "floor", "floorCleared", "bossSpawn", "bossHit", "bossCounter", "bossEnd", "bossReward", "duelRequest", "pong"];

export { NET_EVENTS, Net, TOKEN_KEY, readToken, remembering, setRemember, writeToken };
