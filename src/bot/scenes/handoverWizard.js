/**
 * Courier delivery (handover) wizard — DB-backed state machine.
 *
 * Source of truth: DeliverySession (PostgreSQL), NOT sessionStore RAM.
 * sessionStore is only a thin PHOTO pointer so message router knows to expect a photo.
 *
 * ROOT CAUSE of prior bug:
 *   collateral callback required `_hwConsoleId` which was always null after
 *   Console was removed from professional inventory → "Avval inventarni tanlang"
 *   and wizard restart wiped RAM selections.
 */
const sessionStore = require("../sessionStore");
const orderService = require("../../services/order.service");
const inventoryItemService = require("../../services/inventoryItem.service");
const { ITEM_TYPES } = require("../../constants/inventoryItem");
const deliveryHandoverService = require("../../services/deliveryHandover.service");
const { DeliveryHandoverError } = require("../../services/deliveryHandover.service");
const deliverySessionService = require("../../services/deliverySession.service");
const { DeliverySessionError } = require("../../services/deliverySession.service");
const {
  DeliveryStep,
  PHOTO_RAM_STEP,
  hasAccessoryKit,
  hasUnitBound,
  joystickIdsOf,
} = require("../../constants/deliverySession");
const courierKeyboards = require("../keyboards/courier.keyboards");
const invKb = require("../keyboards/courier.inventory.keyboards");
const orderPhotoService = require("../../services/orderPhoto.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const logger = require("../../utils/logger");

/** RAM step labels kept for courier.handlers photo gate compatibility */
const STEPS = {
  JOYSTICKS: "hw:joysticks",
  HDMI: "hw:hdmi",
  POWER: "hw:power",
  COLLATERAL: "hw:collateral",
  COLLATERAL_CONFIRM: "hw:collateral_confirm",
  PAYMENT: "hw:payment",
  PHOTO: PHOTO_RAM_STEP,
};

const handoverLocks = new Set();

function setPhotoRamPointer(chatId, orderId) {
  sessionStore.beginAction(chatId, PHOTO_RAM_STEP, {
    _hwOrderId: orderId,
    _hwAwaitPhoto: true,
  });
}

function clearPhotoRamPointer(chatId) {
  const s = sessionStore.getSession(chatId);
  if (s.step === PHOTO_RAM_STEP || String(s.step || "").startsWith("hw:")) {
    sessionStore.clearSession(chatId);
  }
}

async function clearKb(bot, query) {
  try {
    await bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: query.message.chat.id, message_id: query.message.message_id }
    );
  } catch (_) {}
}

async function startHandoverWizard(bot, chatId, orderId, courier) {
  const order = await orderService.getOrderById(orderId);
  if (!order) {
    await bot.sendMessage(chatId, "Buyurtma topilmadi");
    return;
  }
  if (!courier?.id) {
    await bot.sendMessage(chatId, "Kuryer topilmadi");
    return;
  }
  if (order.courierId !== courier.id) {
    await bot.sendMessage(chatId, "Bu buyurtma sizga tegishli emas");
    return;
  }
  if (!order.inventoryUnitId) {
    await bot.sendMessage(
      chatId,
      "❗️ Buyurtmaga InventoryUnit biriktirilmagan.\nAdmin qayta tasdiqlashi kerak."
    );
    return;
  }

  const unitLabel = order.inventoryUnit?.unitCode || order.consoleType || "—";

  let session;
  try {
    session = await deliverySessionService.startOrResume({
      orderId,
      courierId: courier.id,
      inventoryUnitId: order.inventoryUnitId,
    });
  } catch (err) {
    const msg =
      err instanceof DeliverySessionError ? err.message : err.message || "Xatolik";
    await bot.sendMessage(chatId, `❗️ ${msg}`);
    return;
  }

  clearPhotoRamPointer(chatId);

  const resumed = session.currentStep !== DeliveryStep.JOYSTICKS || hasAccessoryKit(session);
  await bot.sendMessage(
    chatId,
    `📍 Topshirish wizard (#${orderId})\n\n` +
      `🎮 Konsol (InventoryUnit): <b>${unitLabel}</b>\n` +
      `Status: RESERVED → topshirishda RENTED\n` +
      (resumed ? `\n♻️ Davom ettirilmoqda (tanlovlar saqlangan).\n` : `\nEndi aksessuarlarni tanlang.`),
    { parse_mode: "HTML" }
  );

  await resumeAtStep(bot, chatId, orderId, session);
  await deliveryHandoverService.notifyAdminStep(
    orderId,
    `Yetib kelindi — topshirish (${unitLabel})`
  );
}

