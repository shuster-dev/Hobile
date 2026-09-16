var NPCS = {
  maro: {
    id: "maro",
    name: "Elder Maro",
    he: "הזקן מארו",
    role: "guide",
    icon: "🧙",
    body: "tall",
    skin: "#c98f63",
    hair: "#d8d4cc",
    outfit: "scholar",
    schedule: [{
      at: 0,
      x: -36,
      z: -36,
      act: "sleep"
    }, {
      at: 0.26,
      x: -12,
      z: -12,
      act: "work"
    }, {
      at: 0.62,
      x: 0,
      z: 0,
      act: "walk"
    }, {
      at: 0.8,
      x: -12,
      z: -12,
      act: "work"
    }, {
      at: 0.92,
      x: -36,
      z: -36,
      act: "sleep"
    }]
  },
  tavi: {
    id: "tavi",
    name: "Tavi",
    he: "טאבי",
    role: "shop",
    icon: "🧑‍🍳",
    body: "stocky",
    skin: "#8a5a3c",
    hair: "#2b1b16",
    outfit: "wanderer",
    schedule: [{
      at: 0,
      x: -36,
      z: 12,
      act: "sleep"
    }, {
      at: 0.28,
      x: -12,
      z: 12,
      act: "work"
    }, {
      at: 0.78,
      x: 0,
      z: 0,
      act: "social"
    }, {
      at: 0.9,
      x: -36,
      z: 12,
      act: "sleep"
    }]
  },
  ren: {
    id: "ren",
    name: "Ren",
    he: "רן",
    role: "smith",
    icon: "🔨",
    body: "stocky",
    skin: "#6f452c",
    hair: "#151515",
    outfit: "ranger",
    schedule: [{
      at: 0,
      x: 36,
      z: -12,
      act: "sleep"
    }, {
      at: 0.22,
      x: 12,
      z: -12,
      act: "work"
    }, {
      at: 0.72,
      x: 0,
      z: 0,
      act: "social"
    }, {
      at: 0.88,
      x: 36,
      z: -12,
      act: "sleep"
    }]
  },
  sela: {
    id: "sela",
    name: "Sela",
    he: "סלע",
    role: "warden",
    icon: "🛡",
    body: "slim",
    skin: "#e0ac7e",
    hair: "#7a2f2f",
    outfit: "ranger",
    schedule: [{
      at: 0,
      x: 0,
      z: 36,
      act: "work"
    }, {
      at: 0.35,
      x: 0,
      z: 24,
      act: "walk"
    }, {
      at: 0.55,
      x: 0,
      z: 36,
      act: "work"
    }, {
      at: 0.8,
      x: 0,
      z: 0,
      act: "social"
    }]
  },
  bex: {
    id: "bex",
    name: "Bex",
    he: "בקס",
    role: "kid",
    icon: "🧒",
    body: "slim",
    skin: "#f0c9a0",
    hair: "#c9762c",
    outfit: "tide",
    schedule: [{
      at: 0,
      x: -12,
      z: 36,
      act: "sleep"
    }, {
      at: 0.3,
      x: 0,
      z: 0,
      act: "social"
    }, {
      at: 0.5,
      x: -12,
      z: 12,
      act: "social"
    }, {
      at: 0.68,
      x: 0,
      z: 0,
      act: "social"
    }, {
      at: 0.86,
      x: -12,
      z: 36,
      act: "sleep"
    }]
  }
};

