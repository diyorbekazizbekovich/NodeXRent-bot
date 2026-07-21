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

function locationButton(orderId) {
  return { text: "📍 Lokatsiya", callback_data: `courier:location:${orderId}` };
}

function newOrderKeyboard(orderId, lat, lon, { confirmAllowed = false, highPriority = false } = {}) {
  const rows = [];
  if (confirmAllowed) {
    rows.push([
      {
        text: highPriority ? "🚨 Qabul qilish (PRIORITY)" : "✅ Qabul qilish",
        callback_data: `courier:accept:${orderId}`,
      },
      { text: "❌ Rad etish", callback_data: `courier:reject:${orderId}` },
    ]);
  } else {
    rows.push([
      {
        text: "⏳ Hali qabul qilib bo'lmaydi",
        callback_data: `courier:acceptBlocked:${orderId}`,
      },
      { text: "❌ Rad etish", callback_data: `courier:reject:${orderId}` },
    ]);
  }
  if (lat != null && lon != null) {
    rows.push([locationButton(orderId)]);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function assignedOrderKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚗 Yo'lga chiqish", callback_data: `courier:onway:${orderId}` }],
        [locationButton(orderId)],
      ],
    },
  };
}

function onTheWayKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📍 Yetib keldim", callback_data: `courier:arrived:${orderId}` }],
        [locationButton(orderId)],
      ],
    },
  };
}

function arrivedKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📦 Yetkazildi", callback_data: `courier:delivered:${orderId}` }],
        [locationButton(orderId)],
      ],
    },
  };
}

function locationUpdateKeyboard(orderId, lat, lon) {
  const rows = [[locationButton(orderId)]];
  if (lat != null && lon != null) {
    rows.push([
      {
        text: "🗺 Google Maps",
        url: `https://maps.google.com/?q=${lat},${lon}`,
      },
    ]);
  }
  return { reply_markup: { inline_keyboard: rows } };
}

function deliveredKeyboard(orderId) {
  // Legacy name — now used only for return-eligible statuses
  return returnPickupKeyboard(orderId);
}

/** ACTIVE rental list shortcut */
function activeRentalKeyboard(orderId, remainingText) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: `⏳ ${remainingText || "—"} · 📋 Batafsil`,
            callback_data: `courier:detail:${orderId}`,
          },
        ],
      ],
    },
  };
}

/**
 * Full active-order action pad (shown under detail card).
 * @param {object} opts
 * @param {boolean} [opts.canStartReturn]
 * @param {boolean} [opts.canPickUpNow]
 * @param {string|null} [opts.mapsUrl]
 * @param {string|null} [opts.phone]
 * @param {string|null} [opts.telegramId]
 */
function activeOrderDetailKeyboard(orderId, opts = {}) {
  const rows = [];

  if (opts.phone) {
    rows.push([
      {
        text: "📞 Mijozga qo'ng'iroq",
        url: `tel:${String(opts.phone).replace(/[^\d+]/g, "")}`,
      },
    ]);
  } else {
    rows.push([{ text: "📞 Telefon yo'q", callback_data: `courier:call:${orderId}` }]);
  }

  if (opts.telegramId) {
    rows.push([
      { text: "💬 Telegram", url: `tg://user?id=${opts.telegramId}` },
    ]);
  }

  if (opts.mapsUrl) {
    rows.push([{ text: "🗺 Navigatsiya", url: opts.mapsUrl }]);
  } else {
    rows.push([{ text: "📍 Lokatsiya", callback_data: `courier:location:${orderId}` }]);
  }

  rows.push([{ text: "📩 Eslatma yuborish", callback_data: `courier:remind:${orderId}` }]);
  rows.push([{ text: "↩️ Qaytarish so'rovlari", callback_data: `courier:returns:${orderId}` }]);
  rows.push([{ text: "📜 Tarix", callback_data: `courier:history:${orderId}` }]);

  if (opts.canPickUpNow || opts.canStartReturn) {
    rows.push([
      {
        text: opts.canPickUpNow ? "🚚 Hozir olib ketish" : "🚚 Qaytarishni boshlash",
        callback_data: `courier:returned:${orderId}`,
      },
    ]);
  }

  rows.push([{ text: "🔄 Yangilash", callback_data: `courier:detail:${orderId}` }]);

  return { reply_markup: { inline_keyboard: rows } };
}

/** RETURN_REQUESTED / RETURN_ASSIGNED — courier may collect */
function returnPickupKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Buyurtma tafsiloti", callback_data: `courier:detail:${orderId}` }],
        [{ text: "↩️ Qaytarib olish", callback_data: `courier:returned:${orderId}` }],
      ],
    },
  };
}

/** After pickup — waiting for admin */
function pickedUpKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "📋 Buyurtma tafsiloti", callback_data: `courier:detail:${orderId}` }],
        [
          {
            text: "🔍 Admin tekshiruvi kutilmoqda",
            callback_data: `courier:detail:${orderId}`,
          },
        ],
      ],
    },
  };
}

function handoverWizardCancelKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "❌ Bekor qilish", callback_data: `courier:hw:cancel:${orderId}` }],
      ],
    },
  };
}

/** Topshirish 1-bosqich: garov hujjati */
function handoverCollateralKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "🪪 ID Karta", callback_data: `courier:handover:collateral:${orderId}:ID_CARD` }],
        [{ text: "📕 Passport", callback_data: `courier:handover:collateral:${orderId}:PASSPORT` }],
        [{ text: "❌ Hujjat olinmadi", callback_data: `courier:handover:collateral:${orderId}:NONE` }],
        [{ text: "❌ Wizardni bekor qilish", callback_data: `courier:hw:cancel:${orderId}` }],
      ],
    },
  };
}

/** "Hujjat olinmadi" tasdiqi */
function handoverNoneConfirmKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Ha", callback_data: `courier:handover:noneConfirm:${orderId}:yes` },
          { text: "❌ Yo'q", callback_data: `courier:handover:noneConfirm:${orderId}:no` },
        ],
      ],
    },
  };
}

/** Topshirish 2-bosqich: to'lov usuli */
function handoverPaymentKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💵 Naqd", callback_data: `courier:handover:pay:${orderId}:CASH` },
          { text: "💳 Karta", callback_data: `courier:handover:pay:${orderId}:CARD` },
        ],
        [{ text: "❌ Wizardni bekor qilish", callback_data: `courier:hw:cancel:${orderId}` }],
      ],
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
  activeRentalKeyboard,
  activeOrderDetailKeyboard,
  returnPickupKeyboard,
  pickedUpKeyboard,
  locationUpdateKeyboard,
  handoverCollateralKeyboard,
  handoverNoneConfirmKeyboard,
  handoverPaymentKeyboard,
  handoverWizardCancelKeyboard,
  cancelKeyboard,
};
