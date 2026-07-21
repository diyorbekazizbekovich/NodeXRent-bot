/**
 * Return / early-return request summary for courier order card.
 */
const { ReturnRequestStatus, labelReason } = require("../../constants/earlyReturn");
const { OrderStatus } = require("../../constants/orderStatus");
const { formatDatetime } = require("../../utils/dateHelper");
const { escapeHtml } = require("../../utils/telegramFormat");

function buildReturnSummary(order) {
  const requests = [...(order.returnRequests || [])].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const pending = requests.find((r) => r.status === ReturnRequestStatus.PENDING_ADMIN);
  const approved = requests.find((r) => r.status === ReturnRequestStatus.APPROVED);
  const latest = requests[0] || null;

  const orderReturnStatuses = [
    OrderStatus.RETURN_REQUESTED,
    OrderStatus.RETURN_ASSIGNED,
    OrderStatus.PICKED_UP,
  ];
  const orderHasReturn = orderReturnStatuses.includes(order.status);

  return {
    hasRequest: Boolean(latest) || orderHasReturn,
    pending,
    approved,
    latest,
    orderStatus: order.status,
    canStartReturn: order.status === OrderStatus.RETURN_REQUESTED || order.status === OrderStatus.RETURN_ASSIGNED,
    canPickUpNow:
      order.status === OrderStatus.RETURN_ASSIGNED ||
      (order.status === OrderStatus.RETURN_REQUESTED && Boolean(approved)),
    requestedPickupTime: latest?.requestedPickupTime || null,
    pickupAddress: latest?.pickupAddress || order.address || null,
    reason: latest ? labelReason(latest.reason, latest.customReason) : null,
    requestStatus: latest?.status || null,
  };
}

function formatReturnSection(ret) {
  if (!ret.hasRequest && !ret.latest) {
    return (
      `↩️ <b>Qaytarish</b>\n\n` +
      `So'rov: YO'Q\n` +
      `Holat: mijoz hali so'rov yubormagan`
    );
  }
  const r = ret.latest;
  return (
    `↩️ <b>Qaytarish</b>\n\n` +
    `So'rov: HA\n` +
    `Status: ${escapeHtml(r?.status || ret.orderStatus)}\n` +
    (r?.requestedPickupTime
      ? `🕒 Olib ketish: ${escapeHtml(formatDatetime(r.requestedPickupTime))}\n`
      : "") +
    (r?.pickupAddress ? `📍 Manzil: ${escapeHtml(r.pickupAddress)}\n` : "") +
    (ret.reason ? `📝 Sabab: ${escapeHtml(ret.reason)}` : "")
  );
}

module.exports = {
  buildReturnSummary,
  formatReturnSection,
};