function npcAt(i, e) {
  let t = NPCS[i];
  if (!t) return {
    x: 0,
    z: 0,
    rot: 0,
    moving: !1,
    act: "idle"
  };
  let n = t.schedule,
    s = (e % 1 + 1) % 1,
    r = 0;
  for (let m = 0; m < n.length; m++) s >= n[m].at && (r = m);
  let o = n[r],
    a = n[(r + 1) % n.length],
    l = (a.at - o.at + 1) % 1 || 1,
    c = Math.min(1, (s - o.at + 1) % 1 / l),
    h = 0.75,
    d = c <= h ? 0 : (c - h) / (1 - h),
    u = d * d * (3 - 2 * d),
    f = a.x - o.x,
    p = a.z - o.z,
    x = Math.hypot(f, p) > 0.5,
    g = x && d > 0.01 && d < 0.99;
  return {
    x: o.x + f * u,
    z: o.z + p * u,
    rot: x ? Math.atan2(f, p) : 0,
    moving: g,
    act: g ? "walk" : o.act
  };
}

function npcList(i) {
  return Object.keys(NPCS).map(e => ({
    id: e,
    ...NPCS[e],
    ...npcAt(e, i)
  }));
}

var questDone = (i, e) => !!i.quests?.done?.includes(e),
  questActive = (i, e) => !!i.quests?.active?.[e],
  DIALOGUE = {
    maro: [{
      when: i => !i.hasStarter,
      lines: ["אז הגעת. מאז שהסדק נפתח מעל המזח, אנשים באים לכאן בלי לדעת בדיוק למה.", "קח את בן הלוויה הזה. האתר בחר בו, לא אני — אני רק שומר את הרשימות.", "צא מהשער הצפוני. יש שם אחו, ובאחו יש יצורים. תלמד יותר משם מאשר ממני."],
      en: ["So you came.", "Take this companion.", "Head out the north gate."]
    }, {
      when: i => questActive(i, "q_main_02"),
      lines: ["האחו נראה שקט, נכון? הוא לא היה שקט לפני שנה.", "משהו מושך את היצורים דרומה, לעבר העיר. אני רוצה לדעת מה.", "הבס חמישה מהם ותחזור. לא כדי להוכיח משהו — כדי שאדע מה השתנה בהם."],
      en: ["The meadow is quiet now.", "Something pulls them south.", "Beat five and come back."]
    }, {
      when: i => questDone(i, "q_main_03"),
      lines: ["לכדת אחד. אז אתה כבר לא מבקר — אתה אחראי על מישהו.", "הרשימות שלי אומרות שהשברים שנופלים מהם התחילו לזרוח רק בשנתיים האחרונות.", "רן בסדנה יודע מה לעשות איתם. תשאל אותו, ואל תיתן לו לדבר יותר מדי."],
      en: ["You caught one.", "The shards only started glowing recently.", "Ask Ren."]
    }, {
      when: i => i.night,
      lines: ["בלילה אני שומע את הסדק. אתה לא? כנראה שזה גיל."],
      en: ["At night I can hear the rift."]
    }, {
      when: () => !0,
      lines: ["הארכיון פתוח לכל מי שמנקה את הנעליים.", "אם אתה מחפש עבודה — סלע בשער הצפוני תמיד מחפשת מישהו."],
      en: ["The archive is open.", "Sela at the north gate is always looking for someone."]
    }],
    tavi: [{
      when: i => i.captures === 0,
      lines: ["כדורי אתר, שיקויים, ומה שנפל מהעגלה הבוקר. תסתכל, אל תיגע.", "עוד לא לכדת כלום? אז קח שניים על חשבוני. אני רוצה לראות אותך חוזר לקנות."],
      en: ["Spheres, tonics.", "Take two on me."]
    }, {
      when: i => i.captures >= 5,
      lines: ["חמישה. שמעתי. בעיר קטנה כזאת אנשים סופרים.", "תגיד לי — הם נלחמים אחרת מאז שהאתר התחזק? הלקוחות שלי מתלוננים שכן."],
      en: ["Five. Word gets around.", "Do they fight differently now?"]
    }, {
      when: i => i.night,
      lines: ["הדוכן סגור. אם זה דחוף — תדפוק. אם זה לא — אל תדפוק."],
      en: ["The stall is closed."]
    }, {
      when: () => !0,
      lines: ["הכול טרי חוץ מהשיקויים, והם ממילא לא אמורים להיות טריים."],
      en: ["Everything is fresh except the tonics."]
    }],
    ren: [{
      when: i => !questDone(i, "q_main_03"),
      lines: ["הסדנה סגורה למי שאין לו מה למחזר. תחזור עם שברים."],
      en: ["Come back with shards."]
    }, {
      when: i => questActive(i, "q_main_04"),
      lines: ["שברים. יופי. אתה יודע שאם מזקקים אותם נכון הם מתחילים להחזיק צורה?", "הבסיס שלך — יש לך בסיס, נכון? — יכול לעשות את זה בזמן שאתה בחוץ.", "תזקק ארבעה גבישים ותחזור. אני רוצה לראות שאתה מבין מה אתה מחזיק ביד."],
      en: ["Shards. Good.", "Your base can refine them.", "Bring me four crystals."]
    }, {
      when: i => questDone(i, "q_main_04"),
      lines: ["עכשיו אתה יכול להשאיר יצור בתא אימון והוא יעלה כוכב בזמן שאתה ישן.", "אל תבטל אימון באמצע. החומרים לא חוזרים, ואני לא מחזיר כסף."],
      en: ["Now you can raise a star while you sleep.", "Do not cancel mid-training."]
    }, {
      when: () => !0,
      lines: ["אם זה מצלצל כשמכים בו, זה עוד לא מוכן."],
      en: ["If it rings when you strike it, it is not ready."]
    }],
    sela: [{
      when: i => !questDone(i, "q_main_02"),
      lines: ["השער הצפוני. מעבר לו אחו, ובאחו יצורים שלא אכפת להם מי אתה.", "תישאר על השביל. אם משהו גדול מדי — תברח. זה לא בושה, זה חשבון."],
      en: ["North gate.", "Stay on the path."]
    }, {
      when: i => (i.battlesWon || 0) >= 10,
      lines: ["עשרה נצחונות. ראיתי אנשים עם פחות שקוראים לעצמם ציידים.", "כשתגיע לקניון — קח מים. שם למטה שוכחים."],
      en: ["Ten wins.", "Take water to the canyon."]
    }, {
      when: i => i.guildId,
      lines: ["גילדה, אה? אז יש מי שיסחוב אותך הביתה. טוב."],
      en: ["A guild. Someone to carry you home. Good."]
    }, {
      when: () => !0,
      lines: ["אני עומדת פה כל הלילה כדי שלא תצטרך."],
      en: ["I stand here all night so you do not have to."]
    }],
    bex: [{
      when: i => (i.level || 1) < 5,
      lines: ["היי! היצור שלך אמיתי? אפשר לגעת? למה לא?", "כשאני אהיה גדולה אני אתפוס אחד ענק. יותר גדול מהבית של רן."],
      en: ["Is that real?", "I will catch a huge one."]
    }, {
      when: i => (i.level || 1) >= 10,
      lines: ["אתה זה שהמבוגרים מדברים עליו! ספר לי משהו אמיתי, לא כמו שסלע מספרת.", "סבתא אומרת שהסדק היה קטן פעם. את זה כולם אומרים."],
      en: ["You are the one they talk about.", "The rift used to be small."]
    }, {
      when: i => i.night,
      lines: ["אני לא אמור להיות פה עכשיו. אל תגיד לאף אחד."],
      en: ["I am not supposed to be here."]
    }, {
      when: () => !0,
      lines: ["ספרתי את כל האריחים בכיכר. שלוש מאות ואחד עשר. אחד שבור."],
      en: ["Three hundred and eleven tiles. One is cracked."]
    }]
  };

function npcLines(i, e = {}) {
  let t = DIALOGUE[i];
  if (!t) return ["..."];
  for (let n of t) try {
    if (n.when(e)) return n.lines;
  } catch {}
  return t[t.length - 1].lines;
}

export { DIALOGUE, NPCS, npcAt, npcLines, npcList, questActive, questDone };
