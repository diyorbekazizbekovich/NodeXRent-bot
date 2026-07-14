-- CreateEnum
CREATE TYPE "ConsoleType" AS ENUM ('PS3', 'PS4', 'PS5');

-- CreateEnum
CREATE TYPE "PlaystationStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE', 'MISSING_PARTS', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "InventoryItemType" AS ENUM ('CONSOLE', 'JOYSTICK', 'HDMI', 'POWER');

-- CreateEnum
CREATE TYPE "InventoryItemStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'RENTED', 'MAINTENANCE');

-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('IDEAL', 'GOOD', 'MINOR_ISSUE', 'SERIOUS_ISSUE');

-- CreateEnum
CREATE TYPE "OrderPhotoType" AS ENUM ('HANDOVER', 'RETURN');

-- CreateEnum
CREATE TYPE "CustomerRating" AS ENUM ('TRUSTED', 'NORMAL', 'RISKY');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENT', 'FIXED', 'LOYALTY');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CLICK', 'CARD');

-- CreateEnum
CREATE TYPE "CollateralType" AS ENUM ('ID_CARD', 'PASSPORT', 'NONE');

-- CreateEnum
CREATE TYPE "ExtensionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'ADMIN_CONFIRMED', 'COURIER_ASSIGNED', 'ACCEPTED', 'REJECTED', 'ON_THE_WAY', 'ARRIVED', 'DELIVERED', 'ACTIVE', 'RETURN_REQUESTED', 'RETURNED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PARTIAL', 'PAID', 'PENDING', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ORDER_CREATED', 'ORDER_ACCEPTED', 'ORDER_REJECTED', 'COURIER_ON_WAY', 'ORDER_DELIVERED', 'RETURN_REMINDER', 'ORDER_RETURNED', 'ORDER_COMPLETED', 'ORDER_CANCELLED', 'COURIER_ASSIGNED', 'ORDER_ARRIVED', 'ADMIN_ORDER_ASSIGNED', 'LOCATION_UPDATED', 'PROMO', 'ADVERTISEMENT', 'ORDER_CONFIRM_READY', 'ORDER_PRIORITY_REMINDER', 'ORDER_START_REMINDER');