/** Continue from persisted currentStep without wiping selections. */
async function resumeAtStep(bot, chatId, orderId, session) {
  const step = session.currentStep;
  if (step === DeliveryStep.PHOTO) {
    await askPhoto(bot, chatId, orderId);
    return;
  }
  if (step === DeliveryStep.PAYMENT) {
    await askPayment(bot, chatId, orderId);
    return;
  }
  if (step === DeliveryStep.COLLATERAL || step === DeliveryStep.COLLATERAL_CONFIRM) {
    await askCollateral(bot, chatId, orderId);
    return;
  }
  if (step === DeliveryStep.POWER) {
    await askPower(bot, chatId, orderId);
    return;
  }
  if (step === DeliveryStep.HDMI) {
    await askHdmi(bot, chatId, orderId);
    return;
  }
  await askJoysticks(bot, chatId, orderId);
}

async function askJoysticks(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.JOYSTICKS);
  const session = await deliverySessionService.getByOrderId(orderId);
  const selected = joystickIdsOf(session);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.JOYSTICK, {
    reservedOrderId: orderId,
  });
  await bot.sendMessage(
    chatId,
    `2️⃣ Qaysi 4 ta Joystick topshirildi?\n` +
      `Tanlang (aniq 4 ta). Hozir: ${selected.length}/4`,
    invKb.joystickPickKeyboard(orderId, list, selected)
  );
}

async function askHdmi(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.HDMI);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.HDMI, {
    reservedOrderId: orderId,
  });
  await bot.sendMessage(
    chatId,
    `3️⃣ Qaysi HDMI kabel topshirildi? (bitta)`,
    invKb.singlePickKeyboard(orderId, list, "hdmi")
  );
}

async function askPower(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.POWER);
  const list = await inventoryItemService.listAvailable(ITEM_TYPES.POWER, {
    reservedOrderId: orderId,
  });
  await bot.sendMessage(
    chatId,
    `4️⃣ Qaysi Power kabel topshirildi? (bitta)`,
    invKb.singlePickKeyboard(orderId, list, "power")
  );
}

async function askCollateral(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.COLLATERAL);
  await bot.sendMessage(
    chatId,
    `5️⃣ Mijozdan qanday hujjat olindi?`,
    courierKeyboards.handoverCollateralKeyboard(orderId)
  );
}

async function askPayment(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.PAYMENT);
  await bot.sendMessage(
    chatId,
    `To'lov qanday olindi?`,
    courierKeyboards.handoverPaymentKeyboard(orderId)
  );
}

async function askPhoto(bot, chatId, orderId) {
  await deliverySessionService.setStep(orderId, DeliveryStep.PHOTO);
  setPhotoRamPointer(chatId, orderId);
  await bot.sendMessage(
    chatId,
    `📸 Mijoz va ijara shartnomasi birga tushgan suratni yuboring.\n\n` +
      `Majburiy. Faqat bitta rasm.\n` +
      `(PlayStation / joystick / kabel rasmi KERAK EMAS)`
  );
}

/**
 * courier:hw:* va courier:handover:* callbacks
 */
async function handleCallback(bot, query, courier, data) {
  const chatId = query.message.chat.id;
  const parts = data.split(":");

  await safeAnswerCallbackQuery(bot, query.id);

  try {
    if (parts[1] === "hw") {
      return await handleHwCallback(bot, query, courier, parts, chatId);
    }
    if (parts[1] === "handover") {
      return await handleHandoverCallback(bot, query, courier, parts, chatId);
    }
  } catch (err) {
    const text =
      err instanceof DeliverySessionError || err instanceof DeliveryHandoverError
        ? err.message
        : err.message || "Xatolik";
    logger.error("Handover wizard callback failed", {
      data,
      error: err.message,
      stack: err.stack,
    });
    await bot.sendMessage(chatId, `❗️ ${text}`);
    return true;
  }

  return false;
}

async function assertOwnedOrder(orderId, courier) {
  const order = await orderService.getOrderById(orderId);
  if (!order || order.courierId !== courier.id) {
    throw new DeliverySessionError("NOT_FOUND", "Buyurtma topilmadi");
  }
  return order;
}

