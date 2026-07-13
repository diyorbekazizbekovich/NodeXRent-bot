const sessionStore = require("../sessionStore");
const userService = require("../../services/user.service");
const orderLocationService = require("../../services/orderLocation.service");
const { OrderLocationError } = require("../../errors/orderLocation.errors");
const { GeoFenceError } = require("../../errors/geoFence.errors");
const geoFenceService = require("../../services/geoFence.service");
const userKeyboards = require("../keyboards/user.keyboards");
const logger = require("../../utils/logger");
const { t, resolveLang } = require("../../i18n");
const { label } = require("../../constants/orderStatus");

const STEPS = {
  UPDATE_LOCATION: "order:update_location",
  CHANGE_ADDRESS: "user:change_address",
};

function extractLocation(msg) {
  const loc = msg.location || msg.edited_message?.location;
  if (!loc) return null;
  const latitude = Number(loc.latitude);
  const longitude = Number(loc.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, livePeriod: loc.live_period || null };
}

async function promptUpdateForOrder(bot, chatId, order, lang) {
  const L = resolveLang(lang);
  sessionStore.setStep(chatId, STEPS.UPDATE_LOCATION);
  sessionStore.updateData(chatId, { _locOrderId: order.id });
  await bot.sendMessage(
    chatId,
    t("locationUpdate.prompt", L, { id: order.id }),
    userKeyboards.locationRequestKeyboard(L)
  );
}

async function promptChangeAddress(bot, chatId, user) {
  const L = resolveLang(user?.language);
  const updatable = user ? await orderLocationService.listUpdatableOrders(user.id) : [];

  sessionStore.setStep(chatId, STEPS.CHANGE_ADDRESS);
  sessionStore.updateData(chatId, { _locOrderId: null });

  if (updatable.length === 1) {
    sessionStore.updateData(chatId, { _locOrderId: updatable[0].id });
    await bot.sendMessage(
      chatId,
      t("locationUpdate.prompt", L, { id: updatable[0].id }),
      userKeyboards.locationRequestKeyboard(L)
    );
    return;
  }

  if (updatable.length > 1) {
    await bot.sendMessage(
      chatId,
      t("locationUpdate.pickOrder", L),
      userKeyboards.locationUpdatePickKeyboard(updatable, L)
    );
    return;
  }

  await bot.sendMessage(
    chatId,
    `${t("locationUpdate.noneOpen", L)}\n\n${t("changeAddress.prompt", L)}`,
    userKeyboards.locationRequestKeyboard(L)
  );
}

function formatLocationError(err, L) {
  if (err instanceof GeoFenceError || err?.code === "OUTSIDE_SERVICE_AREA") {
    return t("geoFence.outsideServiceArea", L);
  }
  if (err instanceof OrderLocationError) {
    if (err.code === "RATE_LIMITED") {
      return t("locationUpdate.rateLimited", L, { sec: err.retryAfterSec || 30 });
    }
    if (err.code === "OUTSIDE_SERVICE_AREA" || err.messageKey === "geoFence.outsideServiceArea") {
      return t("geoFence.outsideServiceArea", L);
    }
    if (err.messageKey) return t(err.messageKey, L);
    return err.message;
  }
  if (err?.messageKey === "geoFence.outsideServiceArea" || err?.messageKey === "geoFence.coordsRequired") {
    return t(err.messageKey, L);
  }
  return err.message || t("errors.generic", L);
}

/**
 * Handles static + live location for delivery updates / profile.
 * @returns {Promise<boolean>} true if handled
 */
async function handleCustomerLocation(bot, msg) {
  const loc = extractLocation(msg);
  if (!loc) return false;

  const chatId = msg.chat.id;
  const telegramId = msg.from.id;
  const session = sessionStore.getSession(chatId);
  const user = await userService.getUserByTelegramId(telegramId);
  const L = resolveLang(user?.language);

  if (!user) {
    await bot.sendMessage(chatId, t("welcome.userNotFound", L));
    return true;
  }

  // Geofence first — do not save / continue order outside Tashkent
  if (!geoFenceService.canDeliverTo(loc.latitude, loc.longitude)) {
    logger.info("Customer location outside service area", {
      context: "LocationHandler",
      telegramId,
      latitude: loc.latitude,
      longitude: loc.longitude,
    });
    await bot.sendMessage(
      chatId,
      t("geoFence.outsideServiceArea", L),
      userKeyboards.locationRequestKeyboard(L)
    );
    return true;
  }

  const address = `Lokatsiya: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`;
  const targetOrderId =
    session.step === STEPS.UPDATE_LOCATION || session.step === STEPS.CHANGE_ADDRESS
      ? Number(session.data?._locOrderId) || null
      : null;

  try {
    if (targetOrderId) {
      const result = await orderLocationService.updateDeliveryLocation({
        orderId: targetOrderId,
        userId: user.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address,
      });
      sessionStore.clearSession(chatId);
      const key = result.order.courierId ? "locationUpdate.saved" : "locationUpdate.savedNoCourier";
      await bot.sendMessage(chatId, t(key, L, { id: result.order.id }), userKeyboards.mainMenuKeyboard(L));
      return true;
    }

    const updatable = await orderLocationService.listUpdatableOrders(user.id);
    if (updatable.length > 0) {
      const result = await orderLocationService.updateDeliveryLocation({
        orderId: updatable[0].id,
        userId: user.id,
        latitude: loc.latitude,
        longitude: loc.longitude,
        address,
      });
      if (session.step === STEPS.CHANGE_ADDRESS || session.step === STEPS.UPDATE_LOCATION) {
        sessionStore.clearSession(chatId);
      }
      const key = result.order.courierId ? "locationUpdate.saved" : "locationUpdate.savedNoCourier";
      await bot.sendMessage(chatId, t(key, L, { id: result.order.id }), userKeyboards.mainMenuKeyboard(L));
      return true;
    }

    await userService.updateLocation(telegramId, {
      latitude: loc.latitude,
      longitude: loc.longitude,
      address,
    });
    if (session.step === STEPS.CHANGE_ADDRESS) sessionStore.clearSession(chatId);
    await bot.sendMessage(chatId, t("welcome.locationSaved", L), userKeyboards.mainMenuKeyboard(L));
    return true;
  } catch (err) {
    logger.warn("Customer location handling failed", {
      context: "LocationHandler",
      error: err.message,
      code: err.code,
      telegramId,
    });
    const text =
      err instanceof GeoFenceError || err?.messageKey?.startsWith("geoFence.")
        ? t(err.messageKey || "geoFence.outsideServiceArea", L)
        : t("locationUpdate.fail", L, { error: formatLocationError(err, L) });
    await bot.sendMessage(chatId, text, userKeyboards.locationRequestKeyboard(L));
    return true;
  }
}

module.exports = {
  STEPS,
  extractLocation,
  promptUpdateForOrder,
  promptChangeAddress,
  handleCustomerLocation,
  formatLocationError,
  label,
};
