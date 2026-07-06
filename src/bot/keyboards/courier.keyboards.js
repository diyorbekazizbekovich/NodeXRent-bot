function mainMenuKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ["📦 Buyurtmalar", "✅ Faol buyurtmalar"],
        ["📜 Tarix", "👤 Profil"],
        ["⚙️ Sozlamalar"],
      ],
      resize_keyboard: true,
    },
  };
}

function settingsKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📱 Telefon va hudud", callback_data: "courier:settings:profile" }],
        [{ text: "📍 Lokatsiyani yangilash", callback_data: "courier:settings:location" }],
      ],
    },
  };
}

function newOrderKeyboard(orderId, lat, lon) {
  const rows = [
    [
      { text: "✅ Qabul qilish", callback_data: `courier:accept:${orderId}` },
      { text: "❌ Rad etish", callback_data: `courier:reject:${orderId}` },
    ],
  ];
  if (lat != null && lon != null) {
    rows.push([{ text: "📍 Lokatsiya", callback_data: `courier:location:${orderId}` }]);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function assignedOrderKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "🚗 Yo'lga chiqish", callback_data: `courier:onway:${orderId}` }]],
    },
  };
}

function onTheWayKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "📍 Yetib keldim", callback_data: `courier:arrived:${orderId}` }]],
    },
  };
}

function arrivedKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "📦 Yetkazildi", callback_data: `courier:delivered:${orderId}` }]],
    },
  };
}

function deliveredKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "↩️ Qaytarildi", callback_data: `courier:returned:${orderId}` }]],
    },
  };
}

function cancelKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [[{ text: "❌ Bekor qilish", callback_data: `courier:cancel:${orderId}` }]],
    },
  };
}

module.exports = {
  mainMenuKeyboard,
  settingsKeyboard,
  newOrderKeyboard,
  assignedOrderKeyboard,
  onTheWayKeyboard,
  arrivedKeyboard,
  deliveredKeyboard,
  cancelKeyboard,
};
