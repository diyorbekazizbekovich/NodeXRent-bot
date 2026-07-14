/**
 * Admin PlayStation InventoryUnit UI — model pages, add unit, list, detail.
 * Counts are always computed from DB (never stored manually).
 */
const inventoryService = require("../../services/inventory.service");
const inventoryAssetService = require("../../services/inventoryAsset.service");
const { InventoryAssetError } = require("../../services/inventoryAsset.service");
const { label: statusLabel } = require("../../constants/inventoryStatus");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const prisma = require("../../config/prisma");

const CONSOLE_TYPES = ["PS3", "PS4", "PS5"];

const STATUS_ICON = {
  AVAILABLE: "✅",
  RESERVED: "🟡",
  RENTED: "🚚",
  INSPECTION: "🔍",
  MAINTENANCE: "🔧",
  DISABLED: "🚫",
  LOST: "❌",
  MISSING_PARTS: "🔧",
  DEFECTIVE: "🚫",
};

const STATUS_SHORT = {
  AVAILABLE: "Bo'sh",
  RESERVED: "Bron",
  RENTED: "Ijarada",
  INSPECTION: "Tekshiruv",
  MAINTENANCE: "Ta'mir",
  DISABLED: "O'chirilgan",
  LOST: "Yo'qolgan",
  MISSING_PARTS: "Ta'mir",
  DEFECTIVE: "Nosoz",
};

function modelPickerKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎮 PS3", callback_data: "admin:inv:model:PS3" }],
        [{ text: "🎮 PS4", callback_data: "admin:inv:model:PS4" }],
        [{ text: "🎮 PS5", callback_data: "admin:inv:model:PS5" }],
        [{ text: "🔄 Yangilash", callback_data: "admin:inv:refresh" }],
      ],
    },
  };
}

function modelActionsKeyboard(consoleType) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "➕ Qurilma qo'shish", callback_data: `admin:inv:add:${consoleType}` }],
        [{ text: "📋 Qurilmalar ro'yxati", callback_data: `admin:inv:list:${consoleType}` }],
        [{ text: "✏️ Tahrirlash", callback_data: `admin:inv:editmenu:${consoleType}` }],
        [{ text: "⬅️ Orqaga", callback_data: "admin:inv:back" }],
      ],
    },
  };
}

function formatModelPage(consoleType, stats) {
  const s = stats[consoleType] || stats;
  const total = s.total ?? s.totalUnits ?? 0;
  const available = s.available ?? 0;
  const reserved = s.reserved ?? 0;
  const rented = s.rented ?? 0;
  const inspection = s.inspection ?? 0;
  const repair = s.maintenance ?? s.repair ?? 0;
  const occ =
    s.occupancyRate != null
      ? `${s.occupancyRate}%`
      : total
        ? `${Math.round(((reserved + rented) / total) * 100)}%`
        : "0%";

  return (
    `🎮 <b>${consoleType} inventari</b>\n\n` +
    `Jami: ${total}\n` +
    `Bo'sh: ${available}\n` +
    `Bron: ${reserved}\n` +
    `Ijara: ${rented}\n` +
    `Tekshiruv: ${inspection}\n` +
    `Ta'mir: ${repair}\n` +
    `Occupancy: ${occ}`
  );
}

function formatOverviewMenu(counts) {
  const lines = ["🎮 <b>PlayStation inventar boshqaruvi</b>", ""];
  for (const t of CONSOLE_TYPES) {
    const c = counts[t] || {};
    lines.push(`<b>${t}</b> — Jami: ${c.total ?? 0}`);
  }
  lines.push("", "Modelni tanlang:");
  return lines.join("\n");
}

function unitListLabel(unit) {
  const icon = STATUS_ICON[unit.status] || "•";
  const short = STATUS_SHORT[unit.status] || statusLabel(unit.status);
  const code = unit.unitCode || unit.assetCode;
  return `${code} ${icon} ${short}`;
}

