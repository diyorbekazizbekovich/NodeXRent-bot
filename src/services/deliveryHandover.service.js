const prisma = require("../config/prisma");
const inventoryItemService = require("./inventoryItem.service");
const { ITEM_TYPES } = require("./inventoryItem.service");
const orderRepository = require("../repositories/order.repository");
const {
  COLLATERAL_TYPES,
  PAYMENT_METHODS_HANDOVER,
  labelCollateral,
  labelHandoverPayment,
} = require("../constants/deliveryHandover");
const { PaymentStatus } = require("../constants/paymentStatus");
const { formatDatetime } = require("../utils/dateHelper");
const pricingService = require("./pricing.service");
const { calculateDiscount } = require("./promo.service");
const { t, resolveLang } = require("../i18n");
const { notify } = require("./notification.service");
const { getAdminRecipients } = require("../utils/adminRecipients");
const contractService = require("./contract.service");
const logger = require("../utils/logger");
const { CONDITIONS, labelCondition } = require("../constants/inventoryItem");

const HANDOVER_ALLOWED_FROM = new Set(["ON_THE_WAY", "ARRIVED", "COURIER_ASSIGNED", "ACCEPTED"]);
const ACTIVE_STATUSES = new Set(["DELIVERED", "ACTIVE"]);

class DeliveryHandoverError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DeliveryHandoverError";
    this.code = code;
  }
}

function assertCollateral(type) {
  if (!Object.values(COLLATERAL_TYPES).includes(type)) {
    throw new DeliveryHandoverError("INVALID_COLLATERAL", "Hujjat turi noto'g'ri");
  }
}

function assertPaymentMethod(method) {
  if (!Object.values(PAYMENT_METHODS_HANDOVER).includes(method)) {
    throw new DeliveryHandoverError("INVALID_PAYMENT", "To'lov usuli noto'g'ri");
  }
}

function money(n) {
  return `${Number(n || 0).toLocaleString("uz-UZ")} so'm`;
}

/**
 * Inventar + to'lov + garov + shartnoma + ACTIVE.
 * photoFileId majburiy (Telegram file_id).
 */
