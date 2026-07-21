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

/** @deprecated Manual assign removed from primary delivery workflow */
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

/** Return pickup courier assignment */
function returnCourierPickKeyboard(orderId, couriers) {
  return {
    reply_markup: {
      inline_keyboard: couriers.map((c) => [
        {
          text: `↩️ ${c.fullName || c.telegramId}`,
          callback_data: `admin:order:returnAssignTo:${orderId}:${c.id}`,
        },
      ]),
    },
  };
}

function returnActionsKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: "↩️ Qaytarish so'rovi (force)", callback_data: `admin:order:returnReq:${orderId}` }],
        [{ text: "🚚 Qaytarish kuryeri", callback_data: `admin:order:returnAssign:${orderId}` }],
        [{ text: "✅ Tekshiruvni boshlash", callback_data: `admin:order:startInspect:${orderId}` }],
        [
          { text: "✅ Yaxshi holat", callback_data: `admin:order:inspectOk:${orderId}` },
          { text: "🔧 Ta'mir kerak", callback_data: `admin:order:inspectBad:${orderId}` },
        ],
      ],
    },
  };
}

/** Shown on post-pickup admin alert */
function pickedUpInspectionKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: "✅ Start Inspection",
            callback_data: `admin:order:startInspect:${orderId}`,
          },
        ],
        [{ text: "📋 Full Details", callback_data: `admin:order:details:${orderId}` }],
      ],
    },
  };
}

/** After inspection started (unit INSPECTION) */
function inspectionDecisionKeyboard(orderId) {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Good Condition", callback_data: `admin:order:inspectOk:${orderId}` },
          { text: "🔧 Needs Repair", callback_data: `admin:order:inspectBad:${orderId}` },
        ],
        [{ text: "📋 Full Details", callback_data: `admin:order:details:${orderId}` }],
      ],
    },
  };
}

module.exports = {
  newOrderKeyboard,
  courierPickKeyboard,
  returnCourierPickKeyboard,
  returnActionsKeyboard,
  pickedUpInspectionKeyboard,
  inspectionDecisionKeyboard,
};
