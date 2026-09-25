import { Vector3 } from 'three';
import { vibrate } from './audio.js';
import { device, initDevice, isFullscreen, toggleFullscreen } from './device.js';
import { BattleView, audio } from './gfx/battle.js';
import { CreatorStage, portraits } from './gfx/stage.js';
import { WorldView } from './gfx/world.js';
import { CameraRig, Joystick, Keyboard } from './input.js';
import { Net, remembering, setRemember } from './net.js';
import { $, Ib, UI, kb, loc, wp, zb } from './ui.js';
import { ACTIONS, AVATAR, DUNGEONS, ELEMENTS, HOME_ZONE, ITEMS, MOVES, QUESTS, SPECIES, STARTERS, ZONES } from '../shared/gamedata.js';
import { NPCS } from '../shared/npcs.js';
import { GIVERS, giverMark, giverView, heldProgress, questState } from '../shared/story.js';
import { weatherAt } from '../shared/weather.js';
import { FIELD_FROM_LEVEL, isNight, stanceOfLead, temperOf } from '../shared/temper.js';

var WANT_LOGIN = "hobile.wantLogin";

var Game = class {
  constructor(e) {
    this.net = e || new Net(Ib()), this.world = new WorldView($("#world-canvas")), this.battleView = new BattleView($("#battle-canvas")), this.ui = new UI(this.hooks()), this.stick = new CameraRig($("#stick-zone"), $("#stick-base"), $("#stick-knob")), this.keys = new Keyboard(), this.look = new Joystick($("#look-zone"), (n, s) => {
      if (this.world.camYaw -= n * 0.0055, this.world.viewMode === "first") {
        this.world.camPitch = Math.max(-0.9, Math.min(0.9, this.world.camPitch - s * 0.006));
        return;
      }
      this.world.camHeight = Math.max(3.5, Math.min(15, this.world.camHeight + s * 0.02)), this.world.camDist = Math.max(6.5, Math.min(15, this.world.camDist + s * 0.012));
    }), this.mode = "boot", this.zone = null, this.profile = null, this.cooldowns = {}, this.battle = {
      youId: null,
      combatants: [],
      inventory: {}
    }, this.lastNetSend = 0, this.nearest = null, this.shake = 0, this.freezeUntil = 0, this.walkPhase = 0;
    let t = () => audio.unlock();
    for (let n of ["pointerdown", "touchstart", "keydown"]) window.addEventListener(n, t, {
      passive: !0
    });
    initDevice(), this.bindFullscreen();
    this.bindNet(), this.bindButtons(), this.loop = this.loop.bind(this), requestAnimationFrame(this.loop);
    // A locked phone or a switched app: tell the world, so nothing out in the
    // field starts on a player who is not looking at the game.
    document.addEventListener("visibilitychange", () => {
      this.mode === "world" && this.net.send("presence", { away: document.visibilityState === "hidden" });
    });
  }
  /**
   * The fullscreen affordance, and the honest fallback.
   *
   * iPhone Safari has no Fullscreen API — not a permissions problem, the
   * method does not exist — so offering a button there would be a button that
   * does nothing. What works on iPhone is Add to Home Screen, which needs the
   * page on its own origin; inside an artifact iframe it cannot work at all.
   * So the control only appears where it will actually do something, and the
   * hint only appears where it is actually the answer.
   */
  bindFullscreen() {
    if (device.standalone) return;                 // already chrome-free
    let btn = document.createElement("button");
    btn.className = "fs-btn hidden";
    btn.id = "btn-fs";
    document.getElementById("hud")?.appendChild(btn);
    let paint = () => {
      if (device.canFullscreen) {
        btn.textContent = isFullscreen() ? "⤡ יציאה ממסך מלא" : "⛶ מסך מלא";
        btn.classList.remove("hidden");
      } else if (device.ios && !device.framed) {
        btn.textContent = "⬆ הוסף למסך הבית למסך מלא";
        btn.classList.remove("hidden");
      } else {
        btn.classList.add("hidden");               // iOS inside an iframe: nothing to offer
      }
    };
    btn.onclick = async () => {
      if (device.canFullscreen) { await toggleFullscreen(); paint(); return; }
      this.ui.toast("שתף ← הוסף למסך הבית, ואז המשחק ייפתח בלי הדפדפן", "good");
    };
    document.addEventListener("fullscreenchange", paint);
    document.addEventListener("webkitfullscreenchange", paint);
    paint();
    // Out of the way once play starts; the menu still has it.
    setTimeout(() => btn.classList.add("hidden"), 9000);
    this._paintFullscreen = paint;
  }

  async boot() {
    let e = !1;
    try {
      e = sessionStorage.getItem(WANT_LOGIN) === "1", e && sessionStorage.removeItem(WANT_LOGIN);
    } catch {}
    // Switching accounts goes straight to the form it asked for.
    if (e && !this.net.hasSession()) {
      this.ui.setLoading(!1), this.showLogin();
      return;
    }
    let t = await this.showTitle(this.prepareSession(m => {
      let el = $("#title-sub");
      el && (el.textContent = m);
    }));
    if (this.world.titleView(!1), t.next === "login") return this.showLogin();
    if (t.next === "create") return this.showCreate();
    await this.enterWorld(t.zone);
  }
  /**
   * Everything boot used to do before the first frame, now done behind the
   * title while the harbour turns. No form on the first click: a guest here is
   * a real account — the server holds its document from the first step — and
   * it can be claimed later with a username and a password without losing any
   * of it. A sign-up wall in front of a game link is where most people stop.
   */
  async prepareSession(note = () => {}) {
    // Only the server saying "that token is not good" is a reason to log out.
    // Anything else — no network, a 502 while the free server wakes up, a
    // timeout — is a reason to wait and ask again. Treating every failure as
    // a bad token is what deleted the saved login and sent players back to the
    // password form every time they came back after a break.
    let refused = o => o?.status === 401 || o?.status === 403,
      patient = async fn => {
        for (let i = 0; ; i++) try {
          return await fn();
        } catch (o) {
          if (refused(o) || i >= 11) throw o;
          note(i < 2 ? "מתחבר…" : "השרת מתעורר — עוד רגע…"), await new Promise(r => setTimeout(r, Math.min(8e3, 1500 * (i + 1))));
        }
      };
    try {
      this.net.hasSession() || await patient(() => this.net.guest());
    } catch {
      return { next: "login" };
    }
    try {
      let e = await patient(() => this.net.me());
      return this.setAccount(e), e.hasCharacter ? {
        next: "world",
        zone: e.profile.zone || HOME_ZONE,
        name: e.profile.name
      } : { next: "create" };
    } catch (o) {
      return refused(o) && this.net.logout(), { next: "login" };
    }
  }
  /**
   * The front door. The world was always loading behind a spinner; now it
   * loads behind the logo, live, and the first thing a player touches is a
   * button that says play. That tap is also what browsers require before a
   * page may make a sound, so the music starts with the game instead of
   * whenever the first stray touch happened to land.
   */
  showTitle(e) {
    // No HUD, but the world canvas stays up: it is the background.
    this.mode = "title", this.ui.setMode("none"), $("#world-canvas").classList.remove("hidden");
    try {
      this.world.loadZone(ZONES[HOME_ZONE]), this.world.holdTimeOfDay(0.66), this.world.titleView(!0);
    } catch {}
    this.ui.setLoading(!1), this.ui.showScreen("title");
    let t = $("#btn-play"),
      n = $("#title-sub"),
      s = $("#screen-title .title-top");
    // One copy of the logo in the page; the title borrows it.
    if (s && !s.querySelector(".logo")) {
      let a = $("#screen-login .logo")?.cloneNode(!0),
        he = $("#screen-login .logo-he")?.cloneNode(!0);
      a && (s.prepend(a), he && a.after(he));
    }
    t.disabled = !0, t.textContent = "טוען…", n.textContent = "";
    let r = null;
    return e.then(a => {
      r = a, t.disabled = !1, t.textContent = a.next === "world" ? "▶ המשך" : "▶ שחק", n.textContent = a.next === "world" && a.name ? `ברוך שובך, ${a.name}` : "הרפתקה חדשה מחכה";
    }), new Promise(a => {
      t.onclick = () => {
        r && (audio.unlock(), t.disabled = !0, this.world.holdTimeOfDay(null), a(r));
      }, $("#btn-title-login").onclick = () => {
        this.world.titleView(!1), this.world.holdTimeOfDay(null), this.showLogin();
      };
    });
  }
  /** Who is playing, and whether there is still something to claim. */
  setAccount(e) {
    return this.account = {
      guest: !!e?.guest,
      username: e?.username || "",
      local: !!e?.local
    }, this.ui.setAccount(this.account), this.account;
  }
  showLogin() {
    this.ui.showScreen("login"), this.ui.setMode("none");
    let e = !1,
      t = s => {
        e = s, $("#tab-login").classList.toggle("on", !s), $("#tab-register").classList.toggle("on", s), $("#btn-submit").textContent = s ? "צור חשבון" : "התחבר", $("#in-pass").setAttribute("autocomplete", s ? "new-password" : "current-password");
      },
      keep = $("#in-remember");
    // The name comes back filled in; the password is the phone's to offer —
    // a real form with a submit is what makes iOS and Android offer to save it.
    keep && (keep.checked = remembering());
    try {
      remembering() && !$("#in-user").value && ($("#in-user").value = localStorage.getItem("hobile.user") || "");
    } catch {}
    $("#tab-login").onclick = () => t(!1), $("#tab-register").onclick = () => t(!0);
    let n = async () => {
      let s = $("#in-user").value.trim(),
        r = $("#in-pass").value;
      $("#login-error").textContent = "", setRemember(!keep || keep.checked);
      try {
        let o = e ? await this.net.register(s, r) : await this.net.login(s, r);
        try {
          remembering() ? localStorage.setItem("hobile.user", s) : localStorage.removeItem("hobile.user");
        } catch {}
        this.ui.showScreen(null), this.setAccount(await this.net.me().catch(() => ({}))), o.hasCharacter ? await this.enterWorld() : this.showCreate();
      } catch (o) {
        $("#login-error").textContent = Oc(o.code);
      }
    };
    $("#login-form").onsubmit = s => {
      s.preventDefault(), n();
    }, $("#btn-guest").onclick = async () => {
      try {
        await this.net.guest(), this.setAccount(await this.net.me().catch(() => ({
          guest: !0
        }))), this.ui.showScreen(null), this.showCreate();
      } catch (s) {
        $("#login-error").textContent = Oc(s.code);
      }
    };
  }
  showCreate() {
    this.ui.showScreen("create"), this.ui.setMode("none");
    let e = {
        body: AVATAR.bodies[0],
        skin: AVATAR.skins[0],
        hair: AVATAR.hair[0],
        outfit: AVATAR.outfits[0].id,
        starter: STARTERS[0]
      },
      // The stage follows every pick the moment it is made.
      show = () => this.creatorStage?.set({
        body: e.body,
        skin: e.skin,
        hair: e.hair,
        outfit: e.outfit
      }, e.starter),
      t = (o, a, l, c) => {
        let h = $(o);
        h.innerHTML = "";
        for (let d of a) {
          let u = document.createElement("button");
          u.className = `chip ${e[l] === (d.id ?? d) ? "on" : ""}`, u.textContent = c(d), u.onclick = () => {
            e[l] = d.id ?? d, t(o, a, l, c), show();
          }, h.appendChild(u);
        }
      },
      n = (o, a, l) => {
        let c = $(o);
        c.innerHTML = "";
        for (let h of a) {
          let d = document.createElement("button");
          d.className = `swatch ${e[l] === h ? "on" : ""}`, d.style.background = h, d.onclick = () => {
            e[l] = h, n(o, a, l), show();
          }, c.appendChild(d);
        }
      };
    t("#pick-body", AVATAR.bodies, "body", o => ({
      slim: "רזה",
      stocky: "מוצק",
      tall: "גבוה"
    })[o] || o), n("#pick-skin", AVATAR.skins, "skin"), n("#pick-hair", AVATAR.hair, "hair"), t("#pick-outfit", AVATAR.outfits, "outfit", o => loc(o));
    let s = $("#pick-starter"),
      pics = {},
      r = () => {
        s.innerHTML = "";
        for (let o of STARTERS) {
          let a = SPECIES[o],
            l = document.createElement("button");
          l.className = `starter ${e.starter === o ? "on" : ""}`, l.innerHTML = `${pics[o] ? `<img class="portrait" alt="" src="${pics[o]}">` : ""}<div class="dot" style="background:#${a.model.a.toString(16).padStart(6, "0")}"></div>
          <b>${loc(a)}</b><span>${ELEMENTS[a.types[0]].icon} ${loc(ELEMENTS[a.types[0]])}</span>`, l.onclick = () => {
            e.starter = o, r(), show();
          }, s.appendChild(l);
        }
      };
    // The stage and the portraits are decoration: if WebGL is short of
    // contexts or a model will not load, the form still works with circles.
    try {
      this.creatorStage?.dispose(), this.creatorStage = new CreatorStage($("#creator-stage")), show();
    } catch (o) {
      this.creatorStage = null, $("#creator-stage")?.classList.add("hidden");
    }
    portraits(STARTERS).then(o => {
      pics = o || {}, $("#screen-create:not(.hidden)") && r();
    }).catch(() => {});
    r(), $("#btn-create").onclick = async () => {
      let o = $("#in-charname").value.trim();
      $("#create-error").textContent = "";
      try {
        await this.net.createCharacter({
          name: o,
          starter: e.starter,
          appearance: {
            body: e.body,
            skin: e.skin,
            hair: e.hair,
            outfit: e.outfit
          }
        }), this.creatorStage?.dispose(), this.creatorStage = null, this.ui.showScreen(null), await this.enterWorld();
      } catch (a) {
        $("#create-error").textContent = Oc(a.code);
      }
    };
  }
  /** The socket went (a phone locking, a network change, the server
   *  restarting): go back into the same zone on the same token, quietly and
   *  with patience, instead of throwing the player out to a login form. */
  async reconnect() {
    if (this._reconnecting) return;
    this._reconnecting = !0;
    let zone = this.zone?.id || this.profile?.zone || HOME_ZONE;
    try {
      for (let i = 0; i < 8; i++) {
        this.ui.toast(i ? "מתחבר מחדש…" : "החיבור נותק — מתחבר מחדש…");
        this.transitioning = !0;
        try {
          if (await this.enterWorld(zone, null, !0)) return;
        } finally {
          this.transitioning = !1;
        }
        await new Promise(r => setTimeout(r, Math.min(15e3, 2e3 * (i + 1))));
      }
      this.ui.toast("לא ניתן להתחבר לעולם", "bad"), this.showLogin();
    } finally {
      this._reconnecting = !1;
    }
  }
  async enterWorld(e = HOME_ZONE, t = null, soft = !1) {
    // GM tools come back with the zone's hello, or not at all: the server
    // decides on every arrival, so nothing is carried over from the last one.
    this.ui.gm = null;
    this.mode = "loading", this.ui.setLoading(!0, "נכנס לעולם…"), await this.net.leaveRoom(!0);
    let n = !1;
    for (let s = 0; s < 3 && !n; s++) try {
      await Sp(this.net.joinWorld(e, t), 18e3), n = !0;
    } catch {
      s < 2 && (this.ui.setLoading(!0, "מתחבר מחדש…"), await new Promise(r => setTimeout(r, 700)));
    }
    if (!n) {
      if (soft) return this.ui.setLoading(!1), !1;
      this.mode = "boot", this.ui.setLoading(!1), this.ui.toast("לא ניתן להתחבר לעולם", "bad"), this.showLogin();
      return;
    }
    this.mode = "world", this.spawned = !1, this._chasers = null;
    try {
      let s = globalThis.localStorage?.getItem("hobile.view");
      s && this.world.setViewMode(s);
    } catch {}
    this.ui.showScreen(null), this.ui.setMode("world"), this.ui.setLoading(!1), audio.playMusic(e), t && audio.sfx("portal"), this.wantFaces(this.profile?.team);
    return !0;
  }
  /** Portraits of the team, for the battle screen's team pills: a creature you
   *  can swap to should look like itself, not like a coloured dot. Drawn once
   *  per species, a moment after the world has loaded rather than as a battle
   *  opens, and kept for the session. */
  wantFaces(team) {
    this.faces = this.faces || {};
    let ids = [...new Set((team || []).map(c => c?.species).filter(Boolean))].filter(id => !(id in this.faces));
    if (!ids.length) return;
    for (let id of ids) this.faces[id] = null;
    setTimeout(() => portraits(ids, 96).then(o => {
      Object.assign(this.faces, o || {}), this.ui.faces = this.faces, this.ui.renderTeamBar(null, !0);
    }).catch(() => {}), 1500);
  }
  async enterRoom(e, t) {
    this.mode = "loading", audio.sfx("encounter"), audio.playMusic(t === "dungeon" ? "dungeon" : "battle"), this.ui.setLoading(!0, t === "battle" ? "נכנס לקרב…" : "נכנס למבוך…"), await this.net.leaveRoom(!0);
    try {
      await Sp(this.net.joinRoomById(e), 18e3);
    } catch {
      this.ui.setLoading(!1), this.ui.toast("החדר נסגר", "bad"), this.transitioning = !1, await this.enterWorld(this.zone?.id);
      return;
    }
    this.mode = t === "dungeon" ? "dungeon" : "battle", this.cooldowns = {}, this.battle = {
      youId: null,
      combatants: [],
      inventory: {}
    }, this.ui.setMode("battle"), this.ui.setLoading(!1),
    // "I am on screen now, send me the state." It used to say `arenaReady`,
    // which nothing anywhere handled; `ready` is the name the rooms answer to,
    // and it now returns the same complete payload the fight opened with.
    this.net.send("ready");
  }
  bindNet() {
    let e = this.net;
    e.on("profile", t => {
      this.profile = t, this.ui.setProfile(t), this.ui.renderWorldSkills(t.team?.[0]), this.world.npcMarks = Object.fromEntries(Object.keys(NPCS).map(n => [n, giverMark(t, n)]));
    }), e.on("zone", t => {
      this.zone = t, this.ui.setZone(t), this.world.loadZone(t);
    }), e.on("chat", t => {
      t.fromId && t.fromId !== this.profile?.id && audio.sfx("chat"), this.ui.pushChat(t);
    }), e.on("party", t => {
      this.ui.party = t, this.ui.openPanelId === "party" && this.ui.renderPanel("party");
    }), e.on("friends", t => {
      this.ui.friends = t || {
        friends: [],
        pending: []
      };
      let n = $("#badge-friends"),
        s = this.ui.friends.pending?.length || 0;
      n.textContent = s, n.classList.toggle("hidden", s === 0);
      // Friends lives in the menu now, so the menu carries the count.
      let m = $("#badge-menu");
      m && (m.textContent = s, m.classList.toggle("hidden", s === 0)), this.ui.openPanelId === "friends" && this.ui.renderPanel("friends");
    }), e.on("guild", t => {
      this.ui.guild = t, this.ui.openPanelId === "guild" && this.ui.renderPanel("guild");
    }), e.on("guildList", t => {
      this._guildListResolve?.(t);
    }), e.on("partyInvite", t => {
      this.ui.toast(`${t.fromName} הזמין אותך לקבוצה — פתח את חלון הקבוצה`, "good"), this.pendingPartyInvite = t.partyId, this.ui.openPanel("party"), setTimeout(() => this.renderInvitePrompt(t), 0);
    }), e.on("friendRequest", t => this.ui.toast(`${t.fromName} שלח בקשת חברות`, "good")), e.on("duelRequest", t => {
      this.pendingDuel = t.fromId, this.ui.toast(`${t.fromName} מזמין אותך לדו-קרב — לחץ על כפתור הפעולה לקבל`, "good"), setTimeout(() => {
        this.pendingDuel === t.fromId && (this.pendingDuel = null);
      }, 12e3);
    }), e.on("base", t => {
      this.ui.base = t, t.fiber && (audio.sfx("loot"), this.ui.toast(`🌿 +${t.fiber} סיבים מהגינה`, "good"));
      for (let n of t.collected || []) audio.sfx("loot"), this.ui.toast(`הושלם: ${loc(ITEMS[n.id])} ×${n.n}`, "good");
      t.starUp && (audio.sfx("evolve"), this.ui.celebrate("★".repeat(t.starUp.star), "evolve"), this.ui.toast(`${loc(SPECIES[t.starUp.species])} הגיע ל-${t.starUp.star} כוכבים!`, "good")), t.built && (audio.sfx("quest"), this.ui.toast(`נבנה — רמה ${t.built.level}`, "good")), t.craft && audio.sfx("ui"), this.ui.openPanelId === "base" && this.ui.renderPanel("base");
    }), e.on("card", t => {
      this.ui.card = t, this.ui.openPanelId === "card" && this.ui.renderPanel("card");
    }), e.on("dex", t => {
      this.ui.dex = t, this.ui.openPanelId === "dex" && this.ui.renderPanel("dex");
    }), e.on("healed", () => {
      audio.sfx("heal"), this.ui.toast("הצוות שלך הבריא במלואו", "good");
    }), e.on("building", t => {
      if (!t) {
        this.leaveInterior();
        return;
      }
      let n = {
        id: t.id,
        kind: t.kind,
        name: t.name,
        he: t.he,
        door: t.door
      };
      this.world.enterInterior(n) && (audio.sfx("ui"), this.ui.toast(`${t.he || t.name}`, "good"));
    }), e.on("dialogue", t => {
      let q = t.errand && QUESTS[t.errand.id];
      audio.sfx("ui"), this.ui.showDialogue({
        name: t.he || t.name,
        lines: t.lines.map(n => n.he || n.en),
        onDone: () => {
          t.questsDone?.length && (audio.sfx("quest"), this.ui.celebrate("משימה הושלמה", "quest"), this.ui.toast("משימה הושלמה — אספו את הפרס בחלון המשימות", "good"));
          q && t.errand.mode !== "active" && this.ui.errandCard(q, t.errand.mode, t.he || t.name);
        }
      });
    }), e.on("questDone", t => {
      audio.sfx("quest"), vibrate([18, 40, 26]);
      let n = QUESTS[t?.id];
      this.ui.celebrate(n ? loc(n) : "משימה הושלמה", "quest"), this.ui.toast("משימה הושלמה — אספו את הפרס בחלון המשימות", "good"), this.ui.openPanelId === "quests" && this.ui.renderPanel("quests");
    }), e.on("questClaimed", t => {
      audio.sfx("quest"), vibrate([20, 50, 30]);
      let c = t.creature;
      this.ui.celebrate(c ? `${loc(SPECIES[c.species])} הצטרף אליך!` : "פרס נאסף", "quest"), this.ui.toastHtml(this.ui.rewardText(t.reward)), c && this.wantFaces(this.profile?.team);
    }), e.on("questAccepted", t => {
      let q = QUESTS[t?.questId];
      q && this.ui.toast(`משימה חדשה: ${loc(q)}`, "good");
    }), e.on("error", t => {
      this.engagePending = 0, this.ui.toast(Oc(t.code), "bad");
    }), e.on("roomError", t => console.warn("[net] room error", t?.code, t?.message)), e.on("goto", async t => {
      if (!this.transitioning) {
        this.transitioning = !0, this.engagePending = 0, this.ambush = t.kind === "battle" && t.ambush ? { wildId: t.wildId } : null;
        try {
          t.kind === "world" ? await this.enterWorld(t.zone, t.fromZone) : await this.enterRoom(t.roomId, t.kind);
        } finally {
          this.transitioning = !1;
        }
      }
    }), e.on("battleInit", t => {
      this.battle.youId = t.you, this.battle.inventory = t.inventory || {}, this.battle.team = t.team || [], this.battle.trainerId = t.trainer || null, this.battle.weather = t.weather || null, this.battle.mySide = this.battle.combatants.find(s => s.id === t.you)?.side || "a", t.profile && (this.profile = t.profile, this.ui.setProfile(t.profile), this.ui.battleTeam = t.profile.team || [], this.battleView.setTrainer(t.profile.appearance, t.trainer), this.wantFaces(t.profile.team));
      let n = SPECIES[this.battle.combatants.find(s => s.side !== "a")?.species]?.types?.[0];
      let zd = ZONES[this.zone?.id] || {};
      this.battleView.setTheme(n || this.zoneElement(), !1, {
        stage: zd.urban || t.mode === "pvp" || t.duel ? "stadium" : "clearing",
        palette: this.world.palette,
        element: zd.element || "verdant",
        zone: zd.id
      });
    }), e.on("dungeonInit", t => {
      this.battle.youId = t.you, this.battle.inventory = t.inventory || {}, this.dungeon = t.dungeon, t.profile && (this.profile = t.profile, this.ui.setProfile(t.profile), this.ui.battleTeam = t.profile.team || [], this.battleView.setTrainer(t.profile.appearance, t.trainer)), this.battleView.setTheme(t.dungeon.element, !0), this.ui.battleBanner(`${loc(t.dungeon)} — קומה 1`, 1800);
    }), e.on("battleStart", () => {
      // "A wild Pebblin appeared!" says what this fight is; "the battle
      // begins" said nothing the screen did not.
      let me = this.battle?.combatants?.find(c => c.id === this.battle.youId),
        foe = this.battle?.combatants?.find(c => me && c.side !== me.side && c.kind !== "trainer"),
        sp = foe && SPECIES[foe.species];
      let wild = sp && foe.kind !== "boss" && !this.battle.combatants.some(c => c.side === foe.side && c.kind === "trainer");
      // It came for you: say so, rather than as if you had walked up to it.
      this.ui.battleBanner(wild && this.ambush ? `❗ ${loc(sp)} תקף אותך!` : wild ? `${loc(sp)} פראי הופיע!` : "הקרב מתחיל!", 1400), this.ambush && vibrate([40, 30, 40]), this.ambush = null;
      // The sky is doing something to the numbers, so say so once. Without this
      // the only way to find out rain helps a water move is to notice it.
      let w = this.battle.weather;
      if (w?.boost && ELEMENTS[w.boost]) {
        let el = ELEMENTS[w.boost];
        setTimeout(() => this.ui.battleBanner(`${el.icon} ${w.he} · מהלכי ${el.he} מתחזקים`, 1600), 1100);
      }
    }), e.on("floor", t => this.ui.battleBanner(t.boss ? "⚔ בוס המבוך!" : `קומה ${t.floor}/${t.of}`, 1400)), e.on("floorCleared", () => this.ui.battleBanner("הקומה נוקתה!", 1100)), e.on("inventory", t => {
      this.battle.inventory = t;
    }), e.on("battleEvent", t => {
      // Say it when one of yours goes down. It gets benched in the same beat,
      // and the bench is behind you — out of a portrait frame — so without a
      // word the only sign was a creature quietly walking off screen.
      this.battleView.onFaint || (this.battleView.onFaint = a => {
        a.side === this.battle.mySide && a.kind === "creature" && SPECIES[a.species] && this.ui.battleBanner(`${loc(SPECIES[a.species])} התעלף! 💫`, 1500);
      });
      this.battleView.playEvent(t);
      let n = t.actor && t.actor === this.battle.youId;
      if (t.kind === "hit") {
        let s = this.battleView.actorScreenPos(t.target);
        this.ui.floatDamage(s, String(t.dmg), t.crit ? "crit" : "");
        let r = this.battleView.combatantOf?.(t.target),
          a = Math.min(1, (t.dmg || 0) / Math.max(20, r?.maxHp || 60)) * (t.crit ? 1.8 : 1) * (t.eff > 1 ? 1.25 : 1),
          l = MOVES[t.skill];
        l && audio.sfx("attack", {
          element: l.type
        });
        let c = l?.kind === "special" ? 280 : 120;
        setTimeout(() => {
          audio.sfx(t.crit ? "crit" : "hit", {
            power: a
          }), t.eff > 1 ? audio.sfx("superEffective") : t.eff < 1 && audio.sfx("resisted"), this.punch(0.35 + a * 1.1, t.crit ? 90 : 0), n ? vibrate(t.crit ? [18, 30, 18] : 10) : (audio.sfx("hurt"), vibrate(t.crit ? [30, 40, 30] : 18));
        }, c), t.eff > 1 ? this.ui.battleBanner("פגיעה יעילה במיוחד!", 800) : t.eff < 1 && this.ui.battleBanner("לא יעיל במיוחד…", 700);
      } else t.kind === "heal" ? (audio.sfx("heal"), this.ui.floatDamage(this.battleView.actorScreenPos(t.target), `+${t.amount}`, "heal")) : t.kind === "miss" ? (audio.sfx("miss"), this.ui.floatDamage(this.battleView.actorScreenPos(t.target), "החטאה", "")) : t.kind === "capture" && this.ui.battleBanner(t.success ? "✨ נלכד!" : `הכדור נפתח… (${t.chance}%)`, 1400);
      t.actor && this.battle.youId === t.actor && t.skill && MOVES[t.skill] && (this.cooldowns[t.skill] = Date.now() + MOVES[t.skill].cd);
    }), e.on("actionRejected", t => {
      let n = {
        cooldown: "עוד לא מוכן",
        stamina: "אין מספיק מרץ",
        stunned: "הדמות מסוחררת",
        no_sphere: "אין כדורי לכידה",
        no_item: "אין שיקויים",
        cannot_flee: "אי אפשר לברוח",
        no_capture_in_dungeon: "אי אפשר ללכוד במבוך",
        no_capture_here: "אי אפשר ללכוד באזור הזה — צא מהנמל"
      }[t.reason] || t.reason;
      audio.sfx("deny"), this.ui.toast(n, "bad");
    }), e.on("battleEnd", async t => {
      t.profile && (this.profile = t.profile, this.ui.setProfile(t.profile));
      let n = [];
      t.captured && n.push(`נלכד ${loc(SPECIES[t.captured.species])}!`), t.xp && n.push(`+${t.xp} XP`), t.gold && (n.push(`${t.gold > 0 ? "+" : ""}${t.gold}⛁`), t.gold > 0 && setTimeout(() => audio.sfx("coin"), 620)), t.items?.length && setTimeout(() => audio.sfx("loot"), 820);
      for (let r of t.events || []) r.kind === "level" && n.push(`עלייה לרמה ${r.level}!`), r.kind === "evolve" && n.push(`${loc(SPECIES[r.from])} התפתח ל${loc(SPECIES[r.into])}!`), r.kind === "skill" && n.push(`למד ${loc(MOVES[r.skill])}`);
      audio.sfx(t.outcome === "captured" ? "caught" : t.won ? "victory" : t.outcome === "fled" ? "uiBack" : "defeat"), vibrate(t.won || t.outcome === "captured" ? [20, 50, 20, 50, 60] : [140]);
      for (let r of t.events || []) r.kind === "level" && (audio.sfx("levelUp"), this.ui.celebrate(`רמה ${r.level}!`, "level")), r.kind === "evolve" && (audio.sfx("evolve"), this.ui.celebrate(`${loc(SPECIES[r.into])}!`, "evolve"));
      this.ui.battleBanner(t.won ? "ניצחון!" : t.outcome === "captured" ? "נלכד!" : t.outcome === "fled" ? "ברחת" : "הובסת", 1600), t.blackout && n.push("התעוררת במחנה, הצוות הבריא");
      // A first catch of a species opens its card; a duplicate says what it
      // refined into. Catching the same thing twice should not feel identical.
      if (t.captured && t.duplicate && Object.keys(t.duplicate).length) {
        let parts = Object.entries(t.duplicate).map(([id, count]) => `${ITEMS[id]?.icon || ""} ${loc(ITEMS[id]) || id} ×${count}`);
        n.push(`כפול — ${parts.join(" · ")}`);
      }
      let s = t.outcome === "captured" ? 4200 : 2e3;
      n.length && setTimeout(() => this.ui.toast(n.join(" · "), t.won ? "good" : ""), s - 1400), setTimeout(() => this.enterWorld(this.zone?.id || HOME_ZONE), s);
      if (t.captured && t.newSpecies && t.card) setTimeout(() => {
        audio.sfx("quest"), this.ui.celebrate(`${loc(SPECIES[t.captured.species])} — קלף חדש!`, "quest");
        this.ui.card = t.card;
        this.ui.openPanel("card");
      }, s + 700);
    }), e.on("dungeonEnd", t => {
      t.profile && (this.profile = t.profile, this.ui.setProfile(t.profile)), this.ui.battleBanner(t.success ? "המבוך נוקה!" : "הקבוצה הובסה", 1800);
      let n = [`+${t.xp} XP`, `+${t.gold}⛁`];
      for (let s of t.items || []) n.push(loc(ITEMS[s]));
      setTimeout(() => this.ui.toast(n.join(" · "), t.success ? "good" : ""), 400), setTimeout(() => this.enterWorld(this.zone?.id || HOME_ZONE), 2200);
    }), e.on("gm", t => this.onGm(t)), e.on("gmGift", t => {
      // Someone with the keys sent you something (or you sent it to yourself).
      audio.sfx(t.what === "creature" ? "quest" : "loot"), vibrate([20, 40, 20]);
      let what = t.what === "creature" ? `${loc(SPECIES[t.species])} ${t.shiny ? "✨ " : ""}(Lv ${t.level})` : t.what === "gold" ? `${Number(t.amount || 0).toLocaleString("en-US")}⛁` : t.what === "item" ? `${ITEMS[t.item]?.icon || ""} ${loc(ITEMS[t.item])} ×${t.qty}` : t.what === "level" ? `רמת מאמן ${t.level}` : "משאבים בלי סוף";
      this.ui.celebrate(t.from ? "🎁 מתנה!" : "🎁 נוסף!", "quest"), this.ui.toast(t.from ? `${t.from} (GM) שלח לך: ${what}` : `נוסף לך: ${what}`, "good"), t.what === "creature" && this.wantFaces(this.profile?.team);
    }), e.on("gmAnnounce", t => {
      audio.sfx("quest"), vibrate([30, 50, 30]), this.ui.gmBanner(t.from, t.text);
    }), e.on("bossSpawn", t => {
      audio.sfx("bossRoar"), audio.playMusic("boss"), vibrate([60, 60, 120]), this.ui.toast(`⚠ ${t.he || t.name} הופיע באזור!`, "bad");
    }), e.on("bossHit", () => {}), e.on("bossCounter", t => {
      audio.sfx("hurt"), this.punch(0.7), vibrate(30), this.ui.toast(`הבוס פגע בך (-${t.dmg})`, "bad");
    }), e.on("bossEnd", t => {
      audio.sfx(t.defeated ? "victory" : "uiBack"), audio.playMusic(this.zone?.id || "verdant_meadow"), this.ui.toast(t.defeated ? "הבוס הובס!" : "הבוס נסוג", t.defeated ? "good" : "");
    }), e.on("bossReward", t => {
      audio.sfx("coin"), this.ui.toast(`דירוג ${t.rank} · +${t.gold}⛁ · +${t.xp} XP`, "good");
    }), e.on("left", ({
      code: t,
      unexpected: n
    }) => {
      if (!n || this.transitioning) return;
      // 4000 is the server saying there is no character on this account.
      if (t === 4e3) return this.ui.toast("נותקת מהעולם", "bad"), this.showLogin();
      this.mode !== "boot" && this.reconnect();
    });
  }
  /** Replies to the GM panel. Only a GM's session is ever sent these. */
  onGm(t) {
    if (!t) return;
    if (t.kind === "hello") {
      this.ui.gm = { on: !0, limits: t.limits || {} };
      this.ui.openPanelId === "menu" && this.ui.renderPanel("menu");
      return;
    }
    if (t.kind === "players") return this.ui.gmPlayers = t.players || [], this.ui.gmRefresh("players");
    if (t.kind === "log") return this.ui.gmLog = t.rows || [], this.ui.gmRefresh("log");
    if (t.kind === "done") {
      audio.sfx("ui"), this.ui.toast(`✔ ${this.ui.gmSummary(t.op, t.detail, t.to)}`, "good");
      t.op !== "teleport" && this.net.send("gm", { op: "log" });
      return;
    }
    t.kind === "error" && (audio.sfx("deny"), this.ui.toast({
      forbidden: "אין לך הרשאת GM",
      player_offline: "השחקן כבר לא מחובר",
      bad_species: "יצור לא מוכר",
      bad_item: "חפץ לא מוכר",
      bad_amount: "סכום לא תקין",
      bad_zone: "אזור לא מוכר",
      too_many_summons: "יש כבר יותר מדי יצורים מזומנים באזור",
      empty: "ההודעה ריקה",
      log_unavailable: "היומן לא זמין כרגע"
    }[t.code] || t.code, "bad"));
  }
  /** A wild coming for me: say it once when it starts, and once if I got
   *  away. The "!" over its head is drawn with the nameplates. */
  watchField(s) {
    let me = this.profile?.id;
    if (!me || !s?.wilds) return;
    let chasers = this._chasers ||= new Map();
    s.wilds.forEach((w, id) => {
      let mine = w.alert === "!" && w.target === me;
      if (mine && !chasers.has(id)) {
        chasers.set(id, w.species), audio.sfx("alert"), vibrate([30, 40, 30]);
        this.ui.toast(`❗ ${loc(SPECIES[w.species])} הבחין בך — ברח או הילחם!`, "bad");
      } else if (!mine && chasers.has(id)) {
        w.alert === "?" && this.ui.toast(`💨 ברחת מ${loc(SPECIES[chasers.get(id)])}`, "good"), chasers.delete(id);
      }
    });
    for (let id of [...chasers.keys()]) s.wilds.has(id) || chasers.delete(id);
  }
  renderInvitePrompt(e) {
    let t = document.querySelector("#panel .body");
    if (!t) return;
    let n = document.createElement("div");
    n.className = "list-item", n.innerHTML = `<div class="grow"><b>הזמנה מ${e.fromName}</b><span>הצטרפות לקבוצה</span></div>`;
    let s = document.createElement("button");
    s.className = "btn small primary", s.textContent = "הצטרף", s.onclick = () => {
      this.net.send("partyAccept", {
        partyId: e.partyId
      }), this.ui.closePanel();
    }, n.appendChild(s), t.prepend(n);
  }
  zoneElement() {
    let e = this.zone?.id;
    return {
      emberfall_canyon: "ember",
      tidal_hollow: "aqua",
      frostpeak_ridge: "frost",
      umbral_grove: "umbra"
    }[e] || "verdant";
  }
  bindButtons() {
    $("#btn-action").onclick = () => this.doAction();
    for (let e of document.querySelectorAll(".skill-btn")) e.onclick = () => {
      let t = e.dataset.skill;
      t && (this.worldState()?.boss?.active ? this.attackBoss(t) : this.doAction(t));
    };
  }
  setView(e) {
    let t = this.world.setViewMode(e);
    try {
      globalThis.localStorage?.setItem("hobile.view", t);
    } catch {}
    return audio.sfx("ui"), this.ui.toast(t === "first" ? "מבט גוף ראשון" : "מבט גוף שלישי"), t;
  }
  leaveInterior() {
    this.world.interior && (this.world.exitInterior(), this.net.send("exitBuilding"), audio.sfx("ui"));
  }
  interiorPrompt() {
    let e = this.world.interior;
    if (!e) return !1;
    let t = $("#btn-action");
    if (this.world.atInteriorExit()) return this.ui.setPrompt("🚪 חזרה לרחוב"), t.textContent = "צא", t.onclick = () => this.leaveInterior(), !0;
    let n = this.world.interiorNpcScreenPos(),
      s = {
        clinic: ["🩺 טיפול, שיקויים והחייאה", "מרפאה"],
        shop: ["🛒 כדורים, חומרים וציוד", "חנות"],
        archive: ["📜 יומן המסע ומידע על האזורים", "קרא"],
        workshop: ["🛠 מתכונים — שדרוגים נעשים בחצר", "מתכונים"]
      },
      [r, o] = s[e.kind] || ["—", "פעולה"];
    return n.visible && n.dist < 5.5 ? (this.ui.setPrompt(r), t.textContent = o, t.onclick = () => this.openCounter(e.kind), !0) : (this.ui.setPrompt(e.he || e.name || null), t.textContent = "פעולה", t.onclick = () => this.doAction(), !0);
  }
  openCounter(e) {
    if (audio.sfx("ui"), e === "clinic") {
      this.ui.openPanel("clinic");
      return;
    }
    if (e === "shop") {
      this.ui.openPanel("shop");
      return;
    }
    if (e === "workshop") {
      this.openBase();
      return;
    }
    if (e === "archive") {
      this.ui.openPanel("quests");
      return;
    }
  }
  openBase(e) {
    this.net.send("baseOpen"), this.ui.openPanel("base", e), audio.sfx("ui");
  }
  hooks() {
    let e = (t, n) => this.net.send(t, n);
    return {
      openBase: () => this.openBase(),
      dexOpen: () => e("dex"),
      fullscreen: async () => {
        if (device.canFullscreen) { await toggleFullscreen(); this._paintFullscreen?.(); this.ui.closePanel(); return; }
        this.ui.toast(device.framed
          ? "כדי לשחק בלי הדפדפן צריך לפתוח את המשחק בכתובת שלו, לא בתוך הצ׳אט"
          : "שתף ← הוסף למסך הבית, ואז המשחק ייפתח בלי הדפדפן", "good");
      },
      openSpecies: t => e("card", { species: t }),
      gm: (op, data = {}) => e("gm", { ...data, op }),
      gmOpen: () => (e("gm", { op: "players" }), e("gm", { op: "log" })),
      clinicHeal: () => e("clinicHeal"),
      // NB: swapCreature is defined once, further down in this same object.
      // It used to be declared here too, sending an unhandled "switchCreature"
      // message; the later key silently won, so this one never ran.
      openCard: t => {
        e("card", {
          uid: t
        }), this.ui.openPanel("card");
      },
      baseOpen: () => e("baseOpen"),
      baseBuild: t => e("baseBuild", {
        id: t
      }),
      baseTrain: t => e("baseTrain", {
        uid: t
      }),
      baseCollect: t => e("baseCollect", {
        slotId: t
      }),
      baseCancel: t => e("baseCancel", {
        slotId: t
      }),
      baseCraft: t => e("baseCraft", {
        recipe: t
      }),
      viewMode: () => this.world.viewMode,
      toggleView: () => this.setView(this.world.viewMode === "first" ? "third" : "first"),
      chat: t => e("chat", t),
      travel: t => e("travel", {
        zone: t,
        token: this.net.token
      }),
      dungeon: t => e("dungeonEnter", {
        dungeonId: t
      }),
      useItem: t => e("useItem", {
        itemId: t
      }),
      buy: (t, n) => e("shopBuy", {
        itemId: t,
        qty: n
      }),
      acceptQuest: t => (audio.sfx("quest"), e("questAccept", {
        questId: t
      })),
      claimQuest: t => e("questClaim", {
        questId: t
      }),
      addFriend: t => e("friendAdd", {
        name: t
      }),
      respondFriend: (t, n) => e("friendRespond", {
        fromId: t,
        accept: n
      }),
      partyInvite: t => e("partyInvite", {
        name: t
      }),
      partyLeave: () => e("partyLeave"),
      guildCreate: (t, n) => e("guildCreate", {
        name: t,
        tag: n
      }),
      guildJoin: t => e("guildJoin", {
        guildId: t
      }),
      guildLeave: () => e("guildLeave"),
      guildContribute: t => e("guildContribute", {
        gold: t
      }),
      guildUpgrade: t => e("guildUpgrade", {
        upgradeId: t
      }),
      guildList: () => new Promise(t => {
        this._guildListResolve = t, e("guildList"), setTimeout(() => t([]), 2500);
      }),
      setLead: t => {
        let n = this.profile;
        if (!n) return;
        let s = [...n.team, ...n.box];
        e("setTeam", {
          team: [t, ...s.filter(r => r !== t)].slice(0, 6)
        });
      },
      leaderboard: () => this.net.leaderboard("level").catch(() => []),
      logout: () => {
        this.net.logout(), location.reload();
      },
      claim: async (t, n) => {
        try {
          let s = await this.net.claim(t, n);
          return this.setAccount({
            guest: !1,
            username: s.username
          }), this.ui.closePanel(), this.ui.toast("ההתקדמות שלך שמורה. אפשר להתחבר עם השם הזה מכל מכשיר.", "good"), {
            ok: !0
          };
        } catch (s) {
          return {
            ok: !1,
            message: Oc(s.code)
          };
        }
      },
      switchAccount: () => {
        // Reload rather than swap in place: half the client is bound to the
        // room it joined, and logging into a second account over a live one is
        // the kind of state nobody tests.
        try {
          sessionStorage.setItem(WANT_LOGIN, "1");
        } catch {}
        this.net.logout(), location.reload();
      },
      useSkill: t => {
        this.net.send("skill", {
          skill: t
        }), MOVES[t] && (this.cooldowns[t] = Date.now() + MOVES[t].cd);
      },
      swapCreature: t => {
        this.net.send("swap", {
          uid: t
        }), this.cooldowns = {};
      },
      trainerAction: t => {
        let n = {
          action: t
        };
        t === "sphere" && (n.sphere = this.bestSphere()), t === "potion" && (n.item = this.bestPotion()), this.net.send("trainer", n), this.cooldowns[`trainer:${t}`] = Date.now() + (ACTIONS[t]?.cd || 2e3);
      }
    };
  }
  // bestSphere lives further down: the copy that used to be here tested `e[t] > 0`
  // on a possibly-undefined count and was overridden by the guarded one anyway.
  bestPotion() {
    let e = this.battle.inventory || {};
    for (let t of ["potion_s", "potion_m", "potion_l"]) if (e[t] > 0) return t;
    return "potion_s";
  }
  worldState() {
    return this.mode === "world" ? this.net.room?.state : null;
  }
  attackBoss(e) {
    let t = Date.now();
    this.cooldowns.__boss > t || (this.cooldowns.__boss = t + 900, e && MOVES[e] && (this.cooldowns[e] = t + Math.max(900, MOVES[e].cd * 0.5)), this.net.send("bossAttack", {
      skill: e
    }));
  }
  doAction(e) {
    let t = this.worldState();
    if (!t) return;
    if (this.pendingDuel) {
      this.net.send("duelAccept", {
        fromId: this.pendingDuel
      }), this.pendingDuel = null;
      return;
    }
    let n = this.world.selfPosition();
    if (t.boss?.active && dist2d(t.boss, n) < 15) {
      this.attackBoss(e);
      return;
    }
    let s = this.nearestNpc(n);
    if (s && s.d < 4.2) {
      this.net.send("talk", {
        npcId: s.id
      });
      return;
    }
    // Nearest wins. A fixed priority meant a gate anywhere inside nine metres
    // beat a creature standing on top of you — and if the gate was above your
    // level the button did nothing at all but say so, in a wide ring around
    // every portal on the dock. Whichever is closest is what the player is
    // pointing at.
    let r = this.nearestLandmark(n),
      o = this.nearestWild(n),
      a = this.nearestPlayer(n),
      l = [];
    r && r.d < (r.r ? r.r + 1 : 9) && l.push({
      d: r.d,
      go: () => {
        if (r.interior) {
          this.net.send("enterBuilding", {
            id: r.interior
          });
          return;
        }
        r.kind === "portal" ? this.net.send("travel", {
          zone: r.to,
          token: this.net.token
        }) : r.kind === "dungeon" ? this.net.send("dungeonEnter", {
          dungeonId: r.to
        }) : r.kind === "base" || r.kind === "workshop" ? this.openBase() : this.net.send("interact", {
          target: r.id || r.kind
        });
      }
    }), o && o.d < 7.5 && l.push({
      d: o.d,
      go: () => {
        this.transitioning || Date.now() < this.engagePending || (this.engagePending = Date.now() + 5e3, this.net.send("engage", {
          wildId: o.id
        }));
      }
    }), a && a.d < 6 && l.push({
      d: a.d,
      go: () => {
        this.net.send("duel", {
          targetId: a.id
        }), this.ui.toast("נשלחה הזמנה לדו-קרב");
      }
    });
    if (l.length) {
      l.sort((c, h) => c.d - h.d)[0].go();
      return;
    }
    this.ui.toast("אין מה לעשות כאן — התקרב ליצור, לשער או ל-NPC");
  }
  nearestWild(e) {
    let t = this.worldState(),
      n = null;
    return t?.wilds?.forEach((s, r) => {
      if (s.engagedBy) return;
      let o = dist2d(s, e);
      (!n || o < n.d) && (n = {
        id: r,
        d: o,
        w: s
      });
    }), n;
  }
  nearestPlayer(e) {
    let t = this.worldState(),
      n = null;
    return t?.players?.forEach((s, r) => {
      if (r === this.net.room?.sessionId) return;
      let o = dist2d(s, e);
      (!n || o < n.d) && (n = {
        id: s.id,
        key: r,
        d: o,
        p: s
      });
    }), n;
  }
  nearestLandmark(e) {
    let t = null;
    for (let n of this.zone?.landmarks || []) {
      let s = Math.hypot(n.x - e.x, n.z - e.z);
      (!t || s < t.d) && (t = {
        ...n,
        d: s
      });
    }
    return t;
  }
  nearestNpc(e) {
    let t = null;
    for (let n of Object.keys(NPCS)) {
      let s = this.world.npcPosition?.(n);
      if (!s) continue;
      let r = Math.hypot(s.x - e.x, s.z - e.z);
      (!t || r < t.d) && (t = {
        id: n,
        npc: NPCS[n],
        x: s.x,
        z: s.z,
        d: r
      });
    }
    return t;
  }
  punch(e, t = 0) {
    this.shake = Math.min(1.4, this.shake + e), t && (this.freezeUntil = performance.now() + t);
  }
  loop(e) {
    requestAnimationFrame(this.loop);
    let t = performance.now(),
      n = Math.min(0.05, (t - (this._last || t)) / 1e3);
    if (this._last = t, t < this.freezeUntil) {
      this.applyShake(0);
      return;
    }
    this.mode === "world" ? this.tickWorld(n, e) : this.mode === "title" ? this.world.update(n, e) : (this.mode === "battle" || this.mode === "dungeon") && this.tickBattle(n, e), this.shake = Math.max(0, this.shake - n * 3.4), this.applyShake(n);
    let s = this.net.room?.state?.phase,
      r = (this.mode === "battle" || this.mode === "dungeon") && s !== void 0 && s !== "active";
    this.ui.tickCooldowns(this.cooldowns, Date.now(), r);
  }
  applyShake() {
    let e = this.mode === "world" ? this.world.camera : this.battleView.camera;
    if (!e || (this._shakeApplied && (e.position.sub(this._shakeApplied), this._shakeApplied = null), this.shake < 0.004)) return;
    let t = this.shake * 0.34,
      n = new Vector3((Math.random() - 0.5) * t, (Math.random() - 0.5) * t * 0.8, (Math.random() - 0.5) * t);
    e.position.add(n), this._shakeApplied = n;
  }
  tickWorld(e, t) {
    let n = this.net.room,
      s = n?.state;
    if (!s?.players) return;
    let r = new Set();
    s.players.forEach((d, u) => {
      r.add(u);
      let f = this.world.ensureActor(u, {
        kind: "player",
        signature: `p:${d.body}:${d.skin}:${d.hair}:${d.outfit}`,
        appearance: {
          body: d.body,
          skin: d.skin,
          hair: d.hair,
          outfit: d.outfit
        },
        petSpecies: d.petSpecies
      });
      u !== n.sessionId ? this.world.setActorTarget(u, d.x, d.z, d.rot, d.moving) : this.spawned ? this.world.reconcile(d.x, d.z) : (this.spawned = !0, this.world.setSelf(u), this.world.snapSelf(d.x, d.z), this.world.faceOpen(d.rot || 0)), f.pet?.species !== d.petSpecies && this.world.attachPet(f, d.petSpecies);
    }), s.wilds.forEach((d, u) => {
      r.add(u), this.world.ensureActor(u, {
        kind: "wild",
        signature: `w:${d.species}`,
        species: d.species
      }), this.world.setActorTarget(u, d.x, d.z, d.rot, d.moving !== !1);
    }), this.watchField(s), s.boss?.active && (r.add("boss"), this.world.ensureActor("boss", {
      kind: "boss",
      signature: `b:${s.boss.species}`,
      species: s.boss.species
    }), this.world.setActorTarget("boss", s.boss.x, s.boss.z, 0, !1)), this.world.pruneActors(r), this.world.setSelf(n.sessionId);
    let o = this.stick.value.magnitude > 0.05 ? this.stick.value : this.keys.value,
      a = null;
    if (o.magnitude > 0.05) {
      let d = this.world.camYaw,
        u = Math.cos(d),
        f = Math.sin(d),
        p = kb * Math.min(1, o.magnitude),
        x = (-o.x * u - o.y * f) * p,
        g = (o.x * f - o.y * u) * p;
      a = this.world.moveSelf(x, g, e), this.walkPhase += p * e, this.walkPhase > 1.55 && (this.walkPhase = 0, audio.sfx("step"));
    } else a = this.world.moveSelf(0, 0, e), this.walkPhase = 1.2;
    let l = Date.now();
    a && l - this.lastNetSend > 1e3 / zb && (this.lastNetSend = l, this.net.send("move", a));
    let l2 = s.serverTime || Date.now(),
      c = l2 % wp / wp,
      sky = weatherAt(this.world.zone, l2);
    // Weather before the clock: `setTimeOfDay` is where the sun, the cloud deck
    // and the air are set from the palette, and it reads what the weather has
    // bent them by.
    this.world.setWeather(sky), this.world.setTimeOfDay(c), this.ui.setSky(sky), this.updateObjective(s);
    let h = Number.isFinite(this.world.night) ? this.world.night : 0;
    Math.abs(h - (this._lastNight ?? -1)) > 0.08 && (this._lastNight = h, audio.setNight(h)), this.world.update(e, t), this.ui.drawMinimap(this.world, s, n.sessionId), this.ui.setBoss(s.boss), this.updateNameplates(s, n.sessionId), this.updatePrompt();
  }
  underHud(e) {
    let t = performance.now();
    (!this._hudRects || t - this._hudRectsAt > 1e3) && (this._hudRectsAt = t, this._hudRects = ["#minimap", ".vitals", ".top-right", "#tracker", "#chat-mini", "#action-cluster", "#boss-banner"].map(s => document.querySelector(s)).filter(s => s && !s.classList.contains("hidden")).map(s => s.getBoundingClientRect()));
    let n = {
      left: e.x - 62,
      right: e.x + 62,
      top: e.y - 36,
      bottom: e.y + 4
    };
    return this._hudRects.some(s => n.left < s.right && n.right > s.left && n.top < s.bottom && n.bottom > s.top);
  }
  updateObjective(e) {
    let t = $("#objective");
    if (!t) return;
    let n = this.currentObjective();
    if (globalThis.__hobileQuestNpc = n?.goal?.kind === "talk" && !n.done ? n.goal.target : null, !n) {
      t.classList.add("hidden");
      return;
    }
    let s = this.world.selfPosition(),
      r = this.objectivePoint(n, e, s);
    if (!r) {
      t.classList.add("hidden");
      return;
    }
    let o = Math.hypot(r.x - s.x, r.z - s.z);
    t.classList.remove("hidden"), t.querySelector(".what").textContent = n.label, t.querySelector(".far").textContent = `${Math.round(o)} מ׳`;
    let a = this.world.project(new Vector3(r.x, (r.y ?? 0) + 2.2, r.z)),
      l = this.world.canvas.clientWidth,
      c = this.world.canvas.clientHeight,
      h = 46,
      d = t.querySelector(".arrow");
    if (a.visible && a.x > h && a.x < l - h && a.y > h && a.y < c - h) t.style.left = `${a.x}px`, t.style.top = `${Math.max(h, a.y)}px`, d.style.transform = "rotate(180deg)", t.classList.remove("edge");else {
      let u = l / 2,
        f = c / 2,
        p = a.x - u,
        x = a.y - f;
      (a.z >= 1 || !a.visible) && (p = -p, x = -x);
      let v = Math.min((u - 86) / Math.abs(p || 0.001), (f - 58) / Math.abs(x || 0.001));
      t.style.left = `${u + p * v}px`, t.style.top = `${f + x * v}px`, d.style.transform = `rotate(${Math.atan2(x, p) * 180 / Math.PI + 90}deg)`, t.classList.add("edge");
    }
  }
  currentObjective() {
    let e = this.profile?.quests?.active || {};
    for (let t of Object.values(QUESTS)) {
      if (t.chain !== "main") continue;
      let n = e[t.id];
      if (!(!n || n.claimed)) return {
        label: loc(t),
        goal: t.goal,
        done: n.done
      };
    }
    return null;
  }
  objectivePoint(e, t, n) {
    let s = e.goal,
      r = this.zone?.landmarks || [],
      o = (l, c) => ({
        x: l,
        z: c,
        y: this.world.heightAt(l, c)
      });
    if (s.kind === "talk") {
      let l = this.world.npcPosition?.(s.target);
      if (l) return o(l.x, l.z);
      let c = r.find(h => h.npc === s.target || h.id === s.target) || r.find(h => h.kind === "npc");
      return c ? o(c.x, c.z) : null;
    }
    if (s.kind === "visit") {
      let l = r.find(c => c.kind === s.target);
      return l ? o(l.x, l.z) : null;
    }
    if (s.kind === "craft" || s.kind === "star") {
      let l = r.find(c => c.kind === "base");
      return l ? o(l.x, l.z) : null;
    }
    if (s.kind === "dungeon") {
      let l = r.find(c => c.kind === "dungeon" && (!s.target || c.to === s.target));
      return l ? {
        x: l.x,
        z: l.z,
        y: this.world.heightAt(l.x, l.z)
      } : null;
    }
    if (s.zone && s.zone !== this.zone?.id) {
      let l = r.find(c => c.kind === "portal" && c.to === s.zone);
      return l ? {
        x: l.x,
        z: l.z,
        y: this.world.heightAt(l.x, l.z)
      } : null;
    }
    if (s.kind === "boss") return t?.boss?.active ? {
      x: t.boss.x,
      z: t.boss.z
    } : null;
    let a = this.nearestWild(n);
    return a ? {
      x: a.w.x,
      z: a.w.z,
      y: this.world.heightAt(a.w.x, a.w.z)
    } : null;
  }
  updateNameplates(e, t) {
    let n = [],
      me = this.world.selfPosition(),
      lead = (this.profile?.team || []).find(c => c.hp > 0),
      night = isNight(e.serverTime || Date.now()),
      // A label is for the creature you might walk up to, not for every one on
      // the horizon: a field of them piled into one unreadable stack.
      near = r => Math.hypot(r.holder.position.x - me.x, r.holder.position.z - me.z) < (r.kind === "wild" ? 13 : 30);
    for (let [s, r] of this.world.actors) {
      if (r.kind === "wild") {
        // "!" it saw someone and is coming; "?" it lost them; 💨 it is running.
        // Seen from further than the name is, because it is a warning.
        let w = e.wilds.get(s),
          far = Math.hypot(r.holder.position.x - me.x, r.holder.position.z - me.z);
        if (w?.alert && far < 28) {
          let q = this.world.project(r.holder.position.clone().add(new Vector3(0, 2.1, 0)));
          q.visible && n.push({
            key: `alert:${s}`,
            kind: `alert ${w.alert === "!" ? w.target === this.profile?.id ? "mine" : "bang" : w.alert === "?" ? "lost" : "flee"}${near(r) ? " high" : ""}`,
            x: q.x,
            y: q.y,
            visible: !0,
            label: w.alert === "~" ? "💨" : w.alert
          });
        }
      }
      if (r.kind !== "boss" && !near(r)) continue;
      let o = r.holder.position.clone().add(new Vector3(0, r.kind === "boss" ? 4.6 : 2.1, 0)),
        a = this.world.project(o);
      if (!(!a.visible || this.underHud(a))) if (r.kind === "player") {
        let l = e.players.get(s);
        // Not over your own head: the card in the corner already says who and
        // what level you are, and the label sat on the one figure the camera
        // is built around.
        if (!l || s === t) continue;
        let c = l.guildTag ? `<span class="tag">[${l.guildTag}]</span> ` : "";
        n.push({
          key: s,
          kind: s === t ? "self" : "",
          x: a.x,
          y: a.y,
          visible: !0,
          label: `${c}${escapeHtml(l.name)} <span class="mono">${l.level}</span>`,
          hp: l.hpRatio
        });
      } else if (r.kind === "wild") {
        let l = e.wilds.get(s);
        if (!l) continue;
        // ⚔: this one would come for you — fierce, not of your companion's
        // element, not so much weaker that it would run. Town never has it.
        let hostile = !ZONES[this.zone?.id]?.urban && (this.profile?.level || 1) >= FIELD_FROM_LEVEL && temperOf(l.species, night) === "fierce" && stanceOfLead(l.species, l.level, lead) === "fight";
        n.push({
          key: s,
          kind: "wild",
          x: a.x,
          y: a.y,
          visible: !0,
          label: `${loc(SPECIES[l.species])} <span class="mono">${l.level}</span>${hostile ? ' <span class="fierce" aria-label="תוקפני">⚔</span>' : ""}`
        });
      } else r.kind === "boss" && e.boss?.active && n.push({
        key: s,
        kind: "boss",
        x: a.x,
        y: a.y,
        visible: !0,
        label: `☠ ${loc(SPECIES[e.boss.species])} <span class="mono">${e.boss.level}</span>`,
        hp: e.boss.hp / Math.max(1, e.boss.maxHp)
      });
    }
    this.ui.syncNameplates(n);
  }
  updatePrompt() {
    let e = this.worldState();
    if (!e) return;
    let t = this.world.selfPosition();
    if (e.boss?.active && dist2d(e.boss, t) < 15) {
      this.ui.setPrompt(`☠ תקוף את ${loc(SPECIES[e.boss.species])}`), $("#btn-action").textContent = "תקוף";
      return;
    }
    if (this.interiorPrompt()) return;
    let n = this.nearestNpc(t);
    if (n && n.d < 4.2) {
      this.ui.setPrompt(`${n.npc.icon} דבר עם ${n.npc.he}`), $("#btn-action").textContent = "דבר", $("#btn-action").onclick = () => this.doAction();
      return;
    }
    let s = this.nearestLandmark(t);
    if (s && s.d < (s.r ? s.r + 1 : 9)) {
      let o = {
          portal: [`מעבר ל${loc(ZONES[s.to] || {})}`, "עבור"],
          dungeon: [`כניסה ל${loc(DUNGEONS[s.to] || {
            he: "מבוך"
          })}`, "היכנס"],
          base: ["🔨 החצר שלך — בנייה, ייצור ואימון", "פתח"],
          workshop: ["🛠 המסגרייה — מתכונים ושדרוגים", "פתח"],
          shop: ["🛒 שוק הרחוב", "חנות"],
          archive: ["📜 הארכיון", "היכנס"],
          clinic: ["🩺 מרפאת הגאות — ריפוי והחייאה", "היכנס"],
          plaza: ["⛲ כיכר הרסיס — מנוחה וריפוי", "מנוחה"],
          pier: ["🌀 מזח הקרע", "התבונן"],
          gate: ["🛡 השער הצפוני", "דבר"]
        },
        [a, l] = o[s.kind] || [loc(s) || "מנוחה וריפוי", "פעולה"];
      this.ui.setPrompt(a), $("#btn-action").textContent = l, s.kind === "base" || s.kind === "workshop" ? $("#btn-action").onclick = () => this.openBase() : s.kind === "shop" ? $("#btn-action").onclick = () => this.ui.openPanel("shop") : $("#btn-action").onclick = () => this.doAction();
      return;
    }
    let r = this.nearestWild(t);
    if (r && r.d < 7.5) {
      let o = e.wilds.get(r.id);
      this.ui.setPrompt(`⚔ ${loc(SPECIES[o.species])} Lv ${o.level}`), $("#btn-action").textContent = "קרב", $("#btn-action").onclick = () => this.doAction();
      return;
    }
    this.ui.setPrompt(null), $("#btn-action").textContent = "פעולה", $("#btn-action").onclick = () => this.doAction();
  }
  bestSphere() {
    let e = this.battle.inventory || {};
    for (let t of ["sphere_ultra", "sphere_great", "sphere_basic"]) if ((e[t] || 0) > 0) return t;
    return "sphere_basic";
  }
  liveTeam(e) {
    let t = new Map((this.battle.team || []).map(n => [n.id, n]));
    return e.filter(n => n.kind === "creature" && n.side === this.battle.mySide).sort((n, s) => (n.slot ?? 0) - (s.slot ?? 0)).map(n => ({
      uid: t.get(n.id)?.uid || n.id,
      id: n.id,
      species: n.species,
      level: n.level,
      hp: n.hp,
      maxHp: n.maxHp,
      benched: n.benched
    }));
  }
  tickBattle(e, t) {
    let n = this.net.room?.state;
    if (n?.combatants) {
      let s = [];
      n.combatants.forEach(r => s.push({
        id: r.id,
        side: r.side,
        kind: r.kind,
        name: r.name,
        species: r.species,
        level: r.level,
        hp: r.hp,
        maxHp: r.maxHp,
        stamina: r.stamina,
        benched: !!r.benched,
        slot: r.slot,
        frozenUntil: r.frozenUntil,
        skills: [...r.skills],
        effects: r.effects.map(o => ({
          kind: o.kind,
          until: o.until
        }))
      })), this.battle.combatants = s, this.ui.battleTeam = this.liveTeam(s), this.ui.bestSphere = this.bestSphere(), this.ui.capture = {
        target: n.captureTarget || "",
        until: n.captureUntil || 0,
        chance: n.captureChance || 0
      }, this.battleView.sync(s, this.battle.youId), this.ui.renderBattle(s, this.battle.youId, this.battle.inventory);
    }
    this.battleView.update(e, t);
  }
};

