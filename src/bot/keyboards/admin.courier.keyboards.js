function courierAdminMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Barcha kuryerlar", callback_data: "admin:courier:list" }],
        [{ text: "➕ Kuryer qo'shish", callback_data: "admin:courier:add" }],
        [{ text: "🔍 Qidirish", callback_data: "admin:courier:search" }],
        [{ text: "📊 Umumiy statistika", callback_data: "admin:courier:stats" }],
      ],
    },
  };
}

function courierActionsKeyboard(courierId, isActive) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✏️ Tahrirlash", callback_data: `admin:courier:edit:${courierId}` },
          { text: isActive ? "🔴 Nofaol" : "🟢 Faol", callback_data: `admin:courier:toggle:${courierId}` },
        ],
        [
          { text: "📊 Statistika", callback_data: `admin:courier:detail:${courierId}` },
          { text: "🗑 O'chirish", callback_data: `admin:courier:delete:${courierId}` },
        ],
      ],
    },
  };
}

function courierEditFieldsKeyboard(courierId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "👤 Ism", callback_data: `admin:courier:editField:${courierId}:name` }],
        [{ text: "📱 Telefon", callback_data: `admin:courier:editField:${courierId}:phone` }],
        [{ text: "🏙 Hudud", callback_data: `admin:courier:editField:${courierId}:region` }],
        [{ text: "⬅️ Orqaga", callback_data: `admin:courier:detail:${courierId}` }],
      ],
    },
  };
}

module.exports = { courierAdminMenuKeyboard, courierActionsKeyboard, courierEditFieldsKeyboard };
