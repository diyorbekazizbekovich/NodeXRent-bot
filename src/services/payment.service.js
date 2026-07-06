const paymentRepository = require("../repositories/payment.repository");
const { labelStatus, labelMethod } = require("../constants/paymentStatus");

async function initOrderPayment(order) {
  const amount = Number(order.totalPrice) + Number(order.deliveryFee || 0);
  return paymentRepository.createForOrder(order.id, amount, "CASH");
}

async function addPayment(data) {
  return paymentRepository.recordPayment(data);
}

async function getSummary(orderId) {
  return paymentRepository.getOrderPaymentSummary(orderId);
}

function formatSummary(summary) {
  if (!summary) return "To'lov ma'lumoti yo'q.";
  return (
    `💳 *To'lov holati:* ${labelStatus(summary.status)}\n` +
    `Jami: ${summary.due.toLocaleString()} so'm\n` +
    `To'langan: ${summary.paid.toLocaleString()} so'm\n` +
    `Qolgan: ${summary.remaining.toLocaleString()} so'm`
  );
}

function formatPaymentList(payments) {
  if (!payments.length) return "To'lovlar yo'q.";
  return payments
    .map(
      (p) =>
        `• ${Number(p.amount).toLocaleString()} so'm — ${labelMethod(p.method)} — ${labelStatus(p.status)} (${p.paidAt ? new Date(p.paidAt).toLocaleString("uz-UZ") : "—"})`
    )
    .join("\n");
}

module.exports = {
  initOrderPayment,
  addPayment,
  getSummary,
  formatSummary,
  formatPaymentList,
};
