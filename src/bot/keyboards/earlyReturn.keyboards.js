function reasonKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✅ Ishim tugadi", callback_data: `er:reason:${orderId}:WORK_DONE` }],
        [{ text: "🚗 Safarga ketaman", callback_data: `er:reason:${orderId}:TRAVEL` }],
        [{ text: "🏠 Uyda bo'lmayman", callback_data: `er:reason:${orderId}:AWAY_FROM_HOME` }],
        [{ text: "🎮 Endi kerak emas", callback_data: `er:reason:${orderId}:NO_LONGER_NEEDED` }],
        [{ text: "📝 Boshqa sabab", callback_data: `er:reason:${orderId}:OTHER` }],
        [{ text: "❌ Bekor qilish", callback_data: `er:cancel:${orderId}` }],
      ],
    },
  };
}

function addressKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 Hozirgi manzil", callback_data: `er:addr:${orderId}:current` }],
        [{ text: "📍 Yangi manzil", callback_data: `er:addr:${orderId}:new` }],
        [{ text: "❌ Bekor qilish", callback_data: `er:cancel:${orderId}` }],
      ],
    },
  };
}

function pickupTimeKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🟢 Hozirdan", callback_data: `er:time:${orderId}:now` }],
        [{ text: "🕒 30 daqiqadan keyin", callback_data: `er:time:${orderId}:30m` }],
        [{ text: "🕐 1 soatdan keyin", callback_data: `er:time:${orderId}:1h` }],
        [{ text: "📅 Boshqa vaqt", callback_data: `er:time:${orderId}:custom` }],
        [{ text: "❌ Bekor qilish", callback_data: `er:cancel:${orderId}` }],
      ],
    },
  };
}

function confirmKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ So'rov yuborish", callback_data: `er:submit:${orderId}` },
          { text: "❌ Bekor qilish", callback_data: `er:cancel:${orderId}` },
        ],
      ],
    },
  };
}

function adminReviewKeyboard(requestId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Tasdiqlash", callback_data: `admin:er:approve:${requestId}` },
          { text: "❌ Rad etish", callback_data: `admin:er:reject:${requestId}` },
        ],
        [{ text: "💬 Mijoz bilan bog'lanish", callback_data: `admin:er:contact:${requestId}` }],
        [{ text: "🕒 Boshqa vaqt belgilash", callback_data: `admin:er:reschedule:${requestId}` }],
      ],
    },
  };
}

module.exports = {
  reasonKeyboard,
  addressKeyboard,
  pickupTimeKeyboard,
  confirmKeyboard,
  adminReviewKeyboard,
};
