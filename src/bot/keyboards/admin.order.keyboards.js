function newOrderKeyboard(orderId, { confirmAllowed = false, highPriority = false } = {}) {
  const rows = [];

  if (confirmAllowed) {
    rows.push([
      {
        text: highPriority ? "🚨 Tasdiqlash (PRIORITY)" : "✅ Tasdiqlash",
        callback_data: `admin:order:confirm:${orderId}`,
      },
      { text: "❌ Rad etish", callback_data: `admin:order:reject:${orderId}` },
    ]);
  } else {
    rows.push([
      {
        text: "⏳ Hali tasdiqlab bo'lmaydi",
        callback_data: `admin:order:confirmBlocked:${orderId}`,
      },
      { text: "❌ Rad etish", callback_data: `admin:order:reject:${orderId}` },
    ]);
  }

  rows.push([{ text: "🚫 Bekor qilish", callback_data: `admin:order:cancel:${orderId}` }]);
  rows.push([{ text: "📋 Tafsilotlar", callback_data: `admin:order:details:${orderId}` }]);

  return { reply_markup: { inline_keyboard: rows } };
}

/** @deprecated Manual assign removed from primary workflow */
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
