const prisma = require("../config/prisma");
const { LOCATION_UPDATABLE_STATUSES } = require("../constants/orderStatus");

/**
 * @param {import("@prisma/client").Prisma.TransactionClient | typeof prisma} [db]
 */
function client(db) {
  return db || prisma;
}

async function findUpdatableByUser(userId, { take = 10 } = {}, db) {
  return client(db).order.findMany({
    where: {
      userId,
      status: { in: LOCATION_UPDATABLE_STATUSES },
      paymentReceived: false,
    },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      user: true,
      courier: true,
      rentalPrice: true,
      inventoryUnit: true,
    },
  });
}

async function findOrderForUpdate(orderId, db) {
  return client(db).order.findUnique({
    where: { id: orderId },
    include: {
      user: true,
      courier: true,
      rentalPrice: true,
      inventoryUnit: true,
    },
  });
}

async function findLatestHistory(orderId, db) {
  return client(db).orderLocationHistory.findFirst({
    where: { orderId },
    orderBy: { createdAt: "desc" },
  });
}

async function createHistory(data, db) {
  return client(db).orderLocationHistory.create({ data });
}

async function updateOrderLocation(orderId, { address, latitude, longitude }, db) {
  return client(db).order.update({
    where: { id: orderId },
    data: { address, latitude, longitude },
    include: {
      user: true,
      courier: true,
      rentalPrice: true,
      inventoryUnit: true,
    },
  });
}

module.exports = {
  findUpdatableByUser,
  findOrderForUpdate,
  findLatestHistory,
  createHistory,
  updateOrderLocation,
};
