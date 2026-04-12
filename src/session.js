// ─── Current drawing session ───────────────────────────────────────────────
// Resets on page reload — password unlocks are intentionally session-scoped.
export const session = {
  id:           null,    // DB record id (integer)
  title:        'Untitled Drawing',
  hasPassword:  false,   // drawing has a password hash stored in DB
  passwordHash: null,    // the stored SHA-256 hash (from DB, for comparison)
  unlocked:     true,    // false = read-only; true = can save
};

// True when the drawing is password-protected and not yet unlocked this session
export const isLocked = () => session.hasPassword && !session.unlocked;
