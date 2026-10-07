import { audio } from './gfx/battle.js';
import { zoneMinimap } from './input.js';
import { NPCS } from '../shared/npcs.js';
import { GIVERS, giverView, heldProgress, questState } from '../shared/story.js';
import { ACTIONS, DUNGEONS, ELEMENTS, GUILD, ITEMS, MOVES, PROGRESSION, QUESTS, SPECIES, STARS, ZONES, captureChance, powerOf, typeMultiplier } from '../shared/gamedata.js';
import { HABITATS, HOURS, foundWhere, whereLine } from '../shared/habitats.js';
import { CELL, planFor } from '../shared/worldplan.js';

/**
 * Friends, parties, duels and the chat channels beyond this zone's — online,
 * through the server's social layer (server/social.js). The single-player
 * build has nobody to be friends with, so there they stay hidden: `ui.social`
 * is false and these panels do not open. Guilds are not built for real yet
 * and stay hidden everywhere.
 */
export const SOCIAL = !0;
export const GUILDS = !1;
const SOCIAL_PANELS = new Set(["friends", "party", "player", "guild"]);

var $ = i => document.querySelector(i),
  el = (i, e, t) => {
    let n = document.createElement(i);
    return e && (n.className = e), t !== void 0 && (n.innerHTML = t), n;
  },
  loc = (i, e = "he") => i?.[e] || i?.name || "",
  ltr = i => `<span dir="ltr">${i}</span>`;

var lvlLabel = i => ltr(`Lv ${i}`),
  rangeLabel = (i, e, t = "–") => ltr(`${i}${t}${e}`),
  starLabel = i => ltr(`${"★".repeat(Math.max(0, i))}${"☆".repeat(Math.max(0, 5 - i))}`);

function formatClock(i) {
  let e = Math.max(0, Math.round(i / 1e3)),
    t = s => String(s).padStart(2, "0"),
    n = s => `⁦${s}⁩`;
  return e >= 3600 ? `${n(`${Math.floor(e / 3600)}:${t(Math.floor(e % 3600 / 60))}`)} שע׳` : e >= 60 ? `${n(`${Math.floor(e / 60)}:${t(e % 60)}`)} דק׳` : `${n(e)} שנ׳`;
}

var STRINGS = {
    invalid_username: "שם משתמש לא תקין — בין 2 ל-16 תווים",
    weak_password: "הסיסמה קצרה מדי — לפחות 6 תווים",
    username_taken: "שם המשתמש כבר תפוס",
    bad_credentials: "שם משתמש או סיסמה שגויים",
    invalid_name: "שם דמות לא תקין",
    name_taken: "השם הזה כבר תפוס",
    no_character: "עדיין לא יצרת דמות",
    unauthorized: "ההתחברות פגה — היכנס מחדש",
    server_error: "תקלה בשרת — נסה שוב בעוד רגע",
    request_failed: "הבקשה נכשלה — בדוק את החיבור",
    timeout: "השרת לא הגיב בזמן — נסה שוב",
    network: "אין חיבור לשרת",
    wild_gone: "היצור כבר לא כאן",
    too_far: "רחוק מדי — התקרב",
    no_healthy_creature: "אין לך יצור כשיר לקרב — נוח במחנה כדי להבריא",
    battle_unavailable: "אי אפשר לפתוח קרב כרגע — נסה שוב",
    not_here: "השחקן כבר לא באזור",
    no_portal: "אין שער במקום הזה",
    level_too_low: "הרמה שלך נמוכה מדי לאזור הזה",
    not_leader: "רק מנהיג הקבוצה יכול לעשות את זה",
    not_enough_gold: "אין לך מספיק זהב",
    no_item: "אין לך את החפץ הזה",
    fainted: "היצור מעולף — צריך להחיות אותו קודם",
    not_fainted: "היצור בהכרה — אין צורך להחיות",
    cannot_equip: "אי אפשר לצייד את הפריט הזה",
    cannot_use: "אי אפשר להשתמש בזה כאן",
    cannot_claim: "הפרס עדיין לא מוכן לאיסוף",
    cannot_accept: "המשימה הזאת עוד לא זמינה",
    not_found: "לא נמצא",
    max_level: "המבנה כבר ברמה המרבית",
    cannot_afford: "חסרים חומרים או זהב",
    no_creature: "היצור לא נמצא",
    already_training: "היצור כבר נמצא באימון",
    last_fighter: "זה היצור היחיד שלך שיכול להילחם — תפוס עוד אחד לפני שאתה שולח אותו לאימון בחווה",
    no_free_pod: "אין תא אימון פנוי — שדרג את תא האימון",
    max_star: "היצור כבר בדרגת הכוכבים הגבוהה ביותר",
    no_slot: "התא הזה כבר ריק",
    not_ready: "האימון עדיין לא הסתיים",
    no_recipe: "המתכון הזה לא קיים",
    not_built: "המבנה עדיין לא נבנה",
    building_too_low: "רמת המבנה נמוכה מדי למתכון הזה",
    queue_full: "תור הייצור מלא — חכה שיתפנה או שדרג את המבנה",
    finished: "הקרב כבר הסתיים",
    dead: "היצור שלך מעולף",
    unknown_skill: "כישור לא מוכר",
    not_learned: "היצור לא למד את הכישור הזה",
    stunned: "היצור מסוחרר ולא יכול לפעול",
    cooldown: "עוד לא מוכן",
    stamina: "אין מספיק מרץ",
    no_target: "אין מטרה",
    cannot_flee: "אי אפשר לברוח מהקרב הזה",
    cannot_capture_players: "אי אפשר ללכוד שחקנים",
    cannot_capture_boss: "אי אפשר ללכוד בוס",
    unknown_action: "פעולה לא מוכרת",
    no_sphere: "נגמרו כדורי הלכידה",
    invalid_swap: "אי אפשר להחליף ליצור הזה",
    no_capture_in_dungeon: "אי אפשר ללכוד יצורים בתוך מבוך",
    self: "אי אפשר להוסיף את עצמך",
    already_friends: "אתם כבר חברים",
    pending: "כבר נשלחה בקשה — ממתין לתשובה",
    no_player: "השחקן לא נמצא",
    full: "מלא — אין מקום פנוי",
    offline: "השחקן לא מחובר כרגע",
    gone: "הקבוצה כבר לא קיימת",
    not_invited: "לא הוזמנת לקבוצה הזו",
    already_in_guild: "אתה כבר חבר בגילדה",
    bad_name: "שם לא תקין — לפחות 3 תווים",
    not_in_guild: "אינך חבר בגילדה",
    invalid: "הערך שהוזן לא תקין",
    not_master: "רק ראש הגילדה יכול לעשות את זה",
    owned: "השדרוג הזה כבר נרכש",
    not_enough_contribution: "אין מספיק נקודות תרומה בגילדה",
    solo_mode: "זהו מצב אימון לשחקן יחיד — המערכות החברתיות פועלות בגרסה עם השרת",
    pvp_offline: "דו-קרב דורש שחקן אמיתי נוסף"
  },
  GENERIC_ERROR = "משהו השתבש — נסה שוב",
  USERNAME_RE = /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/;

function usernameError(i) {
  if (i == null) return GENERIC_ERROR;
  let e = String(i).trim();
  return e ? STRINGS[e] ? STRINGS[e] : USERNAME_RE.test(e) ? GENERIC_ERROR : e : GENERIC_ERROR;
}

