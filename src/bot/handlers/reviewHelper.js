const prisma = require("../../config/prisma");
const orderService = require("../../services/order.service");

async function submitReview(bot, chatId, telegramId, orderId, rating) {
  const order = await orderService.getOrderById(orderId);
  if (!order) return;

  const existing = await prisma.review.findUnique({ where: { orderId } });
  if (existing) {
    await bot.sendMessage(chatId, "Siz bu buyurtmaga allaqachon baho bergansiz.");
    return;
  }

  await prisma.review.create({
    data: { orderId, userId: order.userId, rating },
  });

  await orderService.changeStatus(orderId, "COMPLETED");

  await bot.sendMessage(chatId, `Rahmat! Siz ${"⭐".repeat(rating)} baho berdingiz. 🎉`);
}

module.exports = { submitReview };