async function completeHandover({
  orderId,
  courierId,
  consoleItemId,
  joystickIds,
  hdmiItemId,
  powerItemId,
  collateralType,
  paymentMethod,
  photoFileId,
  bot,
}) {
  assertCollateral(collateralType);
  assertPaymentMethod(paymentMethod);

  const jsIds = [...new Set((joystickIds || []).map(Number))];
  if (jsIds.length !== 4) {
    throw new DeliveryHandoverError("JOYSTICKS", "Aniq 4 ta joystick tanlanishi shart");
  }
  if (!consoleItemId || !hdmiItemId || !powerItemId) {
    throw new DeliveryHandoverError("INVENTORY", "Konsol, HDMI va Power majburiy");
  }
  if (!photoFileId) {
    throw new DeliveryHandoverError("PHOTO", "Mijoz + shartnoma surati majburiy");
  }

  const allItemIds = [Number(consoleItemId), ...jsIds, Number(hdmiItemId), Number(powerItemId)];
  if (new Set(allItemIds).size !== allItemIds.length) {
    throw new DeliveryHandoverError("DUPLICATE_ITEMS", "Bir xil inventar ikki marta tanlangan");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        user: true,
        courier: true,
        rentalPrice: { include: { consoleCatalog: true } },
        promocode: true,
      },
    });

    if (!order) throw new DeliveryHandoverError("NOT_FOUND", "Buyurtma topilmadi");
    if (order.courierId !== Number(courierId)) {
      throw new DeliveryHandoverError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
    }
    if (order.paymentReceived || ACTIVE_STATUSES.has(order.status)) {
      throw new DeliveryHandoverError("ALREADY_DONE", "Buyurtma allaqachon topshirilgan");
    }
    if (!HANDOVER_ALLOWED_FROM.has(order.status)) {
      throw new DeliveryHandoverError("INVALID_STATUS", `Noto'g'ri holat: ${order.status}`);
    }

    const consoleItem = await tx.inventoryItem.findUnique({ where: { id: Number(consoleItemId) } });
    if (!consoleItem || consoleItem.itemType !== ITEM_TYPES.CONSOLE) {
      throw new DeliveryHandoverError("CONSOLE", "Konsol topilmadi");
    }
    if (consoleItem.consoleType !== order.consoleType) {
      throw new DeliveryHandoverError("CONSOLE_TYPE", "Konsol turi buyurtmaga mos emas");
    }

    const joysticks = await tx.inventoryItem.findMany({ where: { id: { in: jsIds } } });
    if (joysticks.length !== 4 || joysticks.some((j) => j.itemType !== ITEM_TYPES.JOYSTICK)) {
      throw new DeliveryHandoverError("JOYSTICKS", "Joysticklar noto'g'ri");
    }

    const hdmi = await tx.inventoryItem.findUnique({ where: { id: Number(hdmiItemId) } });
    const power = await tx.inventoryItem.findUnique({ where: { id: Number(powerItemId) } });
    if (!hdmi || hdmi.itemType !== ITEM_TYPES.HDMI) {
      throw new DeliveryHandoverError("HDMI", "HDMI topilmadi");
    }
    if (!power || power.itemType !== ITEM_TYPES.POWER) {
      throw new DeliveryHandoverError("POWER", "Power kabel topilmadi");
    }

    await inventoryItemService.lockItems(tx, allItemIds, {
      orderId: order.id,
      actorId: Number(courierId),
    });

    const basePrice = Number(order.rentalPrice?.price ?? order.totalPrice);
    const promo = order.promocode;
    const { discount } = calculateDiscount(basePrice, promo);
    const deliveryFee = Number(order.deliveryFee || 0);
    const finalPaidAmount = Number(order.totalPrice) + deliveryFee;
    const now = new Date();
    const collateralTaken = collateralType !== COLLATERAL_TYPES.NONE;

    const updated = await tx.order.updateMany({
      where: {
        id: order.id,
        paymentReceived: false,
        status: { in: [...HANDOVER_ALLOWED_FROM] },
      },
      data: {
        status: "DELIVERED",
        paymentReceived: true,
        paymentMethod,
        paymentReceivedAt: now,
        finalPaidAmount,
        collateralType,
        collateralTaken,
        collateralReturned: false,
        deliveredByCourierId: Number(courierId),
        deliveryCompletedAt: now,
        consoleItemId: consoleItem.id,
        hdmiItemId: hdmi.id,
        powerItemId: power.id,
      },
    });
    if (updated.count !== 1) {
      throw new DeliveryHandoverError("ALREADY_DONE", "Buyurtma allaqachon topshirilgan");
    }

    // ACTIVE = faol ijara (talab: ACTIVE RENTAL)
    await tx.order.update({
      where: { id: order.id },
      data: { status: "ACTIVE" },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: "DELIVERED",
        actorType: "courier",
        actorId: Number(courierId),
        note: `Handover inventory+payment ${paymentMethod}/${collateralType}`,
      },
    });
    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: "ACTIVE",
        actorType: "courier",
        actorId: Number(courierId),
        note: "Rental ACTIVE",
      },
    });

    const roles = [
      { id: consoleItem.id, role: ITEM_TYPES.CONSOLE },
      ...joysticks.map((j) => ({ id: j.id, role: ITEM_TYPES.JOYSTICK })),
      { id: hdmi.id, role: ITEM_TYPES.HDMI },
      { id: power.id, role: ITEM_TYPES.POWER },
    ];
    for (const r of roles) {
      await tx.orderInventoryItem.create({
        data: { orderId: order.id, inventoryItemId: r.id, role: r.role },
      });
    }

    const unpaid = await tx.orderPayment.findFirst({
      where: { orderId: order.id, status: PaymentStatus.UNPAID },
      orderBy: { createdAt: "asc" },
    });
    if (unpaid) {
      await tx.orderPayment.update({
        where: { id: unpaid.id },
        data: {
          amount: finalPaidAmount,
          method: paymentMethod,
          status: PaymentStatus.PAID,
          paidAt: now,
          note: "Delivery handover",
        },
      });
    } else {
      await tx.orderPayment.create({
        data: {
          orderId: order.id,
          amount: finalPaidAmount,
          method: paymentMethod,
          status: PaymentStatus.PAID,
          paidAt: now,
          note: "Delivery handover",
        },
      });
    }

    return {
      orderId: order.id,
      basePrice,
      discount,
      deliveryFee,
      finalPaidAmount,
      collateralType,
      paymentMethod,
      deliveredAt: now,
      console: consoleItem,
      joysticks,
      hdmi,
      power,
      orderSnapshot: order,
    };
  });

  // PDF + photo + notifications (transaction tashqarida)
  let contract = null;
  try {
    const fullOrder = await orderRepository.findById(result.orderId);
    const pdf = await contractService.generateContractPdf(fullOrder, result);
    contract = await prisma.rentalContract.upsert({
      where: { orderId: result.orderId },
      create: {
        orderId: result.orderId,
        contractNumber: pdf.contractNumber,
        pdfPath: pdf.pdfPath,
        payload: pdf.payload,
      },
      update: {
        contractNumber: pdf.contractNumber,
        pdfPath: pdf.pdfPath,
        payload: pdf.payload,
      },
    });

    if (bot && photoFileId) {
      const orderPhotoService = require("./orderPhoto.service");
      await orderPhotoService.saveOrderPhoto(bot, {
        orderId: result.orderId,
        photoType: "HANDOVER",
        telegramFileId: photoFileId,
      });
    }

    if (bot && contract.pdfPath) {
      try {
        const admins = await getAdminRecipients();
        for (const admin of admins) {
          await bot.sendDocument(String(admin.telegramId), contract.pdfPath, {
            caption: `📄 Shartnoma ${contract.contractNumber} — buyurtma #${result.orderId}`,
          });
        }
        if (fullOrder.courier?.telegramId) {
          await bot.sendDocument(String(fullOrder.courier.telegramId), contract.pdfPath, {
            caption: `📄 Ijara shartnomasi ${contract.contractNumber}`,
          });
        }
      } catch (err) {
        logger.warn("Contract PDF send failed", { error: err.message });
      }
    }
  } catch (err) {
    logger.error("Contract/photo post-handover xatoligi", { error: err.message });
  }

  const fullOrder = await orderRepository.findById(result.orderId);
  await notifyHandoverComplete(fullOrder, result, contract);

  return fullOrder;
}

