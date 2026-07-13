const prisma = require("../config/prisma");
const deviceStatusService = require("./deviceStatus.service");
const { DeviceStatus } = require("../constants/deviceStatus");

async function addPlaystation(courierId, { type, serialNumber, accessories }) {
  return prisma.playstation.create({
    data: { courierId, type, serialNumber, accessories, status: DeviceStatus.AVAILABLE },
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
 * Faqat AVAILABLE qurilmalar. Ta'mir / band / reserved — hech qachon.
 */
async function findAvailableForCourier(courierId, consoleType, startDatetime, endDatetime) {
  return deviceStatusService.findAssignableForCourier(
    courierId,
    consoleType,
    startDatetime,
    endDatetime
  );
}

async function findAvailable({ consoleType, startDatetime, endDatetime }) {
  return deviceStatusService.listAssignablePlaystations({
    consoleType,
    startDatetime,
    endDatetime,
  });
}

module.exports = {
  addPlaystation,
  listByCourier,
  setStatus,
  findAvailable,
  findAvailableForCourier,
  DeviceStatus,
};
