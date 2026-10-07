// Why a player can be reported. The reporter picks one; "other" asks for a
// few words. Shared: the client draws the picker from it, the server refuses
// anything not on it, the GM panel labels the inbox with it.
export const REPORT_REASONS = {
  language: { he: 'קללות / דיבור לא יפה', icon: '🤬', evidence: true },
  harass: { he: 'הטרדה / בריונות', icon: '😠', evidence: true },
  cheat: { he: 'רמאות / בוט', icon: '🤖', evidence: false },
  name: { he: 'שם לא הולם / ספאם', icon: '🏷', evidence: true },
  other: { he: 'אחר', icon: '✏', evidence: true, needsNote: true },
};
export const REPORT_IDS = Object.keys(REPORT_REASONS);

export const REPORT_LIMITS = {
  note: 200,              // the reporter's own words
  evidence: 12,           // the reported player's last lines kept with it
  evidenceMs: 30 * 60_000,
  sameTargetMs: 10 * 60_000, // one report of the same player in ten minutes
  perHour: 8,             // and no more than this many reports an hour
};

export const REPORT_STATUS = { open: 'פתוח', handled: 'טופל', dismissed: 'נדחה' };
