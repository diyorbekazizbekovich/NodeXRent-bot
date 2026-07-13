/**
 * Geofence smoke tests for Tashkent city polygon.
 * Run: node scripts/test-geo-fence.js
 */
const geoFenceService = require("../src/services/geoFence.service");
const { isPointInZone } = require("../src/utils/geo");
const { GEO_ZONES } = require("../src/constants/geoZones");

const zone = GEO_ZONES.TASHKENT_CITY;

const cases = [
  { name: "Amir Temur (center)", lat: 41.3111, lon: 69.2797, expect: true },
  { name: "Chilonzor approx", lat: 41.285, lon: 69.204, expect: true },
  { name: "Yunusobod approx", lat: 41.365, lon: 69.29, expect: true },
  { name: "Chirchiq (outside)", lat: 41.4689, lon: 69.5822, expect: false },
  { name: "Samarkand", lat: 39.6542, lon: 66.9597, expect: false },
  { name: "Nurafshon / outskirts E", lat: 41.0, lon: 69.35, expect: false },
  { name: "Missing coords", lat: null, lon: null, expect: false },
  { name: "Undefined coords", lat: undefined, lon: undefined, expect: false },
];

let failed = 0;

for (const c of cases) {
  const inside = geoFenceService.canDeliverTo(c.lat, c.lon);
  const ok = inside === c.expect;
  if (!ok) failed += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}: inside=${inside} expected=${c.expect}`);
}

// Direct polygon sanity
const polyOk = isPointInZone(41.3111, 69.2797, zone) === true;
console.log(`${polyOk ? "PASS" : "FAIL"}  raw pointInZone center`);
if (!polyOk) failed += 1;

// assert throws outside
let threw = false;
try {
  geoFenceService.assertInsideServiceArea(41.4689, 69.5822);
} catch (e) {
  threw = e.code === "OUTSIDE_SERVICE_AREA";
}
console.log(`${threw ? "PASS" : "FAIL"}  assertOutside throws OUTSIDE_SERVICE_AREA`);
if (!threw) failed += 1;

let threwMissing = false;
try {
  geoFenceService.assertInsideServiceArea(null, null);
} catch (e) {
  threwMissing = e.code === "MISSING_COORDS";
}
console.log(`${threwMissing ? "PASS" : "FAIL"}  assert null throws MISSING_COORDS`);
if (!threwMissing) failed += 1;

if (failed) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("\nAll geo-fence tests passed");
