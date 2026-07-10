function newOrderKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Tasdiqlash", callback_data: `admin:order:confirm:${orderId}` },
          { text: "❌ Rad etish", callback_data: `admin:order:reject:${orderId}` },
        ],
        [
          { text: "🚫 Bekor qilish", callback_data: `admin:order:cancel:${orderId}` },
        ],
        [
          { text: "👤 Kuryer biriktirish", callback_data: `admin:order:assign:${orderId}` },
          { text: "📋 Tafsilotlar", callback_data: `admin:order:details:${orderId}` },
        ],
      ],
    },
  };
}

function courierPickKeyboard(orderId, couriers) {
  return {
    reply_markup: {
      inline_keyboard: couriers.map((c) => [
        {
          text: `${c.fullName || c.telegramId} (${c.phone || "tel yo'q"})`,
          callback_data: `admin:order:assignTo:${orderId}:${c.id}`,
        },
      ]),
    },
  };
}

module.exports = { newOrderKeyboard, courierPickKeyboard };
