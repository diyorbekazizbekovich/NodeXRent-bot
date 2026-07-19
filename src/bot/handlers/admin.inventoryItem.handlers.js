/**
 * Professional inventory accessories wizard (Joystick / HDMI / Power).
 *
 * State rules:
 * - beginAction() replaces any previous wizard
 * - validation errors keep the SAME step for retry (with cancel) — one message only
 * - menu / cancel / success / fatal error ALWAYS resetConversation()
 * - never swallow admin menu texts (abort first → fall through)
 */
const inventoryItemService = require("../../services/inventoryItem.service");
const { InventoryItemError } = require("../../services/inventoryItem.service");
const {
  ITEM_TYPES,
  CONDITIONS,
  labelItemType,
  labelCondition,
} = require("../../constants/inventoryItem");
const {
  validateInventoryNumber,
  validateSerial,
  parseOptionalDate,
  parseOptionalNote,
} = require("../inventory/inventoryItem.validation");
const sessionStore = require("../sessionStore");
const {
  cancelKeyboard,
  shouldAbortWizard,
  resetConversation,
} = require("../adminConversation");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");

const STEPS = Object.freeze({
  INV_NUM: "admin:invitem:invNum",
  SERIAL: "admin:invitem:serial",
  CONDITION: "admin:invitem:condition",
  PURCHASED: "admin:invitem:purchased",
  NOTE: "admin:invitem:note",
  CONFIRM: "admin:invitem:confirm",
});

const PREFIX = "admin:invitem:";

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

function conditionKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        ...Object.values(CONDITIONS).map((c) => [
          { text: labelCondition(c), callback_data: `admin:invitem:cond:${c}` },
        ]),
        [{ text: "❌ Bekor qilish", callback_data: "admin:invitem:cancel" }],
      ],
    },
  };
}

function confirmKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Saqlash", callback_data: "admin:invitem:confirm:yes" },
          { text: "❌ Bekor", callback_data: "admin:invitem:cancel" },
        ],
        [{ text: "⬅️ Orqaga (raqam)", callback_data: "admin:invitem:back:invNum" }],
      ],
    },
  };
}

function draft(chatId) {
  return { ...(sessionStore.getSession(chatId).data._invItem || {}) };
}

function saveDraft(chatId, inv) {
  sessionStore.updateData(chatId, { _invItem: inv });
}

function formatDraftSummary(inv) {
  const purchased = inv.purchasedAt
    ? new Date(inv.purchasedAt).toLocaleDateString("uz-UZ")
    : "—";
  return (
    `📋 <b>Tasdiqlash</b>\n\n` +
    `Tur: ${labelItemType(inv.itemType)}\n` +
    `Inventory Number: <code>${inv.inventoryNumber}</code>\n` +
    `Serial: <code>${inv.serialNumber}</code>\n` +
    `Holat: ${labelCondition(inv.condition)}\n` +
    `Sotib olingan: ${purchased}\n` +
    `Izoh: ${inv.note || "—"}`
  );
}

async function promptInvNum(bot, chatId) {
  await bot.sendMessage(
    chatId,
    "Inventory Number kiriting (masalan NX-JS-001):\n\n/cancel — bekor qilish",
    cancelKeyboard()
  );
}

async function persistItem(bot, chatId) {
  const inv = draft(chatId);
  try {
    const item = await inventoryItemService.createItem(inv, { actorType: "admin" });
    resetConversation(chatId);
    await bot.sendMessage(
      chatId,
      `✅ Inventar qo'shildi\n` +
        `${item.inventoryNumber}\n` +
        `${labelItemType(item.itemType)} | ${item.status}\n` +
        `SN: ${item.serialNumber}`,
      typeKeyboard()
    );
  } catch (err) {
    const msgText =
      err instanceof InventoryItemError || err?.code === "DUPLICATE"
        ? err.message
        : err.message || "Xatolik";
    if (err?.code === "DUPLICATE" || /allaqachon mavjud/i.test(msgText)) {
      // Soft recovery — back to first identifier step (session stays usable)
      sessionStore.setStep(chatId, STEPS.INV_NUM);
      await bot.sendMessage(
        chatId,
        `❗️ ${msgText}\n\nYangi Inventory Number kiriting yoki /cancel`,
        cancelKeyboard()
      );
      return;
    }
    resetConversation(chatId);
    await bot.sendMessage(chatId, `❗️ ${msgText}\nSessiya tozalandi.`, typeKeyboard());
  }
}

