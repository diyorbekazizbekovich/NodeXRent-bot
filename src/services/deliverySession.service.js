/**
 * Persistent DeliverySession — single source of truth for handover wizard.
 * Never rely on in-memory sessionStore for selections.
 */
const prisma = require("../config/prisma");
const {
  DeliveryStep,
  DeliverySessionStatus,
  joystickIdsOf,
} = require("../constants/deliverySession");

class DeliverySessionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeliverySessionError";
    this.code = code;
  }
}

async function getByOrderId(orderId) {
  return prisma.deliverySession.findUnique({
    where: { orderId: Number(orderId) },
  });
}

async function getInProgressForCourier(courierId, orderId = null) {
  return prisma.deliverySession.findFirst({
    where: {
      courierId: Number(courierId),
      status: DeliverySessionStatus.IN_PROGRESS,
      ...(orderId != null ? { orderId: Number(orderId) } : {}),
    },
    orderBy: { updatedAt: "desc" },
  });
}

async function getPhotoSessionForCourier(courierId) {
  return prisma.deliverySession.findFirst({
    where: {
      courierId: Number(courierId),
      status: DeliverySessionStatus.IN_PROGRESS,
      currentStep: DeliveryStep.PHOTO,
    },
    orderBy: { updatedAt: "desc" },
  });
}

/**
 * Start new session, or resume existing IN_PROGRESS (never wipe selections).
 * Pass { forceReset: true } only when courier explicitly restarts.
 */
async function startOrResume({ orderId, courierId, inventoryUnitId, forceReset = false }) {
  const oid = Number(orderId);
  const existing = await getByOrderId(oid);

  if (existing?.status === DeliverySessionStatus.COMPLETED) {
    throw new DeliverySessionError(
      "ALREADY_DONE",
      "Bu buyurtma allaqachon topshirilgan"
    );
  }

  if (
    existing?.status === DeliverySessionStatus.IN_PROGRESS &&
    Number(existing.courierId) === Number(courierId) &&
    !forceReset
  ) {
    // Keep selections; refresh inventoryUnitId if missing
    if (!existing.inventoryUnitId && inventoryUnitId != null) {
      return patch(oid, { inventoryUnitId: Number(inventoryUnitId) });
    }
    return existing;
  }

  return prisma.deliverySession.upsert({
    where: { orderId: oid },
    create: {
      orderId: oid,
      courierId: Number(courierId),
      inventoryUnitId: inventoryUnitId != null ? Number(inventoryUnitId) : null,
      selectedJoystickIds: [],
      selectedHdmiId: null,
      selectedPowerId: null,
      documentType: null,
      paymentMethod: null,
      consoleItemId: null,
      currentStep: DeliveryStep.JOYSTICKS,
      status: DeliverySessionStatus.IN_PROGRESS,
    },
    update: {
      courierId: Number(courierId),
      inventoryUnitId: inventoryUnitId != null ? Number(inventoryUnitId) : null,
      selectedJoystickIds: [],
      selectedHdmiId: null,
      selectedPowerId: null,
      documentType: null,
      paymentMethod: null,
      consoleItemId: null,
      currentStep: DeliveryStep.JOYSTICKS,
      status: DeliverySessionStatus.IN_PROGRESS,
    },
  });
}

/** @deprecated use startOrResume */
async function startOrReset(opts) {
  return startOrResume({ ...opts, forceReset: true });
}

async function patch(orderId, data) {
  return prisma.deliverySession.update({
    where: { orderId: Number(orderId) },
    data: {
      ...data,
      updatedAt: new Date(),
    },
  });
}

async function setStep(orderId, currentStep) {
  return patch(orderId, { currentStep });
}

async function toggleJoystick(orderId, itemId) {
  const session = await getByOrderId(orderId);
  if (!session || session.status !== DeliverySessionStatus.IN_PROGRESS) {
    throw new DeliverySessionError("NO_SESSION", "Topshirish sessiyasi topilmadi");
  }
  let selected = joystickIdsOf(session);
  const id = Number(itemId);
  if (selected.includes(id)) {
    selected = selected.filter((x) => x !== id);
  } else {
    if (selected.length >= 4) {
      throw new DeliverySessionError("JOYSTICK_LIMIT", "Faqat 4 ta!");
    }
    selected.push(id);
  }
  return patch(orderId, {
    selectedJoystickIds: selected,
    currentStep: DeliveryStep.JOYSTICKS,
  });
}

