const prisma = require("../config/prisma");

async function findOrCreateUser(telegramId, fullName, username) {
  let user = await prisma.user.findUnique({ where: { telegramId: BigInt(telegramId) } });
  if (!user) {
    user = await prisma.user.create({
      data: { telegramId: BigInt(telegramId), fullName, username: username || null, lastActivityAt: new Date() },
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

async function updateLocation(telegramId, { address, latitude, longitude }) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { defaultAddress: address, latitude, longitude },
  });
}

async function updateLanguage(telegramId, language) {
  return prisma.user.update({
    where: { telegramId: BigInt(telegramId) },
    data: { language },
  });
}

async function isRegistrationComplete(user) {
  return Boolean(user && user.phone && (user.defaultAddress || (user.latitude && user.longitude)));
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
