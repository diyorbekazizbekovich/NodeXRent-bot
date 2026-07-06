const prisma = require("../config/prisma");
const { PaymentStatus } = require("../constants/paymentStatus");

async function createForOrder(orderId, amount, method = "CASH") {
  return prisma.orderPayment.create({
    data: {
      orderId,
      amount,
      method,
      status: PaymentStatus.UNPAID,
    },
  });
}

async function recordPayment({ orderId, amount, method = "CASH", status = PaymentStatus.PAID, note }) {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.orderPayment.create({
      data: {
        orderId,
        amount,
        method,
        status,
        paidAt: status === PaymentStatus.PAID ? new Date() : null,
        note,
      },
    });
    await syncOrderPaymentStatus(tx, orderId);
    return payment;
  });
}

async function syncOrderPaymentStatus(tx, orderId) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) return;

  const due = Number(order.totalPrice) + Number(order.deliveryFee);
  const paid = order.payments
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((s, p) => s + Number(p.amount), 0);

  let aggregateStatus = PaymentStatus.UNPAID;
  if (paid >= due) aggregateStatus = PaymentStatus.PAID;
  else if (paid > 0) aggregateStatus = PaymentStatus.PARTIAL;

  await tx.orderPayment.updateMany({
    where: { orderId, status: PaymentStatus.UNPAID },
    data: { status: aggregateStatus === PaymentStatus.PAID ? PaymentStatus.PAID : PaymentStatus.UNPAID },
  });
}

async function listByOrder(orderId) {
  return prisma.orderPayment.findMany({
    where: { orderId },
    orderBy: { createdAt: "asc" },
  });
}

async function getOrderPaymentSummary(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true },
  });
  if (!order) return null;
  const due = Number(order.totalPrice) + Number(order.deliveryFee);
  const paid = order.payments
    .filter((p) => p.status === PaymentStatus.PAID)
    .reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(due - paid, 0);
  let status = PaymentStatus.UNPAID;
  if (paid >= due) status = PaymentStatus.PAID;
  else if (paid > 0) status = PaymentStatus.PARTIAL;
  return { due, paid, remaining, status, payments: order.payments };
}

module.exports = {
  createForOrder,
  recordPayment,
  listByOrder,
  getOrderPaymentSummary,
};
