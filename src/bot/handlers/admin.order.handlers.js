const orderService = require("../../services/order.service");
const orderAssignmentService = require("../../services/orderAssignment.service");
const orderNotificationService = require("../../services/orderNotification.service");
const courierService = require("../../services/courier.service");
const adminOrderKeyboards = require("../keyboards/admin.order.keyboards");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { OrderAssignmentError } = require("../../errors/order.errors");
const { addCallbackHandler } = require("../events/callbackRouter");

function registerAdminOrderHandlers(bot, isAdmin) {
  addCallbackHandler("admin-order", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("admin:order:")) return false;

    const parts = data.split(":");
    const action = parts[2];
    // timeline va boshqa noma'lum actionlar admin.handlers ga o'tsin
    if (!["confirm", "reject", "cancel", "details", "assign", "assignTo"].includes(action)) {
      return false;
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return true;
    }

    try {
      if (action === "confirm") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.confirmOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(chatId, `✅ Buyurtma #${orderId} tasdiqlandi.`);
      } else if (action === "reject") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.rejectOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} rad etildi (REJECTED).`);
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: query.message.message_id,
          });
        } catch (_) {}
      } else if (action === "cancel") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.cancelOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} bekor qilindi.`);
      } else if (action === "details") {
        const orderId = Number(parts[3]);
        const order = await orderService.getOrderById(orderId);
        await bot.sendMessage(chatId, orderNotificationService.buildOrderDetailsText(order), {
          parse_mode: "HTML",
        });
      } else if (action === "assign") {
        const orderId = Number(parts[3]);
        const couriers = await courierService.listActiveCouriers();
        await bot.sendMessage(chatId, "Kuryerni tanlang:", adminOrderKeyboards.courierPickKeyboard(orderId, couriers));
      } else if (action === "assignTo") {
        const orderId = Number(parts[3]);
        const courierId = Number(parts[4]);
        const order = await orderAssignmentService.assignOrderByAdmin(orderId, courierId);
        await bot.sendMessage(chatId, `✅ Buyurtma #${order.id} kuryerga biriktirildi.`);
      }

      await safeAnswerCallbackQuery(bot, query.id);
    } catch (err) {
      const msg = err instanceof OrderAssignmentError ? err.message : "Xatolik yuz berdi";
      await safeAnswerCallbackQuery(bot, query.id, { text: msg });
    }
    return true;
  });
}

module.exports = { registerAdminOrderHandlers };
