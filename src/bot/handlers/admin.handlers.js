const prisma = require("../../config/prisma");
const env = require("../../config/env");
const adminKeyboards = require("../keyboards/admin.keyboards");
const reportService = require("../../services/report.service");
const dashboardService = require("../../services/dashboard.service");
const inventoryService = require("../../services/inventory.service");
const analyticsService = require("../../services/analytics.service");
const auditLogService = require("../../services/auditLog.service");
const settingsService = require("../../services/settings.service");
const pricingService = require("../../services/pricing.service");
const orderService = require("../../services/order.service");
const courierService = require("../../services/courier.service");
const userService = require("../../services/user.service");
const { notify } = require("../../services/notification.service");
const sessionStore = require("../sessionStore");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const adminPricingKeyboards = require("../keyboards/admin.pricing.keyboards");
const {
  registerPricingAdmin,
  handlePricingAdminMessage,
} = require("./admin.pricing.handlers");
const { registerAdminOrderHandlers } = require("./admin.order.handlers");
const {
  registerAdminCourierHandlers,
  handleCourierAdminMessage,
  courierAdminMenuKeyboard,
} = require("./admin.courier.handlers");
const dashboardKpiService = require("../../services/dashboardKpi.service");
const adminAlertService = require("../../services/adminAlert.service");
const maintenanceService = require("../../services/maintenance.service");
const rentalExtensionService = require("../../services/rentalExtension.service");
const courierStatsService = require("../../services/courierStats.service");
const realtimeDashboardService = require("../../services/realtimeDashboard.service");
const broadcastService = require("../../services/broadcast.service");
const promoService = require("../../services/promo.service");
const {
  registerAdminCrmHandlers,
  handleCrmAdminMessage,
  showCrmMenu,
} = require("./admin.crm.handlers");
const { registerAdminBackupHandlers, backupKeyboard } = require("./admin.backup.handlers");
const { label, filterGroup } = require("../../constants/orderStatus");
const { buildOrderTimeline } = require("../../utils/orderTimeline");

async function isAdmin(telegramId) {
  if (env.ADMIN_TELEGRAM_IDS.includes(Number(telegramId))) return true;
  const admin = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
  return Boolean(admin);
}

