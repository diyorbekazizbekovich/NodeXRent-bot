const orderService = require("../../services/order.service");
const orderAssignmentService = require("../../services/orderAssignment.service");
const orderNotificationService = require("../../services/orderNotification.service");
const courierService = require("../../services/courier.service");
const rentalReturnService = require("../../services/rentalReturn.service");
const adminOrderKeyboards = require("../keyboards/admin.order.keyboards");
const { safeAnswerCallbackQuery } = require("../helpers/callbackHelper");
const { OrderAssignmentError } = require("../../errors/order.errors");
const { RentalReturnError } = require("../../services/rentalReturn.service");
const { addCallbackHandler } = require("../events/callbackRouter");
const prisma = require("../../config/prisma");

const HANDLED_ACTIONS = new Set([
  "confirm",
  "confirmBlocked",
  "reject",
  "cancel",
  "details",
  "assign",
  "assignTo",
  "returnReq",
  "returnAssign",
  "returnAssignTo",
  "inspectOk",
  "inspectBad",
  "returnMenu",
]);

function registerAdminOrderHandlers(bot, isAdmin) {
  addCallbackHandler("admin-order", async (bot, query) => {
    const data = query.data;
    if (!data?.startsWith("admin:order:")) return false;

    const parts = data.split(":");
    const action = parts[2];
    if (!HANDLED_ACTIONS.has(action)) {
      return false;
    }

    const chatId = query.message.chat.id;
    const telegramId = query.from.id;

    await safeAnswerCallbackQuery(bot, query.id);

    if (!(await isAdmin(telegramId))) {
      await bot.sendMessage(chatId, "Ruxsat yo'q.");
      return true;
    }

    const adminRecord = await prisma.admin.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });
    const adminContext = { adminId: adminRecord?.id, telegramId };

    try {
      if (action === "confirmBlocked") {
        await bot.sendMessage(chatId, "⏳ Ushbu buyurtmani hali tasdiqlab bo'lmaydi.");
      } else if (action === "confirm") {
        const orderId = Number(parts[3]);
        await orderAssignmentService.confirmOrderByAdmin(orderId, telegramId);
        await bot.sendMessage(
          chatId,
          `✅ Buyurtma #${orderId} tasdiqlandi (ADMIN_CONFIRMED).\n🚚 Kuryerlar navbatiga yuborildi.`
        );
        try {
          await bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
            chat_id: chatId,
            message_id: query.message.message_id,
          });
        } catch (_) {}
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
          ...adminOrderKeyboards.returnActionsKeyboard(orderId),
        });
      } else if (action === "returnMenu") {
        const orderId = Number(parts[3]);
        await bot.sendMessage(
          chatId,
          `↩️ Buyurtma #${orderId} — qaytarish / tekshiruv`,
          adminOrderKeyboards.returnActionsKeyboard(orderId)
        );
      } else if (action === "returnReq") {
        const orderId = Number(parts[3]);
        await rentalReturnService.requestReturn(orderId, {
          actorType: "admin",
          actorId: adminContext.adminId,
          force: true,
          adminContext,
          note: "Admin majburiy qaytarish so'rovi",
        });
        await bot.sendMessage(
          chatId,
          `✅ #${orderId} — RETURN_REQUESTED (majburiy).\nEndi qaytarish kuryerini biriktiring.`,
          adminOrderKeyboards.returnActionsKeyboard(orderId)
        );
      } else if (action === "returnAssign") {
        const orderId = Number(parts[3]);
        const couriers = await courierService.listActiveCouriers();
        await bot.sendMessage(
          chatId,
          `Qaytarish kuryerini tanlang (#${orderId}):`,
          adminOrderKeyboards.returnCourierPickKeyboard(orderId, couriers)
        );
      } else if (action === "returnAssignTo") {
        const orderId = Number(parts[3]);
        const courierId = Number(parts[4]);
        await rentalReturnService.assignReturnCourier(orderId, courierId, adminContext);
        await bot.sendMessage(chatId, `✅ #${orderId} — RETURN_ASSIGNED (kuryer #${courierId}).`);
      } else if (action === "inspectOk" || action === "inspectBad") {
        const orderId = Number(parts[3]);
        const outcome = action === "inspectOk" ? "ok" : "damaged";
        await rentalReturnService.completeAdminInspection(orderId, {
          outcome,
          note: outcome === "ok" ? "Tekshiruv OK" : "Nosozlik aniqlandi",
          adminContext,
        });
        await bot.sendMessage(
          chatId,
          outcome === "ok"
            ? `✅ #${orderId} COMPLETED — inventar AVAILABLE`
            : `🛠 #${orderId} COMPLETED — inventar MAINTENANCE`
        );
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
    } catch (err) {
      const expected = err instanceof OrderAssignmentError || err instanceof RentalReturnError;
      await bot.sendMessage(chatId, (expected ? err.message : "Xatolik").slice(0, 200));
    }
    return true;
  });
}

module.exports = { registerAdminOrderHandlers };