async function sendOverview(bot, chatId) {
  const counts = await inventoryService.getCountsByType();
  await bot.sendMessage(chatId, formatOverviewMenu(counts), {
    parse_mode: "HTML",
    ...modelPickerKeyboard(),
  });
}

async function sendModelPage(bot, chatId, consoleType) {
  const counts = await inventoryService.getCountsByType();
  await bot.sendMessage(chatId, formatModelPage(consoleType, counts), {
    parse_mode: "HTML",
    ...modelActionsKeyboard(consoleType),
  });
}

async function suggestNextCode(consoleType) {
  const units = await prisma.inventoryUnit.findMany({
    where: { consoleType },
    select: { unitCode: true },
  });
  return inventoryAssetService.nextUnitCode(
    consoleType,
    units.map((u) => u.unitCode)
  );
}

async function handleCallback(bot, query, data, { telegramId } = {}) {
  if (!data?.startsWith("admin:inv:")) return false;
  if (data.startsWith("admin:invitem:")) return false;

  const chatId = query.message.chat.id;
  await safeAnswerCallbackQuery(bot, query.id);

  const parts = data.split(":");
  const action = parts[2];

  try {
    if (action === "refresh" || action === "back") {
      await sendOverview(bot, chatId);
      return true;
    }

    if (action === "model") {
      const consoleType = parts[3];
      if (!CONSOLE_TYPES.includes(consoleType)) {
        await bot.sendMessage(chatId, "Noto'g'ri model.");
        return true;
      }
      await sendModelPage(bot, chatId, consoleType);
      return true;
    }

    if (action === "add") {
      const consoleType = parts[3];
      if (!CONSOLE_TYPES.includes(consoleType)) {
        await bot.sendMessage(chatId, "Noto'g'ri model.");
        return true;
      }
      sessionStore.setStep(chatId, "admin:inv:addSerial");
      sessionStore.updateData(chatId, { _invAddModel: consoleType });
      const nextHint = await suggestNextCode(consoleType);
      await bot.sendMessage(
        chatId,
        `➕ <b>${consoleType}</b> qurilma qo'shish\n\n` +
          `Seriya / asset kodini kiriting.\n` +
          `Masalan: <code>${nextHint}</code>\n\n` +
          `/skip — avtomatik kod beriladi.`,
        { parse_mode: "HTML" }
      );
      return true;
    }

    if (action === "list") {
      const consoleType = parts[3];
      const units = await inventoryService.getUnitsByType(consoleType);
      if (!units.length) {
        await bot.sendMessage(
          chatId,
          `${consoleType}: qurilmalar yo'q.`,
          modelActionsKeyboard(consoleType)
        );
        return true;
      }
      const rows = units.slice(0, 40).map((u) => [
        { text: unitListLabel(u), callback_data: `admin:inv:unit:${u.id}` },
      ]);
      rows.push([{ text: "⬅️ Orqaga", callback_data: `admin:inv:model:${consoleType}` }]);
      await bot.sendMessage(chatId, `📋 <b>${consoleType} qurilmalari</b>`, {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: rows },
      });
      return true;
    }

    if (action === "editmenu") {
      const consoleType = parts[3];
      const units = await inventoryService.getUnitsByType(consoleType);
      if (!units.length) {
        await bot.sendMessage(chatId, "Tahrirlash uchun qurilma yo'q.");
        return true;
      }
      const rows = units.slice(0, 30).map((u) => [
        { text: `✏️ ${u.unitCode}`, callback_data: `admin:inv:edit:${u.id}` },
      ]);
      rows.push([{ text: "⬅️ Orqaga", callback_data: `admin:inv:model:${consoleType}` }]);
      await bot.sendMessage(chatId, "✏️ Qaysi qurilmani tahrirlaysiz?", {
        reply_markup: { inline_keyboard: rows },
      });
      return true;
    }

    if (action === "unit") {
      const unitId = Number(parts[3]);
      const unit = await inventoryService.getUnitById(unitId);
      if (!unit) {
        await bot.sendMessage(chatId, "Qurilma topilmadi.");
        return true;
      }
      const model = unit.model || unit.consoleType;
      const canDelete = !["RESERVED", "RENTED", "INSPECTION"].includes(unit.status);
      const rows = [
        [
          { text: "✅ Bo'sh", callback_data: `admin:inv:status:${unitId}:AVAILABLE` },
          { text: "🔧 Ta'mir", callback_data: `admin:inv:status:${unitId}:MAINTENANCE` },
        ],
        [{ text: "🚫 DISABLED", callback_data: `admin:inv:status:${unitId}:DISABLED` }],
      ];
      if (canDelete) {
        rows.push([
          { text: "🗑 O'chirish", callback_data: `admin:inv:delete:${unitId}` },
        ]);
      }
      rows.push([{ text: "⬅️ Ro'yxat", callback_data: `admin:inv:list:${model}` }]);
      await bot.sendMessage(chatId, inventoryService.formatUnitDetail(unit), {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: rows },
      });
      return true;
    }

    if (action === "delete") {
      const unitId = Number(parts[3]);
      const unit = await prisma.inventoryUnit.findUnique({ where: { id: unitId } });
      if (!unit) {
        await bot.sendMessage(chatId, "Qurilma topilmadi.");
        return true;
      }
      await bot.sendMessage(
        chatId,
        `⚠️ <b>${unit.unitCode}</b> ni butunlay o'chirasizmi?\n` +
          `Holat: ${STATUS_SHORT[unit.status] || unit.status}\n\n` +
          `Bu amalni qaytarib bo'lmaydi.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "✅ Ha, o'chirish", callback_data: `admin:inv:deleteConfirm:${unitId}` },
                { text: "❌ Bekor", callback_data: `admin:inv:unit:${unitId}` },
              ],
            ],
          },
        }
      );
      return true;
    }

    if (action === "deleteConfirm") {
      const unitId = Number(parts[3]);
      const adminRecord = await prisma.admin.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });
      const unit = await prisma.inventoryUnit.findUnique({ where: { id: unitId } });
      const model = unit?.consoleType;
      const result = await inventoryAssetService.deleteAsset(unitId, {
        hard: true,
        adminContext: { adminId: adminRecord?.id, telegramId },
      });
      await bot.sendMessage(
        chatId,
        `🗑 O'chirildi: <b>${result.unitCode || unitId}</b>`,
        { parse_mode: "HTML" }
      );
      if (model) await sendModelPage(bot, chatId, model);
      return true;
    }

    if (action === "edit") {
      const unitId = Number(parts[3]);
      const unit = await prisma.inventoryUnit.findUnique({ where: { id: unitId } });
      if (!unit) {
        await bot.sendMessage(chatId, "Qurilma topilmadi.");
        return true;
      }
      sessionStore.setStep(chatId, "admin:inv:editNote");
      sessionStore.updateData(chatId, { _invEditId: unitId, _invEditModel: unit.consoleType });
      await bot.sendMessage(
        chatId,
        `✏️ <b>${unit.unitCode}</b>\n\nYangi izoh kiriting (yoki /skip):\nHozirgi: ${unit.adminNote || "—"}`,
        { parse_mode: "HTML" }
      );
      return true;
    }

    if (action === "status") {
      const unitId = Number(parts[3]);
      let toStatus = parts[4];
      if (toStatus === "REPAIR") toStatus = "MAINTENANCE";
      const adminRecord = await prisma.admin.findUnique({
        where: { telegramId: BigInt(telegramId) },
      });
      await inventoryAssetService.changeStatus(unitId, toStatus, {
        actorType: "admin",
        actorId: adminRecord?.id,
        action: "STATUS_CHANGED",
        note: `Admin → ${toStatus}`,
      });
      const unit = await inventoryService.getUnitById(unitId);
      const model = unit.model || unit.consoleType;
      const canDelete = !["RESERVED", "RENTED", "INSPECTION"].includes(unit.status);
      const rows = [
        [
          { text: "✅ Bo'sh", callback_data: `admin:inv:status:${unitId}:AVAILABLE` },
          { text: "🔧 Ta'mir", callback_data: `admin:inv:status:${unitId}:MAINTENANCE` },
        ],
        [{ text: "🚫 DISABLED", callback_data: `admin:inv:status:${unitId}:DISABLED` }],
      ];
      if (canDelete) {
        rows.push([{ text: "🗑 O'chirish", callback_data: `admin:inv:delete:${unitId}` }]);
      }
      rows.push([{ text: "⬅️ Ro'yxat", callback_data: `admin:inv:list:${model}` }]);
      await bot.sendMessage(
        chatId,
        `✅ Status yangilandi.\n\n${inventoryService.formatUnitDetail(unit)}`,
        { parse_mode: "HTML", reply_markup: { inline_keyboard: rows } }
      );
      return true;
    }

    if (CONSOLE_TYPES.includes(action)) {
      await sendModelPage(bot, chatId, action);
      return true;
    }

    return false;
  } catch (err) {
    const msg = err instanceof InventoryAssetError ? err.message : err.message || "Xatolik";
    await bot.sendMessage(chatId, `❌ ${msg}`);
    return true;
  }
}

