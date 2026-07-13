const { GEO_ZONES, DEFAULT_SERVICE_ZONE_CODE } = require("../constants/geoZones");
const { isPointInZone, isFiniteNumber } = require("../utils/geo");
const { GeoFenceError } = require("../errors/geoFence.errors");
const logger = require("../utils/logger");

function getZone(zoneCode = DEFAULT_SERVICE_ZONE_CODE) {
  const zone = GEO_ZONES[zoneCode];
  if (!zone) {
    throw new GeoFenceError("UNKNOWN_ZONE", `Noma'lum zona: ${zoneCode}`, {
      messageKey: "geoFence.unknownZone",
      zoneCode,
    });
  }
  return zone;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} [zoneCode]
 */
function isInsideServiceArea(latitude, longitude, zoneCode = DEFAULT_SERVICE_ZONE_CODE) {
  const zone = getZone(zoneCode);
  return isPointInZone(Number(latitude), Number(longitude), zone);
}

/**
 * Throws GeoFenceError if coordinates are missing or outside the service zone.
 * @returns {{ latitude: number, longitude: number, zoneCode: string }}
 */
function assertInsideServiceArea(latitude, longitude, zoneCode = DEFAULT_SERVICE_ZONE_CODE) {
  if (latitude == null || longitude == null || latitude === "" || longitude === "") {
    throw new GeoFenceError("MISSING_COORDS", "Lokatsiya majburiy", {
      messageKey: "geoFence.coordsRequired",
      zoneCode,
    });
  }

  const lat = Number(latitude);
  const lon = Number(longitude);

  if (!isFiniteNumber(lat) || !isFiniteNumber(lon)) {
    throw new GeoFenceError("MISSING_COORDS", "Lokatsiya majburiy", {
      messageKey: "geoFence.coordsRequired",
      zoneCode,
    });
  }

  const zone = getZone(zoneCode);
  if (!isPointInZone(lat, lon, zone)) {
    logger.info("Location rejected by geofence", {
      context: "GeoFence",
      latitude: lat,
      longitude: lon,
      zoneCode,
    });
    throw new GeoFenceError(
      "OUTSIDE_SERVICE_AREA",
      "Xizmat faqat Toshkent shahri hududida mavjud",
      { messageKey: "geoFence.outsideServiceArea", zoneCode }
    );
  }

  return { latitude: lat, longitude: lon, zoneCode };
}

/**
 * Safe boolean check for UI gates (never throws).
 */
function canDeliverTo(latitude, longitude, zoneCode = DEFAULT_SERVICE_ZONE_CODE) {
  try {
    assertInsideServiceArea(latitude, longitude, zoneCode);
    return true;
  } catch (_) {
    return false;
  }
}

function listZones() {
  return Object.values(GEO_ZONES).map((z) => ({
    code: z.code,
    name: z.name,
    nameEn: z.nameEn,
  }));
}

module.exports = {
  DEFAULT_SERVICE_ZONE_CODE,
  getZone,
  isInsideServiceArea,
  assertInsideServiceArea,
  canDeliverTo,
  listZones,
};
