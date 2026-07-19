/**
 * In-memory conversation session store.
 *
 * Rules:
 * - One active action per chatId (beginAction replaces previous).
 * - Sessions expire after TTL (dead-state prevention).
 * - clearSession always leaves a clean idle session.
 *
 * For multi-instance production, swap Map for Redis with the same API.
 */

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

const sessions = new Map();

function now() {
  return Date.now();
}

function idleSession() {
  return { step: null, data: {}, startedAt: null, updatedAt: now() };
}

function isExpired(session) {
  if (!session || !session.step) return false;
  const ts = session.updatedAt || session.startedAt;
  if (!ts) return false;
  return now() - ts > SESSION_TTL_MS;
}

function getSession(chatId) {
  const key = String(chatId);
  let session = sessions.get(key);
  if (!session) {
    session = idleSession();
    sessions.set(key, session);
    return session;
  }
  if (isExpired(session)) {
    const cleared = idleSession();
    sessions.set(key, cleared);
    return cleared;
  }
  return session;
}

/** Start a new wizard/action — always replaces any previous pending action. */
function beginAction(chatId, step, data = {}) {
  const key = String(chatId);
  const session = {
    step,
    data: { ...data },
    startedAt: now(),
    updatedAt: now(),
  };
  sessions.set(key, session);
  return session;
}

function setStep(chatId, step) {
  const session = getSession(chatId);
  session.step = step;
  session.updatedAt = now();
  if (!session.startedAt) session.startedAt = now();
  sessions.set(String(chatId), session);
  return session;
}

function updateData(chatId, patch) {
  const session = getSession(chatId);
  session.data = { ...session.data, ...patch };
  session.updatedAt = now();
  sessions.set(String(chatId), session);
  return session;
}

function clearSession(chatId) {
  const cleared = idleSession();
  sessions.set(String(chatId), cleared);
  return cleared;
}

function hasActiveStep(chatId, prefix = null) {
  const session = getSession(chatId);
  if (!session.step) return false;
  if (!prefix) return true;
  return String(session.step).startsWith(prefix);
}

function isIdle(chatId) {
  return !getSession(chatId).step;
}

module.exports = {
  SESSION_TTL_MS,
  getSession,
  beginAction,
  setStep,
  updateData,
  clearSession,
  hasActiveStep,
  isIdle,
};