async function notifyHandoverComplete(order, meta, contract) {
  const consoleName =
    order.rentalPrice?.consoleCatalog?.displayName || order.consoleType;
  const durationHours = order.rentalPrice?.hours;
  const durationLabel =
    durationHours != null ? pricingService.formatDurationLabel(durationHours, "UZ") : "—";
  const courierName = order.courier?.fullName || "—";
  const user = order.user;
  const L = resolveLang(user?.language);
  const js = (meta.joysticks || []).map((j) => j.inventoryNumber).join(", ");

  const adminText =
    `━━━━━━━━━━━━━━\n` +
    `🎮 <b>PlayStation topshirildi — RENTAL ACTIVE</b>\n\n` +
    `📦 Buyurtma: #${order.id}\n` +
    (contract ? `📄 Shartnoma: ${contract.contractNumber}\n` : "") +
    `\n👤 Mijoz: ${user?.fullName || "—"}\n` +
    `📞 ${user?.phone || "—"}\n\n` +
    `🎮 Console: ${meta.console.inventoryNumber}\n` +
    `🔢 Serial: ${meta.console.serialNumber}\n` +
    `🕹 Joysticklar: ${js}\n` +
    `📺 HDMI: ${meta.hdmi.inventoryNumber}\n` +
    `🔌 Power: ${meta.power.inventoryNumber}\n\n` +
    `📅 Ijara: ${durationLabel}\n` +
    `💰 Asl: ${money(meta.basePrice)}\n` +
    `🎁 Promo: ${meta.discount > 0 ? money(meta.discount) : "—"}\n` +
    `💵 To'langan: ${money(meta.finalPaidAmount)}\n` +
    `💳 To'lov: ${labelHandoverPayment(meta.paymentMethod)}\n` +
    `🪪 Garov: ${labelCollateral(meta.collateralType)}\n` +
    `🚚 Kuryer: ${courierName}\n` +
    `🕒 ${formatDatetime(meta.deliveredAt)}\n` +
    `━━━━━━━━━━━━━━`;

  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_DELIVERED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: adminText,
      options: { parse_mode: "HTML" },
    });
  }

  const customerText = t("notify.handoverComplete", L, {
    console: `${consoleName} (${meta.console.inventoryNumber})`,
    start: formatDatetime(order.startDatetime),
    end: formatDatetime(order.endDatetime),
    paid: pricingService.formatMoney(meta.finalPaidAmount, "UZS", L),
    payment: t(`handover.payment.${meta.paymentMethod}`, L),
    collateral: t(`handover.collateral.${meta.collateralType}`, L),
  });

  await notify({
    orderId: order.id,
    type: "ORDER_DELIVERED",
    recipientType: "user",
    recipientTelegramId: user.telegramId.toString(),
    recipientId: order.userId,
    text: customerText,
    options: { parse_mode: "HTML" },
  });
}