async function handleText(bot, msg, { telegramId } = {}) {
  const chatId = msg.chat.id;
  const session = sessionStore.getSession(chatId);
  const step = session.step || "";
  if (!step.startsWith("admin:inv:")) return false;
  if (step.startsWith("admin:invitem:")) return false;

  const text = (msg.text || "").trim();
  const adminRecord = await prisma.admin.findUnique({
    where: { telegramId: BigInt(telegramId) },
  });
  const adminContext = { adminId: adminRecord?.id, telegramId };

  try {
    if (step === "admin:inv:addSerial") {
      const consoleType = session.data._invAddModel;
      if (!CONSOLE_TYPES.includes(consoleType)) {
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, "Sessiya xato.");
        return true;
      }

      const skip = text === "/skip" || text === "-";
      const raw = skip ? null : text.toUpperCase().replace(/\s+/g, "");

      let assetCode = raw;
      let serialNumber = raw;
      if (raw && !/^(PS3|PS4|PS5)-\d+$/i.test(raw)) {
        assetCode = undefined;
        serialNumber = raw;
      }

      const created = await inventoryAssetService.createAsset(
        {
          model: consoleType,
          assetCode: skip ? undefined : assetCode,
          serialNumber: skip ? undefined : serialNumber,
          displayName: skip ? undefined : assetCode || serialNumber,
        },
        adminContext
      );

      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, `✅ Qurilma qo'shildi: <b>${created.assetCode}</b>`, {
        parse_mode: "HTML",
      });
      await sendModelPage(bot, chatId, consoleType);
      return true;
    }

    if (step === "admin:inv:editNote") {
      const unitId = session.data._invEditId;
      const model = session.data._invEditModel;
      const note = text === "/skip" ? null : text;
      await inventoryAssetService.updateAsset(unitId, { notes: note }, adminContext);
      sessionStore.clearSession(chatId);
      await bot.sendMessage(chatId, "✅ Izoh yangilandi.");
      if (model) await sendModelPage(bot, chatId, model);
      return true;
    }

    if (step === "admin:inv:set") {
      sessionStore.clearSession(chatId);
      await bot.sendMessage(
        chatId,
        "ℹ️ Sonni qo'lda o'zgartirish o'chirilgan.\nQurilmani «➕ Qurilma qo'shish» orqali qo'shing."
      );
      await sendOverview(bot, chatId);
      return true;
    }
  } catch (err) {
    await bot.sendMessage(chatId, `❌ ${err.message}`);
    return true;
  }

  return false;
}

module.exports = {
  modelPickerKeyboard,
  modelActionsKeyboard,
  formatModelPage,
  formatOverviewMenu,
  sendOverview,
  sendModelPage,
  handleCallback,
  handleText,
  STATUS_ICON,
  STATUS_SHORT,
};
