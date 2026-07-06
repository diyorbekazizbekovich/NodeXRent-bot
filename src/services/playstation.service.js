const prisma = require("../config/prisma");

async function addPlaystation(courierId, { type, serialNumber, accessories }) {
  return prisma.playstation.create({
    data: { courierId, type, serialNumber, accessories },
  });
}

async function listByCourier(courierId) {
  return prisma.playstation.findMany({ where: { courierId } });
}

async function setStatus(playstationId, status) {
  return prisma.playstation.update({
    where: { id: playstationId },
    data: { status },
  });
}

/**
 * Berilgan konsol turi, hudud va vaqt oralig'ida bo'sh (band bo'lmagan) PlayStationlarni topadi.
 * Har bir nomzod uchun tegishli kuryer ma'lumoti ham qaytariladi (masofa hisoblash uchun).
 */
async function findAvailableForCourier(courierId, consoleType, startDatetime, endDatetime) {
  const available = await findAvailable({ consoleType, startDatetime, endDatetime });
  return available.find((ps) => ps.courierId === courierId) || null;
}

async function findAvailable({ consoleType, startDatetime, endDatetime }) {
  const candidates = await prisma.playstation.findMany({
    where: {
      type: consoleType,
      status: "AVAILABLE",
      courier: { isActive: true },
    },
    include: { courier: true },
  });

  const busyOrders = await prisma.order.findMany({
    where: {
      status: {
        in: ["PENDING", "COURIER_ASSIGNED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "DELIVERED", "RETURN_REQUESTED"],
      },
      AND: [{ startDatetime: { lte: endDatetime } }, { endDatetime: { gte: startDatetime } }],
    },
    select: { playstationId: true },
  });
  const busyIds = new Set(busyOrders.map((o) => o.playstationId).filter(Boolean));

  return candidates.filter((ps) => !busyIds.has(ps.id));
}

module.exports = { addPlaystation, listByCourier, setStatus, findAvailable, findAvailableForCourier };
