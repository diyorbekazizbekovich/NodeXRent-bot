function promoListKeyboard(promos) {
  const rows = promos.map((p) => [
    {
      text: `${p.isActive ? "✅" : "❌"} ${p.code}`,
      callback_data: `admin:promo:view:${p.id}`,
    },
  ]);
  rows.push([{ text: "➕ Yangi promo", callback_data: "admin:promo:new" }]);
  return { reply_markup: { inline_keyboard: rows } };
}

function promoActionKeyboard(promoId, isActive) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: isActive ? "🔴 O'chirish (nofaol)" : "🟢 Faollashtirish",
            callback_data: `admin:promo:toggle:${promoId}`,
          },
        ],
        [{ text: "✏️ Limitni o'zgartirish", callback_data: `admin:promo:editLimit:${promoId}` }],
        [{ text: "🗑 Butunlay o'chirish", callback_data: `admin:promo:delete:${promoId}` }],
        [{ text: "⬅️ Ro'yxat", callback_data: "admin:promo:list" }],
      ],
    },
  };
}

module.exports = { promoListKeyboard, promoActionKeyboard };
