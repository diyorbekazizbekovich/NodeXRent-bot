function customerActionsKeyboard(userId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📨 Xabar yuborish", callback_data: `admin:crm:msg:${userId}` }],
        [
          { text: "📋 Profil", callback_data: `admin:crm:profile:${userId}` },
          { text: "📦 Buyurtmalari", callback_data: `admin:crm:orders:${userId}` },
        ],
        [{ text: "💬 Chat tarixi", callback_data: `admin:crm:chathistory:${userId}` }],
        [{ text: "⬅️ Orqaga", callback_data: "admin:crm:back" }],
      ],
    },
  };
}

function crmProfileActionsKeyboard(userId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📝 Izoh", callback_data: `admin:crm:notes:${userId}` },
          { text: "📨 Xabar", callback_data: `admin:crm:msg:${userId}` },
        ],
        [
          { text: "⭐ Ishonchli", callback_data: `admin:crm:rate:${userId}:TRUSTED` },
          { text: "👤 Oddiy", callback_data: `admin:crm:rate:${userId}:NORMAL` },
        ],
        [{ text: "⚠️ Xavfli", callback_data: `admin:crm:rate:${userId}:RISKY` }],
        [{ text: "⬅️ Orqaga", callback_data: `admin:crm:view:${userId}` }],
      ],
    },
  };
}

function cancelComposeKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: "admin:support:cancel" }]],
    },
  };
}

module.exports = {
  customerActionsKeyboard,
  crmProfileActionsKeyboard,
  cancelComposeKeyboard,
};
