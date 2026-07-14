const inventoryItemService = require("../../services/inventoryItem.service");
const { ITEM_TYPES, CONDITIONS, labelItemType, labelCondition } = require("../../constants/inventoryItem");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");

const STEPS = {
  TYPE: "admin:invitem:type",
  CONSOLE_TYPE: "admin:invitem:consoleType",
  INV_NUM: "admin:invitem:invNum",
  SERIAL: "admin:invitem:serial",
  CONDITION: "admin:invitem:condition",
  PURCHASED: "admin:invitem:purchased",
  NOTE: "admin:invitem:note",
};

function typeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🕹 Joystick", callback_data: "admin:invitem:type:JOYSTICK" }],
        [{ text: "📺 HDMI", callback_data: "admin:invitem:type:HDMI" }],
        [{ text: "🔌 Power", callback_data: "admin:invitem:type:POWER" }],
        [{ text: "📋 Ro'yxat", callback_data: "admin:invitem:list" }],
      ],
    },
  };
}

function consoleTypeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "PS5", callback_data: "admin:invitem:ctype:PS5" },
          { text: "PS4", callback_data: "admin:invitem:ctype:PS4" },
          { text: "PS3", callback_data: "admin:invitem:ctype:PS3" },
        ],
      ],
    },
  };
}

function conditionKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: Object.values(CONDITIONS).map((c) => [
        { text: labelCondition(c), callback_data: `admin:invitem:cond:${c}` },
      ]),
    },
  };
}

async function startAdd(bot, chatId) {
  sessionStore.setStep(chatId, STEPS.TYPE);
  sessionStore.updateData(chatId, { _invItem: {} });
  await bot.sendMessage(chatId, "📦 Yangi inventar — turini tanlang:", typeKeyboard());
}

async function handleCallback(bot, query, data) {
  if (!data.startsWith("admin:invitem:")) return false;
  const chatId = query.message.chat.id;
  const parts = data.split(":");

  await safeAnswerCallbackQuery(bot, query.id);

  if (parts[2] === "list") {
    const items = await inventoryItemService.listByType(null, { take: 40 });
    // Console items removed from professional inventory UI — accessories only
    const accessories = items.filter((i) => i.itemType !== ITEM_TYPES.CONSOLE);
    const lines = accessories.map(
      (i) =>
        `• ${i.inventoryNumber} | ${labelItemType(i.itemType)} | ${i.status}` +
        (i.consoleType ? ` | ${i.consoleType}` : "")
    );
    await bot.sendMessage(chatId, lines.join("\n") || "Inventar bo'sh.");
    return true;
  }

  if (parts[2] === "type") {
    const itemType = parts[3];
    if (itemType === ITEM_TYPES.CONSOLE) {
      await bot.sendMessage(
        chatId,
        "ℹ️ Console professional inventardan olib tashlandi.\n" +
          "PlayStation qurilmalarini «🎮 Inventar» → PS3/PS4/PS5 orqali qo'shing."
      );
      return true;
    }
    sessionStore.updateData(chatId, { _invItem: { itemType } });
    sessionStore.setStep(chatId, STEPS.INV_NUM);
    await bot.sendMessage(chatId, "Inventory Number (masalan NX-JS-001):");
    return true;
  }

  // Legacy console-type step — redirect away
  if (parts[2] === "ctype") {
    await bot.sendMessage(
      chatId,
      "ℹ️ Console qo'shish o'chirilgan. PS modelini Inventar menyusidan tanlang."
    );
    return true;
  }

  if (parts[2] === "cond") {
    const condition = parts[3];
    const inv = sessionStore.getSession(chatId).data._invItem || {};
    sessionStore.updateData(chatId, { _invItem: { ...inv, condition } });
    sessionStore.setStep(chatId, STEPS.PURCHASED);
    await bot.sendMessage(chatId, "Sotib olingan sana (KK.OO.YYYY) yoki /skip:");
    return true;
  }

  return false;
}

async function handleText(bot, msg) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  if (!String(session.step || "").startsWith("admin:invitem:")) return false;
  const text = (msg.text || "").trim();
  const inv = { ...(session.data._invItem || {}) };

  if (session.step === STEPS.INV_NUM) {
    inv.inventoryNumber = text;
    sessionStore.updateData(chatId, { _invItem: inv });
    sessionStore.setStep(chatId, STEPS.SERIAL);
    await bot.sendMessage(chatId, "Original Serial Number:");
    return true;
  }

  if (session.step === STEPS.SERIAL) {
    inv.serialNumber = text;
    sessionStore.updateData(chatId, { _invItem: inv });
    sessionStore.setStep(chatId, STEPS.CONDITION);
    await bot.sendMessage(chatId, "Holati:", conditionKeyboard());
    return true;
  }

  if (session.step === STEPS.PURCHASED) {
    if (!/^\/skip\b/i.test(text)) {
      const m = text.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
      if (!m) {
        await bot.sendMessage(chatId, "Format: KK.OO.YYYY yoki /skip");
        return true;
      }
      inv.purchasedAt = new Date(`${m[3]}-${m[2]}-${m[1]}`);
    }
    sessionStore.updateData(chatId, { _invItem: inv });
    sessionStore.setStep(chatId, STEPS.NOTE);
    await bot.sendMessage(chatId, "Izoh (ixtiyoriy) yoki /skip:");
    return true;
  }

  if (session.step === STEPS.NOTE) {
    if (!/^\/skip\b/i.test(text)) inv.note = text;
    try {
      const item = await inventoryItemService.createItem(inv, { actorType: "admin" });
      sessionStore.clearSession(chatId);
      await bot.sendMessage(
        chatId,
        `✅ Inventar qo'shildi\n` +
          `${item.inventoryNumber}\n` +
          `${labelItemType(item.itemType)} | ${item.status}\n` +
          `SN: ${item.serialNumber}`
      );
    } catch (err) {
      await bot.sendMessage(chatId, `❗️ ${err.message}`);
    }
    return true;
  }

  return false;
}

module.exports = { startAdd, handleCallback, handleText, typeKeyboard };
