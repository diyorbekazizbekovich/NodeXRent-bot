function pricingMenuKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Barcha narxlar", callback_data: "admin:pricing:list" }],
        [{ text: "✏️ Narxni tahrirlash", callback_data: "admin:pricing:edit" }],
        [{ text: "➕ Yangi muddat qo'shish", callback_data: "admin:pricing:add" }],
        [{ text: "🔛 Faol/nofaol", callback_data: "admin:pricing:toggle" }],
        [{ text: "🎮 Konsol turlari", callback_data: "admin:pricing:consoles" }],
        [{ text: "⚙️ Konsol boshqaruvi", callback_data: "admin:pricing:manageConsoles" }],
        [{ text: "➕ Yangi konsol", callback_data: "admin:pricing:addConsole" }],
      ],
    },
  };
}

function rentalPriceSelectKeyboard(prices, action = "pick") {
  return {
    reply_markup: {
      inline_keyboard: prices.map((p) => [
        {
          text: `${p.consoleName} — ${p.duration}soat — ${Number(p.price).toLocaleString()} ${p.currency}${p.isActive ? "" : " (nofaol)"}`,
          callback_data: `admin:pricing:${action}:${p.id}`,
        },
      ]),
    },
  };
}

function consoleSelectKeyboard(consoles, prefix = "admin:pricing:console") {
  return {
    reply_markup: {
      inline_keyboard: consoles.map((c) => [
        {
          text: `${c.displayName} (${c.code})${c.isActive ? "" : " 🚫"}`,
          callback_data: `${prefix}:${c.id}`,
        },
      ]),
    },
  };
}

function consoleManageKeyboard(consoles) {
  return {
    reply_markup: {
      inline_keyboard: consoles.map((c) => [
        {
          text: `${c.isActive ? "✅" : "🚫"} ${c.displayName} (${c.code})`,
          callback_data: `admin:pricing:consoleManage:${c.id}`,
        },
      ]),
    },
  };
}

function consoleActionKeyboard(consoleId, isActive) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "✏️ Nomini o'zgartirish", callback_data: `admin:pricing:consoleRename:${consoleId}` }],
        [
          {
            text: isActive ? "🔴 Nofaol qilish" : "🟢 Faol qilish",
            callback_data: `admin:pricing:consoleToggle:${consoleId}`,
          },
        ],
        [{ text: "🗑 Butunlay o'chirish", callback_data: `admin:pricing:consoleDelete:${consoleId}` }],
        [{ text: "⬅️ Orqaga", callback_data: "admin:pricing:manageConsoles" }],
      ],
    },
  };
}

module.exports = { pricingMenuKeyboard, rentalPriceSelectKeyboard, consoleSelectKeyboard, consoleManageKeyboard, consoleActionKeyboard };