var UI = class {
  constructor(e = {}) {
    this.social = !1, this.hooks = e, this.profile = null, this.party = null, this.guild = null, this.friends = {
      friends: [],
      pending: []
    }, this.chatLog = [], this.chatChannel = "zone", this.chatDraft = "", this.zone = null, this.openPanelId = null, document.addEventListener("pointerdown", n => {
      let s = n.target.closest?.("button, .chip, .swatch, .starter, .list-item[data-act]");
      s && !s.disabled && audio.sfx((s.classList.contains("sk") || s.classList.contains("tb"), "ui"));
    }, {
      passive: !0
    }), this.panelHost = $("#panel-host"), this.panel = $("#panel"), this.panelHost.addEventListener("click", n => {
      n.target === this.panelHost && this.closePanel();
    }), document.addEventListener("keydown", n => {
      n.key === "Escape" && (this._dialogue ? this.closeDialogue() : this.openPanelId && this.closePanel());
    });
    for (let n of document.querySelectorAll("[data-panel]")) n.addEventListener("click", () => this.togglePanel(n.dataset.panel));
    // Screen density. Both choices persist: a player who cleared the screen
    // once does not want it back on every load.
    let lean = (() => { try { return localStorage.getItem("hobile.hud") === "lean"; } catch { return !1; } })();
    document.body.classList.toggle("hud-lean", lean);
    $("#btn-hud")?.addEventListener("click", () => {
      lean = !lean;
      document.body.classList.toggle("hud-lean", lean);
      try { localStorage.setItem("hobile.hud", lean ? "lean" : "full"); } catch {}
    });
    let tracker = $("#tracker");
    // Collapsed unless the player opened it. Open, the tracker is 9% of a phone
    // screen and three of its four rows are dailies; collapsed it still shows
    // the quest you are actually on. Opt-out, not opt-in.
    let collapsed = (() => { try { return localStorage.getItem("hobile.tracker") !== "open"; } catch { return !0; } })();
    tracker?.classList.toggle("collapsed", collapsed);
    $("#tracker-head")?.addEventListener("click", () => {
      collapsed = !collapsed;
      tracker.classList.toggle("collapsed", collapsed);
      try { localStorage.setItem("hobile.tracker", collapsed ? "collapsed" : "open"); } catch {}
    });
    let t = $("#chat-mini");
    t.addEventListener("click", () => this.togglePanel("chat")), t.addEventListener("keydown", n => {
      (n.key === "Enter" || n.key === " ") && (n.preventDefault(), this.togglePanel("chat"));
    }), this.minimapCtx = $("#minimap").getContext("2d");
    // The minimap is a 70-metre radar. Tapping it opens the zone.
    let mini = $("#minimap");
    mini && (mini.setAttribute("role", "button"), mini.setAttribute("tabindex", "0"),
      mini.setAttribute("aria-label", "מפת האזור"), mini.removeAttribute("aria-hidden"),
      mini.addEventListener("click", () => this.togglePanel("map")),
      mini.addEventListener("keydown", (n) => {
        (n.key === "Enter" || n.key === " ") && (n.preventDefault(), this.togglePanel("map"));
      }));
    // Always there while it is a guest account, never a pop-up. A nag every few
    // minutes would be read as an ad; a chip that quietly disappears the moment
    // the account is claimed is read as a status.
    let claimBtn = $("#btn-claim");
    claimBtn && (claimBtn.onclick = () => this.openPanel("account"));
  }
  setLoading(e, t) {
    $("#loading").classList.toggle("hidden", !e), t && ($("#loading-msg").textContent = t);
  }
  showScreen(e) {
    for (let t of document.querySelectorAll(".screen")) t.classList.add("hidden");
    e && $(`#screen-${e}`).classList.remove("hidden");
  }
  setMode(e) {
    // A new fight starts with new rows: ids can repeat from one to the next.
    e !== "battle" && this._rows && (this._rows.forEach(f => f.remove()), this._rows.clear());
    if ($("#hud").classList.toggle("hidden", e !== "world"), $("#battle-hud").classList.toggle("hidden", e !== "battle"), $("#world-canvas").classList.toggle("hidden", e !== "world"), $("#battle-canvas").classList.toggle("hidden", e !== "battle"), e !== "world") {
      this.closePanel(), this.closeDialogue();
      for (let t of document.querySelectorAll("#overlay .nameplate")) t.remove();
      this._plates?.clear();
    }
  }
  toast(e, t = "") {
    let n = el("div", `toast ${t}`);
    n.textContent = typeof e == "string" && USERNAME_RE.test(e.trim()) ? usernameError(e) : e, $("#toasts").appendChild(n), setTimeout(() => n.remove(), 2800);
  }
  celebrate(e, t = "level") {
    let n = $("#toasts"),
      s = el("div", `celebrate ${t}`);
    s.innerHTML = "<div class=\"burst\"></div><div class=\"word\"></div>", s.querySelector(".word").textContent = e, n.appendChild(s), setTimeout(() => s.remove(), 2e3);
  }
  showDialogue({
    name: e,
    lines: t,
    onDone: n
  }) {
    this.closeDialogue(), this.closePanel();
    let s = el("div", "dialogue");
    s.innerHTML = `
      <div class="who"><span class="face">🧙</span><b></b></div>
      <div class="say"></div>
      <div class="hint">הקש להמשך ▸</div>`, s.querySelector(".who b").textContent = e || "", document.body.appendChild(s), document.body.classList.add("talking"), this._dialogue = s;
    let r = s.querySelector(".say"),
      o = 0,
      a = 0,
      l = null,
      c = d => {
        let u = t[o] || "";
        if (clearInterval(l), d) {
          a = u.length, r.textContent = u;
          return;
        }
        a = 0, r.textContent = "", l = setInterval(() => {
          a += 1, r.textContent = u.slice(0, a), a % 3 === 0 && audio.sfx("chat"), a >= u.length && clearInterval(l);
        }, 26);
      },
      h = () => {
        let d = t[o] || "";
        if (a < d.length) {
          c(!0);
          return;
        }
        if (o += 1, o >= t.length) {
          clearInterval(l), this.closeDialogue(), n?.();
          return;
        }
        c(!1);
      };
    s.addEventListener("click", h), this._dialogueCleanup = () => clearInterval(l), c(!1);
  }
  /** The words for a reward: gold, XP, items, and a creature if there is one. */
  rewardText(r = {}) {
    // Each part isolated: "150⛁ · 100 XP · 5× כדור" mixes both directions, and
    // left to the bidi algorithm the numbers wander into each other's places.
    let parts = [];
    r.gold && parts.push(`${r.gold.toLocaleString("en-US")}⛁`), r.xp && parts.push(`${r.xp} XP`);
    for (let [id, n] of r.items || []) ITEMS[id] && parts.push(`${Ze(loc(ITEMS[id]))}${n > 1 ? ` ×${n}` : ""}`);
    r.creature && SPECIES[r.creature.species] && parts.push(`🐾 ${Ze(loc(SPECIES[r.creature.species]))} · רמה ${r.creature.level}`);
    return parts.map(p => `<bdi>${p}</bdi>`).join(" · ");
  }
  /** After an NPC has had their say: take the errand on, or hand it in. */
  errandCard(q, mode, who) {
    this.closeDialogue();
    let s = el("div", "dialogue errand"),
      held = heldProgress(this.profile, q),
      need = q.goal.count || 1;
    s.innerHTML = `
      <div class="who"><span class="face">${mode === "ready" ? "🎁" : "📜"}</span><b></b></div>
      <div class="errand-kicker">${mode === "ready" ? "משימה הושלמה" : "משימה חדשה"}</div>
      <div class="errand-title"></div>
      <div class="errand-desc"></div>
      ${held != null && mode === "offer" ? `<div class="errand-have">יש לך כבר ${ltr(String(Math.min(held, need)))} / ${ltr(String(need))}</div>` : ""}
      <div class="errand-reward"><span>פרס</span><b></b></div>
      <div class="errand-actions"></div>`;
    s.querySelector(".who b").textContent = who || "", s.querySelector(".errand-title").textContent = loc(q), s.querySelector(".errand-desc").textContent = q.descHe || q.desc || "", s.querySelector(".errand-reward b").innerHTML = this.rewardText(q.reward);
    let acts = s.querySelector(".errand-actions"),
      yes = el("button", "btn primary", mode === "ready" ? "קבל פרס" : "קבל משימה"),
      no = el("button", "btn ghost", mode === "ready" ? "אחר כך" : "לא עכשיו");
    yes.onclick = ev => {
      ev.stopPropagation(), mode === "ready" ? this.hooks.claimQuest?.(q.id) : this.hooks.acceptQuest?.(q.id), this.closeDialogue();
    }, no.onclick = ev => {
      ev.stopPropagation(), this.closeDialogue();
    }, acts.append(yes, no), document.body.appendChild(s), document.body.classList.add("talking"), this._dialogue = s;
  }
  closeDialogue() {
    document.body.classList.remove("talking"), this._dialogueCleanup?.(), this._dialogueCleanup = null, this._dialogue?.remove(), this._dialogue = null;
  }
  setProfile(e) {
    if (this.profile = e, !e) return;
    $("#v-name").textContent = e.name, $("#v-level").textContent = `Lv ${e.level}`, $("#v-gold").textContent = `${e.gold.toLocaleString("en-US")} ⛁`;
    let t = PROGRESSION.xpToLevel(e.level),
      n = e.nextXp || PROGRESSION.xpToLevel(e.level + 1),
      s = Math.max(0, Math.min(100, (e.xp - t) / Math.max(1, n - t) * 100));
    $("#v-xp").style.width = `${s}%`;
    let r = e.team?.[0];
    if (r) {
      let o = SPECIES[r.species];
      $("#v-pet-name").innerHTML = `${Ze(loc(o))} ${lvlLabel(r.level)}`;
      let a = r.hp / Math.max(1, r.maxHp) * 100;
      $("#v-hp").style.width = `${a}%`, $("#v-hp").parentElement.classList.toggle("low", a < 30);
    }
    this.renderTracker(), this.openPanelId && this.renderPanel(this.openPanelId);
  }
  setZone(e) {
    this.zone = e, this.toastHtml(`<b>${Ze(loc(e))}</b> · רמות ${rangeLabel(e.levels[0], e.levels[1])}`);
  }
  toastHtml(e, t = "") {
    let n = el("div", `toast ${t}`, e);
    $("#toasts").appendChild(n), setTimeout(() => n.remove(), 2800);
  }
  renderTracker() {
    let e = $("#tracker-list");
    if (!this.profile) return;
    let t = [...Object.entries(this.profile.quests.active || {}), ...Object.entries(this.profile.quests.dailies || {})].map(([u, f]) => [u, qLive(this.profile, u, f), QUESTS[u]]).filter(([, u, f]) => f && !u.claimed),
      n = t.map(([u, f]) => `${u}:${f.progress || 0}:${f.done ? 1 : 0}`).join("|");
    if (e.dataset.sig === n) return;
    if (e.dataset.sig = n, e.innerHTML = "", !t.length) {
      e.innerHTML = "<div class=\"q-empty\">אין משימות פעילות</div>";
      return;
    }
    let s = u => u.chain === "main" ? 0 : u.chain === "zone" ? 1 : 2;
    t.sort((u, f) => s(u[2]) - s(f[2]) || (u[2].step || 0) - (f[2].step || 0));
    let r = (u, f, p) => `<span class="q-bar"><i style="width:${p ? 100 : Math.min(100, (u || 0) / Math.max(1, f) * 100)}%"></i></span>`,
      [o, a, l] = t[0],
      c = l.goal.count || 1,
      h = !!a.done,
      d = el("div", `q-lead ${l.chain} ${h ? "done" : ""}`);
    d.innerHTML = `
      <div class="q-kicker">${h ? l.chain === "npc" ? `הושלם — חזור אל ${giverName(l.giver)}` : "הושלם — אסוף את הפרס" : "המשימה הנוכחית"}</div>
      <div class="q-title">${Ze(loc(l))}</div>
      <div class="q-meter">${r(a.progress, c, h)}
        <span class="mono">${h ? "✓" : rangeLabel(Math.min(a.progress || 0, c), c, "/")}</span></div>`, d.onclick = () => this.openPanel("quests"), e.appendChild(d);
    for (let [, u, f] of t.slice(1, 4)) {
      let p = f.goal.count || 1,
        x = !!u.done,
        g = el("div", `q ${f.chain} ${x ? "done" : ""}`);
      g.innerHTML = `
        <div class="q-row"><span class="q-name">${Ze(loc(f))}</span>
          <span class="mono">${x ? "✓" : rangeLabel(Math.min(u.progress || 0, p), p, "/")}</span></div>
        ${r(u.progress, p, x)}`, g.onclick = () => this.openPanel("quests"), e.appendChild(g);
    }
  }
  drawMinimap(e, t, n) {
    // The panel draws from the same numbers on its own timer, so keep the last
    // frame's view of the world rather than plumbing it through a second path.
    this._live = {
      world: e,
      state: t,
      me: n
    };
    let s = this.minimapCtx,
      r = 208,
      o = 70,
      c = r / 2;
    // The zone's own ground, washed light, so the radar is a little window on
    // the meadow and not a hole in it — and two zones do not look alike.
    s.clearRect(0, 0, r, r), s.save(), s.beginPath(), s.arc(c, c, c - 2, 0, Math.PI * 2), s.clip();
    let wash = s.createRadialGradient(c, c, c * 0.1, c, c, c);
    wash.addColorStop(0, pastel(this.zone?.ground ?? 6531422, 0.62)), wash.addColorStop(1, pastel(this.zone?.ground ?? 6531422, 0.38)), s.fillStyle = wash, s.fillRect(0, 0, r, r);
    let a = e.selfPosition(),
      l = (h, d) => [c + (h - a.x) / o * c, c + (d - a.z) / o * c];
    let art = zoneArt(this.zone);
    if (art) {
      let sc = art.scale;
      s.globalAlpha = 0.85, s.drawImage(art.canvas, (a.x - o + art.size / 2) * sc, (a.z - o + art.size / 2) * sc, o * 2 * sc, o * 2 * sc, 0, 0, r, r), s.globalAlpha = 1;
    }
    // The edge of the world, when it is close enough to matter. Without it the
    // radar has no frame and every zone reads the same.
    if (this.zone?.size) {
      let [h, d] = l(0, 0),
        u = (this.zone.size / 2 - 3) / o * c;
      s.strokeStyle = "rgba(42,47,77,.4)", s.lineWidth = 2, s.setLineDash([6, 5]), s.beginPath(), s.arc(h, d, u, 0, Math.PI * 2), s.stroke(), s.setLineDash([]);
    }
    if (this.zone) for (let h of this.zone.landmarks) {
      let [d, u] = l(h.x, h.z);
      s.fillStyle = MAP_PIN[h.kind] || MAP_PIN._, s.strokeStyle = "rgba(42,47,77,.55)", s.lineWidth = 2, s.beginPath(), s.arc(d, u, h.r ? 9 : 5, 0, Math.PI * 2), s.fill(), s.stroke();
    }
    if (t?.wilds?.forEach(h => {
      let [d, u] = l(h.x, h.z),
        // one coming for someone is the dot worth seeing first
        hot = h.alert === "!";
      s.fillStyle = hot ? "#e0202a" : "#ff6a45", s.strokeStyle = "#fff", s.lineWidth = hot ? 2 : 1.5, s.beginPath(), s.arc(d, u, hot ? 5.2 : 3.6, 0, Math.PI * 2), s.fill(), s.stroke();
    }), t?.players?.forEach((h, d) => {
      if (d === n) return;
      let [u, f] = l(h.x, h.z);
      s.fillStyle = h.partyId && h.partyId === this.party?.id ? "#22b86c" : "#4d86f0", s.strokeStyle = "#fff", s.lineWidth = 1.5, s.beginPath(), s.arc(u, f, 4, 0, Math.PI * 2), s.fill(), s.stroke();
    }), t?.boss?.active) {
      let [h, d] = l(t.boss.x, t.boss.z);
      s.fillStyle = "#ff5f56", s.beginPath(), s.arc(h, d, 6, 0, Math.PI * 2), s.fill();
    }
    // A dot says where you are; a wedge also says which way you are looking,
    // which is the half of "where am I" a north-up map otherwise leaves out.
    drawYou(s, c, c, e.camYaw || 0, 12);
    s.restore();
    // North, so the map is orientable at a glance.
    s.font = "800 14px system-ui", s.textAlign = "center", s.lineWidth = 3, s.strokeStyle = "rgba(255,255,255,.9)", s.strokeText("N", c, 17), s.fillStyle = "#2a2f4d", s.fillText("N", c, 17);
  }

  /** The whole zone, drawn from the same live numbers, on its own clock. */
  panelMap(e) {
    let t = el("canvas");
    t.id = "map-canvas", e.appendChild(t);
    let n = el("div", "map-legend");
    n.innerHTML = [["#2fe6d0", "מעבר"], ["#c084fc", "מבוך"], ["#ffc861", "חנות"], ["#7dd3fc", "דמות"], ["#ff6a45", "יצור בר"], ["#4d86f0", "שחקן"]].map(([s, r]) => `<span><i style="background:${s}"></i>${r}</span>`).join(""), e.appendChild(n);
    let s = el("div", "map-hint");
    s.textContent = "צפון למעלה · הנקודה הלבנה היא אתה", e.appendChild(s);
    this.travelList(e);
    let r = () => this.paintMap(t);
    r(), clearInterval(this._mapTimer), this._mapTimer = setInterval(() => {
      this.openPanelId === "map" ? r() : (clearInterval(this._mapTimer), this._mapTimer = null);
    }, 400);
  }

  paintMap(e) {
    let t = this.zone,
      n = this._live;
    if (!t || !n?.world) return;
    let s = Math.max(1, Math.round(e.clientWidth || 300)),
      r = Math.min(3, devicePixelRatio || 1);
    (e.width !== s * r || e.height !== s * r) && (e.width = e.height = s * r);
    let o = e.getContext("2d");
    o.setTransform(r, 0, 0, r, 0, 0), o.clearRect(0, 0, s, s);
    let a = t.size / 2,
      l = s / 2,
      c = (l - 10) / a,
      h = (x, g) => [l + x * c, l + g * c];
    // The ground, in the zone's own colour washed light, as on the radar — the
    // panel it sits in is warm white now — so two zones do not look alike.
    o.beginPath(), o.arc(l, l, l - 8, 0, Math.PI * 2), o.fillStyle = pastel(t.ground ?? 6531422, 0.5), o.fill(), o.strokeStyle = "rgba(42,47,77,.28)", o.lineWidth = 1.5, o.stroke();
    o.save(), o.beginPath(), o.arc(l, l, l - 8, 0, Math.PI * 2), o.clip();
    // a planned zone draws its own ground: rivers, woods, roads, what is built
    let art = zoneArt(t);
    art && o.drawImage(art.canvas, l - a * c, l - a * c, a * 2 * c, a * 2 * c);
    // Pins first, then labels, so a label can never be painted under a disc
    // drawn after it.
    let pins = [];
    for (let x of t.landmarks || []) {
      let [g, m] = h(x.x, x.z),
        v = MAP_PIN[x.kind] || MAP_PIN._,
        E = x.r ? Math.max(5, x.r * c) : 0;
      E && (o.beginPath(), o.arc(g, m, E, 0, Math.PI * 2), o.fillStyle = rgba(v, 0.2), o.fill(), o.strokeStyle = rgba(v, 0.6), o.lineWidth = 1, o.stroke()),
      o.beginPath(), o.arc(g, m, x.r ? 4.5 : 3.5, 0, Math.PI * 2), o.fillStyle = v, o.fill(), o.strokeStyle = "rgba(42,47,77,.55)", o.lineWidth = 1.5, o.stroke(),
      pins.push({
        x: g,
        y: m,
        rad: E,
        text: mapLabel(x),
        big: !!x.r
      });
    }
    // Greedy label placement. Eight landmarks in a 300px circle will collide on
    // any phone, and two names printed over each other are worse than one name
    // and a pin — so a label that cannot find room is dropped, not squeezed.
    o.font = "600 10px system-ui", o.textAlign = "center";
    let taken = [],
      fits = (b) => !taken.some(k => Math.abs(b.x - k.x) < (b.w + k.w) / 2 + 5 && Math.abs(b.y - k.y) < (b.h + k.h) / 2 + 3);
    for (let b of pins.sort((k, P) => P.big - k.big)) {
      if (!b.text) continue;
      let w = o.measureText(b.text).width + 4,
        cands = [b.y - (b.rad || 7) - 6, b.y + (b.rad || 7) + 11];
      for (let y of cands) {
        let box = {
          x: b.x,
          y: y - 4,
          w,
          h: 12
        };
        if (!fits(box)) continue;
        // A pill, not a shadow. A shadow keeps a name readable over dark
        // ground and loses it over a lit disc, and half the pins are discs.
        taken.push(box), o.fillStyle = "rgba(255,255,255,.92)", o.strokeStyle = "rgba(42,47,77,.16)", o.lineWidth = 1;
        o.beginPath(), o.roundRect ? o.roundRect(b.x - w / 2, y - 9, w, 13, 4) : o.rect(b.x - w / 2, y - 9, w, 13), o.fill(), o.stroke();
        o.fillStyle = "#2a2f4d", o.fillText(b.text, b.x, y);
        break;
      }
    }
    let d = n.state;
    d?.wilds?.forEach(x => {
      let [g, m] = h(x.x, x.z);
      o.fillStyle = x.alert === "!" ? "#e0202a" : "#ff6a45", o.strokeStyle = "#fff", o.lineWidth = 1, o.beginPath(), o.arc(g, m, x.alert === "!" ? 3.4 : 2.6, 0, Math.PI * 2), o.fill(), o.stroke();
    }), d?.players?.forEach((x, g) => {
      if (g === n.me) return;
      let [m, v] = h(x.x, x.z);
      o.fillStyle = x.partyId && x.partyId === this.party?.id ? "#22b86c" : "#4d86f0", o.strokeStyle = "#fff", o.lineWidth = 1.2, o.beginPath(), o.arc(m, v, 3.2, 0, Math.PI * 2), o.fill(), o.stroke();
    }), d?.boss?.active && (() => {
      let [x, g] = h(d.boss.x, d.boss.z);
      o.fillStyle = "#ff5f56", o.beginPath(), o.arc(x, g, 5.5, 0, Math.PI * 2), o.fill();
    })();
    let u = n.world.selfPosition(),
      [f, p] = h(u.x, u.z);
    drawYou(o, f, p, n.world.camYaw || 0, 11), o.restore();
    o.font = "800 12px system-ui", o.textAlign = "center", o.lineWidth = 3, o.strokeStyle = "rgba(255,255,255,.9)", o.strokeText("N", l, 14), o.fillStyle = "#2a2f4d", o.fillText("N", l, 14);
  }

  /** Where you can go from here. Shared by the menu and the map. */
  travelList(e) {
    let t = (this.zone?.landmarks || []).filter(o => o.kind === "portal"),
      n = (this.zone?.landmarks || []).filter(o => o.kind === "dungeon");
    if (!t.length && !n.length) return;
    e.appendChild(section("לאן אפשר ללכת"));
    for (let o of t) {
      let a = ZONES[o.to];
      if (!a) continue;
      let l = el("div", "list-item");
      l.innerHTML = `<div class="grow"><b>🚪 מעבר ל${Ze(loc(a))}</b>
        <span>רמות ${rangeLabel(a.levels[0], a.levels[1])}</span></div>`;
      let c = el("button", "btn small primary", "עבור");
      c.onclick = () => {
        this.hooks.travel?.(o.to), this.closePanel();
      }, l.appendChild(c), e.appendChild(l);
    }
    for (let o of n) {
      let a = DUNGEONS[o.to];
      if (!a) continue;
      let l = el("div", "list-item");
      l.innerHTML = `<div class="grow"><b>🕳 ${Ze(loc(a))}</b>
        <span>רמה ${ltr(`${a.minLevel}+`)} · ${ltr(a.floors)} קומות · עד ${ltr(a.partyMax)} שחקנים</span></div>`;
      let c = el("button", "btn small primary", "היכנס");
      c.onclick = () => {
        this.hooks.dungeon?.(a.id), this.closePanel();
      }, l.appendChild(c), e.appendChild(l);
    }
  }

  pushChat(e) {
    this.chatLog.push(e), this.chatLog.length > 200 && this.chatLog.shift();
    let t = $("#chat-mini"),
      n = el("div", `line ch-${e.ch}`, this.chatLine(e));
    for (t.appendChild(n); t.childElementCount > 5;) t.firstElementChild.remove();
    if (this.openPanelId === "chat") {
      let s = this.panel.querySelector(".log");
      if (s) {
        for (s.appendChild(el("div", `ch-${e.ch}`, this.chatLine(e))); s.childElementCount > 120;) s.firstElementChild.remove();
        let r = this.panel.querySelector(".body");
        r && (r.scrollTop = r.scrollHeight);
      }
    }
  }
  chatLine(e) {
    let t = {
        world: "[עולמי]",
        zone: "[אזור]",
        party: "[קבוצה]",
        guild: "[גילדה]",
        whisper: "[לחישה]",
        gm: "[GM]",
        system: ""
      }[e.ch] ?? "",
      n = e.ch === "whisper" && e.to ? `<b>${Ze(e.from)}</b> ← <b>${Ze(e.to)}</b>: ` : e.from ? `<b>${Ze(e.from)}</b>: ` : "";
    return `${t ? `<span class="ch-tag">${t}</span> ` : ""}${n}${Ze(e.text || e.he || "")}`;
  }
  togglePanel(e) {
    this.openPanelId === e ? this.closePanel() : this.openPanel(e);
  }
  openPanel(e) {
    if (!this.social && SOCIAL_PANELS.has(e) || e === "guild" && !GUILDS) return;
    this.closeDialogue(), this.openPanelId = e, this.panelHost.classList.add("open"), e === "base" && this.hooks.baseOpen?.(), e === "dex" && this.hooks.dexOpen?.(), e === "gm" && this.hooks.gmOpen?.(), this.renderPanel(e);
  }
  closePanel() {
    this.openPanelId = null, this.panelHost.classList.remove("open"), clearInterval(this._cdTimer), this._cdTimer = null, clearInterval(this._mapTimer), this._mapTimer = null, clearTimeout(this._clearTimer), this._clearTimer = setTimeout(() => {
      this.openPanelId || (this.panel.innerHTML = "");
    }, 260);
  }
  renderPanel(e) {
    let t = {
        menu: "תפריט",
        bag: "תיק חפצים",
        team: "היצורים שלי",
        quests: "משימות",
        friends: "חברים",
        guild: "גילדה",
        chat: "צ'אט",
        shop: "חנות",
        party: "קבוצה",
        player: "שחקן",
        leaders: "טבלת מובילים",
        base: "הבסיס",
        card: "כרטיס יצור",
        dex: "אוסף היצורים",
        species: "יומן המינים",
        clinic: "מרפאת הגאות",
        account: "החשבון שלי",
        map: "מפת האזור",
        gm: "🛡 כלי GM"
      }[e] || e,
      n = this.panel.dataset.panelId === e && this.panel.querySelector(".body")?.scrollTop || 0;
    clearTimeout(this._clearTimer), this.panel.innerHTML = "", this.panel.id = e === "chat" ? "chat-panel" : "panel", this.panel.dataset.panelId = e, this.panel.setAttribute("aria-label", t);
    let s = el("header");
    s.innerHTML = "<h3></h3>", s.querySelector("h3").textContent = t;
    let r = el("button", "btn small ghost icon-only", "✕");
    r.setAttribute("aria-label", "סגור"), r.onclick = () => this.closePanel(), s.appendChild(r), this.panel.appendChild(s);
    let o = el("div", "body");
    this.panel.appendChild(o), ({
      menu: () => this.panelMenu(o),
      account: () => this.panelAccount(o),
      map: () => this.panelMap(o),
      bag: () => this.panelBag(o),
      team: () => this.panelTeam(o),
      quests: () => this.panelQuests(o),
      friends: () => this.panelFriends(o),
      guild: () => this.panelGuild(o),
      chat: () => this.panelChat(o),
      shop: () => this.panelShop(o),
      party: () => this.panelParty(o),
      player: () => this.panelPlayer(o),
      leaders: () => this.panelLeaders(o),
      base: () => this.panelBase(o),
      card: () => this.panelCard(o),
      dex: () => this.panelDex(o),
      species: () => this.panelSpecies(o),
      clinic: () => this.panelClinic(o),
      gm: () => this.gm?.on ? this.panelGm(o) : o.appendChild(emptyState("🛡", "אין הרשאה"))
    }[e] || (() => o.appendChild(emptyState("🗒", "אין מה להציג כאן"))))(), n && (o.scrollTop = n);
  }
  /**
   * The collection. One tile per species, dim until it has been caught once,
   * with the number of duplicates on it — duplicates are what pay for star
   * upgrades, so the count is the useful number, not a trophy.
   */
  panelDex(host) {
    let dex = this.dex;
    if (!dex) { host.appendChild(emptyState("📕", "טוען את האוסף…", null, "loading")); return; }
    host.appendChild(section(`נתפסו ${dex.seen} מתוך ${dex.total}`, `${Math.round(dex.seen / Math.max(1, dex.total) * 100)}%`));
    let byRarity = {};
    for (let row of dex.rows) (byRarity[row.rarity] ||= []).push(row);
    let labels = { starter: "פותחים", common: "נפוצים", evolved: "מתפתחים", final: "סופיים", rare: "נדירים", legendary: "אגדיים" };
    for (let rarity of ["starter", "common", "evolved", "final", "rare", "legendary"]) {
      let rows = byRarity[rarity];
      if (!rows?.length) continue;
      host.appendChild(section(labels[rarity] || rarity, `${rows.filter((r) => r.caught).length}/${rows.length}`));
      let grid = el("div", "dex-grid");
      for (let row of rows) {
        let tile = el("button", `dex-tile ${row.caught ? "" : "locked"}`);
        let el0 = ELEMENTS[row.types[0]];
        tile.style.setProperty("--elem", el0?.ui || "#7d87ab");
        // one that only comes out in its hour says so, caught or not: it is
        // the clue for where to look
        let hour = foundWhere(row.id).find((f) => f.when)?.when;
        tile.innerHTML = row.caught
          ? `<span class="ico">${el0?.icon || "•"}</span><b>${row.he}</b>` +
            `<span class="n">${row.caught > 1 ? `×${row.caught}` : "חדש"}</span>`
          : `<span class="ico">❔</span><b>???</b><span class="n">${el0?.icon || ""}${hour ? ` ${HOURS[hour].icon}` : ""}</span>`;
        tile.setAttribute("aria-label", row.caught ? row.he : "יצור שעוד לא נתפס");
        tile.onclick = () => { this.speciesId = row.id; this.openPanel("species"); };
        grid.appendChild(tile);
      }
      host.appendChild(grid);
    }
  }

  /**
   * One species in the log: its picture (a shadow until you catch one), its
   * line, and where and when it is found — which is the part a player hunting
   * for it needs, so it is there before it is caught.
   */
  panelSpecies(host) {
    let id = this.speciesId, sp = SPECIES[id];
    if (!sp) { host.appendChild(emptyState("📕", "לא נמצא")); return; }
    let row = this.dex?.rows.find((r) => r.id === id), caught = row?.caught || 0;
    let name = (s) => (this.dex?.rows.find((r) => r.id === s.id)?.caught ? Ze(loc(s)) : "???");
    let back = el("button", "btn small ghost", "→ לאוסף");
    back.onclick = () => this.openPanel("dex");
    host.appendChild(back);
    let page = el("div", `species-page ${caught ? "" : "locked"}`), el0 = ELEMENTS[sp.types[0]];
    page.style.setProperty("--elem", el0?.ui || "#7d87ab");
    let img = zoneMinimap(id),
      rarity = { starter: "פותח", common: "נפוץ", evolved: "מתפתח", final: "סופי", rare: "נדיר", legendary: "אגדי" }[sp.rarity] || sp.rarity;
    page.innerHTML = `
      <div class="art" style="background:linear-gradient(150deg, ${oo(sp.model.a)}, ${oo(sp.model.b)})">${img ? `<img src="${img}" alt="" />` : ""}</div>
      <div class="name">${caught ? Ze(loc(sp)) : "???"}</div>
      <div class="chips">${sp.types.map((t) => `<span class="chip">${ELEMENTS[t].icon} ${Ze(loc(ELEMENTS[t]))}</span>`).join("")}<span class="chip">${rarity}</span></div>
      <div class="caught">${caught ? `נתפסו ${caught}` : "עוד לא נתפס"}</div>`;
    host.appendChild(page);

    // the line it belongs to, from the first form to the last
    let root = sp;
    for (let guard = 0; guard < 4; guard++) {
      let prev = Object.values(SPECIES).find((s) => s.evolve?.into === root.id);
      if (!prev) break;
      root = prev;
    }
    if (root.evolve) {
      let chain = [], at = root;
      while (at) { chain.push(at); at = at.evolve ? SPECIES[at.evolve.into] : null; }
      host.appendChild(section("קו ההתפתחות"));
      let line = el("div", "evo-line");
      line.innerHTML = chain.map((s, i) => (i ? `<span class="arrow">← רמה ${ltr(chain[i - 1].evolve.level)}</span>` : "") +
        `<span class="evo ${s.id === id ? "here" : ""}">${ELEMENTS[s.types[0]]?.icon || ""} ${name(s)}</span>`).join("");
      host.appendChild(line);
    }

    host.appendChild(section("איפה למצוא"));
    let where = foundWhere(id);
    let often = { common: "נפוץ", uncommon: "לא נפוץ", rare: "נדיר" };
    for (let f of where) {
      let it = el("div", "list-item");
      it.innerHTML = `<div class="ico-lg">${f.when ? HOURS[f.when].icon : f.at ? HABITATS[f.at].icon : "📍"}</div>
        <div class="grow"><b>${Ze(whereLine(f))}</b><span>רמות ${ltr(`${f.levels[0]}–${f.levels[1]}`)} · ${often[f.often]}</span></div>`;
      host.appendChild(it);
    }
    if (!where.length) {
      let prev = Object.values(SPECIES).find((s) => s.evolve?.into === id);
      let it = el("div", "empty plain");
      it.textContent = prev ? `לא חי בטבע — מתפתח מ${prev.evolve && this.dex?.rows.find((r) => r.id === prev.id)?.caught ? loc(prev) : "יצור אחר"} ברמה ${prev.evolve.level}.`
        : sp.rarity === "starter" ? "אחד משלושת יצורי הפתיחה."
        : sp.rarity === "legendary" ? "מגיע למי שמשלים את יומן המינים של מארו."
        : "לא נראה בטבע.";
      host.appendChild(it);
    }
    if (!caught) return;

    host.appendChild(section("נתוני בסיס"));
    let grid = el("div", "statgrid"), lbl = { hp: "חיים", atk: "התקפה", def: "הגנה", spa: "מיוחדת", spd: "עמידות", spe: "מהירות" };
    for (let [k, v] of Object.entries(sp.base)) {
      let m = el("div", "stat");
      m.innerHTML = `<span>${lbl[k] || k}</span><i style="width:${Math.min(100, v / 130 * 100)}%"></i><b class="mono">${ltr(v)}</b>`;
      grid.appendChild(m);
    }
    host.appendChild(grid);
    host.appendChild(section("מהלכים"));
    let moves = el("div", "chips");
    for (let [lv, m] of sp.learn || []) {
      let mv = MOVES[m];
      mv && moves.appendChild(el("span", "chip", `${ltr(lv)} · ${ELEMENTS[mv.type]?.icon || "◆"} ${Ze(loc(mv))}`));
    }
    host.appendChild(moves);
  }

  /**
   * GM tools. Drawn only for a session the server said belongs to a GM; the
   * server refuses every one of these buttons for anyone else regardless, and
   * writes every one it carries out to the log at the bottom.
   */
  panelGm(e) {
    let f = this.gmForm ||= {
        to: "me",
        species: "cindcub",
        level: 30,
        shiny: !1,
        gold: 10000,
        item: "sphere_ultra",
        qty: 50,
        zone: this.zone?.id || "aetherport",
        text: ""
      },
      // Through the one `gm` hook: these are ops, not messages of their own.
      ask = (op, data = {}) => this.hooks.gm?.(op, data),
      maxLv = PROGRESSION.maxLevel,
      num = (value, lo, hi) => {
        let n = el("input", "field-input");
        return n.type = "number", n.inputMode = "numeric", n.min = lo, n.max = hi, n.value = value, n;
      },
      clampNum = (input, lo, hi, dflt) => {
        let v = Math.round(Number(input.value));
        return v = Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt, input.value = v, v;
      },
      btn = (label, cls, onclick) => {
        let b = el("button", `btn ${cls}`, label);
        return b.onclick = onclick, b;
      },
      row = (...kids) => {
        let r = el("div", "row gm-row");
        return r.append(...kids), r;
      };
    let hint = el("div", "hint");
    hint.textContent = "כל פעולה כאן נרשמת ביומן שבתחתית, עם השם שלך.";
    e.appendChild(hint);

    // who
    e.appendChild(section("למי"));
    let who = el("select", "field-input");
    who.setAttribute("aria-label", "למי");
    who.onchange = () => { f.to = who.value; };
    this._gmWho = who, this.fillGmWho();
    e.appendChild(row(who, btn("🔄", "small icon-only", () => ask("players"))));

    // a creature
    e.appendChild(section("יצור"));
    let order = ["starter", "common", "evolved", "final", "rare", "legendary", "boss"],
      sp = el("select", "field-input");
    sp.setAttribute("aria-label", "איזה יצור");
    for (let s of Object.values(SPECIES).sort((a, b) => order.indexOf(a.rarity) - order.indexOf(b.rarity) || loc(a).localeCompare(loc(b), "he")))
      sp.appendChild(new Option(`${ELEMENTS[s.types[0]]?.icon || ""} ${loc(s)}${s.rarity === "boss" ? " ☠" : s.rarity === "legendary" ? " ★" : ""}`, s.id));
    sp.value = f.species, sp.onchange = () => { f.species = sp.value; };
    let lv = num(f.level, 1, maxLv);
    lv.setAttribute("aria-label", "רמה"), lv.classList.add("gm-num"), lv.onchange = () => { f.level = clampNum(lv, 1, maxLv, 30); };
    let shiny = btn(`✨ נוצץ`, `small ${f.shiny ? "primary" : ""}`, () => {
      f.shiny = !f.shiny, shiny.classList.toggle("primary", f.shiny), shiny.setAttribute("aria-pressed", String(f.shiny));
    });
    shiny.setAttribute("aria-pressed", String(f.shiny));
    e.appendChild(row(sp, lv));
    let give = btn("🎁 תן את היצור", "primary", () => (f.level = clampNum(lv, 1, maxLv, 30), ask("give", { to: f.to, what: "creature", species: f.species, level: f.level, shiny: f.shiny }))),
      summon = btn("📍 זמן לידי", "", () => (f.level = clampNum(lv, 1, maxLv, 30), ask("summon", { species: f.species, level: f.level })));
    e.appendChild(row(give, summon, shiny));
    let sh = el("div", "hint");
    sh.textContent = "״תן״ מוסיף לצוות (או לקופסה כשהצוות מלא). ״זמן לידי״ מביא יצור פראי לידך — אפשר להילחם בו ולתפוס אותו.";
    e.appendChild(sh);

    // gold and things
    e.appendChild(section("זהב וחפצים"));
    let gold = num(f.gold, 1, this.gm?.limits?.gold || 1e7);
    gold.setAttribute("aria-label", "כמה זהב"), gold.onchange = () => { f.gold = clampNum(gold, 1, this.gm?.limits?.gold || 1e7, 1e4); };
    e.appendChild(row(gold, btn("💰 תן זהב", "", () => (f.gold = clampNum(gold, 1, this.gm?.limits?.gold || 1e7, 1e4), ask("give", { to: f.to, what: "gold", amount: f.gold })))));
    let it = el("select", "field-input");
    it.setAttribute("aria-label", "איזה חפץ");
    let kinds = { sphere: "כדורים", heal: "שיקויים", revive: "החייאה", stamina: "מרץ", trainerHeal: "ריפוי מאמן", gear: "ציוד", material: "חומרים" };
    for (let [kind, label] of Object.entries(kinds)) {
      let g = document.createElement("optgroup");
      g.label = label;
      for (let item of Object.values(ITEMS)) item.kind === kind && g.appendChild(new Option(`${item.icon || ""} ${loc(item)}`, item.id));
      g.children.length && it.appendChild(g);
    }
    it.value = f.item, it.onchange = () => { f.item = it.value; };
    let qty = num(f.qty, 1, this.gm?.limits?.qty || 999);
    qty.setAttribute("aria-label", "כמות"), qty.classList.add("gm-num"), qty.onchange = () => { f.qty = clampNum(qty, 1, this.gm?.limits?.qty || 999, 1); };
    e.appendChild(row(it, qty));
    e.appendChild(btn("📦 תן את החפץ", "", () => (f.qty = clampNum(qty, 1, this.gm?.limits?.qty || 999, 1), ask("give", { to: f.to, what: "item", item: f.item, qty: f.qty }))));
    let fill = btn("♾ משאבים בלי סוף", "primary", () => ask("fill", { to: f.to }));
    fill.style.marginTop = "var(--s2)", e.appendChild(fill);
    let fh = el("div", "hint");
    fh.textContent = `ממלא זהב עד ${(this.gm?.limits?.fillGold || 1e7).toLocaleString("en-US")} וכל כדור, שיקוי וחומר עד ${this.gm?.limits?.fillQty || 999}. אפשר ללחוץ שוב בכל פעם.`;
    e.appendChild(fh);

    // the trainer's own level
    e.appendChild(section("רמת מאמן"));
    let tl = num(f.trainer || this.profile?.level || 1, 1, maxLv);
    tl.setAttribute("aria-label", "רמת מאמן"), tl.classList.add("gm-num"), tl.onchange = () => { f.trainer = clampNum(tl, 1, maxLv, 1); };
    let th = el("div", "hint grow");
    th.textContent = "קובע את הרמה של המאמן עצמו (לא של היצורים).";
    e.appendChild(row(tl, btn("⬆ קבע רמה", "", () => (f.trainer = clampNum(tl, 1, maxLv, 1), ask("give", { to: f.to, what: "level", level: f.trainer })))));
    e.appendChild(th);

    // go and mend
    e.appendChild(section("שיגור וריפוי"));
    let zone = el("select", "field-input");
    zone.setAttribute("aria-label", "לאיזה אזור");
    for (let z of Object.values(ZONES)) zone.appendChild(new Option(`${loc(z)} · ${z.levels[0]}–${z.levels[1]}`, z.id));
    zone.value = f.zone, zone.onchange = () => { f.zone = zone.value; };
    e.appendChild(row(zone, btn("🌀 שגר אותי", "", () => ask("teleport", { zone: f.zone }))));
    e.appendChild(row(
      btn("👣 אל השחקן", "", () => f.to === "me" ? this.toast("בחר שחקן ברשימה למעלה", "bad") : ask("teleport", { player: f.to })),
      btn("❤ ריפוי הצוות", "", () => ask("heal", { to: f.to }))
    ));

    // say something to everyone
    e.appendChild(section("הודעה לכל השרת"));
    let text = textInput("מה להגיד לכל השחקנים?");
    text.maxLength = this.gm?.limits?.text || 200, text.value = f.text, text.oninput = () => { f.text = text.value; };
    e.appendChild(row(text, btn("📢 שלח", "primary", () => {
      let v = text.value.trim();
      v ? (ask("announce", { text: v }), text.value = "", f.text = "") : this.toast("ההודעה ריקה", "bad");
    })));

    // the log
    e.appendChild(section("יומן פעולות", ""));
    let log = el("div", "gm-log");
    this._gmLogBox = log, this.fillGmLog(), e.appendChild(log);
    e.appendChild(btn("🔄 רענן יומן", "small ghost", () => ask("log")));
  }
  /** The "who" list, refilled in place so a reply never steals focus. */
  fillGmWho() {
    let who = this._gmWho,
      f = this.gmForm;
    if (!who || !f) return;
    let others = (this.gmPlayers || []).filter(p => p.id !== this.profile?.id);
    others.some(p => p.id === f.to) || (f.to = "me"), who.innerHTML = "", who.appendChild(new Option(`אני (${this.profile?.name || ""})`, "me"));
    for (let p of others) who.appendChild(new Option(`${p.name} · Lv ${p.level} · ${loc(ZONES[p.zone]) || p.zone}`, p.id));
    who.value = f.to;
  }
  fillGmLog() {
    let box = this._gmLogBox;
    if (!box) return;
    box.innerHTML = "";
    let rows = this.gmLog || [];
    if (!rows.length) return box.appendChild(emptyState("🗒", "עוד אין פעולות ביומן"));
    for (let r of rows.slice(0, 40)) {
      let d = new Date(r.at),
        line = el("div", "gm-log-row"),
        time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      line.innerHTML = `<span class="mono">${ltr(time)}</span> <b>${Ze(r.gm?.name || "")}</b> ${Ze(this.gmSummary(r.op, r.detail, r.to && r.to.id !== r.gm?.id ? r.to.name : null))}`, box.appendChild(line);
    }
  }
  gmRefresh(kind) {
    if (this.openPanelId !== "gm") return;
    kind === "players" ? this.fillGmWho() : kind === "log" && this.fillGmLog();
  }
  /** One line for what a GM did: the toast after it, and its row in the log. */
  gmSummary(op, d = {}, to = null) {
    d ||= {};
    let whom = to ? ` ← ${to}` : "",
      what = {
        give: () => d.what === "creature" ? `${loc(SPECIES[d.species]) || d.species} ${d.shiny ? "✨ " : ""}Lv ${d.level}${d.where === "box" ? " (לקופסה)" : ""}` : d.what === "gold" ? `${Number(d.amount || 0).toLocaleString("en-US")}⛁` : d.what === "level" ? `רמת מאמן ${d.level}` : `${loc(ITEMS[d.item]) || d.item} ×${d.qty}`,
        fill: () => "משאבים בלי סוף",
        heal: () => "ריפוי הצוות",
        teleport: () => d.beside ? `שיגור אל ${d.beside}` : `שיגור ל${loc(ZONES[d.zone]) || d.zone}`,
        summon: () => `זימון ${loc(SPECIES[d.species]) || d.species} Lv ${d.level}`,
        announce: () => `📢 ${d.text || ""}${Number.isFinite(d.reached) ? ` (${d.reached} שחקנים)` : ""}`
      }[op];
    return `${what ? what() : op}${whom}`;
  }
  /** A GM's announcement: across the top, long enough to read, tap to close. */
  gmBanner(from, text) {
    let host = $("#app") || document.body,
      b = el("div", "gm-banner");
    b.setAttribute("role", "status"), b.innerHTML = `<span class="who">📢 ${Ze(from || "GM")}</span><span class="what"></span>`, b.querySelector(".what").textContent = text || "";
    b.onclick = () => b.remove(), host.appendChild(b), setTimeout(() => b.classList.add("out"), 7e3), setTimeout(() => b.remove(), 7600);
  }

  panelMenu(e) {
    let t = el("div", "grid2"),
      n = [["🎒 תיק", "bag"], ["🐾 יצורים", "team"], ["📜 משימות", "quests"], ["👥 חברים", "friends"], ["🛡 גילדה", "guild"], ["⚔ קבוצה", "party"], ["🏪 חנות", "shop"], ["🏆 מובילים", "leaders"], ["🏕 הבסיס", "base"], ["📕 אוסף", "dex"], ["🗺 מפה", "map"], ["👁 מבט", "__view"], ["⛶ מסך מלא", "__fullscreen"]];
    n = n.filter(([, h]) => h !== "guild" || GUILDS), this.social || (n = n.filter(([, h]) => !SOCIAL_PANELS.has(h)));
    // Only a session the server called a GM's ever gets the hello that sets this.
    this.gm?.on && n.unshift(["👑 כלי GM", "gm"]);
    for (let [c, h] of n) {
      let d = el("button", "btn", c);
      if (h === "__view") {
        let u = () => this.hooks.viewMode?.() === "first" ? "גוף ראשון" : "גוף שלישי";
        d.textContent = `👁 ${u()}`, d.onclick = () => {
          this.hooks.toggleView?.(), d.textContent = `👁 ${u()}`;
        };
      } else if (h === "__fullscreen") {
        d.onclick = () => this.hooks.fullscreen?.();
      } else d.onclick = () => this.openPanel(h);
      t.appendChild(d);
    }
    e.appendChild(t);
    let s = el("div", "sound-row");
    for (let [c, h, d] of [["music", "מוזיקה", "🎵"], ["sfx", "אפקטים", "🔊"]]) {
      let u = el("button", `btn ${audio.enabled[c] ? "" : "off"}`, `${d} ${h}`);
      u.setAttribute("aria-pressed", String(!!audio.enabled[c])), u.onclick = () => {
        let f = audio.toggle(c);
        u.classList.toggle("off", !f), u.setAttribute("aria-pressed", String(!!f)), f && c === "music" && audio.playMusic(audio.currentTrack || this.zone?.id || "verdant_meadow", !0);
      }, s.appendChild(u);
    }
    e.appendChild(s), e.appendChild(section("היכן אתה"));
    let r = el("div", "list-item");
    r.innerHTML = `<div class="grow"><b>${Ze(loc(this.zone || {}))}</b>
      <span>${this.zone ? `רמות ${rangeLabel(this.zone.levels[0], this.zone.levels[1])}` : ""}</span></div>`, e.appendChild(r);
    this.travelList(e);
    let l = el("button", "btn", this.account?.guest ? "🔒 שמור את ההתקדמות" : "👤 החשבון שלי");
    l.style.marginTop = "var(--s3)", l.onclick = () => this.openPanel("account"), e.appendChild(l);
  }

  /** Where a guest turns into an account without losing anything. */
  panelAccount(e) {
    if (this.account?.local) {
      e.appendChild(emptyState("💾", "שמירה מקומית", "הגרסה הזו שומרת בדפדפן הזה בלבד. בגרסה עם שרת אפשר לפתוח חשבון וההתקדמות נוסעת איתך לכל מכשיר."));
      return;
    }
    if (!this.account?.guest) {
      let d = el("div", "list-item");
      d.innerHTML = `<div class="grow"><b>מחובר</b><span dir="ltr">${Ze(this.account?.username || "")}</span></div>`;
      e.appendChild(d);
      let u = el("div", "hint");
      u.textContent = "ההתקדמות נשמרת בשרת. אפשר להתחבר עם אותו שם משתמש מכל מכשיר.";
      e.appendChild(u);
      let f = el("button", "btn danger", "התנתקות");
      f.style.marginTop = "var(--s3)", f.onclick = () => this.hooks.logout?.(), e.appendChild(f);
      return;
    }
    let t = el("div", "hint");
    t.textContent = "אתה משחק כאורח. ההתקדמות שלך נשמרת בשרת כבר עכשיו, אבל הדרך היחידה להוכיח שהיא שלך היא הדפדפן הזה. בחר שם משתמש וסיסמה וההתקדמות תיקשר אליהם — שום דבר לא מתאפס.";
    e.appendChild(t);
    let n = el("div", "field");
    n.innerHTML = '<label for="claim-user">שם משתמש</label>';
    let s2 = el("input");
    s2.id = "claim-user", s2.type = "text", s2.dir = "ltr", s2.autocomplete = "username", s2.placeholder = "אותיות קטנות באנגלית, ספרות, קו תחתון";
    n.appendChild(s2), e.appendChild(n);
    let r = el("div", "field");
    r.innerHTML = '<label for="claim-pass">סיסמה</label>';
    let o = el("input");
    o.id = "claim-pass", o.type = "password", o.dir = "ltr", o.autocomplete = "new-password", o.placeholder = "לפחות 6 תווים";
    r.appendChild(o), e.appendChild(r);
    let a = el("div", "error-text");
    e.appendChild(a);
    let l2 = el("button", "btn primary", "שמור את ההתקדמות");
    l2.style.marginTop = "var(--s2)", l2.onclick = async () => {
      // The error dictionary lives with the rest of the login flow in game.js,
      // so the hook reports rather than throws.
      a.textContent = "", l2.disabled = !0;
      let d = await this.hooks.claim?.(s2.value.trim(), o.value);
      l2.disabled = !1, d?.ok || (a.textContent = d?.message || "לא הצלחנו לשמור");
    }, e.appendChild(l2);
    let c = el("button", "btn ghost", "כבר יש לי חשבון — התחברות");
    c.style.marginTop = "var(--s2)", c.onclick = () => this.hooks.switchAccount?.(), e.appendChild(c);
  }

  /** Who is playing, and whether there is anything to claim. */
  setAccount(e) {
    this.account = e;
    let t = $("#btn-claim");
    t && t.classList.toggle("hidden", !e?.guest);
    this.openPanelId === "account" && this.renderPanel("account");
  }
  panelBag(e) {
    let t = this.profile?.inventory || {},
      n = Object.entries(t).filter(([, a]) => a > 0);
    if (!n.length) {
      e.appendChild(emptyState("🎒", "התיק ריק", "שלל מקרבות ומבוכים מגיע לכאן"));
      return;
    }
    for (let [a, l] of n) {
      let c = ITEMS[a];
      if (!c) continue;
      let h = el("div", "list-item");
      if (h.innerHTML = `<div class="ico-lg">${c.icon || "📦"}</div>
        <div class="grow"><b>${Ze(loc(c))}</b><span>${itemEffect(c)}</span></div>
        <div class="mono pill">${ltr(`×${l}`)}</div>`, c.kind === "heal" || c.kind === "revive" || c.kind === "gear") {
        let d = el("button", "btn small", c.kind === "gear" ? "צייד" : "השתמש");
        d.onclick = () => this.hooks.useItem?.(a), h.appendChild(d);
      }
      e.appendChild(h);
    }
    e.appendChild(section("ציוד"));
    let s = el("div", "list-item"),
      r = this.profile?.gear || {},
      o = (a, l) => `${a}: ${r[l] ? Ze(loc(ITEMS[r[l]])) : "—"}`;
    s.innerHTML = `<div class="grow"><b>מה שאתה לובש</b><span>
      ${o("נשק", "weapon")} · ${o("שריון", "armor")} · ${o("קמע", "trinket")}</span></div>`, e.appendChild(s);
  }
  panelTeam(e) {
    let t = this.profile;
    if (!t) return;
    let n = [...(t.team || []), ...(t.box || [])];
    if (!n.length && !t.away?.length) {
      e.appendChild(emptyState("🐾", "אין לך עדיין יצורים", "לכידה בקרב מוסיפה יצור לצוות"));
      return;
    }
    e.appendChild(section("הצוות", `${n.length}`)), n.forEach((s, r) => {
      let o = SPECIES[s.species],
        a = r < (t.team?.length || 0),
        l = el("div", "list-item tappable");
      l.setAttribute("role", "button"), l.tabIndex = 0;
      let c = o.types.map(f => `${ELEMENTS[f].icon} ${Ze(loc(ELEMENTS[f]))}`).join(" / ");
      l.innerHTML = `
        <div class="thumb" style="background:${oo(o.model.a)}"></div>
        <div class="grow">
          <b>${Ze(loc(o))} ${s.shiny ? "✨" : ""} <span class="pill">${lvlLabel(s.level)}</span> <span class="stars">${starLabel(s.star || 1)}</span></b>
          <span>${c} · HP ${rangeLabel(s.hp, s.maxHp, "/")}</span>
          <div class="bar hp" style="margin-top:4px"><i style="width:${s.hp / Math.max(1, s.maxHp) * 100}%"></i></div>
        </div>
        ${a ? "<span class=\"pill good\">בצוות</span>" : ""}`;
      let h = zoneMinimap(s.species);
      h && (l.querySelector(".thumb").innerHTML = `<img src="${h}" alt="" />`);
      let d = () => this.hooks.openCard?.(s.uid);
      l.onclick = d, l.onkeydown = f => {
        (f.key === "Enter" || f.key === " ") && (f.preventDefault(), d());
      };
      let u = el("button", "btn small icon-only", "⬆");
      u.title = "הצב בראש הצוות", u.setAttribute("aria-label", "הצב בראש הצוות"), u.disabled = r === 0, u.onclick = f => {
        f.stopPropagation(), this.hooks.setLead?.(s.uid);
      }, l.appendChild(u), e.appendChild(l);
    });
    // the ones at the farm, in a pod until their training is done
    let away = t.away || [];
    if (away.length) {
      e.appendChild(section("בחווה — באימון", `${away.length}`));
      for (let s of away) {
        let o = SPECIES[s.species];
        if (!o) continue;
        let left = (s.training?.readyAt || 0) - Date.now(),
          l = el("div", `list-item tappable ${left <= 0 ? "ready" : ""}`);
        l.setAttribute("role", "button"), l.tabIndex = 0;
        l.innerHTML = `
          <div class="thumb" style="background:${oo(o.model.a)}"></div>
          <div class="grow">
            <b>${Ze(loc(o))} <span class="pill">${lvlLabel(s.level)}</span> <span class="stars">${starLabel(s.star || 1)}</span> → <span class="stars">${starLabel(s.training?.star || 2)}</span></b>
            <span>${left <= 0 ? "מוכן! לך לחווה להוציא אותו" : "בתא אימון בחווה — "}${left > 0 ? `<span class="mono" dir="ltr" data-countdown="${s.training.readyAt}">${formatClock(left)}</span>` : ""}</span>
          </div>
          <span class="pill">🧪 בחווה</span>`;
        let h = zoneMinimap(s.species);
        h && (l.querySelector(".thumb").innerHTML = `<img src="${h}" alt="" />`);
        l.onclick = () => this.hooks.openCard?.(s.uid), e.appendChild(l);
      }
      this.startCountdowns();
    }
  }
  panelBase(e) {
    let t = this.base;
    if (!t) {
      e.appendChild(emptyState("🏕", "טוען את הבסיס…", null, "loading"));
      return;
    }
    if (t.garden?.ready > 0) {
      let n = el("div", "list-item ready");
      n.innerHTML = `<div class="ico-lg">🌿</div><div class="grow"><b>הגינה מוכנה</b>
        <span>${ltr(t.garden.ready)} סיבים ממתינים</span></div>`;
      let s = el("button", "btn small primary", "אסוף");
      s.onclick = () => this.hooks.baseOpen?.(), n.appendChild(s), e.appendChild(n);
    }
    e.appendChild(section("תאי אימון", `${ltr(t.freeSlots)} פנויים`));
    for (let n of t.training) {
      let s = SPECIES[n.species],
        r = el("div", `list-item ${n.ready ? "ready" : ""}`),
        o = zoneMinimap(n.species);
      r.innerHTML = `
        <div class="thumb" style="background:${oo(s?.model.a ?? 8947848)}">${o ? `<img src="${o}" alt="" />` : ""}</div>
        <div class="grow">
          <b>${Ze(loc(s))} → <span class="stars">${starLabel(n.star)}</span></b>
          <span class="mono" dir="${n.ready ? "rtl" : "ltr"}" data-countdown="${n.readyAt}">${n.ready ? "מוכן!" : formatClock(n.remaining)}</span>
        </div>`;
      let a = el("button", `btn small ${n.ready ? "primary" : "danger"}`, n.ready ? "קבל" : "בטל");
      a.onclick = () => n.ready ? this.hooks.baseCollect?.(n.id) : this.hooks.baseCancel?.(n.id), r.appendChild(a), e.appendChild(r);
    }
    if (t.training.length || e.appendChild(emptyState("🛖", "אין יצור באימון", "פתח כרטיס יצור מתוך \"היצורים שלי\" והתחל שדרוג כוכב")), t.crafts.length) {
      e.appendChild(section("בייצור", `${ltr(t.crafts.length)}`));
      for (let n of t.crafts) {
        let s = el("div", "list-item");
        s.innerHTML = `<div class="grow"><b>${Ze(n.recipeHe || n.recipeName || "")}</b>
            <span>${itemList(n.output)}</span></div>
          <span class="pill mono" dir="ltr" data-countdown="${n.readyAt}">${formatClock(n.remaining)}</span>`, e.appendChild(s);
      }
    }
    for (let [n, s, r] of [["refinery", "מזקקה", "⚗️"], ["workshop", "סדנה", "🔨"]]) {
      let o = t.recipes?.[n] || [];
      if (!o.length) continue;
      let a = o.filter(d => d.affordable),
        l = this._showAll?.[n] || !a.length,
        c = l ? o : a,
        h = section(`${r} ${s}`, o.length > c.length ? rangeLabel(c.length, o.length, "/") : "");
      if (e.appendChild(h), o.length > a.length && a.length) {
        let d = el("button", "btn small ghost", "");
        d.innerHTML = l ? "הצג רק זמינים" : `הצג הכול ${ltr(`(${o.length})`)}`, d.onclick = () => {
          this._showAll = {
            ...(this._showAll || {}),
            [n]: !l
          }, this.renderPanel("base");
        }, e.appendChild(d);
      }
      for (let d of c) {
        let u = el("div", `list-item ${d.affordable ? "" : "lacking"}`);
        u.innerHTML = `<div class="grow"><b>${Ze(loc(d))}</b>
          <span>${itemList(d.output)} · ${ltr(`${d.mins} דק׳`)}</span></div>`;
        let f = el("button", `btn small ${d.affordable ? "primary" : ""}`, "ייצר");
        f.disabled = !d.affordable, f.onclick = () => this.hooks.baseCraft?.(d.id), u.appendChild(f), u.appendChild(costRow({
          gold: d.gold,
          items: d.inputs
        }, this.profile)), e.appendChild(u);
      }
    }
    e.appendChild(section("מבנים"));
    for (let n of t.buildings) {
      let s = el("div", "list-item"),
        r = n.effect ? Cb(n.effect) : "עדיין לא נבנה";
      if (s.innerHTML = `<div class="ico-lg">${n.icon}</div>
        <div class="grow"><b>${Ze(n.he)} <span class="pill">רמה ${rangeLabel(n.level, n.maxLevel, "/")}</span></b>
        <span>${Ze(n.descHe)}</span><span>${r}</span></div>`, n.next) {
        let o = el("button", `btn small ${n.next.affordable ? "primary" : ""}`, n.level ? "שדרג" : "בנה");
        o.disabled = !n.next.affordable, o.onclick = () => this.hooks.baseBuild?.(n.id), s.appendChild(o), s.appendChild(costRow(n.next, this.profile));
      } else s.appendChild(el("span", "pill good", "רמה מרבית"));
      e.appendChild(s);
    }
    this.startCountdowns();
  }
  panelCard(e) {
    let t = this.card;
    if (!t) {
      e.appendChild(emptyState("🃏", "טוען…", null, "loading"));
      return;
    }
    let n = SPECIES[t.species],
      s = ELEMENTS[t.types?.[0]] || {
        color: 8950438,
        icon: "◆",
        name: "—",
        he: "—"
      },
      r = el("div", "creature-card");
    r.style.setProperty("--elem", oo(s.color));
    let o = zoneMinimap(t.species);
    r.innerHTML = `
      <div class="art" style="background:linear-gradient(150deg, ${oo(n.model.a)}, ${oo(n.model.b)})">
        ${o ? `<img src="${o}" alt="" />` : ""}
        <span class="badge">${s.icon} ${Ze(loc(s))}</span>
        <span class="lvl">${lvlLabel(t.level)}</span>
      </div>
      <div class="name">${Ze(loc(n))}</div>
      <div class="stars big">${starLabel(t.star)}</div>
      <div class="power">כוח <b>${ltr(powerOf(t))}</b></div>`;
    let a = el("div", "statgrid"),
      l = {
        hp: "חיים",
        atk: "התקפה",
        def: "הגנה",
        spa: "מיוחדת",
        spd: "עמידות",
        spe: "מהירות"
      },
      c = Math.max(...Object.entries(t.stats).filter(([x]) => x !== "hp").map(([, x]) => x), 1);
    for (let [x, g] of Object.entries(t.stats)) {
      let m = el("div", "stat"),
        v = x === "hp" ? Math.min(100, g / 400 * 100) : g / c * 100;
      m.innerHTML = `<span>${l[x] || x}</span><i style="width:${v}%"></i><b class="mono">${ltr(g)}</b>`, a.appendChild(m);
    }
    r.appendChild(a);
    let h = el("div", "chips");
    for (let x of t.skills || []) {
      let g = MOVES[x];
      g && h.appendChild(el("span", "chip", `${ELEMENTS[g.type]?.icon || "◆"} ${Ze(loc(g))}`));
    }
    if (r.appendChild(h), e.appendChild(r), t.training) {
      let x = el("div", "list-item");
      x.innerHTML = `<div class="grow"><b>🧪 בתא אימון בחווה → <span class="stars">${starLabel(t.training.star)}</span></b>
        <span class="mono" dir="ltr" data-countdown="${t.training.readyAt}">${formatClock(t.training.readyAt - Date.now())}</span></div>`, e.appendChild(x), this.startCountdowns();
      return;
    }
    if (t.next?.maxed) {
      e.appendChild(emptyState("🌟", "הכוכב המרבי הושג", `<span class="stars">${starLabel(STARS.max)}</span>`));
      return;
    }
    e.appendChild(section("לשדרוג הכוכב הבא"));
    for (let [x, g] of Object.entries(t.next.items)) {
      let m = el("div", `list-item ${g.have >= g.need ? "" : "lacking"}`);
      m.innerHTML = `<div class="ico-lg">${ITEMS[x]?.icon || "📦"}</div>
        <div class="grow"><b>${Ze(loc(ITEMS[x]))}</b>
        <span class="mono">${ltr(`${g.have} / ${g.need}`)}</span></div>
        ${g.have >= g.need ? "<span class=\"pill good\">✓</span>" : ""}`, e.appendChild(m);
    }
    let d = (this.profile?.gold || 0) >= t.next.gold,
      u = el("div", `list-item ${d ? "" : "lacking"}`);
    u.innerHTML = `<div class="ico-lg">⛁</div>
      <div class="grow"><b>זהב</b>
      <span class="mono">${ltr(`${(this.profile?.gold || 0).toLocaleString("en-US")} / ${t.next.gold.toLocaleString("en-US")}`)}</span></div>
      ${d ? "<span class=\"pill good\">✓</span>" : ""}`, e.appendChild(u);
    let f = el("div", "empty plain");
    f.innerHTML = `היצור יעבור לתא אימון בחווה שלך לעוד ${ltr(`${t.next.hours} שעות`)} (ממשיך גם כשהמשחק סגור), ויחזור חזק יותר ועם מראה חדש`, e.appendChild(f);
    let p = el("button", "btn primary", t.next.ready ? "התחל אימון" : "חסרים חומרים");
    p.disabled = !t.next.ready, p.onclick = () => this.hooks.baseTrain?.(t.uid), e.appendChild(p);
  }
  startCountdowns() {
    clearInterval(this._cdTimer);
    let e = () => {
      let t = document.querySelectorAll("[data-countdown]");
      if (!t.length) {
        clearInterval(this._cdTimer), this._cdTimer = null;
        return;
      }
      let n = Date.now();
      for (let s of t) {
        let r = Number(s.dataset.countdown) - n;
        s.dir = r <= 0 ? "rtl" : "ltr", s.textContent = r <= 0 ? "מוכן!" : formatClock(r);
      }
    };
    this._cdTimer = setInterval(e, 1e3), e();
  }
  panelQuests(e) {
    let t = this.profile;
    if (!t) return;
    let n = (s, r) => {
      if (r.length) {
        e.appendChild(section(s, `${ltr(r.length)}`));
        for (let [o, a0] of r) {
          let l = QUESTS[o];
          if (!l) continue;
          let a = qLive(t, o, a0);
          let c = l.goal.count || 1,
            h = !!a.done,
            d = el("div", `list-item ${h && !a.claimed ? "ready" : ""}`);
          if (d.innerHTML = `<div class="grow">
            <b>${Ze(loc(l))}</b>
            <span>${l.chain === "npc" ? `${Ze(giverName(l.giver))}: ` : ""}${Ze(l.descHe || l.desc)}</span>
            <div class="bar xp" style="margin-top:6px"><i style="width:${Math.min(100, (a.progress || 0) / c * 100)}%"></i></div>
            <span class="mono">${rangeLabel(Math.min(a.progress || 0, c), c, " / ")}
              · ${ltr(`${l.reward.gold}⛁`)} · ${ltr(`${l.reward.xp} XP`)}</span>
          </div>`, h && !a.claimed && l.chain === "npc") d.appendChild(el("span", "pill good", l.giver === "noga" ? "חזור למרפאה" : `חזור אל ${giverName(l.giver)}`));
          else if (h && !a.claimed) {
            let u = el("button", "btn small primary", "קבל");
            u.onclick = () => this.hooks.claimQuest?.(o), d.appendChild(u);
          } else a.claimed && d.appendChild(el("span", "pill good", "הושלם"));
          e.appendChild(d);
        }
      }
    };
    n("משימות סיפור", Object.entries(t.quests.active || {})), n("משימות יומיות", Object.entries(t.quests.dailies || {})), !Object.keys(t.quests.active || {}).length && !Object.keys(t.quests.dailies || {}).length && e.appendChild(emptyState("📜", "אין משימות פעילות", "דבר עם דמויות באזור כדי לקבל משימה"));
  }
  /** Friends: add by name, answer requests, see who is on and where, and from
   *  each row whisper, call into your party, or open them for more. */
  panelFriends(e) {
    let t = el("div", "row"),
      n = textInput("שם הדמות של חבר"),
      s = el("button", "btn primary small", "הוסף");
    n.id = "friend-name", s.style.flex = "0 0 84px";
    let r = () => {
      let a = n.value.trim();
      a && (this.hooks.addFriend?.(a), n.value = "");
    };
    s.onclick = r, n.addEventListener("keydown", a => {
      a.key === "Enter" && r();
    }), t.append(n, s), e.appendChild(t);
    let o = this.friends.pending || [];
    o.length && e.appendChild(section("בקשות חברות", `${ltr(o.length)}`));
    for (let a of o) {
      let l = el("div", "list-item ready");
      l.innerHTML = `<div class="grow"><b>${Ze(a.name)}</b>
        <span>רוצה להיות חבר שלך · ${lvlLabel(a.level)}</span></div>`;
      let c = el("button", "btn small primary", "אשר"),
        h = el("button", "btn small ghost", "דחה");
      c.setAttribute("aria-label", `אשר את ${a.name}`), h.setAttribute("aria-label", `דחה את ${a.name}`), c.onclick = () => this.hooks.respondFriend?.(a.id, !0), h.onclick = () => this.hooks.respondFriend?.(a.id, !1), l.append(c, h), e.appendChild(l);
    }
    let list = this.friends.friends || [];
    if (!list.length) {
      e.appendChild(emptyState("👥", "עוד אין חברים", "הוסף לפי שם הדמות, או עמוד ליד שחקן ולחץ על כפתור הפעולה"));
    } else {
      let on = list.filter(a => a.online).length;
      e.appendChild(section("חברים", `${ltr(`${on}/${list.length}`)} מחוברים`));
      let mineParty = new Set((this.party?.members || []).map(m => m.id));
      for (let a of list) {
        let l = el("div", "list-item friend"),
          c = ZONES[a.zone];
        l.innerHTML = `<div class="dot ${a.online ? "on" : ""}"></div>
          <div class="grow"><b>${Ze(a.name)}</b>
          <span>${lvlLabel(a.level)} · ${a.online ? `${Ze(loc(c || {})) || "—"} · ${bp(a.status)}` : "לא מחובר"}${mineParty.has(a.id) ? " · ⚔ בקבוצה שלך" : ""}</span></div>`;
        if (a.online && !mineParty.has(a.id)) {
          let d = el("button", "btn small", "לקבוצה");
          d.setAttribute("aria-label", `הזמן את ${a.name} לקבוצה`), d.onclick = () => this.hooks.partyInvite?.(a.id), l.appendChild(d);
        }
        if (a.online) {
          let h = el("button", "btn small ghost icon-only", "💬");
          h.setAttribute("aria-label", `לחש אל ${a.name}`), h.onclick = () => {
            this.chatChannel = "whisper", this.whisperTo = a.name, this.whisperToId = a.id, this.openPanel("chat");
          }, l.appendChild(h);
        }
        let m = el("button", "btn small ghost icon-only", "⋯");
        m.setAttribute("aria-label", `עוד על ${a.name}`), m.onclick = () => this.showPlayer({ id: a.id, name: a.name, level: a.level, friend: !0, online: a.online, zone: a.zone }), l.appendChild(m), e.appendChild(l);
      }
    }
    let blocked = this.friends.blocked || [];
    if (blocked.length) {
      e.appendChild(section("חסומים", `${ltr(blocked.length)}`));
      for (let a of blocked) {
        let l = el("div", "list-item");
        l.innerHTML = `<div class="grow"><b>${Ze(a.name)}</b><span>לא יכול/ה ללחוש לך, להזמין או לבקש חברות</span></div>`;
        let u = el("button", "btn small ghost", "בטל חסימה");
        u.onclick = () => this.hooks.block?.(a.id, !1), l.appendChild(u), e.appendChild(l);
      }
    }
  }
  /** The party: who, where, how they are; leader can promote and remove. */
  panelParty(e) {
    let p = this.party;
    if (!p) {
      e.appendChild(emptyState("⚔", "אינך בקבוצה", "הזמן חבר מרשימת החברים, או עמוד ליד שחקן ולחץ על כפתור הפעולה. בקבוצה נלחמים יחד ביצורים, ובזוגות נגד זוג אחר."));
      let n = el("button", "btn", "פתח רשימת חברים");
      n.onclick = () => this.openPanel("friends"), e.appendChild(n);
      return;
    }
    let me = this.profile?.id, lead = p.leaderId === me;
    e.appendChild(section("הקבוצה", rangeLabel(p.members.length, p.max || 4, "/")));
    for (let n of p.members) {
      let s = el("div", "list-item member"),
        z = ZONES[n.zone],
        pet = SPECIES[n.petSpecies];
      s.innerHTML = `<div class="dot ${n.online ? "on" : ""}"></div>
        <div class="grow"><b>${Ze(n.name)} ${n.id === p.leaderId ? "👑" : ""} ${n.id === me ? "<span class=\"pill\">אתה</span>" : ""}</b>
        <span>${lvlLabel(n.level)} · ${n.online ? `${Ze(loc(z || {})) || "—"} · ${bp(n.status)}` : "לא מחובר"}${pet ? ` · ${Ze(loc(pet))}` : ""}</span>
        <div class="bar hp" style="margin-top:4px"><i style="width:${Math.round((n.hp ?? 1) * 100)}%"></i></div></div>`;
      if (lead && n.id !== me) {
        let k = el("button", "btn small ghost icon-only", "👑");
        k.setAttribute("aria-label", `העבר הנהגה ל${n.name}`), k.title = "העבר הנהגה", k.onclick = () => this.hooks.partyPromote?.(n.id);
        let x = el("button", "btn small danger icon-only", "✕");
        x.setAttribute("aria-label", `הוצא את ${n.name} מהקבוצה`), x.title = "הוצא מהקבוצה", x.onclick = () => this.hooks.partyKick?.(n.id), s.append(k, x);
      }
      e.appendChild(s);
    }
    let tip = el("div", "empty plain");
    tip.innerHTML = p.members.length === 2 ? "⚔ זוג: עמדו ליד זוג אחר ולחצו על כפתור הפעולה — <b>קרב זוגות</b>. ונלחמים יחד ביצורים: מי שקרוב מקבל הזמנה להצטרף." : "כשמישהו מהקבוצה נלחם ביצור, מי שקרוב אליו מקבל הזמנה להצטרף לקרב.", e.appendChild(tip);
    let row = el("div", "row"),
      inv = el("button", "btn", "הזמן חבר"),
      t = el("button", "btn danger", "עזוב קבוצה");
    inv.onclick = () => this.openPanel("friends"), t.onclick = () => this.hooks.partyLeave?.(), row.append(inv, t), e.appendChild(row);
  }
  /** Someone you are standing beside (or picked from a list): what you can do
   *  with them. */
  showPlayer(p) {
    this.playerCard = p, this.openPanel("player");
  }
  panelPlayer(e) {
    let p = this.playerCard;
    if (!p) return e.appendChild(emptyState("🙂", "אין שחקן נבחר"));
    let friend = (this.friends.friends || []).some(f => f.id === p.id),
      inMine = (this.party?.members || []).some(m => m.id === p.id),
      myPair = this.party?.members?.length === 2,
      card = el("div", "list-item player-head");
    card.innerHTML = `<div class="dot ${p.online === !1 ? "" : "on"}"></div><div class="grow"><b>${Ze(p.name)}</b><span>${lvlLabel(p.level || 1)}${friend ? " · 👥 חבר" : ""}${inMine ? " · ⚔ בקבוצה שלך" : p.partyId ? " · בקבוצה" : ""}</span></div>`, e.appendChild(card);
    let grid = el("div", "grid2 player-actions"),
      add = (label, fn, cls = "btn", off = !1, why = "") => {
        let b = el("button", cls, label);
        b.disabled = off, why && (b.title = why), b.onclick = () => {
          fn(), this.closePanel();
        }, grid.appendChild(b);
      };
    let here = p.near !== !1 && p.online !== !1;
    friend || add("👥 הוסף לחברים", () => this.hooks.addFriendId?.(p.id, p.name));
    inMine || add("⚔ הזמן לקבוצה", () => this.hooks.partyInvite?.(p.id), "btn", p.online === !1);
    add("🗡 דו‑קרב 1 נגד 1", () => this.hooks.duel?.(p.id, !1), "btn primary", !here, "צריך לעמוד באותו אזור");
    add("⚔ קרב זוגות 2 נגד 2", () => this.hooks.duel?.(p.id, !0), "btn primary", !here || !myPair || !p.partyId || inMine, "צריך שבקבוצה שלך יהיו 2, ושהוא בזוג אחר");
    p.online !== !1 && add("💬 לחישה", () => {
      this.chatChannel = "whisper", this.whisperTo = p.name, this.whisperToId = p.id, setTimeout(() => this.openPanel("chat"), 0);
    });
    friend && add("➖ הסר מחברים", () => this.hooks.removeFriend?.(p.id), "btn ghost");
    add("🚫 חסום", () => this.hooks.block?.(p.id, !0), "btn danger");
    add("⚑ דווח", () => this.hooks.report?.(p.id, p.name), "btn ghost");
    e.appendChild(grid);
  }
  /**
   * Something someone asked you, with a yes and a no, at the top of the
   * screen until you answer or it runs out: a friend request, a party
   * invitation, a challenge, a call to join a fight. Several stack.
   */
  offer({ key, icon = "", title, sub = "", until = Date.now() + 3e4, yes = "אשר", no = "דחה", onYes, onNo }) {
    let host = $("#offers");
    host || (host = el("div"), host.id = "offers", ($("#app") || document.body).appendChild(host));
    key && host.querySelector(`[data-key="${key}"]`)?.remove();
    let c = el("div", "offer");
    key && (c.dataset.key = key), c.setAttribute("role", "alertdialog"), c.innerHTML = `<div class="o-ico">${icon}</div><div class="o-txt"><b></b><span></span></div><div class="o-btns"></div><i class="o-time"></i>`, c.querySelector("b").textContent = title, c.querySelector(".o-txt span").textContent = sub;
    let done = () => {
        c.remove(), clearInterval(tick);
      },
      y = el("button", "btn small primary", yes),
      n = el("button", "btn small ghost", no);
    y.onclick = () => (done(), onYes?.()), n.onclick = () => (done(), onNo?.()), c.querySelector(".o-btns").append(y, n);
    let total = Math.max(1e3, until - Date.now()),
      bar = c.querySelector(".o-time"),
      tick = setInterval(() => {
        let left = until - Date.now();
        left <= 0 ? done() : bar.style.width = `${left / total * 100}%`;
      }, 250);
    for (host.prepend(c); host.childElementCount > 3;) host.lastElementChild.remove();
    audio.sfx("chat");
    return done;
  }
  dropOffer(key) {
    $("#offers")?.querySelector(`[data-key="${key}"]`)?.remove();
  }
  /** Your party on the world screen: a line each, health under the name. */
  renderPartyStrip() {
    let host = $("#party-strip");
    if (!host) {
      let v = document.querySelector("#hud .vitals");
      if (!v) return;
      host = el("div"), host.id = "party-strip", host.setAttribute("role", "button"), host.setAttribute("aria-label", "הקבוצה"), host.onclick = () => this.openPanel("party"), v.after(host);
    }
    let p = this.party,
      me = this.profile?.id,
      others = (p?.members || []).filter(m => m.id !== me);
    if (!this.social || !others.length) {
      host.classList.add("hidden");
      return;
    }
    host.classList.remove("hidden"), host.innerHTML = others.map(m => `<div class="pm ${m.online ? "" : "off"}"><span class="nm">${m.id === p.leaderId ? "👑 " : ""}${Ze(m.name)}</span><span class="st">${m.status === "battle" ? "⚔" : m.status === "dungeon" ? "🕳" : m.zone && m.zone !== this.zone?.id ? "↗" : ""}</span><div class="bar hp"><i style="width:${Math.round((m.hp ?? 1) * 100)}%"></i></div></div>`).join("");
  }
  panelGuild(e) {
    let t = this.guild;
    if (!t) {
      let h = el("div", "empty");
      h.innerHTML = `<span class="ico">🛡</span>אינך חבר בגילדה
        <span class="sub">הקמת גילדה עולה ${ltr(`${GUILD.createCost.toLocaleString("en-US")}⛁`)}</span>`, e.appendChild(h), e.appendChild(section("הקמת גילדה"));
      let d = textInput("שם הגילדה"),
        u = textInput("תג (עד 4 תווים)");
      u.maxLength = 4;
      let f = el("button", "btn primary", "הקם גילדה");
      f.onclick = () => this.hooks.guildCreate?.(d.value.trim(), u.value.trim()), e.append(d, u, f), e.appendChild(section("הצטרפות לגילדה קיימת"));
      let p = el("button", "btn", "הצג גילדות קיימות"),
        x = el("div", "stack");
      x.style.cssText = "display:flex;flex-direction:column;gap:var(--s2)", p.onclick = async () => {
        p.disabled = !0, x.innerHTML = "", x.appendChild(emptyState("🛡", "טוען…", null, "loading"));
        let g = (await this.hooks.guildList?.()) || [];
        if (this.openPanelId === "guild") {
          if (p.disabled = !1, x.innerHTML = "", !g.length) {
            x.appendChild(emptyState("🛡", "אין גילדות עדיין", "הקם את הראשונה"));
            return;
          }
          for (let m of g) {
            let v = el("div", "list-item");
            v.innerHTML = `<div class="grow"><b>${ltr(`[${Ze(m.tag)}]`)} ${Ze(m.name)}</b>
            <span>${ltr(m.members)} חברים · באפים רמה ${ltr(m.buffLevel)}</span></div>`;
            let E = el("button", "btn small primary", "הצטרף");
            E.onclick = () => this.hooks.guildJoin?.(m.id), v.appendChild(E), x.appendChild(v);
          }
        }
      }, e.append(p, x);
      return;
    }
    let n = el("div", "list-item");
    n.innerHTML = `<div class="grow"><b>${ltr(`[${Ze(t.tag)}]`)} ${Ze(t.name)}</b>
      <span>${ltr(t.members.length)} חברים · תרומה ${ltr(`${t.contribution.toLocaleString("en-US")}⛁`)} · באפים רמה ${ltr(t.buffLevel)}</span></div>`, e.appendChild(n);
    let s = GUILD.buffs.filter(h => h.level <= t.buffLevel).map(h => `${Ze(loc(h))} ${ltr(`(${Object.entries(h.bonus).map(([d, u]) => `${d} +${Math.round(u * 100)}%`).join(", ")})`)}`).join(" · "),
      r = el("div", "list-item");
    if (r.innerHTML = `<div class="grow"><b>באפים פעילים</b><span>${s || "—"}</span></div>`, e.appendChild(r), t.territories?.length) {
      let h = el("div", "list-item");
      h.innerHTML = `<div class="grow"><b>שטחים בשליטה</b>
        <span>${t.territories.map(d => Ze(loc(ZONES[d]))).join(" · ")}</span></div>`, e.appendChild(h);
    }
    e.appendChild(section("תרומה"));
    let o = el("div", "row"),
      a = textInput("סכום לתרומה");
    a.type = "number", a.inputMode = "numeric", a.min = "1", a.value = "1000", a.dir = "ltr";
    let l = el("button", "btn primary small", "תרום");
    l.style.flex = "0 0 90px", l.onclick = () => this.hooks.guildContribute?.(Number(a.value) || 0), o.append(a, l), e.appendChild(o), e.appendChild(section("בית הגילדה"));
    for (let h of GUILD.houseUpgrades) {
      let d = t.house.includes(h.id),
        u = el("div", `list-item ${d ? "ready" : ""}`);
      if (u.innerHTML = `<div class="grow"><b>${Ze(loc(h))}</b>
        <span>${Ze(h.effect)} · ${ltr(`${h.cost.toLocaleString("en-US")}⛁`)}</span></div>`, d) u.appendChild(el("span", "pill good", "נרכש"));else if (t.masterId === this.profile?.id) {
        let f = el("button", "btn small primary", "שדרג");
        f.disabled = t.contribution < h.cost, f.onclick = () => this.hooks.guildUpgrade?.(h.id), u.appendChild(f);
      }
      e.appendChild(u);
    }
    e.appendChild(section("חברים", `${ltr(t.members.length)}`));
    for (let h of t.members) {
      let d = el("div", "list-item");
      d.innerHTML = `<div class="dot ${h.online ? "on" : ""}"></div>
        <div class="grow"><b>${Ze(h.name)} ${h.rank === "master" ? "👑" : h.rank === "officer" ? "⭐" : ""}</b>
        <span>${lvlLabel(h.level)} · תרומה ${ltr(h.contribution.toLocaleString("en-US"))}</span></div>`, e.appendChild(d);
    }
    let c = el("button", "btn danger", "עזוב גילדה");
    c.style.marginTop = "var(--s3)", c.onclick = () => this.hooks.guildLeave?.(), e.appendChild(c);
  }
  panelClinic(e) {
    let t = this.profile || {},
      n = t.gold || 0,
      s = t.team || [],
      r = s.filter(p => p && p.hp < p.maxHp).length,
      o = s.filter(p => p && p.hp <= 0).length,
      a = (t.trainerHp ?? 1) < (t.trainerMaxHp ?? 1),
      l = Math.max(40, Math.round(s.reduce((p, x) => p + (x?.level || 1), 0) * 14 + o * 120)),
      c = r > 0 || o > 0 || a;
    // The nurse's own errands, at her counter: she has no street to stand in.
    let v = giverView(t, "noga"),
      eq = v.ready || v.offer || v.active;
    if (eq) {
      let m = v.ready ? "ready" : v.offer ? "offer" : "active",
        box = el("div", `list-item errand-row ${m === "ready" ? "ready" : ""}`),
        pr = qLive(t, eq.id, t.quests?.active?.[eq.id] || { progress: 0 });
      box.innerHTML = `<div class="ico-lg">${m === "ready" ? "🎁" : "✚"}</div>
        <div class="grow"><b>${Ze(loc(eq))}</b><span>האחות נוגה: ${Ze(eq.descHe)}</span>
        <span>${m === "active" ? rangeLabel(Math.min(pr.progress || 0, eq.goal.count || 1), eq.goal.count || 1, " / ") + " · " : ""}פרס: ${this.rewardText(eq.reward)}</span></div>`;
      if (m !== "active") {
        let b = el("button", "btn small primary", m === "ready" ? "קבל פרס" : "קבל");
        b.onclick = () => m === "ready" ? this.hooks.claimQuest?.(eq.id) : this.hooks.acceptQuest?.(eq.id), box.appendChild(b);
      }
      e.appendChild(section("משימה מהאחות נוגה")), e.appendChild(box);
    }
    e.appendChild(section("טיפול", ltr(`${n.toLocaleString("en-US")}⛁`)));
    let h = el("div", "list-item");
    h.innerHTML = `<div class="ico-lg">🩺</div>
      <div class="grow"><b>טיפול מלא</b><span>${c ? `${o ? `${ltr(String(o))} מחוסרי הכרה · ` : ""}${r ? `${ltr(String(r))} פצועים` : ""}${a ? `${r ? " · " : ""}גם אתה` : ""}` : "הצוות שלך במצב מצוין"}</span></div>
      <div class="mono pill">${ltr(`${l}⛁`)}</div>`;
    let d = el("button", "btn small primary", "טפל");
    d.disabled = !c || n < l, d.onclick = () => this.hooks.clinicHeal?.(l), h.appendChild(d), e.appendChild(h);
    let u = new Set(["heal", "revive", "trainerHeal", "stamina"]),
      f = Object.values(ITEMS).filter(p => p.price && u.has(p.kind));
    e.appendChild(section("בית מרקחת"));
    for (let p of f) {
      let x = el("div", `list-item ${n >= p.price ? "" : "lacking"}`),
        g = p.kind === "trainerHeal" ? "עבורך" : "ליצורים";
      x.innerHTML = `<div class="ico-lg">${p.icon}</div>
        <div class="grow"><b>${Ze(loc(p))}</b><span>${g} · ${itemEffect(p)}</span></div>
        <div class="mono pill">${ltr(`${p.price}⛁`)}</div>`;
      let m = el("button", "btn small", "קנה");
      m.disabled = n < p.price, m.setAttribute("aria-label", `קנה ${loc(p)}`), m.onclick = () => this.hooks.buy?.(p.id, 1), x.appendChild(m), e.appendChild(x);
    }
  }
  panelShop(e) {
    let t = this.profile?.gold || 0,
      n = Object.values(ITEMS).filter(s => s.price);
    if (!n.length) {
      e.appendChild(emptyState("🏪", "החנות ריקה"));
      return;
    }
    e.appendChild(section("למכירה", ltr(`${t.toLocaleString("en-US")}⛁`)));
    for (let s of n) {
      let r = el("div", `list-item ${t >= s.price ? "" : "lacking"}`);
      r.innerHTML = `<div class="ico-lg">${s.icon}</div>
        <div class="grow"><b>${Ze(loc(s))}</b><span>${itemEffect(s)}</span></div>
        <div class="mono pill">${ltr(`${s.price}⛁`)}</div>`;
      let o = el("button", "btn small primary", "קנה");
      o.disabled = t < s.price, o.setAttribute("aria-label", `קנה ${loc(s)}`), o.onclick = () => this.hooks.buy?.(s.id, 1), r.appendChild(o), e.appendChild(r);
    }
  }
  async panelLeaders(e) {
    e.appendChild(emptyState("🏆", "טוען…", null, "loading"));
    let t = (await this.hooks.leaderboard?.()) || [];
    if (!(this.openPanelId !== "leaders" || !e.isConnected)) {
      if (e.innerHTML = "", !t.length) {
        e.appendChild(emptyState("🏆", "אין נתונים עדיין"));
        return;
      }
      for (let n of t) {
        let s = el("div", "list-item");
        s.innerHTML = `<div class="mono" style="width:26px;text-align:center;opacity:.7">${ltr(n.rank)}</div>
        <div class="dot ${n.online ? "on" : ""}"></div>
        <div class="grow"><b>${Ze(n.name)}</b>
        <span>${lvlLabel(n.level)} · ${ltr(n.stats?.captures || 0)} לכידות · ${ltr(n.stats?.dungeonsCleared || 0)} מבוכים</span></div>`, e.appendChild(s);
      }
    }
  }
  panelChat(e) {
    let t = el("div", "log");
    for (let l of this.chatLog.slice(-120)) t.appendChild(el("div", `ch-${l.ch}`, this.chatLine(l)));
    e.appendChild(t);
    let n = el("div", "tabs"),
      channels = this.social ? ["zone", "world", "party", "whisper"] : ["zone"];
    // One channel needs no tabs; and a channel it no longer offers is not the
    // one it sends on.
    channels.includes(this.chatChannel) || (this.chatChannel = "zone"), channels.length < 2 && n.classList.add("hidden");
    for (let l of channels) {
      let c = el("button", this.chatChannel === l ? "on" : "", {
        zone: "אזור",
        world: "עולמי",
        party: "קבוצה",
        guild: "גילדה",
        whisper: "לחישה"
      }[l]);
      c.setAttribute("aria-pressed", String(this.chatChannel === l)), c.onclick = () => {
        this.chatChannel = l, this.renderPanel("chat");
      }, n.appendChild(c);
    }
    this.panel.insertBefore(n, e);
    let s = el("div", "composer"),
      r = el("input");
    r.enterKeyHint = "send", r.maxLength = 160, r.value = this.chatDraft || "", r.placeholder = this.chatChannel === "whisper" ? `ללחוש אל ${this.whisperTo || "…"}` : "הודעה…";
    let o = el("button", "btn primary small", "שלח"),
      a = () => {
        let l = r.value.trim();
        if (l) {
          if (this.chatChannel === "whisper" && !this.whisperTo) {
            this.toast("בחר תחילה חבר לשלוח לו לחישה", "bad");
            return;
          }
          this.hooks.chat?.({
            ch: this.chatChannel,
            text: l,
            to: this.whisperTo,
            toId: this.whisperToId
          }), r.value = "", this.chatDraft = "";
        }
      };
    o.onclick = a, r.addEventListener("input", () => {
      this.chatDraft = r.value;
    }), r.addEventListener("keydown", l => {
      l.key === "Enter" && a();
    }), s.append(r, o), this.panel.appendChild(s), requestAnimationFrame(() => {
      e.scrollTop = e.scrollHeight;
    });
  }
  renderWorldSkills(e) {
    let t = e?.skills || [];
    document.querySelectorAll(".skill-btn").forEach((n, s) => {
      let r = t[s],
        o = MOVES[r];
      n.dataset.skill = r || "", n.disabled = !o, n.classList.toggle("hidden", !o), n.querySelector(".ico").textContent = o && ELEMENTS[o.type]?.icon || "✦", n.title = o ? loc(o) : "", n.setAttribute("aria-label", o ? loc(o) : `כישור ${s + 1}`);
    });
  }
  setPrompt(e) {
    let t = $("#prompt");
    t.classList.toggle("hidden", !e), e && (t.textContent = e);
  }
  /** The weather chip. Touched every frame, so it writes only on a change —
   *  setting textContent to the string it already holds still costs a layout
   *  invalidation on some engines, and this sits over a 3D canvas. */
  setSky(e) {
    if (!e || this._skyId === e.id && this._seasonId === e.season?.id) return;
    this._skyId = e.id, this._seasonId = e.season?.id;
    let t = $("#v-sky"),
      n = $("#v-season");
    t && (t.textContent = SKY_ICON[e.id] + " " + e.he), n && (n.textContent = e.season?.he || "");
  }

  setBoss(e) {
    let t = $("#boss-banner");
    if (!e?.active) {
      t.classList.add("hidden");
      return;
    }
    t.classList.remove("hidden");
    let n = SPECIES[e.species],
      s = Math.max(0, Math.round((e.endsAt - Date.now()) / 1e3)),
      r = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    $("#boss-title").innerHTML = `${Ze(loc(n))} · ${lvlLabel(e.level)} · ${ltr(r)}`, $("#boss-hp").style.width = `${e.hp / Math.max(1, e.maxHp) * 100}%`;
    let o = [];
    e.top?.forEach(a => o.push(`${Ze(a.name)} ${ltr(a.damage.toLocaleString("en-US"))}`)), $("#boss-lb").innerHTML = o.length ? `מובילים: ${o.join(" · ")}` : "תקפו יחד — הנזק נצבר לטבלה";
  }
  renderBattle(e, t, n) {
    let s = $("#combat-bars"),
      ss = $("#combat-bars-self") || s,
      rows = this._rows || (this._rows = new Map()),
      keep = new Set(),
      // Rows live across updates, so a bar that changes width animates — and
      // the pale "ghost" behind it drains after it, the way a hit reads.
      row = (key, cls, parent) => {
        let f = rows.get(key);
        f || (f = el("div", cls), f.innerHTML = `<div class="name"><b></b><span class="mono"></span></div><div class="bar hp"><b class="ghost"></b><i></i></div><div class="bar stam" style="margin-top:3px"><i></i></div><div class="fx"></div>`, rows.set(key, f));
        return f.className = cls, keep.add(key), parent.appendChild(f), f;
      },
      fill = (f, name, meta, p, stam, fx) => {
        f.querySelector(".name b").innerHTML = name, f.querySelector(".name .mono").innerHTML = meta;
        let hp = f.querySelector(".bar.hp"),
          st = f.querySelector(".bar.stam");
        hp.classList.toggle("low", p < 30), hp.querySelector("i").style.width = `${p}%`, hp.querySelector(".ghost").style.width = `${p}%`, st.style.display = stam == null ? "none" : "", stam != null && (st.querySelector("i").style.width = `${stam}%`), f.querySelector(".fx").innerHTML = fx;
      };
    let r = e.find(d => d.id === t),
      o = e.filter(d => d.side !== r?.side),
      a = e.filter(d => d.side === r?.side),
      l = d => !d.benched && d.kind !== "trainer",
      me = this.battleMe || r?.ownerId,
      // your own trainer: in a fight with other players there are several
      c = a.find(d => d.kind === "trainer" && (!me || !d.ownerId || d.ownerId === me)),
      h = c?.benched && a.some(d => d.kind === "creature" && d.hp > 0 && (!me || d.ownerId === me)),
      foes = o.filter(l),
      // the foe your moves go at: the one you tapped, while it stands
      aim = foes.find(d => d.id === this.battleTarget && d.hp > 0) || null;
    aim || (this.battleTarget = null);
    for (let d of [...foes, ...a.filter(l)]) {
      let u = SPECIES[d.species],
        foe = d.side !== r?.side,
        owner = d.ownerId && d.ownerId !== me && this.battlePlayers?.[d.ownerId],
        f = row(d.id, `combat-row ${foe ? "foe" : ""} ${foe && foes.length > 1 && aim?.id === d.id ? "aimed" : ""} ${!foe && owner ? "ally" : ""}`, foe ? s : ss);
      fill(f, `${owner ? `<small>${Ze(owner)} · </small>` : ""}${Ze(loc(u))}${d.kind === "boss" ? " ☠" : ""}${foe && foes.length > 1 && aim?.id === d.id ? " 🎯" : ""}`, `${lvlLabel(d.level)} · ${rangeLabel(d.hp, d.maxHp, "/")}`, d.hp / Math.max(1, d.maxHp) * 100, d.id === t ? d.stamina / PROGRESSION.staminaMax * 100 : null, (d.effects || []).map(x => `<span class="e">${Pb(x.kind)}</span>`).join(""));
      // two foes: tap one to aim at it
      f.onclick = foe && foes.length > 1 ? () => {
        this.battleTarget = d.id, this.hooks.aim?.(d.id);
      } : null;
    }
    c && fill(row(`trainer:${c.id}`, `combat-row self ${h ? "shielded" : "exposed"}`, ss), Ze(c.name), rangeLabel(c.hp, c.maxHp, "/"), c.hp / Math.max(1, c.maxHp) * 100, null, `<span class="e">${h ? "🛡 היצורים שלך מגנים עליך" : "⚠ אתה בחזית"}</span>`);
    for (let [k, f] of rows) keep.has(k) || (f.remove(), rows.delete(k));
    (!this._battleSkillsFor || this._battleSkillsFor !== t) && (this._battleSkillsFor = t, this._effFor = null, this.buildBattleButtons(r, n)), this.battleYou = r, this.battleFoe = aim || foes[0] || null, this.renderTeamBar(r), this.markEffectiveness(this.battleFoe);
  }
  /** ▲ on a move that hits this foe hard, ▼ on one it shrugs off. Ten
   *  elements is more than anyone keeps in their head mid-fight, and the
   *  "super effective" banner only says so after the move is spent. Redrawn
   *  only when the foe (or its species) changes. */
  markEffectiveness(foe) {
    let types = foe && SPECIES[foe.species]?.types,
      key = foe ? `${foe.id}:${foe.species}:${this._battleSkillsFor}` : "";
    if (this._effFor === key) return;
    this._effFor = key;
    for (let b of document.querySelectorAll("#battle-skills .sk")) {
      let m = MOVES[b.dataset.skill],
        e = b.querySelector(".eff"),
        mult = types && m?.type && m.kind !== "status" ? typeMultiplier(m.type, types) : 1;
      if (!e) continue;
      e.className = `eff ${mult > 1 ? "up" : mult < 1 ? mult === 0 ? "none" : "down" : ""}`, e.textContent = mult > 1 ? "▲" : mult === 0 ? "✕" : mult < 1 ? "▼" : "";
      let name = loc(m) || b.dataset.skill;
      b.setAttribute("aria-label", mult > 1 ? `${name} — יעיל במיוחד` : mult === 0 ? `${name} — לא משפיע` : mult < 1 ? `${name} — לא יעיל` : name);
    }
  }
  buildBattleButtons(e, t) {
    let n = $("#battle-skills");
    n.innerHTML = "";
    for (let o of e?.skills || []) {
      let a = MOVES[o],
        l = el("button", "sk");
      l.dataset.skill = o, l.setAttribute("aria-label", loc(a) || o), l.innerHTML = `<span class="cd" style="transform:scaleY(0)"></span>
        <span class="eff" aria-hidden="true"></span>
        <span class="ico">${ELEMENTS[a?.type]?.icon || "✦"}</span>
        <span>${Ze(loc(a))}</span>
        <span class="mono" style="opacity:.7">${a?.power ? ltr(a.power) : ""}</span>`, l.onclick = () => this.hooks.useSkill?.(o), n.appendChild(l);
    }
    let s = $("#battle-trainer");
    s.innerHTML = "";
    let r = [["strike", "👊"], ["sphere", "🔵"], ["potion", "🧪"], ["rally", "📣"], ["flee", "🏃"]];
    for (let [o, a] of r) {
      let l = ACTIONS[o],
        c = el("button", "tb");
      o === "sphere" && c.classList.add("sphere"), c.dataset.trainer = o, c.setAttribute("aria-label", loc(l) || o), c.innerHTML = `<span class="ico">${a}</span>${Ze(loc(l))}` + (o === "sphere" ? "<span class=\"odds mono\" dir=\"ltr\"></span>" : ""), c.onclick = () => this.hooks.trainerAction?.(o), s.appendChild(c);
    }
  }
  renderTeamBar(e, again = !1) {
    let t = $("#battle-team"),
      n = this.battleTeam || [];
    if (!t) return;
    again && (t.dataset.sig = "");
    let s = n.map(r => `${r.uid}:${r.hp}:${r.benched ? "b" : "f"}`).join("|");
    if (t.dataset.sig !== s && (t.dataset.sig = s, t.innerHTML = "", !(n.length < 2))) for (let r of n) {
      let o = SPECIES[r.species],
        a = r.benched === !1,
        l = r.hp <= 0,
        c = el("button", `tm ${a ? "active" : ""} ${l ? "down" : ""}`);
      let face = this.faces?.[r.species];
      c.innerHTML = `${face ? `<img class="face" src="${face}" alt="">` : `<span class="orb" style="background:${oo(o.model.a)}"></span>`}
        <span>${Ze(loc(o))} <b class="mono" dir="ltr">${r.level}</b></span>
        <span class="hpwrap"><span class="bar hp" style="height:5px"><i style="width:${r.hp / Math.max(1, r.maxHp) * 100}%"></i></span></span>`, c.disabled = l || a, c.setAttribute("aria-label", `${loc(o)} ${l ? "מעולף" : a ? "בזירה" : "החלף"}`), c.onclick = () => this.hooks.swapCreature?.(r.uid), t.appendChild(c);
    }
  }
  tickCooldowns(e, t, n = !1) {
    for (let r of document.querySelectorAll(".sk, .skill-btn")) {
      let o = r.dataset.skill;
      if (!o) continue;
      let a = e[o] || 0,
        l = MOVES[o],
        c = a > t && l ? Math.min(1, (a - t) / l.cd) : 0,
        h = r.querySelector(".cd");
      h && (h.style.transform = `scaleY(${c})`), r.disabled = c > 0 || n && r.classList.contains("sk");
    }
    let s = document.querySelector(".tb.sphere");
    if (s) {
      let r = this.battleFoe && this.battleFoe.hp > 0 ? this.battleFoe : null,
        o = r ? Math.round(captureChance(r, this.bestSphere || "sphere_basic") * 100) : 0,
        a = s.querySelector(".odds");
      a && (a.textContent = r ? `${o}%` : ""), s.classList.toggle("good", o >= 60), s.classList.toggle("slim", !!r && o < 20);
    }
    for (let r of document.querySelectorAll(".tb")) {
      let o = r.dataset.trainer,
        a = e[`trainer:${o}`] || 0,
        l = ACTIONS[o],
        c = a > t;
      r.disabled = c || n, l && c ? r.style.filter = "grayscale(.6)" : r.style.filter = "";
    }
  }
  battleBanner(e, t = 1400) {
    let n = $("#battle-banner");
    n.textContent = e, n.style.opacity = "1", clearTimeout(this._bannerTimer), this._bannerTimer = setTimeout(() => {
      n.style.opacity = "0";
    }, t);
  }
  floatDamage(e, t, n = "") {
    if (!e?.visible) return;
    let s = el("div", `dmg ${n}`);
    s.textContent = t, s.style.left = `${e.x}px`, s.style.top = `${e.y}px`, $("#overlay").appendChild(s), setTimeout(() => s.remove(), 1200);
  }
  syncNameplates(e) {
    let t = $("#overlay");
    this._plates = this._plates || new Map();
    let n = new Set();
    for (let s of e) {
      n.add(s.key);
      let r = this._plates.get(s.key);
      r || (r = el("div", `nameplate ${s.kind}`), t.appendChild(r), this._plates.set(s.key, r)), r.className = `nameplate ${s.kind}`, r.style.left = `${s.x}px`, r.style.top = `${s.y}px`, r.style.display = s.visible ? "block" : "none", (r._label !== s.label || r._hp !== s.hp) && (r._label = s.label, r._hp = s.hp, r.innerHTML = `${s.label}${s.hp !== void 0 ? `<div class="hpbar"><i style="width:${Math.round(s.hp * 100)}%"></i></div>` : ""}`);
    }
    for (let [s, r] of this._plates) n.has(s) || (r.remove(), this._plates.delete(s));
  }
};

