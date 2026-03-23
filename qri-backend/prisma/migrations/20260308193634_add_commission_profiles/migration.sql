-- AlterTable
ALTER TABLE "Merchant" ADD COLUMN     "commission_profile_id" TEXT;

-- AlterTable
ALTER TABLE "Settlement" ADD COLUMN     "avg_commission_rate" DECIMAL(5,3),
ADD COLUMN     "commission_detail" JSONB;

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "merchant_net_amount" DECIMAL(15,2),
ADD COLUMN     "platform_commission" DECIMAL(15,2);

-- CreateTable
CREATE TABLE "CommissionProfile" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "default_rate" DECIMAL(5,3) NOT NULL,
    "rates" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionProfile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommissionProfile_name_key" ON "CommissionProfile"("name");

-- CreateIndex
CREATE INDEX "CommissionProfile_is_default_idx" ON "CommissionProfile"("is_default");

-- CreateIndex
CREATE INDEX "CommissionProfile_is_active_idx" ON "CommissionProfile"("is_active");

-- CreateIndex
CREATE INDEX "Merchant_commission_profile_id_idx" ON "Merchant"("commission_profile_id");

-- AddForeignKey
ALTER TABLE "Merchant" ADD CONSTRAINT "Merchant_commission_profile_id_fkey" FOREIGN KEY ("commission_profile_id") REFERENCES "CommissionProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
