const prisma = require("../config/prisma");
const { ACTIVE_RENTAL_STATUSES } = require("../constants/orderStatus");
const { REVENUE_STATUSES } = require("../constants/orderStatus");

async function findById(userId) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      orders: {
        orderBy: { createdAt: "desc" },
        include: {
          rentalPrice: { include: { consoleCatalog: true } },
          payments: true,
          inventoryUnit: true,
        },
      },
    },
  });
}

async function searchUsers({ query, skip = 0, take = 20 } = {}) {
  const where = query
    ? {
        OR: [
          { fullName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query } },
          { username: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};
  return prisma.user.findMany({
    where,
    skip,
    take,
    orderBy: { lastActivityAt: "desc" },
  });
}

async function getOrderStats(userId) {
  const [totalOrders, cancelledOrders, activeRentals, spendAgg, lastOrder] = await Promise.all([
    prisma.order.count({ where: { userId } }),
    prisma.order.count({ where: { userId, status: { in: ["CANCELLED", "EXPIRED"] } } }),
    prisma.order.count({ where: { userId, status: { in: ACTIVE_RENTAL_STATUSES } } }),
    prisma.order.aggregate({
      where: { userId, status: { in: REVENUE_STATUSES } },
      _sum: { totalPrice: true, deliveryFee: true },
    }),
    prisma.order.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const totalSpent =
    Number(spendAgg._sum.totalPrice ?? 0) + Number(spendAgg._sum.deliveryFee ?? 0);
  return { totalOrders, cancelledOrders, activeRentals, totalSpent, lastOrderAt: lastOrder?.createdAt };
}

async function updateRating(userId, customerRating) {
  return prisma.user.update({ where: { id: userId }, data: { customerRating } });
}

async function updateNotes(userId, adminNotes) {
  return prisma.user.update({ where: { id: userId }, data: { adminNotes } });
}

async function touchActivity(userId) {
  return prisma.user.update({
    where: { id: userId },
    data: { lastActivityAt: new Date() },
  });
}

module.exports = {
  findById,
  searchUsers,
  getOrderStats,
  updateRating,
  updateNotes,
  touchActivity,
};