async function handleHwCallback(bot, query, courier, parts, chatId) {
  const action = parts[2];
  if (action === "noop") return true;

  const orderId = Number(parts[3]);
  if (!Number.isFinite(orderId)) {
    await bot.sendMessage(chatId, "Noto'g'ri");
    return true;
  }

  const order = await assertOwnedOrder(orderId, courier);

  // Ensure session exists (resume after bot restart)
  let session = await deliverySessionService.getByOrderId(orderId);
  if (!session || session.status !== "IN_PROGRESS") {
    if (!order.inventoryUnitId) {
      await bot.sendMessage(chatId, "❗️ InventoryUnit biriktirilmagan.");
      return true;
    }
    session = await deliverySessionService.startOrResume({
      orderId,
      courierId: courier.id,
      inventoryUnitId: order.inventoryUnitId,
    });
  } else {
    await deliverySessionService.requireInProgress(orderId, courier.id);
  }

  if (action === "console") {
    // Legacy path — optional InventoryItem console; unit already on order
    const itemId = Number(parts[4]);
    await deliverySessionService.patch(orderId, { consoleItemId: itemId });
    await clearKb(bot, query);
    await askJoysticks(bot, chatId, orderId);
    return true;
  }

  if (action === "js") {
    const itemId = Number(parts[4]);
    session = await deliverySessionService.toggleJoystick(orderId, itemId);
    const selected = joystickIdsOf(session);
    const list = await inventoryItemService.listAvailable(ITEM_TYPES.JOYSTICK, {
      reservedOrderId: orderId,
    });
    try {
      await bot.editMessageReplyMarkup(
        invKb.joystickPickKeyboard(orderId, list, selected).reply_markup,
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch (_) {}
    return true;
  }

  if (action === "jsDone") {
    await deliverySessionService.setJoysticksDone(orderId);
    await clearKb(bot, query);
    await askHdmi(bot, chatId, orderId);
    return true;
  }

  if (action === "hdmi") {
    await deliverySessionService.setHdmi(orderId, Number(parts[4]));
    await clearKb(bot, query);
    await askPower(bot, chatId, orderId);
    return true;
  }

  if (action === "power") {
    await deliverySessionService.setPower(orderId, Number(parts[4]));
    await clearKb(bot, query);
    await askCollateral(bot, chatId, orderId);
    return true;
  }

  return false;
}

async function handleHandoverCallback(bot, query, courier, parts, chatId) {
  const sub = parts[2];
  const orderId = Number(parts[3]);
  if (!Number.isFinite(orderId)) {
    await bot.sendMessage(chatId, "Noto'g'ri");
    return true;
  }

  const order = await assertOwnedOrder(orderId, courier);
  const session = await deliverySessionService.requireInProgress(orderId, courier.id);

  // InventoryUnit must be bound — NEVER require legacy consoleItemId
  if (!hasUnitBound(session, order)) {
    await bot.sendMessage(
      chatId,
      "❗️ Buyurtmaga InventoryUnit biriktirilmagan. Admin qayta tasdiqlashi kerak."
    );
    return true;
  }

  if (!hasAccessoryKit(session)) {
    await bot.sendMessage(
      chatId,
      "❗️ Avval aksessuarlarni to'liq tanlang (4 joystick + HDMI + Power).\n" +
        "Tanlovlar saqlangan — wizard qayta boshlanmaydi."
    );
    // Resume at the first incomplete step — do NOT wipe session
    if (joystickIdsOf(session).length !== 4) {
      await askJoysticks(bot, chatId, orderId);
    } else if (session.selectedHdmiId == null) {
      await askHdmi(bot, chatId, orderId);
    } else if (session.selectedPowerId == null) {
      await askPower(bot, chatId, orderId);
    }
    return true;
  }

  if (sub === "collateral") {
    const collateralType = parts[4];
    await clearKb(bot, query);
    if (collateralType === "NONE") {
      await deliverySessionService.setAwaitNoneConfirm(orderId);
      await bot.sendMessage(
        chatId,
        `⚠️ <b>Diqqat!</b>\n\nMijozdan hech qanday hujjat olinmadi.\n\nHaqiqatan ham davom etishni xohlaysizmi?`,
        { parse_mode: "HTML", ...courierKeyboards.handoverNoneConfirmKeyboard(orderId) }
      );
      return true;
    }
    await deliverySessionService.setDocument(orderId, collateralType);
    await deliveryHandoverService.notifyAdminStep(orderId, "Hujjat olindi", [
      `🪪 ${collateralType}`,
    ]);
    await askPayment(bot, chatId, orderId);
    return true;
  }

  if (sub === "noneConfirm") {
    const answer = parts[4];
    await clearKb(bot, query);
    if (answer === "no") {
      await askCollateral(bot, chatId, orderId);
      return true;
    }
    await deliverySessionService.setDocument(orderId, "NONE");
    await deliveryHandoverService.notifyAdminStep(orderId, "Hujjat olinmadi (tasdiqlangan)");
    await askPayment(bot, chatId, orderId);
    return true;
  }

  if (sub === "pay") {
    const paymentMethod = parts[4];
    if (!["CASH", "CARD"].includes(paymentMethod)) {
      await bot.sendMessage(chatId, "Noto'g'ri to'lov");
      return true;
    }
    const fresh = await deliverySessionService.requireInProgress(orderId, courier.id);
    if (!fresh.documentType) {
      await bot.sendMessage(chatId, "Avval hujjat");
      await askCollateral(bot, chatId, orderId);
      return true;
    }
    await deliverySessionService.setPayment(orderId, paymentMethod);
    await clearKb(bot, query);
    await deliveryHandoverService.notifyAdminStep(orderId, "To'lov olindi", [
      `💳 ${paymentMethod}`,
    ]);
    await askPhoto(bot, chatId, orderId);
    return true;
  }

  return false;
}

/**
 * PHOTO bosqichida rasm — state DeliverySession dan o'qiladi.
 */
async function handlePhotoMessage(bot, msg, courier) {
  const chatId = msg.chat.id;

  const ram = sessionStore.getSession(chatId);
  if (ram.data?._hwPhotoProcessing) {
    return true;
  }

  // Prefer DB session (survives RAM clear / restart)
  let session = await deliverySessionService.getPhotoSessionForCourier(courier.id);
  if (!session && ram.step === PHOTO_RAM_STEP && ram.data?._hwOrderId) {
    session = await deliverySessionService.getByOrderId(ram.data._hwOrderId);
  }

  if (
    !session ||
    session.status !== "IN_PROGRESS" ||
    session.currentStep !== DeliveryStep.PHOTO
  ) {
    if (ram.step === PHOTO_RAM_STEP || String(ram.step || "").startsWith("hw:")) {
      await bot.sendMessage(
        chatId,
        "❗️ Topshirish sessiyasi topilmadi yoki muddati o'tgan.\n" +
          "Iltimos, buyurtmada «📍 Yetib keldim» ni qayta bosing va wizardni yakunlang."
      );
      return true;
    }
    return false;
  }

  const fileId = orderPhotoService.extractLargestPhotoFileId(msg);
  if (!fileId) {
    await bot.sendMessage(chatId, "❌ Iltimos faqat rasm yuboring.");
    return true;
  }

  if (!hasAccessoryKit(session) || !session.documentType || !session.paymentMethod) {
    await bot.sendMessage(
      chatId,
      "❗️ Wizard ma'lumotlari to'liq emas. «📍 Yetib keldim» orqali qaytadan boshlang."
    );
    return true;
  }

  const orderId = session.orderId;
  const lockKey = `${orderId}:${courier.id}`;
  if (handoverLocks.has(lockKey)) {
    await bot.sendMessage(chatId, "⏳ Jarayon davom etmoqda...");
    return true;
  }
  handoverLocks.add(lockKey);
  sessionStore.updateData(chatId, { _hwPhotoProcessing: true, _hwAwaitPhoto: false });

  try {
    await bot.sendMessage(chatId, "⏳ Shartnoma yaratilmoqda va topshirish yakunlanmoqda...");

    const updated = await deliveryHandoverService.completeHandover({
      orderId,
      courierId: courier.id,
      consoleItemId: session.consoleItemId || null,
      joystickIds: joystickIdsOf(session),
      hdmiItemId: session.selectedHdmiId,
      powerItemId: session.selectedPowerId,
      collateralType: session.documentType,
      paymentMethod: session.paymentMethod,
      photoFileId: fileId,
      bot,
    });

    clearPhotoRamPointer(chatId);
    const end = updated.expectedReturnAt || updated.endDatetime;
    const { formatRemainingDuration } = require("../../utils/dateHelper");
    const remaining = formatRemainingDuration(end);
    const unitCode = updated.inventoryUnit?.unitCode || "—";
    await bot.sendMessage(
      chatId,
      `✅ Topshirish muvaffaqiyatli yakunlandi.\n\n` +
        `Buyurtma #${orderId} — faol ijara.\n` +
        `🏷 Qurilma: <b>${unitCode}</b> (RENTED)\n` +
        `⏳ Ijara tugashiga: ${remaining}\n` +
        `Status: ${updated.status}`,
      {
        parse_mode: "HTML",
        reply_markup: courierKeyboards.activeRentalKeyboard(orderId, remaining).reply_markup,
      }
    );
  } catch (err) {
    sessionStore.updateData(chatId, { _hwPhotoProcessing: false, _hwAwaitPhoto: true });
    const text = err instanceof DeliveryHandoverError ? err.message : "Xatolik";
    logger.error("Handover complete failed", { error: err.message, stack: err.stack });
    await bot.sendMessage(chatId, `❗️ ${text}\n\nRasmni qayta yuborishingiz mumkin.`);
  } finally {
    handoverLocks.delete(lockKey);
  }
  return true;
}

module.exports = {
  STEPS,
  startHandoverWizard,
  handleCallback,
  handlePhotoMessage,
};
