const sessionStore = require("../sessionStore");
const orderService = require("../../services/order.service");
const deliveryHandoverService = require("../../services/deliveryHandover.service");
const { DeliveryHandoverError } = require("../../services/deliveryHandover.service");
const invKb = require("../keyboards/courier.inventory.keyboards");
const orderPhotoService = require("../../services/orderPhoto.service");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { labelItemType } = require("../../constants/inventoryItem");
const logger = require("../../utils/logger");

const STEPS = {
  ITEMS: "ret:items",
  COLLATERAL: "ret:collateral",
  CONDITION: "ret:condition",
  NOTE: "ret:note",
  PHOTO: "ret:photo",
};

const returnLocks = new Set();

async function startReturnWizard(bot, chatId, orderId) {
  const order = await orderService.getOrderById(orderId);
  if (!order) {
    await bot.sendMessage(chatId, "Buyurtma topilmadi");
    return;
  }
  if (!order.orderItems?.length) {
    await bot.sendMessage(
      chatId,
      `❗️ Buyurtma #${orderId} uchun inventar bog'lanmagan.\n` +
        `Eski buyurtmalar uchun oddiy yakunlash ishlatiladi.`
    );
    return false;
  }

  const confirmed = {};
  for (const link of order.orderItems) {
    confirmed[link.id] = false;
  }

  sessionStore.setStep(chatId, STEPS.ITEMS);
  sessionStore.updateData(chatId, {
    _retOrderId: orderId,
    _retConfirmed: confirmed,
    _retCollateralReturned: null,
    _retCondition: null,
    _retNote: null,
  });

  await bot.sendMessage(
    chatId,
    `↩️ Qaytarib olish wizard (#${orderId})\n\n` +
      `Faqat ushbu buyurtmaga berilgan inventarni tasdiqlang:`
  );

  for (const link of order.orderItems) {
    const item = link.inventoryItem;
    const label = `${labelItemType(link.role)} ${item?.inventoryNumber || link.inventoryItemId}`;
    await bot.sendMessage(
      chatId,
      `📦 ${label}\nSN: ${item?.serialNumber || "—"}`,
      invKb.returnConfirmItemKeyboard(orderId, link.id, label)
    );
  }

  await deliveryHandoverService.notifyAdminStep(orderId, "Qaytarib olish wizard boshlandi");
  return true;
}

function allItemsConfirmed(data) {
  const c = data._retConfirmed || {};
  return Object.values(c).every(Boolean);
}

async function handleCallback(bot, query, courier, data) {
  if (!data.startsWith("courier:ret:")) return false;

  const parts = data.split(":");
  const action = parts[2];
  const orderId = Number(parts[3]);
  const chatId = query.message.chat.id;

  const order = await orderService.getOrderById(orderId);
  if (!order || order.courierId !== courier.id) {
    await safeAnswerCallbackQuery(bot, query.id, { text: "Buyurtma topilmadi" });
    return true;
  }

  if (action === "item") {
    const linkId = Number(parts[4]);
    const allowed = (order.orderItems || []).some((l) => l.id === linkId);
    if (!allowed) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Bu inventar ushbu buyurtmaga tegishli emas" });
      return true;
    }
    const session = sessionStore.getSession(chatId);
    const confirmed = { ...(session.data._retConfirmed || {}) };
    confirmed[linkId] = true;
    sessionStore.updateData(chatId, { _retConfirmed: confirmed, _retOrderId: orderId });

    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [[{ text: "✅ Tasdiqlandi", callback_data: "courier:hw:noop" }]] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch (_) {}

    await safeAnswerCallbackQuery(bot, query.id, { text: "OK" });

    if (allItemsConfirmed({ _retConfirmed: confirmed })) {
      sessionStore.setStep(chatId, STEPS.COLLATERAL);
      await bot.sendMessage(
        chatId,
        `Garov hujjati qaytarildimi?`,
        invKb.returnCollateralKeyboard(orderId)
      );
    }
    return true;
  }

  if (action === "collateral") {
    const yes = parts[4] === "yes";
    sessionStore.updateData(chatId, { _retCollateralReturned: yes });
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch (_) {}
    sessionStore.setStep(chatId, STEPS.CONDITION);
    await bot.sendMessage(chatId, `Qurilma holati:`, invKb.returnConditionKeyboard(orderId));
    await safeAnswerCallbackQuery(bot, query.id);
    return true;
  }

  if (action === "cond") {
    const condition = parts[4];
    sessionStore.updateData(chatId, { _retCondition: condition });
    try {
      await bot.editMessageReplyMarkup(
        { inline_keyboard: [] },
        { chat_id: chatId, message_id: query.message.message_id }
      );
    } catch (_) {}
    sessionStore.setStep(chatId, STEPS.NOTE);
    await bot.sendMessage(
      chatId,
      `Izoh yozing (ixtiyoriy) yoki /skip yuboring:`
    );
    await safeAnswerCallbackQuery(bot, query.id);
    return true;
  }

  return false;
}