/** A quest's progress as it stands: counted from events, or read from what you hold. */
function qLive(profile, id, st) {
  let q = QUESTS[id];
  if (!q || q.chain !== "npc") return st;
  let held = heldProgress(profile, q);
  return held == null ? st : { ...st, progress: held, done: questState(profile, q) === "ready" };
}

function giverName(g) {
  return NPCS[g]?.he || GIVERS[g]?.he || g;
}

function section(i, e = "") {
  let t = el("div", "section");
  return t.innerHTML = `<h4></h4>${e ? `<span class="meta">${e}</span>` : ""}`, t.querySelector("h4").textContent = i, t;
}

function emptyState(i, e, t = null, n = "") {
  let s = el("div", `empty ${n}`);
  return s.innerHTML = `<span class="ico">${i}</span><span class="msg"></span>${t ? `<span class="sub">${t}</span>` : ""}`, s.querySelector(".msg").textContent = e, s;
}

function textInput(i) {
  let e = document.createElement("input");
  return e.className = "field-input", e.placeholder = i, e.autocomplete = "off", e.spellcheck = !1, e;
}

function itemList(i) {
  return Object.entries(i || {}).map(([e, t]) => `${ITEMS[e]?.icon || "📦"} ${Ze(loc(ITEMS[e]))} ${ltr(`×${t}`)}`).join(", ");
}

