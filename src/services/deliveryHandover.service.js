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
const { escapeHtml } = require("../utils/telegramFormat");

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
  if (!hdmiItemId || !powerItemId) {
    throw new DeliveryHandoverError("INVENTORY", "HDMI va Power majburiy");
  }
  if (!photoFileId) {
    throw new DeliveryHandoverError("PHOTO", "Mijoz + shartnoma surati majburiy");
  }

  const allItemIds = [
    ...(consoleItemId ? [Number(consoleItemId)] : []),
    ...jsIds,
    Number(hdmiItemId),
    Number(powerItemId),
  ];
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
        inventoryUnit: true,
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
    if (!order.inventoryUnitId) {
      throw new DeliveryHandoverError(
        "NO_UNIT",
        "Buyurtmaga InventoryUnit biriktirilmagan. Admin qayta tasdiqlashi kerak."
      );
    }

    // Legacy optional CONSOLE InventoryItem — primary console is InventoryUnit
    let consoleItem = null;
    if (consoleItemId) {
      consoleItem = await tx.inventoryItem.findUnique({ where: { id: Number(consoleItemId) } });
      if (!consoleItem || consoleItem.itemType !== ITEM_TYPES.CONSOLE) {
        throw new DeliveryHandoverError("CONSOLE", "Konsol topilmadi");
      }
      if (consoleItem.consoleType !== order.consoleType) {
        throw new DeliveryHandoverError("CONSOLE_TYPE", "Konsol turi buyurtmaga mos emas");
      }
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
        consoleItemId: consoleItem?.id ?? null,
        hdmiItemId: hdmi.id,
        powerItemId: power.id,
      },
    });
    if (updated.count !== 1) {
      throw new DeliveryHandoverError("ALREADY_DONE", "Buyurtma allaqachon topshirilgan");
    }

    // ACTIVE = faol ijara (ACTIVE_RENTAL)
    const rentalReturnService = require("./rentalReturn.service");
    const { rentalStartAt, expectedReturnAt } = rentalReturnService.computeRentalWindow(
      order,
      now
    );

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "ACTIVE",
        rentalStartAt,
        expectedReturnAt,
        endDatetime: expectedReturnAt,
      },
    });

    // Device: RESERVED → RENTED (synced with ACTIVE)
    const deviceStatusService = require("./deviceStatus.service");
    await deviceStatusService.syncDeviceToOrderStatus(
      tx,
      { id: order.id, playstationId: order.playstationId, inventoryUnitId: order.inventoryUnitId },
      "ACTIVE",
      { actorType: "courier", actorId: courierId, reason: "HANDOVER_ACTIVE" }
    );

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
        note: `Rental ACTIVE until ${expectedReturnAt.toISOString()}`,
      },
    });

    await rentalReturnService.logRentalAudit({
      action: "DELIVERED_RENTAL_STARTED",
      orderId: order.id,
      inventoryUnitId: order.inventoryUnitId,
      actorType: "courier",
      actorId: courierId,
      extra: {
        rentalStartAt: rentalStartAt.toISOString(),
        expectedReturnAt: expectedReturnAt.toISOString(),
      },
    });

    const roles = [
      ...(consoleItem ? [{ id: consoleItem.id, role: ITEM_TYPES.CONSOLE }] : []),
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

    // Persist wizard completion inside same transaction
    const deliverySessionService = require("./deliverySession.service");
    await deliverySessionService.markCompleted(order.id, tx);

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
      inventoryUnitId: order.inventoryUnitId,
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
    (contract ? `📄 Shartnoma: ${escapeHtml(contract.contractNumber)}\n` : "") +
    `\n👤 Mijoz: ${escapeHtml(user?.fullName || "—")}\n` +
    `📞 ${escapeHtml(user?.phone || "—")}\n\n` +
    `🎮 Console: ${escapeHtml(meta.console.inventoryNumber)}\n` +
    `🔢 Serial: ${escapeHtml(meta.console.serialNumber)}\n` +
    `🕹 Joysticklar: ${escapeHtml(js)}\n` +
    `📺 HDMI: ${escapeHtml(meta.hdmi.inventoryNumber)}\n` +
    `🔌 Power: ${escapeHtml(meta.power.inventoryNumber)}\n\n` +
    `📅 Ijara: ${escapeHtml(durationLabel)}\n` +
    `💰 Asl: ${escapeHtml(money(meta.basePrice))}\n` +
    `🎁 Promo: ${meta.discount > 0 ? escapeHtml(money(meta.discount)) : "—"}\n` +
    `💵 To'langan: ${escapeHtml(money(meta.finalPaidAmount))}\n` +
    `💳 To'lov: ${escapeHtml(labelHandoverPayment(meta.paymentMethod))}\n` +
    `🪪 Garov: ${escapeHtml(labelCollateral(meta.collateralType))}\n` +
    `🚚 Kuryer: ${escapeHtml(courierName)}\n` +
    `🕒 ${escapeHtml(formatDatetime(meta.deliveredAt))}\n` +
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
    console: escapeHtml(`${consoleName} (${meta.console.inventoryNumber})`),
    start: escapeHtml(formatDatetime(order.startDatetime)),
    end: escapeHtml(formatDatetime(order.endDatetime)),
    paid: escapeHtml(pricingService.formatMoney(meta.finalPaidAmount, "UZS", L)),
    payment: escapeHtml(t(`handover.payment.${meta.paymentMethod}`, L)),
    collateral: escapeHtml(t(`handover.collateral.${meta.collateralType}`, L)),
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
 * Courier pickup after RETURN_REQUESTED / RETURN_ASSIGNED.
 * Order → PICKED_UP; InventoryUnit stays RENTED until admin inspection.
 * Does NOT complete the order.
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

  const rentalReturnService = require("./rentalReturn.service");
  const { OrderStatus } = require("../constants/orderStatus");

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
    if (order.status === "COMPLETED" || order.status === "PICKED_UP") {
      throw new DeliveryHandoverError("ALREADY_DONE", "Allaqachon olib ketilgan / yakunlangan");
    }

    try {
      rentalReturnService.assertPickupAllowed(order, courierId);
    } catch (err) {
      if (err.code === "RENTAL_NOT_ENDED" || err.message?.includes("tugamagan")) {
        throw new DeliveryHandoverError("RENTAL_NOT_ENDED", "Ijara muddati hali tugamagan.");
      }
      throw new DeliveryHandoverError(err.code || "INVALID_STATUS", err.message);
    }

    // Kit items returned with console — release item locks; console asset stays RENTED
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
        status: OrderStatus.PICKED_UP,
        collateralReturned,
        returnCondition,
        returnNote: returnNote || null,
        pickedUpAt: now,
        returnedAt: now,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        orderId: order.id,
        status: OrderStatus.PICKED_UP,
        actorType: "courier",
        actorId: Number(courierId),
        note: "Courier picked up — awaiting admin inspection",
      },
    });

    // InventoryUnit MUST stay RENTED (admin inspection next)
    return order;
  });

  await rentalReturnService.logRentalAudit({
    action: "COURIER_PICKED_UP",
    orderId: result.id,
    inventoryUnitId: result.inventoryUnitId,
    actorType: "courier",
    actorId: courierId,
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

  try {
    const { getAdminRecipients } = require("../utils/adminRecipients");
    const admins = await getAdminRecipients();
    for (const a of admins) {
      await notify({
        orderId: result.id,
        type: "ORDER_RETURNED",
        recipientType: "admin",
        recipientId: a.telegramId,
        message:
          `📦 Kuryer olib keldi #${result.id}\n` +
          `Status: PICKED_UP\n` +
          `Admin tekshiruvi kutilmoqda (AVAILABLE / MAINTENANCE).`,
      });
    }
  } catch (err) {
    logger.warn("Pickup admin notify failed", { error: err.message });
  }

  return prisma.order.findUnique({
    where: { id: Number(orderId) },
    include: {
      user: true,
      courier: true,
      rentalPrice: { include: { consoleCatalog: true } },
      inventoryUnit: true,
    },
  });
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
    `👤 Mijoz: ${escapeHtml(order.user?.fullName || "—")}\n` +
    `🚚 Kuryer: ${escapeHtml(order.courier?.fullName || "—")}\n\n` +
    `🎮 Console: ${escapeHtml(consoleItem?.inventoryNumber || "—")}\n` +
    `🔢 Serial: ${escapeHtml(consoleItem?.serialNumber || "—")}\n` +
    `🕹 Joysticklar: ${escapeHtml(js || "—")}\n` +
    `📺 HDMI: ${escapeHtml(hdmi)}\n` +
    `🔌 Power: ${escapeHtml(power)}\n\n` +
    `🪪 Garov qaytarildi: ${meta.collateralReturned ? "Ha" : "Yo'q"}\n` +
    `🛠 Holat: ${escapeHtml(labelCondition(meta.returnCondition))}\n` +
    (meta.returnNote ? `📝 Izoh: ${escapeHtml(meta.returnNote)}\n` : "") +
    `🕒 ${escapeHtml(formatDatetime(new Date()))}\n` +
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
        unit: escapeHtml(consoleItem?.inventoryNumber || "—"),
      }),
      options: { parse_mode: "HTML" },
    });
  }
}

async function notifyAdminStep(orderId, title, extraLines = []) {
  const order = await orderRepository.findById(orderId);
  if (!order) return;
  const text =
    `📌 <b>${escapeHtml(title)}</b>\n\n` +
    `📦 Buyurtma: #${orderId}\n` +
    `👤 Mijoz: ${escapeHtml(order.user?.fullName || "—")}\n` +
    `🚚 Kuryer: ${escapeHtml(order.courier?.fullName || "—")}\n` +
    (extraLines.length ? `\n${extraLines.map((l) => escapeHtml(l)).join("\n")}` : "");

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