-- CreateEnum
CREATE TYPE "SupportSenderType" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "SupportThreadStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "defaultAddress" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "language" TEXT,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "lastActivityAt" TIMESTAMP(3),
    "customerRating" "CustomerRating" NOT NULL DEFAULT 'NORMAL',
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "couriers" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "username" TEXT,
    "fullName" TEXT,
    "phone" TEXT,
    "region" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "couriers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playstations" (
    "id" SERIAL NOT NULL,
    "courierId" INTEGER NOT NULL,
    "type" "ConsoleType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "status" "PlaystationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "accessories" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playstations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" SERIAL NOT NULL,
    "unitCode" TEXT NOT NULL,
    "consoleType" "ConsoleType" NOT NULL,
    "status" "PlaystationStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchasedAt" TIMESTAMP(3),
    "purchasePrice" DECIMAL(10,2),
    "lastServiceAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_unit_history" (
    "id" SERIAL NOT NULL,
    "inventoryUnitId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "PlaystationStatus",
    "toStatus" "PlaystationStatus",
    "orderId" INTEGER,
    "note" TEXT,
    "actorType" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_unit_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_zones" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "fee" DECIMAL(10,2) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "delivery_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "admin_audit_logs" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER,
    "adminTelegramId" BIGINT,
    "module" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "beforeData" JSONB,
    "afterData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "database_backups" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileSize" BIGINT,
    "createdByAdminId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "database_backups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_extensions" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "extraHours" INTEGER NOT NULL,
    "extraPrice" DECIMAL(10,2) NOT NULL,
    "status" "ExtensionStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByAdminId" INTEGER,
    "previousEnd" TIMESTAMP(3) NOT NULL,
    "newEnd" TIMESTAMP(3),

    CONSTRAINT "rental_extensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "console_catalog" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "console_catalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_prices" (
    "id" SERIAL NOT NULL,
    "consoleCatalogId" INTEGER NOT NULL,
    "hours" INTEGER NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'UZS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rental_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promocodes" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "discountType" "DiscountType" NOT NULL DEFAULT 'PERCENT',
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(10,2),
    "loyaltyMinOrders" INTEGER,
    "description" TEXT,
    "usageLimit" INTEGER NOT NULL,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "minOrderAmount" DECIMAL(10,2),
    "maxDiscountAmount" DECIMAL(10,2),
    "perUserLimit" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "promocodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "courierId" INTEGER,
    "playstationId" INTEGER,
    "rentalPriceId" INTEGER NOT NULL,
    "promocodeId" INTEGER,
    "consoleType" "ConsoleType" NOT NULL,
    "address" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "startDatetime" TIMESTAMP(3) NOT NULL,
    "endDatetime" TIMESTAMP(3) NOT NULL,
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "depositAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "inventoryUnitId" INTEGER,
    "acceptedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "deliveryStartedAt" TIMESTAMP(3),
    "deliveryCompletedAt" TIMESTAMP(3),
    "assignedByAdmin" BOOLEAN NOT NULL DEFAULT false,
    "confirmedAt" TIMESTAMP(3),
    "isHighPriority" BOOLEAN NOT NULL DEFAULT false,
    "deliveryZoneCode" TEXT,
    "paymentReceived" BOOLEAN NOT NULL DEFAULT false,
    "paymentMethod" "PaymentMethod",
    "paymentReceivedAt" TIMESTAMP(3),
    "finalPaidAmount" DECIMAL(10,2),
    "collateralType" "CollateralType",
    "collateralTaken" BOOLEAN NOT NULL DEFAULT false,
    "collateralReturned" BOOLEAN NOT NULL DEFAULT false,
    "deliveredByCourierId" INTEGER,
    "consoleItemId" INTEGER,
    "hdmiItemId" INTEGER,
    "powerItemId" INTEGER,
    "returnCondition" "ConditionGrade",
    "returnNote" TEXT,
    "returnedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_reminder_logs" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,

    CONSTRAINT "order_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_courier_rejections" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "courierId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_courier_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_location_history" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "previousLatitude" DOUBLE PRECISION,
    "previousLongitude" DOUBLE PRECISION,
    "previousAddress" TEXT,
    "newLatitude" DOUBLE PRECISION,
    "newLongitude" DOUBLE PRECISION,
    "newAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" SERIAL NOT NULL,
    "itemType" "InventoryItemType" NOT NULL,
    "consoleType" "ConsoleType",
    "inventoryNumber" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "condition" "ConditionGrade" NOT NULL DEFAULT 'GOOD',
    "status" "InventoryItemStatus" NOT NULL DEFAULT 'AVAILABLE',
    "purchasedAt" TIMESTAMP(3),
    "note" TEXT,
    "reservedOrderId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_item_history" (
    "id" SERIAL NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "InventoryItemStatus",
    "toStatus" "InventoryItemStatus",
    "orderId" INTEGER,
    "note" TEXT,
    "actorType" TEXT,
    "actorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_item_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_inventory_items" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "inventoryItemId" INTEGER NOT NULL,
    "role" "InventoryItemType" NOT NULL,
    "returnedAt" TIMESTAMP(3),
    "returnCondition" "ConditionGrade",
    "returnNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rental_contracts" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "pdfPath" TEXT,
    "telegramFileId" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rental_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_photos" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "photoType" "OrderPhotoType" NOT NULL,
    "filePath" TEXT,
    "telegramFileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_logs" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "actorType" TEXT,
    "actorId" INTEGER,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER,
    "type" "NotificationType" NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "isSent" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_payments" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admins" (
    "id" SERIAL NOT NULL,
    "telegramId" BIGINT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admins_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "mediaType" TEXT NOT NULL DEFAULT 'text',
    "payload" JSONB,
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_threads" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "SupportThreadStatus" NOT NULL DEFAULT 'OPEN',
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "id" SERIAL NOT NULL,
    "threadId" INTEGER NOT NULL,
    "senderType" "SupportSenderType" NOT NULL,
    "senderUserId" INTEGER,
    "senderAdminId" INTEGER,
    "messageType" TEXT NOT NULL,
    "text" TEXT,
    "caption" TEXT,
    "fileId" TEXT,
    "payload" JSONB,
    "telegramMessageId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_telegramId_key" ON "users"("telegramId");

-- CreateIndex
CREATE INDEX "users_lastActivityAt_idx" ON "users"("lastActivityAt");

-- CreateIndex
CREATE UNIQUE INDEX "couriers_telegramId_key" ON "couriers"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "playstations_serialNumber_key" ON "playstations"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_unitCode_key" ON "inventory_units"("unitCode");

-- CreateIndex
CREATE INDEX "inventory_units_consoleType_status_idx" ON "inventory_units"("consoleType", "status");

-- CreateIndex
CREATE INDEX "inventory_unit_history_inventoryUnitId_createdAt_idx" ON "inventory_unit_history"("inventoryUnitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "delivery_zones_code_key" ON "delivery_zones"("code");

-- CreateIndex
CREATE INDEX "admin_audit_logs_createdAt_idx" ON "admin_audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_logs_module_idx" ON "admin_audit_logs"("module");

-- CreateIndex
CREATE INDEX "database_backups_createdAt_idx" ON "database_backups"("createdAt");

-- CreateIndex
CREATE INDEX "rental_extensions_orderId_status_idx" ON "rental_extensions"("orderId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "console_catalog_code_key" ON "console_catalog"("code");

-- CreateIndex
CREATE UNIQUE INDEX "rental_prices_consoleCatalogId_hours_key" ON "rental_prices"("consoleCatalogId", "hours");

-- CreateIndex
CREATE UNIQUE INDEX "promocodes_code_key" ON "promocodes"("code");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_status_endDatetime_idx" ON "orders"("status", "endDatetime");

-- CreateIndex
CREATE INDEX "orders_status_startDatetime_idx" ON "orders"("status", "startDatetime");

-- CreateIndex
CREATE INDEX "orders_paymentReceived_idx" ON "orders"("paymentReceived");

-- CreateIndex
CREATE INDEX "orders_isHighPriority_idx" ON "orders"("isHighPriority");

-- CreateIndex
CREATE INDEX "order_reminder_logs_kind_sentAt_idx" ON "order_reminder_logs"("kind", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "order_reminder_logs_orderId_kind_key" ON "order_reminder_logs"("orderId", "kind");

-- CreateIndex
CREATE INDEX "order_courier_rejections_orderId_idx" ON "order_courier_rejections"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_courier_rejections_orderId_courierId_key" ON "order_courier_rejections"("orderId", "courierId");

-- CreateIndex
CREATE INDEX "order_location_history_orderId_createdAt_idx" ON "order_location_history"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_location_history_userId_createdAt_idx" ON "order_location_history"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_inventoryNumber_key" ON "inventory_items"("inventoryNumber");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_serialNumber_key" ON "inventory_items"("serialNumber");

-- CreateIndex
CREATE INDEX "inventory_items_itemType_status_idx" ON "inventory_items"("itemType", "status");

-- CreateIndex
CREATE INDEX "inventory_items_consoleType_status_idx" ON "inventory_items"("consoleType", "status");

-- CreateIndex
CREATE INDEX "inventory_item_history_inventoryItemId_idx" ON "inventory_item_history"("inventoryItemId");

-- CreateIndex
CREATE INDEX "order_inventory_items_orderId_idx" ON "order_inventory_items"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "order_inventory_items_orderId_inventoryItemId_key" ON "order_inventory_items"("orderId", "inventoryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_orderId_key" ON "rental_contracts"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "rental_contracts_contractNumber_key" ON "rental_contracts"("contractNumber");

-- CreateIndex
CREATE INDEX "order_photos_orderId_photoType_idx" ON "order_photos"("orderId", "photoType");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_orderId_key" ON "reviews"("orderId");

-- CreateIndex
CREATE INDEX "order_payments_orderId_idx" ON "order_payments"("orderId");

-- CreateIndex
CREATE INDEX "order_payments_status_idx" ON "order_payments"("status");

-- CreateIndex
CREATE UNIQUE INDEX "admins_telegramId_key" ON "admins"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "support_threads_userId_key" ON "support_threads"("userId");

-- CreateIndex
CREATE INDEX "support_threads_status_idx" ON "support_threads"("status");

-- CreateIndex
CREATE INDEX "support_threads_lastMessageAt_idx" ON "support_threads"("lastMessageAt");

-- CreateIndex
CREATE INDEX "support_messages_threadId_createdAt_idx" ON "support_messages"("threadId", "createdAt");

-- CreateIndex
CREATE INDEX "support_messages_senderType_idx" ON "support_messages"("senderType");

-- AddForeignKey
ALTER TABLE "playstations" ADD CONSTRAINT "playstations_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_unit_history" ADD CONSTRAINT "inventory_unit_history_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "inventory_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_extensions" ADD CONSTRAINT "rental_extensions_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_prices" ADD CONSTRAINT "rental_prices_consoleCatalogId_fkey" FOREIGN KEY ("consoleCatalogId") REFERENCES "console_catalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_playstationId_fkey" FOREIGN KEY ("playstationId") REFERENCES "playstations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_rentalPriceId_fkey" FOREIGN KEY ("rentalPriceId") REFERENCES "rental_prices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_promocodeId_fkey" FOREIGN KEY ("promocodeId") REFERENCES "promocodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_inventoryUnitId_fkey" FOREIGN KEY ("inventoryUnitId") REFERENCES "inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_deliveredByCourierId_fkey" FOREIGN KEY ("deliveredByCourierId") REFERENCES "couriers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_consoleItemId_fkey" FOREIGN KEY ("consoleItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_hdmiItemId_fkey" FOREIGN KEY ("hdmiItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_powerItemId_fkey" FOREIGN KEY ("powerItemId") REFERENCES "inventory_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_reminder_logs" ADD CONSTRAINT "order_reminder_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_courier_rejections" ADD CONSTRAINT "order_courier_rejections_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_courier_rejections" ADD CONSTRAINT "order_courier_rejections_courierId_fkey" FOREIGN KEY ("courierId") REFERENCES "couriers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_location_history" ADD CONSTRAINT "order_location_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_item_history" ADD CONSTRAINT "inventory_item_history_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inventory_items" ADD CONSTRAINT "order_inventory_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_inventory_items" ADD CONSTRAINT "order_inventory_items_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "inventory_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rental_contracts" ADD CONSTRAINT "rental_contracts_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_logs" ADD CONSTRAINT "order_status_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "admins"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_threads" ADD CONSTRAINT "support_threads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "support_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_senderAdminId_fkey" FOREIGN KEY ("senderAdminId") REFERENCES "admins"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One occupying PlayStation per non-terminal order (race-safe assignment)
CREATE UNIQUE INDEX "orders_unique_occupying_playstation"
ON "orders" ("playstationId")
WHERE "playstationId" IS NOT NULL
  AND status NOT IN ('CANCELLED', 'REJECTED', 'COMPLETED', 'RETURNED');
