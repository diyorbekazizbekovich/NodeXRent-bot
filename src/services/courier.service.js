const courierRepository = require("../repositories/courier.repository");

async function findOrCreateCourier(telegramId, fullName, username) {
  let courier = await courierRepository.findByTelegramId(telegramId);
  if (!courier) {
    courier = await courierRepository.create({
      telegramId: BigInt(telegramId),
      fullName,
      username: username || null,
    });
  } else if (username && courier.username !== username) {
    courier = await courierRepository.update(courier.id, { username });
  }
  return courier;
}

async function getCourierByTelegramId(telegramId) {
  return courierRepository.findByTelegramId(telegramId);
}

async function getCourierById(id) {
  return courierRepository.findById(id);
}

async function isCourier(telegramId) {
  const courier = await getCourierByTelegramId(telegramId);
  return Boolean(courier);
}

async function updateCourierProfile(telegramId, { phone, region, latitude, longitude, fullName, username }) {
  const courier = await getCourierByTelegramId(telegramId);
  if (!courier) return null;
  return courierRepository.update(courier.id, {
    phone,
    region,
    latitude,
    longitude,
    fullName: fullName ?? courier.fullName,
    username: username ?? courier.username,
  });
}

async function createCourierByAdmin({ telegramId, fullName, phone, username }) {
  return courierRepository.create({
    telegramId: BigInt(telegramId),
    fullName,
    phone,
    username,
    isActive: true,
  });
}

async function updateCourierByAdmin(id, data) {
  return courierRepository.update(id, data);
}

async function deleteCourier(id) {
  return courierRepository.remove(id);
}

async function setActive(courierId, isActive) {
  return courierRepository.update(courierId, { isActive });
}

async function listActiveCouriers() {
  return courierRepository.listActive();
}

async function listAllCouriers(options) {
  return courierRepository.listAll(options);
}

async function searchCouriers(query) {
  return courierRepository.listAll({ search: query, take: 15 });
}

async function getCourierStats(courierId) {
  return courierRepository.getStats(courierId);
}

module.exports = {
  findOrCreateCourier,
  getCourierByTelegramId,
  getCourierById,
  isCourier,
  updateCourierProfile,
  createCourierByAdmin,
  updateCourierByAdmin,
  deleteCourier,
  setActive,
  listActiveCouriers,
  listAllCouriers,
  searchCouriers,
  getCourierStats,
};
