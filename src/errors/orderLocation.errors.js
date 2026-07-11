class OrderLocationError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ messageKey?: string, retryAfterSec?: number }} [meta]
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "OrderLocationError";
    this.code = code;
    this.messageKey = meta.messageKey || null;
    this.retryAfterSec = meta.retryAfterSec ?? null;
  }
}

module.exports = { OrderLocationError };
