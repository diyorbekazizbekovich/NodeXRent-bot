const playstationService = require("./playstation.service");
const { distanceKm } = require("../utils/distance");

/**
 * Berilgan buyurtma parametrlari bo'yicha eng mos (eng yaqin) bo'sh PlayStation + kuryerni topadi.
 * `excludeCourierIds` — avval rad etgan yoki javob bermagan kuryerlarni chetlab o'tish uchun.
 */
async function findBestCandidate({ consoleType, startDatetime, endDatetime, userLat, userLon, excludeCourierIds = [] }) {
  const available = await playstationService.findAvailable({ consoleType, startDatetime, endDatetime });

  const filtered = available.filter((ps) => !excludeCourierIds.includes(ps.courierId));

  if (filtered.length === 0) return null;

  // Agar foydalanuvchi lokatsiyasi mavjud bo'lsa — eng yaqin kuryerni tanlaymiz
  if (userLat != null && userLon != null) {
    filtered.sort((a, b) => {
      const da = distanceKm(userLat, userLon, a.courier.latitude, a.courier.longitude);
      const db = distanceKm(userLat, userLon, b.courier.latitude, b.courier.longitude);
      return da - db;
    });
  }

  const chosen = filtered[0];
  return { playstation: chosen, courier: chosen.courier };
}

module.exports = { findBestCandidate };
