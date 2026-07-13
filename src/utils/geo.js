/**
 * Geometry helpers for geofencing (no external deps).
 * Polygons use GeoJSON order: [longitude, latitude].
 */

function isFiniteNumber(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function inBoundingBox(lon, lat, bbox) {
  return lon >= bbox.minLon && lon <= bbox.maxLon && lat >= bbox.minLat && lat <= bbox.maxLat;
}

/**
 * Ray-casting point-in-polygon.
 * @param {number} lon
 * @param {number} lat
 * @param {ReadonlyArray<ReadonlyArray<number>>} ring [lon, lat][], closed or open
 */
function pointInPolygon(lon, lat, ring) {
  if (!Array.isArray(ring) || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];

    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * @param {number} latitude
 * @param {number} longitude
 * @param {{ bbox: object, polygon: ReadonlyArray }} zone
 */
function isPointInZone(latitude, longitude, zone) {
  if (!isFiniteNumber(latitude) || !isFiniteNumber(longitude)) return false;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return false;
  if (!zone?.polygon) return false;
  if (zone.bbox && !inBoundingBox(longitude, latitude, zone.bbox)) return false;
  return pointInPolygon(longitude, latitude, zone.polygon);
}

module.exports = {
  isFiniteNumber,
  inBoundingBox,
  pointInPolygon,
  isPointInZone,
};
