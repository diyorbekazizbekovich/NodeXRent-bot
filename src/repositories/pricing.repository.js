const prisma = require("../config/prisma");

async function findActiveConsoles() {
  return prisma.consoleCatalog.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

async function findAllConsoles() {
  return prisma.consoleCatalog.findMany({
    orderBy: { sortOrder: "asc" },
    include: { rentalPrices: { orderBy: { hours: "asc" } } },
  });
}

async function findConsoleByCode(code) {
  return prisma.consoleCatalog.findUnique({ where: { code } });
}

async function findConsoleById(id) {
  return prisma.consoleCatalog.findUnique({
    where: { id },
    include: { rentalPrices: { orderBy: { hours: "asc" } } },
  });
}

async function createConsole({ code, displayName, sortOrder = 0 }) {
  return prisma.consoleCatalog.create({
    data: { code: code.toUpperCase(), displayName, sortOrder },
  });
}

async function updateConsole(id, data) {
  return prisma.consoleCatalog.update({ where: { id }, data });
}

async function findActiveByConsoleAndHours(consoleCode, hours) {
  return prisma.rentalPrice.findFirst({
    where: {
      hours,
      isActive: true,
      consoleCatalog: { code: consoleCode, isActive: true },
    },
    include: { consoleCatalog: true },
  });
}

async function findActivePricesByConsoleCode(consoleCode) {
  return prisma.rentalPrice.findMany({
    where: {
      isActive: true,
      consoleCatalog: { code: consoleCode, isActive: true },
    },
    orderBy: { hours: "asc" },
    include: { consoleCatalog: true },
  });
}

async function findRentalPriceById(id) {
  return prisma.rentalPrice.findUnique({
    where: { id },
    include: { consoleCatalog: true },
  });
}

async function findAllRentalPrices({ includeInactive = false } = {}) {
  return prisma.rentalPrice.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: [{ consoleCatalog: { sortOrder: "asc" } }, { hours: "asc" }],
    include: { consoleCatalog: true },
  });
}

async function createRentalPrice({ consoleCatalogId, hours, price, currency = "UZS" }) {
  return prisma.rentalPrice.create({
    data: { consoleCatalogId, hours, price, currency },
    include: { consoleCatalog: true },
  });
}

async function updateRentalPrice(id, data) {
  return prisma.rentalPrice.update({
    where: { id },
    data,
    include: { consoleCatalog: true },
  });
}

async function deleteRentalPrice(id) {
  return prisma.rentalPrice.delete({ where: { id } });
}

module.exports = {
  findActiveConsoles,
  findAllConsoles,
  findConsoleByCode,
  findConsoleById,
  createConsole,
  updateConsole,
  findActiveByConsoleAndHours,
  findActivePricesByConsoleCode,
  findRentalPriceById,
  findAllRentalPrices,
  createRentalPrice,
  updateRentalPrice,
  deleteRentalPrice,
};
