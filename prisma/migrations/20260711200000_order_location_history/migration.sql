[32m-- AlterEnum[0m
[32mALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'LOCATION_UPDATED';[0m
[32m[0m
[32m-- CreateTable[0m
[32mCREATE TABLE IF NOT EXISTS "order_location_history" ([0m
[32m    "id" SERIAL NOT NULL,[0m
[32m    "orderId" INTEGER NOT NULL,[0m
[32m    "userId" INTEGER NOT NULL,[0m
[32m    "previousLatitude" DOUBLE PRECISION,[0m
[32m    "previousLongitude" DOUBLE PRECISION,[0m
[32m    "previousAddress" TEXT,[0m
[32m    "newLatitude" DOUBLE PRECISION,[0m
[32m    "newLongitude" DOUBLE PRECISION,[0m
[32m    "newAddress" TEXT,[0m
[32m    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,[0m
[32m[0m
[32m    CONSTRAINT "order_location_history_pkey" PRIMARY KEY ("id")[0m
[32m);[0m
[32m[0m
[32m-- CreateIndex[0m
[32mCREATE INDEX IF NOT EXISTS "order_location_history_orderId_createdAt_idx" ON "order_location_history"("orderId", "createdAt");[0m
[32m[0m
[32m-- CreateIndex[0m
[32mCREATE INDEX IF NOT EXISTS "order_location_history_userId_createdAt_idx" ON "order_location_history"("userId", "createdAt");[0m
[32m[0m
[32m-- AddForeignKey[0m
[32mDO $$[0m
[32mBEGIN[0m
[32m  IF NOT EXISTS ([0m
[32m    SELECT 1 FROM pg_constraint WHERE conname = 'order_location_history_orderId_fkey'[0m
[32m  ) THEN[0m
[32m    ALTER TABLE "order_location_history"[0m
[32m      ADD CONSTRAINT "order_location_history_orderId_fkey"[0m
[32m      FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;[0m
[32m  END IF;[0m
[32mEND $$;[0m