async function handleCallback(bot, query, data) {
  if (!data.startsWith(PREFIX)) return false;
  const chatId = query.message.chat.id;
  const parts = data.split(":");

  await safeAnswerCallbackQuery(bot, query.id);

  if (parts[2] === "cancel") {
    resetConversation(chatId);
    await bot.sendMessage(chatId, "❌ Inventar qo'shish bekor qilindi.", typeKeyboard());
    return true;
  }

  if (parts[2] === "back" && parts[3] === "invNum") {
    if (!sessionStore.hasActiveStep(chatId, PREFIX)) {
      await bot.sendMessage(chatId, "Sessiya tugagan. Qaytadan boshlang.", typeKeyboard());
      return true;
    }
    sessionStore.setStep(chatId, STEPS.INV_NUM);
    await promptInvNum(bot, chatId);
    return true;
  }

  if (parts[2] === "confirm" && parts[3] === "yes") {
    if (!sessionStore.hasActiveStep(chatId, PREFIX)) {
      await bot.sendMessage(chatId, "Sessiya tugagan. Qaytadan boshlang.", typeKeyboard());
      return true;
    }
    await persistItem(bot, chatId);
    return true;
  }

  if (parts[2] === "list") {
    resetConversation(chatId);
    const items = await inventoryItemService.listByType(null, { take: 40 });
    const accessories = items.filter((i) => i.itemType !== ITEM_TYPES.CONSOLE);
    const lines = accessories.map(
      (i) =>
        `• ${i.inventoryNumber} | ${labelItemType(i.itemType)} | ${i.status}` +
        (i.consoleType ? ` | ${i.consoleType}` : "")
    );
    await bot.sendMessage(chatId, lines.join("\n") || "Inventar bo'sh.", typeKeyboard());
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
    if (![ITEM_TYPES.JOYSTICK, ITEM_TYPES.HDMI, ITEM_TYPES.POWER].includes(itemType)) {
      await bot.sendMessage(chatId, "Noto'g'ri tur.");
      return true;
    }
    sessionStore.beginAction(chatId, STEPS.INV_NUM, { _invItem: { itemType } });
    await promptInvNum(bot, chatId);
    return true;
  }

  if (parts[2] === "cond") {
    const condition = parts[3];
    if (!sessionStore.hasActiveStep(chatId, PREFIX)) {
      await bot.sendMessage(chatId, "Sessiya tugagan. Qaytadan boshlang.", typeKeyboard());
      return true;
    }
    if (!Object.values(CONDITIONS).includes(condition)) {
      await bot.sendMessage(chatId, "Holat noto'g'ri.", conditionKeyboard());
      return true;
    }
    const inv = draft(chatId);
    inv.condition = condition;
    saveDraft(chatId, inv);
    sessionStore.setStep(chatId, STEPS.PURCHASED);
    await bot.sendMessage(
      chatId,
      "Sotib olingan sana (KK.OO.YYYY) yoki /skip:\n/cancel — bekor",
      cancelKeyboard()
    );
    return true;
  }

  return false;
}

