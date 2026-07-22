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
    _hwPhotoProcessing: false,
  });
}

/** Always clear RAM photo-wait — never leave orphan hw:photo (menu trap). */
function clearPhotoRamPointer(chatId) {
  const s = sessionStore.getSession(chatId);
  if (
    s.step === PHOTO_RAM_STEP ||
    String(s.step || "").startsWith("hw:") ||
    s.data?._hwAwaitPhoto ||
    s.data?._hwPhotoProcessing ||
    s.data?._hwOrderId
  ) {
    sessionStore.clearSession(chatId);
  }
}

/** Hard exit wizard: DB cancel + RAM clear + main menu. */
async function abortWizard(bot, chatId, courier, orderId = null, reason = "CANCEL") {
  logger.info("Handover wizard abort", {
    context: "HandoverWizard",
    courierId: courier?.id,
    orderId,
    reason,
    chatId,
  });
  try {
    if (orderId != null) {
      await deliverySessionService.cancel(orderId);
    } else if (courier?.id) {
      await deliverySessionService.cancelForCourier(courier.id);
    }
  } catch (err) {
    logger.warn("DeliverySession cancel failed", { error: err.message, orderId });
  }
  clearPhotoRamPointer(chatId);
  await bot.sendMessage(
    chatId,
    `❌ Topshirish wizard bekor qilindi${orderId ? ` (#${orderId})` : ""}.\n` +
      `Kuryer menyusiga qaytdingiz.`,
    courierKeyboards.mainMenuKeyboard()
  );
}

function isCourierMenuText(text) {
  const t = String(text || "").trim();
  return [
    "📦 Buyurtmalar",
    "✅ Faol buyurtmalar",
    "📜 Tarix",
    "👤 Profil",
    "⚙️ Sozlamalar",
    "❌ Bekor qilish",
    "/cancel",
    "/menu",
  ].includes(t);
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

  const legacyBound = Boolean(order.inventoryUnitId);
  const unitLabel = order.inventoryUnit?.unitCode || order.consoleType || "—";
  const serialLabel = order.inventoryUnit?.serialNumber || "—";

  let session;
  try {
    session = await deliverySessionService.startOrResume({
      orderId,
      courierId: courier.id,
      inventoryUnitId: order.inventoryUnitId || null,
      startStep: legacyBound ? DeliveryStep.JOYSTICKS : DeliveryStep.UNIT_SELECT,
    });
  } catch (err) {
    const msg =
      err instanceof DeliverySessionError ? err.message : err.message || "Xatolik";
    await bot.sendMessage(chatId, `❗️ ${msg}`);
    return;
  }

  clearPhotoRamPointer(chatId);

  if (legacyBound) {
    await bot.sendMessage(
      chatId,
      `📍 Topshirish wizard (#${orderId})\n\n` +
        `🎮 Konsol: <b>${unitLabel}</b>\n` +
        `🔢 Serial: <code>${serialLabel}</code>\n` +
        `(Legacy bron — aksessuarlarni tanlang)`,
      { parse_mode: "HTML" }
    );
  } else {
    await bot.sendMessage(
      chatId,
      `📍 Topshirish wizard (#${orderId})\n\n` +
        `🎮 Model: <b>${order.consoleType}</b>\n\n` +
        `Qo'lingizdagi PlayStation orqa tomonidagi <b>Serial Number</b> ga qarab\n` +
        `AVAILABLE qurilmani tanlang.`,
      { parse_mode: "HTML" }
    );
  }

  await resumeAtStep(bot, chatId, orderId, session, order);
  await deliveryHandoverService.notifyAdminStep(
    orderId,
    legacyBound
      ? `Yetib kelindi — topshirish (${unitLabel})`
      : `Yetib kelindi — Serial tanlash (${order.consoleType})`
  );
}

/** Continue from persisted currentStep without wiping selections. */
async function resumeAtStep(bot, chatId, orderId, session, order = null) {
  const step = session.currentStep;
  if (step === DeliveryStep.UNIT_SELECT) {
    await askUnitSelect(bot, chatId, orderId, order);
    return;
  }
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

async function askUnitSelect(bot, chatId, orderId, orderHint = null) {
  await deliverySessionService.setStep(orderId, DeliveryStep.UNIT_SELECT);
  const order = orderHint || (await orderService.getOrderById(orderId));
  const orderReservationService = require("../../services/orderReservation.service");
  const units = await orderReservationService.listAvailableUnitsForHandover(
    order.consoleType
  );
  await bot.sendMessage(
    chatId,
    `1️⃣ Qaysi PlayStation topshirilmoqda?\n` +
      `Model: <b>${order.consoleType}</b>\n` +
      `Faqat AVAILABLE. Serial raqamni tekshiring.`,
    {
      parse_mode: "HTML",
      ...invKb.unitPickKeyboard(orderId, units),
    }
  );
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
      `(PlayStation / joystick / kabel rasmi KERAK EMAS)\n\n` +
      `Menyu tugmalari yoki «Bekor qilish» — wizardni yopadi.`,
    courierKeyboards.handoverWizardCancelKeyboard(orderId)
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

  if (action === "cancel") {
    await clearKb(bot, query);
    await abortWizard(bot, chatId, courier, orderId, "USER_CANCEL");
    return true;
  }

  const order = await assertOwnedOrder(orderId, courier);

  // Ensure session exists (resume after bot restart)
  let session = await deliverySessionService.getByOrderId(orderId);
  if (!session || session.status !== "IN_PROGRESS") {
    session = await deliverySessionService.startOrResume({
      orderId,
      courierId: courier.id,
      inventoryUnitId: order.inventoryUnitId || null,
      startStep: order.inventoryUnitId
        ? DeliveryStep.JOYSTICKS
        : DeliveryStep.UNIT_SELECT,
    });
  } else {
    await deliverySessionService.requireInProgress(orderId, courier.id);
  }

  if (action === "unit") {
    const unitId = Number(parts[4]);
    if (!Number.isFinite(unitId)) {
      await bot.sendMessage(chatId, "Noto'g'ri qurilma");
      return true;
    }
    const orderReservationService = require("../../services/orderReservation.service");
    const units = await orderReservationService.listAvailableUnitsForHandover(
      order.consoleType
    );
    const picked = units.find((u) => u.id === unitId);
    if (!picked) {
      await bot.sendMessage(
        chatId,
        "❌ Bu qurilma endi AVAILABLE emas. Ro'yxatni yangilang."
      );
      await askUnitSelect(bot, chatId, orderId, order);
      return true;
    }
    await deliverySessionService.patch(orderId, { inventoryUnitId: unitId });
    await deliverySessionService.setStep(orderId, DeliveryStep.JOYSTICKS);
    await clearKb(bot, query);
    await bot.sendMessage(
      chatId,
      `✅ Tanlandi\n\n` +
        `🎮 <b>${picked.unitCode}</b>\n` +
        `🔢 Serial: <code>${picked.serialNumber || "—"}</code>\n\n` +
        `Endi aksessuarlarni tanlang.`,
      { parse_mode: "HTML" }
    );
    await askJoysticks(bot, chatId, orderId);
    return true;
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

  // Unit must be selected in session (or legacy on order) before accessories/payment
  if (!hasUnitBound(session, order)) {
    await bot.sendMessage(
      chatId,
      "❗️ Avval PlayStation ni Serial Number bo'yicha tanlang."
    );
    await askUnitSelect(bot, chatId, orderId, order);
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
 *
 * Lifecycle rules:
 * - On SUCCESS: clear RAM + DB session completed (by completeHandover)
 * - On TX/business ERROR: keep DB at PHOTO, restore RAM await, allow retry
 * - On ghost (RAM photo but no DB PHOTO): ALWAYS clear RAM (never trap menu)
 * - If order already ACTIVE: treat as success cleanup, exit photo mode
 */
async function handlePhotoMessage(bot, msg, courier) {
  const chatId = msg.chat.id;

  try {
    await deliverySessionService.expireStaleSessions();
  } catch (_) {}

  const ram = sessionStore.getSession(chatId);
  if (ram.data?._hwPhotoProcessing) {
    logger.info("Handover photo ignored — already processing", {
      chatId,
      courierId: courier.id,
      orderId: ram.data?._hwOrderId,
    });
    return true;
  }

  let session = await deliverySessionService.getPhotoSessionForCourier(courier.id);
  if (!session && ram.step === PHOTO_RAM_STEP && ram.data?._hwOrderId) {
    session = await deliverySessionService.getByOrderId(ram.data._hwOrderId);
  }

  logger.info("Handover photo received", {
    context: "HandoverWizard",
    chatId,
    courierId: courier.id,
    ramStep: ram.step,
    waitingPhoto: Boolean(ram.data?._hwAwaitPhoto),
    dbSessionId: session?.id,
    dbStep: session?.currentStep,
    dbStatus: session?.status,
    orderId: session?.orderId || ram.data?._hwOrderId,
    updateType: msg.photo ? "photo" : msg.document ? "document" : "other",
  });

  // Ghost / expired / already completed — NEVER keep RAM photo-wait
  if (
    !session ||
    session.status !== "IN_PROGRESS" ||
    session.currentStep !== DeliveryStep.PHOTO
  ) {
    const orderIdHint = session?.orderId || ram.data?._hwOrderId;
    if (orderIdHint) {
      const order = await orderService.getOrderById(orderIdHint).catch(() => null);
      if (order && ["ACTIVE", "DELIVERED"].includes(order.status)) {
        clearPhotoRamPointer(chatId);
        await bot.sendMessage(
          chatId,
          `✅ Buyurtma #${orderIdHint} allaqachon topshirilgan (${order.status}).\n` +
            `Kuryer menyusiga qaytdingiz.`,
          courierKeyboards.mainMenuKeyboard()
        );
        return true;
      }
    }

    if (ram.step === PHOTO_RAM_STEP || String(ram.step || "").startsWith("hw:")) {
      clearPhotoRamPointer(chatId);
      await bot.sendMessage(
        chatId,
        "❗️ Topshirish sessiyasi topilmadi yoki muddati o'tgan.\n" +
          "Photo-kutish rejimi yopildi.\n" +
          "Kerak bo'lsa «📍 Yetib keldim» / «Yetkazildi» orqali qayta boshlang.",
        courierKeyboards.mainMenuKeyboard()
      );
      return true;
    }
    return false;
  }

  const fileId = orderPhotoService.extractLargestPhotoFileId(msg);
  if (!fileId) {
    await bot.sendMessage(
      chatId,
      "❌ Iltimos faqat rasm yuboring (yoki rasm-hujjat).\n" +
        "Menyu / Bekor — wizardni yopadi.",
      courierKeyboards.handoverWizardCancelKeyboard(session.orderId)
    );
    return true;
  }

  if (!hasAccessoryKit(session) || !session.documentType || !session.paymentMethod) {
    clearPhotoRamPointer(chatId);
    await bot.sendMessage(
      chatId,
      "❗️ Wizard ma'lumotlari to'liq emas. «📍 Yetib keldim» orqali qaytadan boshlang.",
      courierKeyboards.mainMenuKeyboard()
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
    logger.info("Handover TX starting", {
      context: "HandoverWizard",
      orderId,
      courierId: courier.id,
      sessionId: session.id,
      fileId: String(fileId).slice(0, 24),
    });

    await bot.sendMessage(chatId, "⏳ Shartnoma yaratilmoqda va topshirish yakunlanmoqda...");

    const updated = await deliveryHandoverService.completeHandover({
      orderId,
      courierId: courier.id,
      inventoryUnitId: session.inventoryUnitId || null,
      consoleItemId: session.consoleItemId || null,
      joystickIds: joystickIdsOf(session),
      hdmiItemId: session.selectedHdmiId,
      powerItemId: session.selectedPowerId,
      collateralType: session.documentType,
      paymentMethod: session.paymentMethod,
      photoFileId: fileId,
      bot,
    });

    logger.info("Handover complete success — cleanup", {
      context: "HandoverWizard",
      orderId,
      status: updated.status,
    });

    clearPhotoRamPointer(chatId);
    const end = updated.expectedReturnAt || updated.endDatetime;
    const { formatRemainingDuration } = require("../../utils/dateHelper");
    const remaining = formatRemainingDuration(end);
    const unitCode = updated.inventoryUnit?.unitCode || "—";
    const serial = updated.inventoryUnit?.serialNumber || "—";
    await bot.sendMessage(
      chatId,
      `✅ Topshirish muvaffaqiyatli yakunlandi.\n\n` +
        `Buyurtma #${orderId} — faol ijara.\n` +
        `🏷 Qurilma: <b>${unitCode}</b>\n` +
        `🔢 Serial: <code>${serial}</code>\n` +
        `📌 Status: RENTED\n` +
        `⏳ Qolgan: ${remaining}`,
      {
        parse_mode: "HTML",
        ...courierKeyboards.mainMenuKeyboard(),
      }
    );
    await bot.sendMessage(
      chatId,
      `📦 Faol buyurtma:`,
      courierKeyboards.activeRentalKeyboard(orderId, remaining)
    );
  } catch (err) {
    // Keep DB PHOTO step for retry — never destroy session on soft failure
    const text = err instanceof DeliveryHandoverError ? err.message : err.message || "Xatolik";
    logger.error("Handover complete failed — keeping PHOTO step", {
      context: "HandoverWizard",
      orderId,
      courierId: courier.id,
      error: err.message,
      stack: err.stack,
    });

    // If order already delivered by a racing success, exit cleanly
    const order = await orderService.getOrderById(orderId).catch(() => null);
    if (order && ["ACTIVE", "DELIVERED"].includes(order.status)) {
      clearPhotoRamPointer(chatId);
      try {
        await deliverySessionService.markCompleted(orderId);
      } catch (_) {}
      await bot.sendMessage(
        chatId,
        `✅ Buyurtma #${orderId} allaqachon topshirilgan.\nKuryer menyusiga qaytdingiz.`,
        courierKeyboards.mainMenuKeyboard()
      );
      return true;
    }

    setPhotoRamPointer(chatId, orderId);
    await bot.sendMessage(
      chatId,
      `❗️ ${text}\n\n` +
        `Wizard saqlangan — rasmni qayta yuboring.\n` +
        `Yoki «Bekor qilish» / menyu tugmasi bilan chiqing.`,
      courierKeyboards.handoverWizardCancelKeyboard(orderId)
    );
  } finally {
    handoverLocks.delete(lockKey);
    const s = sessionStore.getSession(chatId);
    if (s.data?._hwPhotoProcessing) {
      sessionStore.updateData(chatId, { _hwPhotoProcessing: false });
    }
  }
  return true;
}

/**
 * Escape photo-wait trap.
 * - /cancel or "Bekor qilish" → full abort message, consumed (return 'aborted')
 * - Menu buttons → silent cleanup, fall through (return 'cleared')
 * - Not in photo mode → 'noop'
 */
async function handleAbortText(bot, msg, courier) {
  const text = (msg.text || "").trim();
  const isCancel = /^\/cancel\b/i.test(text) || text === "❌ Bekor qilish";
  const isMenu = isCourierMenuText(text);
  if (!isCancel && !isMenu) return "noop";

  const chatId = msg.chat.id;
  const ram = sessionStore.getSession(chatId);
  const photoSession = await deliverySessionService
    .getPhotoSessionForCourier(courier.id)
    .catch(() => null);
  const inHw =
    ram.step === PHOTO_RAM_STEP ||
    Boolean(ram.data?._hwAwaitPhoto) ||
    Boolean(photoSession) ||
    String(ram.step || "").startsWith("hw:");

  if (!inHw) return "noop";

  const orderId = photoSession?.orderId || ram.data?._hwOrderId || null;

  if (isCancel) {
    await abortWizard(bot, chatId, courier, orderId, "USER_CANCEL_TEXT");
    return "aborted";
  }

  // Menu: clear trap silently, then let menu handler run
  logger.info("Handover photo-wait cleared for menu", {
    chatId,
    courierId: courier.id,
    orderId,
    text,
  });
  try {
    if (orderId != null) await deliverySessionService.cancel(orderId);
    else if (courier?.id) await deliverySessionService.cancelForCourier(courier.id);
  } catch (_) {}
  clearPhotoRamPointer(chatId);
  return "cleared";
}

module.exports = {
  STEPS,
  startHandoverWizard,
  handleCallback,
  handlePhotoMessage,
  handleAbortText,
  abortWizard,
  clearPhotoRamPointer,
  isCourierMenuText,
};
