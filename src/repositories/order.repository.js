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

async function tryAssignCourier(orderId, courierId, playstationId, extra = {}) {
  return prisma.order.updateMany({
    where: { id: orderId, status: "PENDING", courierId: null },
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

async function createStatusLog(orderId, status, { actorType, actorId, note } = {}) {
  return prisma.orderStatusLog.create({
    data: { orderId, status, actorType, actorId, note },
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
    playstation: true,
    inventoryUnit: true,
    payments: true,
    rentalPrice: { include: { consoleCatalog: true } },
    payment: true,
    statusLogs: { orderBy: { changedAt: "asc" } },
  };
}

module.exports = {
  create,
  findById,
  update,
  tryAssignCourier,
  createStatusLog,
  listByCourierAndStatuses,
  listByStatus,
  listByStatuses,
  countByCourierAndStatus,
};