async function handleText(bot, msg) {
  const chatId = msg.chat.id;
  const text = (msg.text || "").trim();
  if (!sessionStore.hasActiveStep(chatId, PREFIX)) return false;

  // Menu / cancel → exit wizard, let admin router handle menu
  if (shouldAbortWizard(text)) {
    resetConversation(chatId);
    if (/^\/cancel\b/i.test(text) || text === "❌ Bekor qilish" || text === "❌ Bekor") {
      await bot.sendMessage(chatId, "❌ Inventar qo'shish bekor qilindi.", typeKeyboard());
      return true;
    }
    return false; // menu text — fall through to admin menu switch
  }

  const session = sessionStore.getSession(chatId);
  const inv = draft(chatId);

  if (session.step === STEPS.INV_NUM) {
    const parsed = validateInventoryNumber(text);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, `❗️ ${parsed.error}`, cancelKeyboard());
      return true;
    }
    const existing = await inventoryItemService.findByInventoryNumber(parsed.value);
    if (existing) {
      await bot.sendMessage(
        chatId,
        `❗️ Inventory Number allaqachon mavjud: ${parsed.value}\nBoshqa raqam kiriting yoki /cancel`,
        cancelKeyboard()
      );
      return true;
    }
    inv.inventoryNumber = parsed.value;
    saveDraft(chatId, inv);
    sessionStore.setStep(chatId, STEPS.SERIAL);
    await bot.sendMessage(chatId, "Original Serial Number:\n/cancel — bekor", cancelKeyboard());
    return true;
  }

  if (session.step === STEPS.SERIAL) {
    const parsed = validateSerial(text);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, `❗️ ${parsed.error}`, cancelKeyboard());
      return true;
    }
    const existing = await inventoryItemService.findBySerialNumber(parsed.value);
    if (existing) {
      await bot.sendMessage(
        chatId,
        `❗️ Serial allaqachon mavjud.\nBoshqa serial kiriting yoki /cancel`,
        cancelKeyboard()
      );
      return true;
    }
    inv.serialNumber = parsed.value;
    saveDraft(chatId, inv);
    sessionStore.setStep(chatId, STEPS.CONDITION);
    await bot.sendMessage(chatId, "Holati:", conditionKeyboard());
    return true;
  }

  if (session.step === STEPS.CONDITION) {
    await bot.sendMessage(chatId, "Holatni tugmalardan tanlang yoki /cancel", conditionKeyboard());
    return true;
  }

  if (session.step === STEPS.PURCHASED) {
    const parsed = parseOptionalDate(text);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, `❗️ ${parsed.error}\n/cancel — bekor`, cancelKeyboard());
      return true;
    }
    if (parsed.value) inv.purchasedAt = parsed.value;
    saveDraft(chatId, inv);
    sessionStore.setStep(chatId, STEPS.NOTE);
    await bot.sendMessage(chatId, "Izoh (ixtiyoriy) yoki /skip:\n/cancel — bekor", cancelKeyboard());
    return true;
  }

  if (session.step === STEPS.NOTE) {
    const parsed = parseOptionalNote(text);
    if (!parsed.ok) {
      await bot.sendMessage(chatId, `❗️ ${parsed.error}`, cancelKeyboard());
      return true;
    }
    if (parsed.value) inv.note = parsed.value;
    saveDraft(chatId, inv);
    sessionStore.setStep(chatId, STEPS.CONFIRM);
    await bot.sendMessage(chatId, formatDraftSummary(inv), {
      parse_mode: "HTML",
      ...confirmKeyboard(),
    });
    return true;
  }

  if (session.step === STEPS.CONFIRM) {
    // Waiting for inline confirm — text only for cancel/menu (already handled)
    await bot.sendMessage(
      chatId,
      "Tasdiqlash uchun tugmalardan foydalaning yoki /cancel",
      confirmKeyboard()
    );
    return true;
  }

  // Unknown invitem step — clear ghost state
  resetConversation(chatId);
  return false;
}

async function startAdd(bot, chatId) {
  resetConversation(chatId);
  await bot.sendMessage(chatId, "📦 Yangi inventar — turini tanlang:", typeKeyboard());
}

module.exports = {
  STEPS,
  startAdd,
  handleCallback,
  handleText,
  typeKeyboard,
};