/**
 * Qaytarib olish — faqat shu order inventari.
 */
async function completeReturn({
  orderId,
  courierId,
  collateralReturned,
  returnCondition,
  returnNote,
  photoFileId,
  bot,
}) {
  if (!Object.values(CONDITIONS).includes(returnCondition)) {
    throw new DeliveryHandoverError("CONDITION", "Qurilma holati noto'g'ri");
  }
  if (typeof collateralReturned !== "boolean") {
    throw new DeliveryHandoverError("COLLATERAL", "Garov qaytarilganligi majburiy");
  }
  if (!photoFileId) {
    throw new DeliveryHandoverError("PHOTO", "Qaytarish surati majburiy");
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: Number(orderId) },
      include: {
        user: true,
        courier: true,
        orderItems: { include: { inventoryItem: true } },
        consoleItem: true,
        hdmiItem: true,
        powerItem: true,
        rentalPrice: { include: { consoleCatalog: true } },
      },
    });
    if (!order) throw new DeliveryHandoverError("NOT_FOUND", "Buyurtma topilmadi");
    if (order.courierId !== Number(courierId)) {
      throw new DeliveryHandoverError("FORBIDDEN", "Bu buyurtma sizga tegishli emas");
    }
    if (!["DELIVERED", "ACTIVE", "RETURN_REQUESTED", "ARRIVED"].includes(order.status)) {
      throw new DeliveryHandoverError("INVALID_STATUS", `Qaytarib bo'lmaydi: ${order.status}`);
    }
    if (order.status === "COMPLETED" || order.status === "RETURNED") {
      throw new DeliveryHandoverError("ALREADY_DONE", "Allaqachon yakunlangan");
    }

    const itemIds = order.orderItems.map((l) => l.inventoryItemId);
    await inventoryItemService.releaseItems(tx, itemIds, {
      orderId: order.id,
      actorId: Number(courierId),
      condition: returnCondition,
    });

    const now = new Date();
    for (const link of order.orderItems) {
      await tx.orderInventoryItem.update({
        where: { id: link.id },
        data: {
          returnedAt: now,
          returnCondition,
          returnNote: returnNote || null,
        },
      });
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "COMPLETED",
        collateralReturned,
        returnCondition,
        returnNote: returnNote || null,
        returnedAt: now,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: "RETURNED",
        actorType: "courier",
        actorId: Number(courierId),
        note: "Inventory returned",
      },
    });
    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: "COMPLETED",
        actorType: "courier",
        actorId: Number(courierId),
        note: "Rental completed",
      },
    });

    return order;
  });

  if (bot && photoFileId) {
    try {
      const orderPhotoService = require("./orderPhoto.service");
      await orderPhotoService.saveOrderPhoto(bot, {
        orderId,
        photoType: "RETURN",
        telegramFileId: photoFileId,
      });
    } catch (err) {
      logger.warn("Return photo save failed", { error: err.message });
    }
  }

  const full = await orderRepository.findById(orderId);
  await notifyReturnComplete(full, {
    collateralReturned,
    returnCondition,
    returnNote,
  });

  return full;
}

