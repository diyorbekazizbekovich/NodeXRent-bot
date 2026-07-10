const prisma = require("../../config/prisma");
const orderService = require("../../services/order.service");
const { t, resolveLang } = require("../../i18n");
const userService = require("../../services/user.service");

async function submitReview(bot, chatId, telegramId, orderId, rating) {
  const order = await orderService.getOrderById(orderId);
  if (!order) return;

  const user = await userService.getUserByTelegramId(telegramId);
  const L = resolveLang(user?.language || order.user?.language);

  const existing = await prisma.review.findUnique({ where: { orderId } });
  if (existing) {
    await bot.sendMessage(chatId, t("review.already", L));
    return;
  }

  await prisma.review.create({
    data: { orderId, userId: order.userId, rating },
  });

  await orderService.changeStatus(orderId, "COMPLETED");

  await bot.sendMessage(chatId, t("review.thanks", L, { stars: "⭐".repeat(rating) }));
}

module.exports = { submitReview };
