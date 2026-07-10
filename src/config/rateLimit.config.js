/**
 * Anti-spam / rate limit sozlamalari.
 * Magic numberlar o'rniga shu config ishlatiladi.
 */
module.exports = {
  /** So'rovlar sanash oynasi (ms) */
  WINDOW_MS: Number(process.env.RATE_LIMIT_WINDOW_MS) || 2000,

  /** Oyna ichida ruxsat etilgan maksimal so'rovlar */
  MAX_REQUESTS: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 3,

  /** Limit oshganda blok muddati (ms) — 1 daqiqa */
  BLOCK_DURATION_MS: Number(process.env.RATE_LIMIT_BLOCK_MS) || 60_000,

  /** Eski yozuvlarni tozalash intervali (ms) */
  CLEANUP_INTERVAL_MS: Number(process.env.RATE_LIMIT_CLEANUP_MS) || 5 * 60_000,
};
