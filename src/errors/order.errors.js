class OrderAssignmentError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "OrderAssignmentError";
    this.code = code;
  }
}

module.exports = { OrderAssignmentError };
