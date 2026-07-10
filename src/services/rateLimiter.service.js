const config = require("../config/rateLimit.config");

/**
 * In-memory per-user rate limiter.
 * Redis yo'q — Map. Multi-instance uchun keyinchalik Redis adapter qo'shish mumkin.
 *
 * check(userId) → {
 *   allowed: boolean,
 *   blocked: boolean,
 *   justBlocked: boolean,   // shu so'rovda yangi blok ochildi
 *   remainingMs: number,    // blok qolgan vaqt
 *   shouldNotify: boolean,  // blok xabarini yuborish kerakmi (faqat birinchi)
 * }
 */
class RateLimiterService {
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? config.WINDOW_MS;
    this.maxRequests = options.maxRequests ?? config.MAX_REQUESTS;
    this.blockDurationMs = options.blockDurationMs ?? config.BLOCK_DURATION_MS;
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? config.CLEANUP_INTERVAL_MS;

    /** @type {Map<string, { timestamps: number[], blockedUntil: number, notified: boolean }>} */
    this.users = new Map();

    this._cleanupTimer = setInterval(() => this.cleanup(), this.cleanupIntervalMs);
    if (typeof this._cleanupTimer.unref === "function") {
      this._cleanupTimer.unref();
    }
  }

  _key(userId) {
    return String(userId);
  }

  _getState(userId) {
    const key = this._key(userId);
    if (!this.users.has(key)) {
      this.users.set(key, { timestamps: [], blockedUntil: 0, notified: false });
    }
    return this.users.get(key);
  }

  /**
   * So'rovni tekshiradi va hisoblaydi. Race-safe: bitta sync chaqiriq.
   */
  check(userId) {
    if (userId == null) {
      return { allowed: true, blocked: false, justBlocked: false, remainingMs: 0, shouldNotify: false };
    }

    const now = Date.now();
    const state = this._getState(userId);

    // Blok hali faol
    if (state.blockedUntil > now) {
      const remainingMs = state.blockedUntil - now;
      const shouldNotify = !state.notified;
      if (shouldNotify) state.notified = true;
      return {
        allowed: false,
        blocked: true,
        justBlocked: false,
        remainingMs,
        shouldNotify,
      };
    }

    // Blok muddati tugagan — tiklash
    if (state.blockedUntil > 0 && state.blockedUntil <= now) {
      state.blockedUntil = 0;
      state.notified = false;
      state.timestamps = [];
    }

    // Oyna ichidagi so'rovlarni filtrlash
    const windowStart = now - this.windowMs;
    state.timestamps = state.timestamps.filter((t) => t > windowStart);
    state.timestamps.push(now);

    // WINDOW ichida MAX_REQUESTS yoki undan ko'p → blok
    if (state.timestamps.length >= this.maxRequests) {
      state.blockedUntil = now + this.blockDurationMs;
      state.notified = true;
      state.timestamps = [];
      return {
        allowed: false,
        blocked: true,
        justBlocked: true,
        remainingMs: this.blockDurationMs,
        shouldNotify: true,
      };
    }

    return {
      allowed: true,
      blocked: false,
      justBlocked: false,
      remainingMs: 0,
      shouldNotify: false,
    };
  }

  isBlocked(userId) {
    const state = this.users.get(this._key(userId));
    if (!state) return false;
    return state.blockedUntil > Date.now();
  }

  remainingBlockMs(userId) {
    const state = this.users.get(this._key(userId));
    if (!state) return 0;
    return Math.max(0, state.blockedUntil - Date.now());
  }

  /** Test / admin uchun */
  reset(userId) {
    this.users.delete(this._key(userId));
  }

  cleanup() {
    const now = Date.now();
    for (const [key, state] of this.users.entries()) {
      const inactive =
        state.blockedUntil <= now &&
        (state.timestamps.length === 0 ||
          state.timestamps.every((t) => t < now - this.windowMs * 2));
      if (inactive && state.blockedUntil <= now) {
        // Blok tugagan va oyna bo'sh
        if (state.blockedUntil === 0 && state.timestamps.every((t) => t < now - this.windowMs)) {
          this.users.delete(key);
        } else if (state.blockedUntil > 0 && state.blockedUntil <= now) {
          this.users.delete(key);
        }
      }
    }
  }

  destroy() {
    if (this._cleanupTimer) clearInterval(this._cleanupTimer);
    this.users.clear();
  }
}

function formatRemaining(ms, lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  const sec = Math.max(1, Math.ceil(ms / 1000));
  if (sec >= 60) {
    const m = Math.ceil(sec / 60);
    return t("time.minute", L, { n: m });
  }
  return t("time.second", L, { n: sec });
}

function buildBlockMessage(remainingMs, lang) {
  const { t, resolveLang } = require("../i18n");
  const L = resolveLang(lang);
  return t("rateLimit.blocked", L, { time: formatRemaining(remainingMs, L) });
}

const rateLimiter = new RateLimiterService();

module.exports = {
  RateLimiterService,
  rateLimiter,
  formatRemaining,
  buildBlockMessage,
};