function Sp(i, e) {
  return Promise.race([i, new Promise((t, n) => setTimeout(() => n(new Error("timeout")), e))]);
}

function dist2d(i, e) {
  return Math.hypot(i.x - e.x, i.z - e.z);
}

function escapeHtml(i) {
  return String(i ?? "").replace(/[&<>"']/g, e => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[e]);
}

function Oc(i) {
  return {
    invalid_username: "שם משתמש לא תקין — 3–16 תווים, אותיות קטנות באנגלית, ספרות וקו תחתון",
    already_claimed: "החשבון הזה כבר שמור",
    weak_password: "סיסמה קצרה מדי (לפחות 6 תווים)",
    username_taken: "שם המשתמש תפוס",
    bad_credentials: "שם משתמש או סיסמה שגויים",
    invalid_name: "שם דמות לא תקין",
    name_taken: "שם הדמות תפוס",
    not_enough_gold: "אין מספיק זהב",
    already_in_guild: "אתה כבר בגילדה",
    level_too_low: "הרמה שלך נמוכה מדי",
    too_far: "רחוק מדי",
    not_leader: "רק מנהיג הקבוצה יכול",
    no_healthy_creature: "אין לך יצור כשיר לקרב",
    wild_gone: "היצור נעלם",
    not_found: "לא נמצא",
    full: "הקבוצה מלאה",
    offline: "השחקן לא מחובר",
    no_portal: "אין שער כאן",
    solo_mode: "זה מצב אימון לשחקן יחיד — המערכות החברתיות פועלות בגרסה עם השרת",
    pvp_offline: "דו-קרב דורש שחקן אמיתי נוסף"
  }[i] || i || "שגיאה";
}

export { Game, Oc, Sp, dist2d, escapeHtml };
