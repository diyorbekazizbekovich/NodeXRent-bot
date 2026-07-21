/**
 * Dynamic payment / extension totals for an Order (no hardcoded amounts).
 */
const { PaymentStatus } = require("../../constants/paymentStatus");
const { labelMethod } = require("../../constants/paymentStatus");

function money(n) {
  return `${Number(n || 0).toLocaleString("uz-UZ")} so'm`;
}

/**
 * @param {object} order — with payments[], extensions[], promocode, rentalPrice
 */
function buildPaymentSummary(order) {
  const baseRental = Number(order.rentalPrice?.price ?? order.totalPrice ?? 0);
  const deliveryFee = Number(order.deliveryFee || 0);
  const deposit = Number(order.depositAmount || 0);

  const approvedExt = (order.extensions || []).filter((e) => e.status === "APPROVED");
  const pendingExt = (order.extensions || []).filter((e) => e.status === "PENDING");

  const extensionLines = approvedExt.map((e) => ({
    id: e.id,
    extraHours: Number(e.extraHours || 0),
    extraPrice: Number(e.extraPrice || 0),
    label: `+${e.extraHours} soat = ${money(e.extraPrice)}`,
  }));
  const extensionTotal = extensionLines.reduce((s, e) => s + e.extraPrice, 0);

  // Discount: difference between base+delivery+ext and recorded totalPrice path
  // Prefer promocode-derived if available, else inferred
  let discount = 0;
  if (order.promocode) {
    const pct = Number(order.promocode.discountPercent || 0);
    const fixed = Number(order.promocode.discountAmount || 0);
    if (order.promocode.discountType === "FIXED" && fixed > 0) discount = fixed;
    else if (pct > 0) discount = Math.round((baseRental * pct) / 100);
    else if (fixed > 0) discount = fixed;
  }

  const expectedDue = Math.max(0, baseRental + deliveryFee + extensionTotal - discount);
  // finalPaidAmount / payments are source of truth for paid
  const paidFromFlag = order.paymentReceived
    ? Number(order.finalPaidAmount != null ? order.finalPaidAmount : expectedDue)
    : 0;
  const payments = order.payments || [];
  const paidFromRows = payments
    .filter((p) => p.status === PaymentStatus.PAID || p.status === "PAID")
    .reduce((s, p) => s + Number(p.amount || 0), 0);
  const totalPaid = Math.max(paidFromFlag, paidFromRows);
  const outstanding = Math.max(0, expectedDue - totalPaid);

  const method =
    order.paymentMethod ||
    payments.find((p) => p.status === PaymentStatus.PAID || p.status === "PAID")?.method ||
    null;

  return {
    baseRental,
    deliveryFee,
    deposit,
    extensionCount: approvedExt.length,
    extensionLines,
    extensionTotal,
    pendingExtensionCount: pendingExt.length,
    discount,
    promoCode: order.promocode?.code || null,
    expectedDue,
    totalPaid,
    outstanding,
    paymentMethod: method,
    paymentMethodLabel: method ? labelMethod(method) : "—",
    paymentReceived: Boolean(order.paymentReceived),
  };
}

function formatPaymentSection(summary) {
  const extBlock =
    summary.extensionLines.length > 0
      ? summary.extensionLines.map((e) => `  ${e.label}`).join("\n")
      : "  —";

  return (
    `💰 <b>To'lov</b>\n\n` +
    `Ijara:\n${money(summary.baseRental)}\n\n` +
    `Yetkazib berish:\n${money(summary.deliveryFee)}\n\n` +
    `Uzaytirish (${summary.extensionCount}):\n${extBlock}\n\n` +
    `Chegirma` +
    (summary.promoCode ? ` (${summary.promoCode})` : "") +
    `:\n${money(summary.discount)}\n\n` +
    `Jami:\n${money(summary.expectedDue)}\n\n` +
    `To'langan:\n${money(summary.totalPaid)}\n\n` +
    `Qarz:\n${money(summary.outstanding)}\n\n` +
    `Usul: ${summary.paymentMethodLabel}` +
    (summary.deposit > 0 ? `\nDepozit: ${money(summary.deposit)}` : "")
  );
}

module.exports = {
  buildPaymentSummary,
  formatPaymentSection,
  money,
};
