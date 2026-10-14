// Why a player can be reported. The reporter picks one; "other" asks for a
// few words. Shared: the client draws the picker from it, the server refuses
// anything not on it, the GM panel labels the inbox with it.
export const REPORT_REASONS = {
  language: { he: 'קללות / דיבור לא יפה', icon: '🤬', evidence: true },
  harass: { he: 'הטרדה / בריונות', icon: '😠', evidence: true },
  cheat: { he: 'רמאות / בוט', icon: '🤖', evidence: false },
  name: { he: 'שם לא הולם / ספאם', icon: '🏷', evidence: true },
  other: { he: 'אחר', icon: '✏', evidence: true, needsNote: true },
  // a player's own report of something broken (the menu's 🐞): about
  // themselves, with a picture of the screen and where they were
  bug: { he: 'באג במשחק', icon: '🐞', evidence: false, needsNote: true, self: true },
};
export const REPORT_IDS = Object.keys(REPORT_REASONS);

export const REPORT_LIMITS = {
  note: 200,              // the reporter's own words
  evidence: 12,           // the reported player's last lines kept with it
  evidenceMs: 30 * 60_000,
  sameTargetMs: 10 * 60_000, // one report of the same player in ten minutes
  perHour: 8,             // and no more than this many reports an hour
  bugNote: 600,           // a bug told in the player's own words
  bugShot: 450_000,       // the screen, as a small jpeg data URL
  bugsPerHour: 6,
};

export const REPORT_STATUS = { open: 'פתוח', handled: 'טופל', dismissed: 'נדחה' };
