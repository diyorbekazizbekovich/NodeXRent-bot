const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");
const prisma = require("../config/prisma");
const env = require("../config/env");
const logger = require("../utils/logger");

const PHOTOS_DIR = path.join(process.cwd(), "uploads", "photos");
const RETURNS_DIR = path.join(process.cwd(), "uploads", "returns");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const file = fs.createWriteStream(destPath);
    mod
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlink(destPath, () => {});
          return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlink(destPath, () => {});
          return reject(new Error(`Download failed: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on("finish", () => file.close(() => resolve(destPath)));
      })
      .on("error", (err) => {
        file.close();
        fs.unlink(destPath, () => {});
        reject(err);
      });
  });
}

/**
 * Telegram file_id dan rasmni yuklab saqlaydi.
 */
async function saveOrderPhoto(bot, { orderId, photoType, telegramFileId }) {
  ensureDir(photoType === "RETURN" ? RETURNS_DIR : PHOTOS_DIR);
  const dir = photoType === "RETURN" ? RETURNS_DIR : PHOTOS_DIR;
  const filePath = path.join(dir, `order-${orderId}-${photoType}-${Date.now()}.jpg`);

  try {
    const fileLink = await bot.getFileLink(telegramFileId);
    await downloadFile(fileLink, filePath);
  } catch (err) {
    logger.warn("Photo download failed, storing file_id only", { error: err.message });
  }

  const existing = await prisma.orderPhoto.findFirst({
    where: { orderId: Number(orderId), photoType },
  });
  if (existing) {
    return prisma.orderPhoto.update({
      where: { id: existing.id },
      data: {
        telegramFileId,
        filePath: fs.existsSync(filePath) ? filePath : existing.filePath,
      },
    });
  }

  return prisma.orderPhoto.create({
    data: {
      orderId: Number(orderId),
      photoType,
      telegramFileId,
      filePath: fs.existsSync(filePath) ? filePath : null,
    },
  });
}

function extractLargestPhotoFileId(msg) {
  if (!msg.photo || !msg.photo.length) return null;
  return msg.photo[msg.photo.length - 1].file_id;
}

module.exports = {
  saveOrderPhoto,
  extractLargestPhotoFileId,
  PHOTOS_DIR,
  RETURNS_DIR,
};