async function notifyReturnComplete(order, meta) {
  const items = order.orderItems || [];
  const consoleItem = order.consoleItem || items.find((i) => i.role === "CONSOLE")?.inventoryItem;
  const js = items
    .filter((i) => i.role === "JOYSTICK")
    .map((i) => i.inventoryItem?.inventoryNumber)
    .filter(Boolean)
    .join(", ");
  const hdmi = order.hdmiItem?.inventoryNumber || "—";
  const power = order.powerItem?.inventoryNumber || "—";

  const adminText =
    `━━━━━━━━━━━━━━\n` +
    `↩️ <b>Ijara yakunlandi — COMPLETED</b>\n\n` +
    `📦 Buyurtma: #${order.id}\n` +
    `👤 Mijoz: ${order.user?.fullName || "—"}\n` +
    `🚚 Kuryer: ${order.courier?.fullName || "—"}\n\n` +
    `🎮 Console: ${consoleItem?.inventoryNumber || "—"}\n` +
    `🔢 Serial: ${consoleItem?.serialNumber || "—"}\n` +
    `🕹 Joysticklar: ${js || "—"}\n` +
    `📺 HDMI: ${hdmi}\n` +
    `🔌 Power: ${power}\n\n` +
    `🪪 Garov qaytarildi: ${meta.collateralReturned ? "Ha" : "Yo'q"}\n` +
    `🛠 Holat: ${labelCondition(meta.returnCondition)}\n` +
    (meta.returnNote ? `📝 Izoh: ${meta.returnNote}\n` : "") +
    `🕒 ${formatDatetime(new Date())}\n` +
    `━━━━━━━━━━━━━━`;

  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId: order.id,
      type: "ORDER_RETURNED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text: adminText,
      options: { parse_mode: "HTML" },
    });
  }

  if (order.user?.telegramId) {
    const L = resolveLang(order.user.language);
    await notify({
      orderId: order.id,
      type: "ORDER_RETURNED",
      recipientType: "user",
      recipientTelegramId: order.user.telegramId.toString(),
      recipientId: order.userId,
      text: t("notify.returned", L, {
        id: order.id,
        unit: consoleItem?.inventoryNumber || "—",
      }),
      options: { parse_mode: "HTML" },
    });
  }
}

async function notifyAdminStep(orderId, title, extraLines = []) {
  const order = await orderRepository.findById(orderId);
  if (!order) return;
  const text =
    `📌 <b>${title}</b>\n\n` +
    `📦 Buyurtma: #${orderId}\n` +
    `👤 Mijoz: ${order.user?.fullName || "—"}\n` +
    `🚚 Kuryer: ${order.courier?.fullName || "—"}\n` +
    (extraLines.length ? `\n${extraLines.join("\n")}` : "");

  const admins = await getAdminRecipients();
  for (const admin of admins) {
    await notify({
      orderId,
      type: "ORDER_ARRIVED",
      recipientType: "admin",
      recipientTelegramId: String(admin.telegramId),
      recipientId: admin.recipientId,
      text,
      options: { parse_mode: "HTML" },
    });
  }
}

module.exports = {
  completeHandover,
  completeReturn,
  notifyAdminStep,
  DeliveryHandoverError,
  HANDOVER_ALLOWED_FROM,
  COLLATERAL_TYPES,
  PAYMENT_METHODS_HANDOVER,
};
