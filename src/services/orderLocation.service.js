const prisma = require("../config/prisma");
const logger = require("../utils/logger");
const env = require("../config/env");
const { LOCATION_UPDATABLE_STATUSES } = require("../constants/orderStatus");
const { OrderLocationError } = require("../errors/orderLocation.errors");
const orderLocationRepo = require("../repositories/orderLocation.repository");
const userService = require("./user.service");
const orderNotificationService = require("./orderNotification.service");

const COOLDOWN_MS = Number(env.LOCATION_UPDATE_COOLDOWN_MS) || 30_000;

function isFiniteCoord(n) {
  return typeof n === "number" && Number.isFinite(n);
}

function validateCoordinates(latitude, longitude, { required = true } = {}) {
  if (latitude == null && longitude == null && !required) return;
  if (!isFiniteCoord(latitude) || !isFiniteCoord(longitude)) {
    throw new OrderLocationError("INVALID_LOCATION", "Noto'g'ri lokatsiya", {
      messageKey: "locationUpdate.invalid",
    });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new OrderLocationError("INVALID_LOCATION", "Lokatsiya chegaradan tashqari", {
      messageKey: "locationUpdate.invalid",
    });
  }
}

function assertCanUpdate(order, userId) {
  if (!order) {
    throw new OrderLocationError("NOT_FOUND", "Buyurtma topilmadi", {
      messageKey: "locationUpdate.notFound",
    });
  }
  if (order.userId !== userId) {
    throw new OrderLocationError("FORBIDDEN", "Bu buyurtma sizniki emas", {
      messageKey: "locationUpdate.forbidden",
    });
  }
  if (order.paymentReceived || !LOCATION_UPDATABLE_STATUSES.includes(order.status)) {
    throw new OrderLocationError(
      "STATUS_LOCKED",
      "Yetkazib berilgandan keyin manzilni o'zgartirib bo'lmaydi",
      { messageKey: "locationUpdate.locked" }
    );
  }
}

function buildAddress(latitude, longitude, address) {
  if (address && String(address).trim()) return String(address).trim();
  return `Lokatsiya: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;
}

function coordsUnchanged(order, latitude, longitude) {
  if (order.latitude == null || order.longitude == null) return false;
  const eps = 1e-6;
  return (
    Math.abs(Number(order.latitude) - Number(latitude)) < eps &&
    Math.abs(Number(order.longitude) - Number(longitude)) < eps
  );
}

/**
 * Mijozning yetkazib berishdan oldingi buyurtmalari.
 */
async function listUpdatableOrders(userId) {
  return orderLocationRepo.findUpdatableByUser(userId);
}

/**
 * Yetkazib berish lokatsiyasini yangilaydi (transaction + history + notify).
 *
 * @param {{
 *   orderId: number,
 *   userId: number,
 *   latitude: number,
 *   longitude: number,
 *   address?: string|null,
 *   syncUserProfile?: boolean,
 * }} params
 */
async function updateDeliveryLocation({
  orderId,
  userId,
  latitude = null,
  longitude = null,
  address = null,
  syncUserProfile = true,
}) {
  const hasCoords = isFiniteCoord(latitude) && isFiniteCoord(longitude);
  if (hasCoords) {
    validateCoordinates(latitude, longitude);
  } else if (!address || !String(address).trim()) {
    throw new OrderLocationError("INVALID_LOCATION", "Noto'g'ri lokatsiya", {
      messageKey: "locationUpdate.invalid",
    });
  }

  const result = await prisma.$transaction(async (tx) => {
    const order = await orderLocationRepo.findOrderForUpdate(orderId, tx);
    assertCanUpdate(order, userId);

    const nextLat = hasCoords ? latitude : order.latitude;
    const nextLon = hasCoords ? longitude : order.longitude;
    if (nextLat == null || nextLon == null) {
      throw new OrderLocationError("INVALID_LOCATION", "Avval lokatsiya yuboring", {
        messageKey: "locationUpdate.invalid",
      });
    }

    const newAddress = buildAddress(nextLat, nextLon, address || order.address);

    if (
      hasCoords &&
      coordsUnchanged(order, nextLat, nextLon) &&
      String(order.address || "") === String(newAddress)
    ) {
      return { order, unchanged: true, history: null };
    }
    if (!hasCoords && String(order.address || "") === String(newAddress)) {
      return { order, unchanged: true, history: null };
    }

    const latest = await orderLocationRepo.findLatestHistory(orderId, tx);
    if (latest) {
      const elapsed = Date.now() - new Date(latest.createdAt).getTime();
      if (elapsed < COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
        throw new OrderLocationError(
          "RATE_LIMITED",
          `Juda tez-tez yangilanmoqda. ${retryAfterSec}s kuting.`,
          { messageKey: "locationUpdate.rateLimited", retryAfterSec }
        );
      }
    }

    const history = await orderLocationRepo.createHistory(
      {
        orderId: order.id,
        userId,
        previousLatitude: order.latitude,
        previousLongitude: order.longitude,
        previousAddress: order.address,
        newLatitude: nextLat,
        newLongitude: nextLon,
        newAddress,
      },
      tx
    );

    const updated = await orderLocationRepo.updateOrderLocation(
      order.id,
      { address: newAddress, latitude: nextLat, longitude: nextLon },
      tx
    );

    return { order: updated, unchanged: false, history };
  });

  if (result.unchanged) {
    logger.info("Delivery location unchanged (same coords)", {
      context: "OrderLocation",
      orderId,
      userId,
    });
    return result;
  }

  if (syncUserProfile) {
    try {
      const telegramId = result.order.user?.telegramId;
      if (telegramId != null) {
        await userService.updateLocation(telegramId, {
          latitude: result.order.latitude,
          longitude: result.order.longitude,
          address: result.order.address,
        });
      }
    } catch (err) {
      logger.warn("User profile location sync failed (order already updated)", {
        context: "OrderLocation",
        orderId,
        error: err.message,
      });
    }
  }

  // Notifications outside transaction — Telegram failures must not roll back DB
  try {
    await orderNotificationService.notifyLocationUpdated(result.order, {
      previous: {
        latitude: result.history.previousLatitude,
        longitude: result.history.previousLongitude,
        address: result.history.previousAddress,
      },
    });
  } catch (err) {
    logger.error("Location update notifications failed", {
      context: "OrderLocation",
      orderId,
      error: err.message,
      stack: err.stack,
    });
  }

  logger.info("Delivery location updated", {
    context: "OrderLocation",
    orderId,
    userId,
    latitude: result.order.latitude,
    longitude: result.order.longitude,
    courierId: result.order.courierId || null,
  });

  return result;
}

/**
 * Lokatsiya kelganda: bitta ochiq buyurtma bo'lsa yangilaydi;
 * bir nechta bo'lsa eng yangisini yangilaydi (picker alohida UI orqali).
 */
async function updateLatestUpdatableOrder(userId, { latitude, longitude, address }) {
  const orders = await listUpdatableOrders(userId);
  if (!orders.length) return null;
  return updateDeliveryLocation({
    orderId: orders[0].id,
    userId,
    latitude,
    longitude,
    address,
  });
}

module.exports = {
  listUpdatableOrders,
  updateDeliveryLocation,
  updateLatestUpdatableOrder,
  LOCATION_UPDATABLE_STATUSES,
  COOLDOWN_MS,
};
