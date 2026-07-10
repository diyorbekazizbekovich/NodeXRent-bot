const prisma = require("../config/prisma");

async function findByTelegramId(telegramId) {
  return prisma.courier.findUnique({ where: { telegramId: BigInt(telegramId) } });
}

async function findById(id) {
  return prisma.courier.findUnique({
    where: { id },
    include: { playstations: true, orders: { take: 5, orderBy: { createdAt: "desc" } } },
  });
}

async function create(data) {
  return prisma.courier.create({ data });
}

async function update(id, data) {
  return prisma.courier.update({ where: { id }, data });
}

async function remove(id) {
  return prisma.courier.delete({ where: { id } });
}

async function listActive() {
  return prisma.courier.findMany({ where: { isActive: true }, orderBy: { createdAt: "desc" } });
}

async function listAll({ search, skip = 0, take = 20 } = {}) {
  const where = search
    ? {
        OR: [
          { fullName: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { username: { contains: search, mode: "insensitive" } },
          { region: { contains: search, mode: "insensitive" } },
        ],
      }
    : undefined;

  return prisma.courier.findMany({
    where,
    skip,
    take,
    orderBy: { createdAt: "desc" },
    include: {
      playstations: true,
      _count: { select: { orders: true } },
    },
  });
}

async function getStats(courierId) {
  const [active, completed, cancelled, total] = await Promise.all([
    prisma.order.count({
      where: {
        courierId,
        status: { in: ["COURIER_ASSIGNED", "ACCEPTED", "ON_THE_WAY", "ARRIVED", "DELIVERED", "ACTIVE", "RETURN_REQUESTED"] },
      },
    }),
    prisma.order.count({ where: { courierId, status: { in: ["COMPLETED", "RETURNED"] } } }),
    prisma.order.count({ where: { courierId, status: "CANCELLED" } }),
    prisma.order.count({ where: { courierId } }),
  ]);
  return { active, completed, cancelled, total };
}

async function listAllAdmins() {
  return prisma.admin.findMany();
}

module.exports = {
  findByTelegramId,
  findById,
  create,
  update,
  remove,
  listActive,
  listAll,
  getStats,
  listAllAdmins,
};
