-- CreateTable
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" SERIAL NOT NULL,
    "eventType" TEXT NOT NULL,
    "orderId" INTEGER,
    "courierId" INTEGER,
    "adminId" INTEGER,
    "customerId" INTEGER,
    "telegramMessageId" BIGINT,
    "photoMessageId" BIGINT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "error" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "audit_logs_eventType_createdAt_idx" ON "audit_logs"("eventType", "createdAt");
CREATE INDEX IF NOT EXISTS "audit_logs_orderId_idx" ON "audit_logs"("orderId");
CREATE INDEX IF NOT EXISTS "audit_logs_status_createdAt_idx" ON "audit_logs"("status", "createdAt");
