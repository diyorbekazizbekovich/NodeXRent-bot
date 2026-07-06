const orderService = require("../../services/order.service");
const orderAssignmentService = require("../../services/orderAssignment.service");
const orderNotificationService = require("../../services/orderNotification.service");
const courierService = require("../../services/courier.service");
const adminOrderKeyboards = require("../keyboards/admin.order.keyboards");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { OrderAssignmentError } = require("../../errors/order.errors");

function registerAdminOrderHandlers(bot, isAdmin) {
  bot.on("callback_query", async (query) => {
    const data = query.data;
    if (!data.startsWith("admin:order:")) return;

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;
    if (!(await isAdmin(telegramId))) {
      await safeAnswerCallbackQuery(bot, query.id, { text: "Ruxsat yo'q." });
      return;
    }

    const parts = data.split(":");

    try {
      if (parts[2] === "confirm") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.confirmOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(chatId, `✅ Buyurtma #${orderId} tasdiqlandi.`);
      } else if (parts[2] === "cancel") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.cancelOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(chatId, `❌ Buyurtma #${orderId} bekor qilindi.`);
      } else if (parts[2] === "details") {
        const orderId = Number(parts[3]);
        const order = await orderService.getOrderById(orderId);
        await bot.sendMessage(chatId, orderNotificationService.buildOrderDetailsText(order), {
          parse_mode: "HTML",
        });
      } else if (parts[2] === "assign") {
        const orderId = Number(parts[3]);
        const couriers = await courierService.listActiveCouriers();
        await bot.sendMessage(chatId, "Kuryerni tanlang:", adminOrderKeyboards.courierPickKeyboard(orderId, couriers));
      } else if (parts[2] === "assignTo") {
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
  });
}

module.exports = { registerAdminOrderHandlers };