function register(bot) {
  registerPricingAdmin(bot, isAdmin);
  registerAdminOrderHandlers(bot, isAdmin);
  registerAdminCourierHandlers(bot, isAdmin);
  registerAdminCrmHandlers(bot, isAdmin);
  registerAdminBackupHandlers(bot, isAdmin);

  bot.onText(/\/admin/, async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Sizda admin huquqlari yo'q.");
      return;
    }
    const [stats, alerts] = await Promise.all([
      dashboardKpiService.getKpiStats(),
      adminAlertService.getAdminAlerts(),
    ]);
    const text =
      adminAlertService.formatAlerts(alerts) +
      "\n\n" +
      dashboardKpiService.formatKpiDashboard(stats) +
      "\n\n_🔄 Real-time dashboard faol_";
    const sent = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      ...adminKeyboards.mainMenuKeyboard(),
    });
    if (await realtimeDashboardService.isEnabled(telegramId)) {
      realtimeDashboardService.subscribe(chatId, sent.message_id);
    }
  });

  bot.on("message", async (msg) => {
    const chatId = msg.chat.id;
    const telegramId = msg.from.id;
    if (!(await isAdmin(telegramId))) return;

    const session = sessionStore.getSession(chatId);

    if (session.step === "admin:ads:await") {
      const adminRecord = await prisma.admin.upsert({
        where: { telegramId: BigInt(telegramId) },
        update: {},
        create: { telegramId: BigInt(telegramId), fullName: msg.from.first_name },
      });

      const hasContent =
        msg.text ||
        msg.photo ||
        msg.video ||
        msg.video_note ||
        msg.voice ||
        msg.audio ||
        msg.animation ||
        msg.sticker ||
        msg.document ||
        msg.contact ||
        msg.location;

      if (!hasContent) {
        await bot.sendMessage(chatId, "❗️ Matn yoki media yuboring (rasm, video, ovoz va hokazo).");
        return;
      }

      const progressMsg = await bot.sendMessage(chatId, "📢 Yuborish boshlandi... 0%");
      try {
        const result = await broadcastService.broadcast(bot, msg, adminRecord.id, async ({ pct, success, failed, total, done }) => {
          try {
            await bot.editMessageText(
              `📢 Yuborilmoqda... ${pct}%\n✅ ${success} | ❌ ${failed} | Jami ${total} (${done}/${total})`,
              { chat_id: chatId, message_id: progressMsg.message_id }
            );
          } catch (_) {}
        });
        sessionStore.clearSession(chatId);
        await bot.sendMessage(
          chatId,
          `📢 *Yakuniy hisobot*\n\n` +
            `Tur: ${result.mediaType}\n` +
            `Jami: ${result.total}\n` +
            `✅ Muvaffaqiyatli: ${result.success}\n` +
            `❌ Xatolik: ${result.failed}`,
          { parse_mode: "Markdown" }
        );
      } catch (err) {
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, `❌ Reklama yuborishda xatolik: ${err.message}`);
      }
      return;
    }

    if (!msg.text) return;

    if (await handlePricingAdminMessage(bot, chatId, msg, session)) return;
    if (await handleCourierAdminMessage(bot, chatId, msg, session)) return;
    if (await handleCrmAdminMessage(bot, chatId, msg, session)) return;

    if (session.step === "admin:inv:set") {
      const consoleType = session.data._consoleType;
      const target = Number(msg.text.trim());
      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        await inventoryService.setCount(consoleType, target, {
          telegramId,
          adminId: adminRecord?.id,
        });
        sessionStore.clearSession(chatId);
        const counts = await inventoryService.getCountsByType();
        await bot.sendMessage(chatId, `✅ ${consoleType} soni ${target} taga o'rnatildi.`, {
          parse_mode: "Markdown",
          ...adminKeyboards.inventoryTypeKeyboard(),
        });
        await bot.sendMessage(chatId, inventoryService.formatInventoryMenu(counts), { parse_mode: "Markdown" });
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      return;
    }

    if (session.step === "admin:settings:delivery") {
      try {
        const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
        const fee = await settingsService.setDeliveryFee(msg.text.trim(), {
          telegramId,
          adminId: adminRecord?.id,
        });
        sessionStore.clearSession(chatId);
        await bot.sendMessage(chatId, `✅ Yetkazib berish narxi: ${fee.toLocaleString()} so'm`);
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      return;
    }

    // ---- Promo-kod yaratish jarayoni ----
    if (session.step === "admin:promo:code") {
      sessionStore.updateData(chatId, { _code: msg.text.trim() });
      sessionStore.setStep(chatId, "admin:promo:discount");
      await bot.sendMessage(chatId, "Chegirma foizini kiriting (masalan 15):");
      return;
    }
    if (session.step === "admin:promo:discount") {
      sessionStore.updateData(chatId, { _discount: Number(msg.text.trim()) });
      sessionStore.setStep(chatId, "admin:promo:limit");
      await bot.sendMessage(chatId, "Foydalanish limitini kiriting (masalan 100):");
      return;
    }
    if (session.step === "admin:promo:limit") {
      sessionStore.updateData(chatId, { _limit: Number(msg.text.trim()) });
      sessionStore.setStep(chatId, "admin:promo:days");
      await bot.sendMessage(chatId, "Necha kun amal qilishini kiriting (masalan 30):");
      return;
    }
    if (session.step === "admin:promo:days") {
      const { _code, _discount, _limit } = session.data;
      const days = Number(msg.text.trim());
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + days);

      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const promo = await promoService.createPromo(
        {
          code: _code,
          discountType: "PERCENT",
          discountPercent: _discount,
          usageLimit: _limit,
          expiresAt,
          perUserLimit: 1,
        },
        { telegramId, adminId: adminRecord?.id }
      );
      sessionStore.clearSession(chatId);
      await bot.sendMessage(
        chatId,
        `✅ Promo-kod yaratildi: <b>${promo.code}</b> (-${promo.discountPercent}%, limit: ${promo.usageLimit}, muddat: ${days} kun)`,
        { parse_mode: "HTML" }
      );
      return;
    }

    switch (msg.text) {
      case "📊 Dashboard": {
        const [stats, alerts] = await Promise.all([
          dashboardKpiService.getKpiStats(),
          adminAlertService.getAdminAlerts(),
        ]);
        const text =
          adminAlertService.formatAlerts(alerts) + "\n\n" + dashboardKpiService.formatKpiDashboard(stats);
        const sent = await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
        if (await realtimeDashboardService.isEnabled(telegramId)) {
          realtimeDashboardService.subscribe(chatId, sent.message_id);
        }
        return;
      }
      case "👥 CRM": {
        await showCrmMenu(bot, chatId);
        return;
      }
      case "💾 Backup": {
        await bot.sendMessage(chatId, "💾 *Backup va audit*", {
          parse_mode: "Markdown",
          ...backupKeyboard(),
        });
        return;
      }
      case "🏷️ Promo":
      case "🏷️ Promo-kodlar": {
        const promos = await promoService.listPromos();
        const lines = promos.length ? promos.map(promoService.formatPromoLine).join("\n") : "Promo-kodlar yo'q.";
        await bot.sendMessage(chatId, `🏷️ *Promo-kodlar*\n\n${lines}`, {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [{ text: "➕ Yangi promo", callback_data: "admin:promo:new" }],
            ],
          },
        });
        return;
      }
      case "📅 Bugun": {
        const stats = await dashboardService.getDashboardStats();
        await bot.sendMessage(chatId, dashboardService.formatTodayBlock(stats), { parse_mode: "Markdown" });
        return;
      }
      case "📊 Statistika": {
        const stats = await reportService.generalStats();
        const statusLines = stats.ordersByStatus.map((s) => `  • ${label(s.status)}: ${s.count}`).join("\n");
        await bot.sendMessage(
          chatId,
          `📊 <b>Umumiy statistika</b>\n\n` +
            `👥 Foydalanuvchilar: ${stats.totalUsers}\n` +
            `🚚 Kuryerlar: ${stats.totalCouriers}\n` +
            `🎮 PlayStationlar: ${stats.totalPlaystations}\n` +
            `📦 Jami buyurtmalar: ${stats.totalOrders}\n` +
            `💰 Jami daromad: ${stats.totalRevenue.toLocaleString()} so'm\n\n` +
            `Statuslar bo'yicha:\n${statusLines}`,
          { parse_mode: "HTML" }
        );
        return;
      }
      case "📦 Buyurtmalar": {
        await bot.sendMessage(chatId, "Status bo'yicha filter:", adminKeyboards.orderStatusFilterKeyboard());
        return;
      }
      case "🎮 Inventar":
      case "🎮 PlayStationlar": {
        const counts = await inventoryService.getCountsByType();
        await bot.sendMessage(chatId, inventoryService.formatInventoryMenu(counts), {
          parse_mode: "Markdown",
          ...adminKeyboards.inventoryTypeKeyboard(),
        });
        return;
      }
      case "📈 Analytics": {
        const report = await analyticsService.getAnalyticsReport();
        await bot.sendMessage(chatId, analyticsService.formatAnalytics(report), { parse_mode: "Markdown" });
        return;
      }
      case "📋 Loglar": {
        const logs = await auditLogService.recent(15);
        const text = logs.length ? logs.map(auditLogService.formatEntry).join("\n\n") : "Loglar yo'q.";
        await bot.sendMessage(chatId, `📋 *Admin loglar*\n\n${text}`, { parse_mode: "Markdown" });
        return;
      }
      case "⚙️ Sozlamalar": {
        const [fee, maintenanceOn, realtimeOn] = await Promise.all([
          settingsService.getDeliveryFee(),
          maintenanceService.isEnabled(),
          realtimeDashboardService.isEnabled(telegramId),
        ]);
        await bot.sendMessage(
          chatId,
          `⚙️ *Sozlamalar*\n\n🚚 Yetkazib berish: *${fee.toLocaleString()} so'm*\n🚧 Maintenance: *${maintenanceOn ? "YOQILGAN" : "O'CHIRILGAN"}*\n🔄 Real-time: *${realtimeOn ? "YOQILGAN" : "O'CHIRILGAN"}*`,
          { parse_mode: "Markdown", ...adminKeyboards.settingsKeyboard({ maintenanceOn, realtimeOn }) }
        );
        return;
      }
      case "👥 Foydalanuvchilar": {
        const users = await userService.listUsers({ take: 15 });
        const lines = users.map((u) => `• ${u.fullName || "—"} (${u.phone || "tel yo'q"}) ${u.isBlocked ? "🚫" : ""}`);
        await bot.sendMessage(chatId, lines.join("\n") || "Foydalanuvchilar topilmadi.");
        return;
      }
      case "🚚 Kuryerlar": {
        const top = await courierStatsService.getTopCouriers(5);
        await bot.sendMessage(chatId, courierStatsService.formatTopCouriers(top), { parse_mode: "Markdown" });
        await bot.sendMessage(chatId, "🚚 Kuryerlar boshqaruvi:", courierAdminMenuKeyboard());
        return;
      }
      case "📢 Reklama": {
        sessionStore.setStep(chatId, "admin:ads:await");
        await bot.sendMessage(
          chatId,
          "📢 *Reklama yuborish*\n\nMatn, rasm, video, ovoz, sticker, hujjat, kontakt yoki lokatsiya yuboring.\nCaption va inline tugmalar saqlanadi.",
          { parse_mode: "Markdown" }
        );
        return;
      }
      case "💰 Narxlar": {
        await bot.sendMessage(chatId, "💰 Narxlar boshqaruvi:", adminPricingKeyboards.pricingMenuKeyboard());
        return;
      }
      default:
        return;
    }
  });

  bot.on("callback_query", async (query) => {
    const data = query.data;
    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return;
    }

    if (data === "admin:promo:new") {
      sessionStore.setStep(chatId, "admin:promo:code");
      await bot.sendMessage(chatId, "Yangi promo-kod matnini kiriting (masalan SUMMER2026):");
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:promo:toggle:")) {
      const id = Number(data.split(":")[3]);
      const promo = await prisma.promocode.findUnique({ where: { id } });
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      await promoService.togglePromo(id, !promo.isActive, { telegramId, adminId: adminRecord?.id });
      await bot.sendMessage(chatId, `✅ Promo holati o'zgartirildi.`);
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:ext:")) {
      const [, , action, extIdRaw] = data.split(":");
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const ctx = { telegramId, adminId: adminRecord?.id };
      try {
        if (action === "approve") {
          await rentalExtensionService.approveExtension(Number(extIdRaw), ctx);
          await bot.sendMessage(chatId, "✅ Uzaytirish tasdiqlandi.");
        } else if (action === "reject") {
          await rentalExtensionService.rejectExtension(Number(extIdRaw), ctx);
          await bot.sendMessage(chatId, "❌ Uzaytirish rad etildi.");
        }
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data === "admin:settings:realtime") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const ctx = { telegramId, adminId: adminRecord?.id };
      const enabled = await realtimeDashboardService.toggle(telegramId, ctx);
      if (enabled) {
        const [stats, alerts] = await Promise.all([
          dashboardKpiService.getKpiStats(),
          adminAlertService.getAdminAlerts(),
        ]);
        const text =
          adminAlertService.formatAlerts(alerts) + "\n\n" + dashboardKpiService.formatKpiDashboard(stats);
        const sent = await bot.sendMessage(chatId, text + "\n\n_🔄 Real-time yoqildi_", { parse_mode: "Markdown" });
        realtimeDashboardService.subscribe(chatId, sent.message_id);
        await bot.sendMessage(chatId, "✅ Real-time dashboard yoqildi.");
      } else {
        await bot.sendMessage(chatId, "✅ Real-time dashboard o'chirildi.");
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data === "admin:dashboard:unsubscribe") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      await realtimeDashboardService.setEnabled(telegramId, false, { telegramId, adminId: adminRecord?.id });
      await bot.sendMessage(chatId, "Real-time dashboard o'chirildi.");
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data === "admin:settings:maintenance") {
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const current = await maintenanceService.isEnabled();
      await maintenanceService.setEnabled(!current, { telegramId, adminId: adminRecord?.id });
      await bot.sendMessage(chatId, current ? "✅ Maintenance o'chirildi." : "🚧 Maintenance yoqildi.");
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data === "admin:inv:units") {
      const units = await prisma.inventoryUnit.findMany({ orderBy: { unitCode: "asc" }, take: 30 });
      const rows = units.map((u) => [{ text: u.unitCode, callback_data: `admin:inv:unit:${u.id}` }]);
      await bot.sendMessage(chatId, "📋 *Inventar qurilmalar*", {
        parse_mode: "Markdown",
        reply_markup: { inline_keyboard: rows },
      });
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:inv:unit:")) {
      const unitId = Number(data.split(":")[3]);
      const unit = await inventoryService.getUnitById(unitId);
      await bot.sendMessage(chatId, inventoryService.formatUnitDetail(unit), { parse_mode: "Markdown" });
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:orders:filter:")) {
      const filterKey = data.split(":")[3];
      const group = filterGroup(filterKey);
      const orders = await orderService.listOrdersByFilter(filterKey, { take: 10 });
      const title = group?.label || (filterKey === "ALL" ? "Barchasi" : filterKey);
      if (orders.length === 0) {
        await bot.sendMessage(chatId, `"${title}" bo'yicha buyurtmalar yo'q.`);
      } else {
        for (const o of orders) {
          await bot.sendMessage(
            chatId,
            `#${o.id} — ${o.consoleType} — ${label(o.status)}\nMijoz: ${o.user?.fullName || "—"}`,
            {
              reply_markup: {
                inline_keyboard: [[{ text: "📜 Timeline", callback_data: `admin:order:timeline:${o.id}` }]],
              },
            }
          );
        }
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:order:timeline:")) {
      const orderId = Number(data.split(":")[3]);
      const order = await orderService.getOrderById(orderId);
      if (order) {
        await bot.sendMessage(chatId, buildOrderTimeline(order), { parse_mode: "Markdown" });
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data.startsWith("admin:inv:")) {
      const [, , consoleType, action] = data.split(":");
      const adminRecord = await prisma.admin.findUnique({ where: { telegramId: BigInt(telegramId) } });
      const ctx = { telegramId, adminId: adminRecord?.id };
      try {
        const counts = await inventoryService.getCountsByType();
        const current = counts[consoleType]?.total ?? 0;
        if (action === "inc") {
          await inventoryService.setCount(consoleType, current + 1, ctx);
        } else if (action === "dec") {
          await inventoryService.setCount(consoleType, current - 1, ctx);
        } else if (action === "set") {
          sessionStore.setStep(chatId, "admin:inv:set");
          sessionStore.updateData(chatId, { _consoleType: consoleType });
          await bot.sendMessage(chatId, `${consoleType} uchun yangi jami sonni kiriting (hozir: ${current}):`);
          await safeAnswerCallbackQuery(bot, query.id);
          return;
        } else if (action === "refresh") {
          // noop
        }
        const updated = await inventoryService.getCountsByType();
        await bot.sendMessage(chatId, inventoryService.formatInventoryMenu(updated), { parse_mode: "Markdown" });
      } catch (err) {
        await bot.sendMessage(chatId, `❌ ${err.message}`);
      }
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (data === "admin:settings:delivery") {
      sessionStore.setStep(chatId, "admin:settings:delivery");
      const fee = await settingsService.getDeliveryFee();
      await bot.sendMessage(chatId, `Hozirgi narx: ${fee.toLocaleString()} so'm.\nYangi narxni kiriting:`);
      await safeAnswerCallbackQuery(bot, query.id);
      return;
    }

    if (!data.startsWith("admin:orders:")) return;
    const status = data.split(":")[2];
    const orders = await orderService.listOrdersByStatus(status, { take: 15 });
    const lines = orders.map(
      (o) => `#${o.id} — ${o.consoleType}, mijoz: ${o.user.fullName || o.user.telegramId}, status: ${label(o.status)}`
    );
    await bot.sendMessage(chatId, lines.join("\n") || `"${label(status)}" statusida buyurtmalar yo'q.`);
    await safeAnswerCallbackQuery(bot, query.id);
  });
}

module.exports = { register, isAdmin };
