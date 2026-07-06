function newOrderKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Confirm Order", callback_data: `admin:order:confirm:${orderId}` },
          { text: "❌ Cancel Order", callback_data: `admin:order:cancel:${orderId}` },
        ],
        [
          { text: "👤 Assign Courier", callback_data: `admin:order:assign:${orderId}` },
          { text: "📋 View Details", callback_data: `admin:order:details:${orderId}` },
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