async function setJoysticksDone(orderId) {
  const session = await getByOrderId(orderId);
  if (!session) throw new DeliverySessionError("NO_SESSION", "Sessiya topilmadi");
  if (joystickIdsOf(session).length !== 4) {
    throw new DeliverySessionError("JOYSTICKS", "Aniq 4 ta tanlang");
  }
  return setStep(orderId, DeliveryStep.HDMI);
}

async function setHdmi(orderId, itemId) {
  return patch(orderId, {
    selectedHdmiId: Number(itemId),
    currentStep: DeliveryStep.POWER,
  });
}

async function setPower(orderId, itemId) {
  return patch(orderId, {
    selectedPowerId: Number(itemId),
    currentStep: DeliveryStep.COLLATERAL,
  });
}

async function setDocument(orderId, documentType) {
  return patch(orderId, {
    documentType,
    currentStep: DeliveryStep.PAYMENT,
  });
}

async function setAwaitNoneConfirm(orderId) {
  return setStep(orderId, DeliveryStep.COLLATERAL_CONFIRM);
}

async function setPayment(orderId, paymentMethod) {
  return patch(orderId, {
    paymentMethod,
    currentStep: DeliveryStep.PHOTO,
  });
}

async function markCompleted(orderId, tx = null) {
  const client = tx || prisma;
  return client.deliverySession.updateMany({
    where: {
      orderId: Number(orderId),
      status: DeliverySessionStatus.IN_PROGRESS,
    },
    data: {
      status: DeliverySessionStatus.COMPLETED,
      currentStep: DeliveryStep.COMPLETED,
      updatedAt: new Date(),
    },
  });
}

async function cancel(orderId) {
  const existing = await getByOrderId(orderId);
  if (!existing) return null;
  if (existing.status !== DeliverySessionStatus.IN_PROGRESS) return existing;
  return patch(orderId, {
    status: DeliverySessionStatus.CANCELLED,
    currentStep: DeliveryStep.CANCELLED,
  });
}

const SESSION_TTL_MS = 30 * 60 * 1000;

/** Expire stale IN_PROGRESS sessions (photo trap / abandoned wizards). */
async function expireStaleSessions({ olderThanMs = SESSION_TTL_MS } = {}) {
  const cutoff = new Date(Date.now() - olderThanMs);
  const result = await prisma.deliverySession.updateMany({
    where: {
      status: DeliverySessionStatus.IN_PROGRESS,
      updatedAt: { lt: cutoff },
    },
    data: {
      status: DeliverySessionStatus.CANCELLED,
      currentStep: DeliveryStep.CANCELLED,
      updatedAt: new Date(),
    },
  });
  return result.count;
}

async function cancelForCourier(courierId, orderId = null) {
  return prisma.deliverySession.updateMany({
    where: {
      courierId: Number(courierId),
      status: DeliverySessionStatus.IN_PROGRESS,
      ...(orderId != null ? { orderId: Number(orderId) } : {}),
    },
    data: {
      status: DeliverySessionStatus.CANCELLED,
      currentStep: DeliveryStep.CANCELLED,
      updatedAt: new Date(),
    },
  });
}

/** Load session or throw — used by every callback. */
async function requireInProgress(orderId, courierId) {
  const session = await getByOrderId(orderId);
  if (!session || session.status !== DeliverySessionStatus.IN_PROGRESS) {
    throw new DeliverySessionError(
      "NO_SESSION",
      "Topshirish sessiyasi topilmadi. «📍 Yetib keldim» ni qayta bosing."
    );
  }
  if (Number(session.courierId) !== Number(courierId)) {
    throw new DeliverySessionError("FORBIDDEN", "Bu sessiya boshqa kuryerga tegishli");
  }
  return session;
}

module.exports = {
  DeliverySessionError,
  getByOrderId,
  getInProgressForCourier,
  getPhotoSessionForCourier,
  startOrResume,
  startOrReset,
  patch,
  setStep,
  toggleJoystick,
  setJoysticksDone,
  setHdmi,
  setPower,
  setDocument,
  setAwaitNoneConfirm,
  setPayment,
  markCompleted,
  cancel,
  cancelForCourier,
  expireStaleSessions,
  SESSION_TTL_MS,
  requireInProgress,
  joystickIdsOf,
};
