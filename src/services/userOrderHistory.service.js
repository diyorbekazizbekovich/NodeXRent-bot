const pricingService = require("./pricing.service");
const { formatDatetime } = require("../utils/dateHelper");
const { calculateDiscount } = require("./promo.service");
const { t, resolveLang } = require("../i18n");

function userStatusLabel(order, lang) {
  const L = resolveLang(lang);
  const hasApprovedExt =
    Array.isArray(order.extensions) && order.extensions.some((e) => e.status === "APPROVED");
  if (hasApprovedExt && ["ARRIVED", "DELIVERED", "ACTIVE", "RETURN_REQUESTED"].includes(order.status)) {
    return t("status.EXTENDED", L);
  }
  return t(`status.${order.status}`, L) || order.status;
}

function remainingOrAgo(order, lang, now = new Date()) {
  const L = resolveLang(lang);
  const end = new Date(order.endDatetime);
  if (["ARRIVED", "DELIVERED", "ACTIVE", "RETURN_REQUESTED"].includes(order.status)) {
    const ms = end.getTime() - now.getTime();
    if (ms <= 0) return t("myOrders.remainingExpired", L);
    const hours = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    if (hours >= 24) {
      const days = Math.floor(hours / 24);
      const remH = hours % 24;
      return t("myOrders.remaining", L, {
        time: t("time.dayHour", L, { days, hours: remH }),
      });
    }
    return t("myOrders.remaining", L, {
      time: t("time.hourMin", L, { hours, mins }),
    });
  }

  if (["RETURNED", "COMPLETED", "EXPIRED"].includes(order.status)) {
    const ms = now.getTime() - end.getTime();
    if (ms < 0) return null;
    const days = Math.max(0, Math.floor(ms / 86400000));
    if (days === 0) return t("myOrders.endedToday", L);
    return t("myOrders.endedDays", L, { n: days });
  }
  return null;
}

function formatUserOrderCard(order, lang) {
  const L = resolveLang(lang);
  const rental = order.rentalPrice;
  const hours = rental?.hours ?? null;
  const basePrice = rental ? Number(rental.price) : Number(order.totalPrice);
  const deliveryFee = Number(order.deliveryFee || 0);
  const promo = order.promocode;
  let discount = 0;
  if (promo) {
    discount = calculateDiscount(basePrice, promo).discount;
  }
  const finalPaid = Number(order.totalPrice) + deliveryFee;
  const extensions = order.extensions || [];
  const approvedExt = extensions.filter((e) => e.status === "APPROVED");

  const lines = [
    t("myOrders.title", L, { id: order.id }),
    t("myOrders.console", L, { type: order.consoleType }),
    t("myOrders.status", L, { status: userStatusLabel(order, L) }),
    t("myOrders.created", L, { datetime: formatDatetime(order.createdAt) }),
  ];

  if (order.deliveryCompletedAt || ["DELIVERED", "ACTIVE"].includes(order.status) || order.deliveryStartedAt) {
    lines.push(
      t("myOrders.delivered", L, {
        datetime: order.deliveryCompletedAt
          ? formatDatetime(order.deliveryCompletedAt)
          : order.deliveryStartedAt
            ? formatDatetime(order.deliveryStartedAt)
            : "—",
      })
    );
  }

  if (order.status === "RETURNED" || order.status === "COMPLETED") {
    const returnedAt =
      order.statusLogs?.slice().reverse().find((l) => l.status === "RETURNED" || l.status === "COMPLETED")
        ?.changedAt || null;
    lines.push(t("myOrders.returned", L, { datetime: returnedAt ? formatDatetime(returnedAt) : "—" }));
  }

  lines.push(
    t("myOrders.duration", L, {
      duration: hours != null ? pricingService.formatDurationLabel(hours, L) : "—",
    })
  );
  if (approvedExt.length) {
    const extraH = approvedExt.reduce((s, e) => s + e.extraHours, 0);
    lines.push(
      t("myOrders.extension", L, {
        duration: pricingService.formatDurationLabel(extraH, L),
      })
    );
  }

  lines.push(t("myOrders.start", L, { datetime: formatDatetime(order.startDatetime) }));
  lines.push(t("myOrders.end", L, { datetime: formatDatetime(order.endDatetime) }));

  const rem = remainingOrAgo(order, L);
  if (rem) lines.push(rem);

  lines.push(t("myOrders.basePrice", L, { price: pricingService.formatMoney(basePrice, "UZS", L) }));
  if (promo && discount > 0) {
    const promoLabel =
      promo.discountType === "FIXED"
        ? `${Number(promo.discountAmount).toLocaleString()}${t("currency.uzs", L)}`
        : `-${promo.discountPercent}%`;
    lines.push(
      t("myOrders.promo", L, {
        code: promo.code,
        label: promoLabel,
        discount: pricingService.formatMoney(discount, "UZS", L),
      })
    );
  }
  if (deliveryFee > 0) {
    lines.push(t("myOrders.delivery", L, { price: pricingService.formatMoney(deliveryFee, "UZS", L) }));
  }
  lines.push(t("myOrders.total", L, { price: pricingService.formatMoney(finalPaid, "UZS", L) }));
  lines.push(t("myOrders.address", L, { address: order.address || "—" }));

  if (order.courier) {
    lines.push(
      t("myOrders.courier", L, {
        name:
          (order.courier.fullName || "—") + (order.courier.phone ? ` | ${order.courier.phone}` : ""),
      })
    );
  }

  return lines.join("\n");
}

function formatUserOrdersList(orders, lang) {
  const L = resolveLang(lang);
  if (!orders.length) return t("myOrders.empty", L);
  return orders.map((o) => formatUserOrderCard(o, L)).join("\n\n──────────────\n\n");
}

module.exports = {
  userStatusLabel,
  remainingOrAgo,
  formatUserOrderCard,
  formatUserOrdersList,
};
