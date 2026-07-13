class GeoFenceError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {{ messageKey?: string, zoneCode?: string }} [meta]
   */
  constructor(code, message, meta = {}) {
    super(message);
    this.name = "GeoFenceError";
    this.code = code;
    this.messageKey = meta.messageKey || "geoFence.outsideServiceArea";
    this.zoneCode = meta.zoneCode || null;
  }
}

module.exports = { GeoFenceError };
