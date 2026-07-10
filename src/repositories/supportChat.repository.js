const prisma = require("../config/prisma");

async function findThreadByUserId(userId) {
  return prisma.supportThread.findUnique({
    where: { userId },
    include: { user: true },
  });
}

async function findThreadById(threadId) {
  return prisma.supportThread.findUnique({
    where: { id: threadId },
    include: { user: true },
  });
}

async function getOrCreateThread(userId) {
  return prisma.supportThread.upsert({
    where: { userId },
    update: { status: "OPEN" },
    create: { userId, status: "OPEN" },
    include: { user: true },
  });
}

async function createMessage(data) {
  return prisma.$transaction(async (tx) => {
    const message = await tx.supportMessage.create({
      data: {
        threadId: data.threadId,
        senderType: data.senderType,
        senderUserId: data.senderUserId ?? null,
        senderAdminId: data.senderAdminId ?? null,
        messageType: data.messageType,
        text: data.text ?? null,
        caption: data.caption ?? null,
        fileId: data.fileId ?? null,
        payload: data.payload ?? undefined,
        telegramMessageId: data.telegramMessageId ?? null,
      },
    });
    await tx.supportThread.update({
      where: { id: data.threadId },
      data: { lastMessageAt: new Date(), status: "OPEN" },
    });
    return message;
  });
}

async function listMessages(threadId, { take = 30, skip = 0 } = {}) {
  return prisma.supportMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take,
    skip,
    include: {
      senderAdmin: { select: { id: true, fullName: true, telegramId: true } },
    },
  });
}

module.exports = {
  findThreadByUserId,
  findThreadById,
  getOrCreateThread,
  createMessage,
  listMessages,
};
