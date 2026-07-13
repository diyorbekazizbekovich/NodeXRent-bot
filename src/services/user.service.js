const prisma = require("../config/prisma");
const geoFenceService = require("./geoFence.service");

async function findOrCreateUser(telegramId, fullName, username) {
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        telegramId: BigInt(telegramId),
        fullName,
        username: username || null,
        lastActivityAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.update({
      where: { telegramId: BigInt(telegramId) },
      data: {
        username: username || user.username,
        fullName: fullName || user.fullName,
        lastActivityAt: new Date(),
      },
    });
  }
  return user;
}

async function getUserByTelegramId(telegramId) {
  return prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
}

async function updatePhone(telegramId, phone) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { phone },
  });
}

/**
 * Profile location update. Coordinates (when present) must be inside the service area.
 * Omitting latitude/longitude leaves existing coords unchanged (text-only address note).
 */
async function updateLocation(telegramId, { address, latitude, longitude }) {
  const coordsProvided = latitude !== undefined || longitude !== undefined;
  const hasCoords =
    latitude != null &&
    longitude != null &&
    Number.isFinite(Number(latitude)) &&
    Number.isFinite(Number(longitude));

  if (hasCoords) {
    geoFenceService.assertInsideServiceArea(latitude, longitude);
  } else if (coordsProvided) {
    // Explicit null/invalid coords — do not wipe a valid in-zone profile by accident
    const err = new Error("Lokatsiya majburiy");
    err.messageKey = "geoFence.coordsRequired";
    err.code = "MISSING_COORDS";
    throw err;
  }

  const data = { defaultAddress: address };
  if (hasCoords) {
    data.latitude = Number(latitude);
    data.longitude = Number(longitude);
  }

  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data,
  });
}

async function updateLanguage(telegramId, language) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { language },
  });
}

async function isRegistrationComplete(user) {
  if (!user?.phone) return false;
  if (user.latitude != null && user.longitude != null) {
    return geoFenceService.canDeliverTo(user.latitude, user.longitude);
  }
  return false;
}

async function blockUser(userId, isBlocked = true) {
  return prisma.user.update({ where: { id: userId }, data: { isBlocked } });
}

async function listUsers({ skip = 0, take = 20 } = {}) {
  return prisma.user.findMany({
    skip,
    take,
    orderBy: { createdAt: "desc" },
  });
}

module.exports = {
  findOrCreateUser,
  getUserByTelegramId,
  updatePhone,
  updateLocation,
  updateLanguage,
  isRegistrationComplete,
  blockUser,
  listUsers,
};
