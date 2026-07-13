/**
 * Compatibility facade — prefer orderWorkflow / courierWorkflow / orderStatus.manager.
 * Existing callers keep importing this module.
 */
const orderWorkflowService = require("./orderWorkflow.service");
const courierWorkflowService = require("./courierWorkflow.service");
const orderStatusManager = require("./orderStatus.manager");
const orderNotificationService = require("./orderNotification.service");
const { OrderAssignmentError } = require("../errors/order.errors");
const orderRepository = require("../repositories/order.repository");
const courierRepository = require("../repositories/courier.repository");

async function broadcastNewOrder(order) {
  await orderWorkflowService.onOrderCreated(order);
}

async function confirmOrderByAdmin(orderId, adminTelegramId) {
  return orderWorkflowService.confirmByAdmin(orderId, adminTelegramId);
}

async function rejectOrderByAdmin(orderId, adminTelegramId) {
  return orderWorkflowService.rejectByAdmin(orderId, adminTelegramId);
}

async function cancelOrderByAdmin(orderId, adminTelegramId) {
  return orderWorkflowService.cancelByAdmin(orderId, adminTelegramId);
}

async function cancelOrderBySystem(orderId, opts) {
  return orderWorkflowService.cancelBySystem(orderId, opts);
}

async function acceptOrderByCourier(orderId, courierId) {
  return courierWorkflowService.acceptOrder(orderId, courierId);
}

async function rejectOrderByCourier(orderId, courierId) {
  return courierWorkflowService.rejectOrder(orderId, courierId);
}

async function updateCourierOrderStatus(orderId, courierId, status) {
  return courierWorkflowService.updateOwnedStatus(orderId, courierId, status);
}

async function listCourierDashboard(courierId) {
  return courierWorkflowService.listCourierDashboard(courierId);
}

async function updateOrderStatus(orderId, status, opts = {}) {
  return orderStatusManager.transitionOrderStatus({
    orderId,
    toStatus: status,
    actorType: opts.actorType,
    actorId: opts.actorId,
    note: opts.note,
    timestamps: opts.timestamps || {},
  });
}

async function terminateOrderWithRelease(opts) {
  return orderWorkflowService.terminateWithRelease(opts);
}

/**
 * @deprecated Manual admin assign removed from primary UI.
 * Emergency: only ADMIN_CONFIRMED pool → direct assign one courier.
 */
async function assignOrderByAdmin(orderId, courierId) {
  const { OrderStatus } = require("../constants/orderStatus");
  const { isCourierPoolStatus } = require("../constants/orderTransitions");

  const courier = await courierRepository.findById(courierId);
  if (!courier || !courier.isActive) {
    throw new OrderAssignmentError("COURIER_INACTIVE", "Kuryer faol emas");
  }

  const order = await orderRepository.findById(orderId);
  if (!order) throw new OrderAssignmentError("NOT_FOUND", "Buyurtma topilmadi");

  if (!isCourierPoolStatus(order.status) || order.courierId) {
    throw new OrderAssignmentError(
      "NOT_AVAILABLE",
      "Faqat ADMIN_CONFIRMED (kuryersiz) buyurtmaga emergency biriktirish mumkin"
    );
  }

  await courierWorkflowService.assignWithRetry(orderId, courierId, order, {
    assignedByAdmin: true,
  });

  const updated = await orderRepository.findById(orderId);
  await orderNotificationService.notifySingleCourierAssignment(updated, courier);
  await orderNotificationService.notifyCustomerOrderAccepted(updated);
  await orderNotificationService.notifyAdminCourierAccepted(updated);
  await orderNotificationService.notifyOtherCouriersOrderTaken(updated, courierId);
  return updated;
}

module.exports = {
  broadcastNewOrder,
  acceptOrderByCourier,
  rejectOrderByCourier,
  rejectOrderByAdmin,
  assignOrderByAdmin,
  confirmOrderByAdmin,
  cancelOrderByAdmin,
  cancelOrderBySystem,
  terminateOrderWithRelease,
  updateCourierOrderStatus,
  updateOrderStatus,
  listCourierDashboard,
  ACTIVE_COURIER_STATUSES: courierWorkflowService.ACTIVE_COURIER_STATUSES,
};
