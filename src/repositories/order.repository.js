const prisma = require("../config/prisma");

async function create(data) {
  return prisma.order.create({ data, include: orderIncludes() });
}

async function findById(orderId) {
  return prisma.order.findUnique({ where: { id: orderId }, include: orderIncludes() });
}

async function update(orderId, data) {
  return prisma.order.update({ where: { id: orderId }, data, include: orderIncludes() });
}

async function tryAssignCourier(orderId, courierId, playstationId, extra = {}, tx = prisma) {
  return tx.order.updateMany({
    where: {
      id: orderId,
      status: { in: ["ADMIN_CONFIRMED", "ACCEPTED"] },
      courierId: null,
    },
    data: {
      courierId,
      playstationId,
      status: "COURIER_ASSIGNED",
      acceptedAt: new Date(),
      assignedAt: new Date(),
      ...extra,
    },
  });
}

/**
 * Open (non-terminal) order for a user — used to enforce single active order.
 */
async function findOpenOrderForUser(userId, openStatuses, tx = prisma) {
  return tx.order.findFirst({
    where: { userId: Number(userId), status: { in: openStatuses } },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true },
  });
}

async function createStatusLog(orderId, status, { actorType, actorId, note } = {}, tx = prisma) {
  const INT32_MAX = 2147483647;
  let safeActorId = actorId == null ? null : Number(actorId);
  let safeNote = note || null;

  if (safeActorId != null && (!Number.isFinite(safeActorId) || Math.abs(safeActorId) > INT32_MAX)) {
    safeNote = [safeNote, `actorTelegramId=${actorId}`].filter(Boolean).join(" | ");
    safeActorId = null;
  }

  return tx.orderStatusLog.create({
    data: {
      orderId,
      status,
      actorType: actorType || null,
      actorId: safeActorId,
      note: safeNote,
    },
  });
}

async function listByCourierAndStatuses(courierId, statuses, { take = 20 } = {}) {
  return prisma.order.findMany({
    where: { courierId, status: { in: statuses } },
    orderBy: { createdAt: "desc" },
    take,
    include: orderIncludes(),
  });
}

async function listByStatus(status, { take = 20 } = {}) {
  return prisma.order.findMany({
    where: { status },
    orderBy: { createdAt: "desc" },
    take,
    include: orderIncludes(),
  });
}

async function listByStatuses(statuses, { take = 20 } = {}) {
  return prisma.order.findMany({
    where: { status: { in: statuses } },
    orderBy: { createdAt: "desc" },
    take,
    include: orderIncludes(),
  });
}

async function countByCourierAndStatus(courierId, status) {
  return prisma.order.count({ where: { courierId, status } });
}

function orderIncludes() {
  return {
    user: true,
    courier: true,
    deliveredByCourier: true,
    playstation: true,
    inventoryUnit: true,
    consoleItem: true,
    hdmiItem: true,
    powerItem: true,
    payments: true,
    rentalPrice: { include: { consoleCatalog: true } },
    promocode: true,
    orderItems: { include: { inventoryItem: true } },
    contract: true,
    photos: true,
    statusLogs: { orderBy: { changedAt: "asc" } },
  };
}

module.exports = {
  create,
  findById,
  update,
  tryAssignCourier,
  findOpenOrderForUser,
  createStatusLog,
  listByCourierAndStatuses,
  listByStatus,
  listByStatuses,
  countByCourierAndStatus,
};