function costRow(i, e) {
  let t = el("div", "cost"),
    n = i?.gold || 0;
  if (n) {
    let s = (e?.gold || 0) < n;
    t.appendChild(el("span", `c ${s ? "short" : ""}`, `⛁ ${n.toLocaleString("en-US")}`));
  }
  for (let [s, r] of Object.entries(i?.items || {})) {
    let o = e?.inventory?.[s] || 0,
      a = o < r,
      l = el("span", `c ${a ? "short" : ""}`);
    l.innerHTML = `${ITEMS[s]?.icon || "📦"} ${a ? `${o}/${r}` : r}`, l.title = loc(ITEMS[s]), t.appendChild(l);
  }
  return t.childElementCount || t.appendChild(el("span", "c", "חינם")), t;
}

function itemEffect(i) {
  return i.kind === "sphere" ? `סיכוי לכידה ${ltr(`×${i.rate}`)}` : i.kind === "heal" ? `מרפא ${ltr(`${i.amount} HP`)}` : i.kind === "revive" ? i.ratio >= 1 ? "מחייה יצור במלוא החיים" : "מחייה יצור מעולף" : i.kind === "trainerHeal" ? `מרפא לך ${ltr(`${i.amount} HP`)}` : i.kind === "stamina" ? `${ltr(`+${i.amount}`)} מרץ` : i.kind === "gear" ? Object.entries(i.bonus).map(([e, t]) => ltr(`${e} +${t}`)).join(" · ") : "חומר גלם";
}