async function handleTextMessage(bot, msg, courier) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  if (session.step !== STEPS.NOTE) return false;
  if (!msg.text) return false;

  const text = msg.text.trim();
  const note = /^\/skip\b/i.test(text) ? null : text;
  sessionStore.updateData(chatId, { _retNote: note });
  sessionStore.setStep(chatId, STEPS.PHOTO);
  sessionStore.updateData(chatId, { _retAwaitPhoto: true });
  await bot.sendMessage(
    chatId,
    `📸 Mijoz va ijara shartnomasi bilan qaytarish vaqtida tushgan suratni yuboring.\n\nMajburiy. Faqat bitta rasm.`
  );
  return true;
}

async function handlePhotoMessage(bot, msg, courier) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  if (session.data?._retPhotoProcessing) return true;
  if (session.step !== STEPS.PHOTO || !session.data?._retAwaitPhoto) return false;

  const fileId = orderPhotoService.extractLargestPhotoFileId(msg);
  if (!fileId) {
    await bot.sendMessage(chatId, "❌ Iltimos faqat rasm yuboring.");
    return true;
  }

  const d = session.data;
  const orderId = d._retOrderId;
  if (!allItemsConfirmed(d)) {
    await bot.sendMessage(chatId, "❗️ Avval barcha inventarni tasdiqlang.");
    return true;
  }
  if (d._retCollateralReturned == null || !d._retCondition) {
    await bot.sendMessage(chatId, "❗️ Garov va holatni tanlang.");
    return true;
  }

  const lockKey = `ret:${orderId}:${courier.id}`;
  if (returnLocks.has(lockKey)) {
    await bot.sendMessage(chatId, "⏳ Jarayon davom etmoqda...");
    return true;
  }
  returnLocks.add(lockKey);
  sessionStore.updateData(chatId, { _retPhotoProcessing: true, _retAwaitPhoto: false });

  try {
    await bot.sendMessage(chatId, "⏳ Qaytarish yakunlanmoqda...");
    const updated = await deliveryHandoverService.completeReturn({
      orderId,
      courierId: courier.id,
      collateralReturned: Boolean(d._retCollateralReturned),
      returnCondition: d._retCondition,
      returnNote: d._retNote,
      photoFileId: fileId,
      bot,
    });
    sessionStore.clearSession(chatId);
    await bot.sendMessage(
      chatId,
      `✅ Qaytarish yakunlandi!\nBuyurtma #${orderId} — ${updated.status}\nInventar AVAILABLE holatiga qaytdi.`
    );
  } catch (err) {
    sessionStore.updateData(chatId, { _retPhotoProcessing: false, _retAwaitPhoto: true });
    const text = err instanceof DeliveryHandoverError ? err.message : "Xatolik";
    logger.error("Return complete failed", { error: err.message });
    await bot.sendMessage(chatId, `❗️ ${text}`);
  } finally {
    returnLocks.delete(lockKey);
  }
  return true;
}

module.exports = {
  STEPS,
  startReturnWizard,
  handleCallback,
  handleTextMessage,
  handlePhotoMessage,
};
