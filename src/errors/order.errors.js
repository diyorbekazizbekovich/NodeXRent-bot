class OrderAssignmentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrderAssignmentError";
    this.code = code;
  }
}

class ActiveOrderExistsError extends Error {
  constructor(existingOrderId, message) {
    super(
      message ||
        "Sizda hali yakunlanmagan buyurtma mavjud. Yangi buyurtma berishdan oldin mavjud buyurtmangizni yakunlang yoki bekor qiling."
    );
    this.name = "ActiveOrderExistsError";
    this.code = "ACTIVE_ORDER_EXISTS";
    this.messageKey = "orderErrors.activeOrderExists";
    this.existingOrderId = existingOrderId;
  }
}

module.exports = { OrderAssignmentError, ActiveOrderExistsError };