function Cb(i) {
  let e = {
    slots: "תאים",
    speed: "מהירות",
    queue: "תור",
    tier: "דרגה",
    perHour: "לשעה",
    capHours: "מקס׳ שעות"
  };
  return Object.entries(i).map(([t, n]) => `${e[t] || t} ${ltr(typeof n == "number" ? Math.round(n * 100) / 100 : n)}`).join(" · ");
}

function bp(i) {
  return {
    idle: "בעולם",
    world: "בעולם",
    battle: "בקרב",
    dungeon: "במבוך",
    afk: "לא פעיל",
    offline: "מנותק"
  }[i] || i || "";
}

function Pb(i) {
  return {
    burn: "🔥 כוויה",
    poison: "☠ רעל",
    slow: "🐌 האטה",
    stun: "💫 מסוחרר",
    shield: "🛡 מגן",
    atkUp: "⚔ התקפה+",
    defUp: "🛡 הגנה+",
    defDown: "🛡 הגנה−",
    hasteUp: "💨 זריזות+"
  }[i] || i;
}

function Ze(i) {
  return String(i ?? "").replace(/[&<>"']/g, e => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[e]);
}

function oo(i) {
  return "#" + i.toString(16).padStart(6, "0");
}

function Ib() {
  let e = (new URLSearchParams(location.search).get("server") || globalThis.HOBILE_SERVER || "").replace(/\/+$/, "");
  if (!e) return {};
  let t = new URL(e, location.href);
  return {
    httpBase: t.origin,
    wsBase: (t.protocol === "https:" ? "wss://" : "ws://") + t.host
  };
}

// Pin colours, shared by the radar and the panel so a landmark is the same
// colour in both. Anything unlisted falls back to bone.
var MAP_PIN = {
  portal: "#2fe6d0",
  gate: "#2fe6d0",
  dungeon: "#c084fc",
  shop: "#ffc861",
  npc: "#7dd3fc",
  clinic: "#7ff0d8",
  archive: "#b9a3ff",
  workshop: "#ffa273",
  base: "#9ae6a0",
  plaza: "#e6dcc4",
  town: "#e6dcc4",
  camp: "#e6dcc4",
  pier: "#8ab4ff",
  _: "#d9cdb4"
};

/** Accepts a palette number (0x3a5f58) or a css hex, and gives back rgba. */
/** A zone colour washed toward white, as a CSS colour: `k` of the way there. */
/**
 * A planned zone drawn from above for the map and the radar: its ground in the
 * zone's colour washed light, then the water, the rock, the woods and the tall
 * grass, the roads, what is built and the bridges — once per zone, from the
 * plan's own grid, so it costs nothing per frame. (worldplan.js)
 */
var ZONE_ART = new Map();
function zoneArt(zone) {
  if (!zone || zone.urban) return null;
  if (ZONE_ART.has(zone.id)) return ZONE_ART.get(zone.id);
  let P = planFor(zone);
  if (!P) return ZONE_ART.set(zone.id, null), null;
  let n = P.grid.n, half = P.half, k = 2,
    cv = document.createElement("canvas");
  cv.width = cv.height = n * k;
  let c = cv.getContext("2d"),
    img = c.createImageData(n, n),
    hex = (v) => [v >> 16 & 255, v >> 8 & 255, v & 255],
    mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
    base = hex(zone.ground ?? 6531422).map(v => v + (255 - v) * 0.5),
    W = { water: [126, 186, 226], lava: [255, 140, 70], ice: [218, 240, 252], swamp: [120, 146, 112] }[P.water?.kind] || [126, 186, 226];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let x = -half + (i + 0.5) * CELL, z = -half + (j + 0.5) * CELL, q = j * n + i, col = base;
    if (P.grassAt(x, z) > 0.3) col = mix(col, [120, 190, 96], 0.3);
    if (P.forestAt(x, z) > 0.35) col = mix(col, [70, 128, 76], 0.55);
    if (P.grid.cliffD[q] < 0.5) col = mix(col, [150, 132, 120], 0.8);
    if (P.roadAt(x, z) > 0.4) col = mix(col, [214, 188, 140], 0.85);
    if (P.grid.waterD[q] < 0.5) col = W;
    if (!P.grid.walk[q] && P.grid.waterD[q] >= 0.5 && P.grid.cliffD[q] >= 0.5) col = mix(col, [60, 60, 80], 0.7);
    img.data.set([col[0] | 0, col[1] | 0, col[2] | 0, 255], q * 4);
  }
  let tmp = document.createElement("canvas");
  tmp.width = tmp.height = n, tmp.getContext("2d").putImageData(img, 0, 0);
  c.imageSmoothingEnabled = !0, c.drawImage(tmp, 0, 0, n * k, n * k);
  let toPx = (x, z) => [(x + half) / CELL * k, (z + half) / CELL * k];
  for (let st of P.structures) {
    if (st.deck) {
      let [ax, az] = toPx(st.a[0], st.a[1]), [bx, bz] = toPx(st.b[0], st.b[1]);
      c.strokeStyle = "#8a6440", c.lineWidth = Math.max(2, st.w / CELL * k), c.beginPath(), c.moveTo(ax, az), c.lineTo(bx, bz), c.stroke();
      continue;
    }
    if (st.kind === "volcano" || st.kind === "rails" || st.kind === "lanterns" || st.kind === "airship") continue;
    let [px, pz] = toPx(st.x, st.z), w = Math.max(3, (st.w ?? (st.r ? st.r * 2 : 4)) / CELL * k), d = Math.max(3, (st.d ?? (st.r ? st.r * 2 : 4)) / CELL * k);
    c.save(), c.translate(px, pz), c.rotate(-(st.rot || 0)), c.fillStyle = st.kind === "field" ? "#d8b860" : st.kind === "orchard" ? "#5e9a4e" : "#7a5a4a", c.fillRect(-w / 2, -d / 2, w, d), c.restore();
  }
  let art = { canvas: cv, size: P.size, scale: n * k / P.size };
  return ZONE_ART.set(zone.id, art), art;
}

function pastel(i, k) {
  let t = i >> 16 & 255,
    n = i >> 8 & 255,
    s = i & 255,
    w = v => Math.round(v + (255 - v) * k);
  return `rgb(${w(t)},${w(n)},${w(s)})`;
}

function rgba(i, e) {
  let t, n, s;
  if (typeof i == "number") t = i >> 16 & 255, n = i >> 8 & 255, s = i & 255;else {
    let r = String(i).replace("#", "");
    t = parseInt(r.slice(0, 2), 16), n = parseInt(r.slice(2, 4), 16), s = parseInt(r.slice(4, 6), 16);
  }
  return `rgba(${t},${n},${s},${e})`;
}

/** You, and which way you are looking. North-up maps need the second half. */
function drawYou(i, e, t, n, s) {
  let r = Math.sin(n),
    o = Math.cos(n);
  i.fillStyle = "rgba(11,14,30,.85)", i.beginPath(), i.arc(e, t, s * 0.55, 0, Math.PI * 2), i.fill(), i.fillStyle = "#fff", i.beginPath(), i.moveTo(e + r * s, t + o * s), i.lineTo(e - o * s * 0.46 - r * s * 0.28, t + r * s * 0.46 - o * s * 0.28), i.lineTo(e + o * s * 0.46 - r * s * 0.28, t - r * s * 0.46 - o * s * 0.28), i.closePath(), i.fill();
}

/** A landmark is worth a label when it has a name and room to print one. */
function mapLabel(i) {
  if (i.kind === "portal" || i.kind === "npc") return "";
  let e = i.he || i.name;
  if (e) return String(e).slice(0, 14);
  return {
    dungeon: "מבוך",
    shop: "חנות",
    clinic: "מרפאה",
    archive: "ארכיון",
    workshop: "בית מלאכה",
    base: "הבסיס",
    plaza: "הכיכר",
    pier: "המזח",
    gate: "השער",
    town: "עיירה",
    camp: "מחנה"
  }[i.kind] || "";
}

var SKY_ICON = {
  clear: "☀",
  cloud: "☁",
  rain: "☂",
  storm: "⚡",
  snow: "❄",
  fog: "≈",
  ash: "✦"
},
  kb = 7.4,
  zb = 12,
  wp = 720 * 1e3;

export { $, Cb, GENERIC_ERROR, Ib, Pb, STRINGS, UI, USERNAME_RE, Ze, bp, costRow, el, emptyState, formatClock, itemEffect, itemList, kb, loc, ltr, lvlLabel, oo, rangeLabel, section, starLabel, textInput, usernameError, wp, zb };
