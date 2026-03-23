-- CreateEnum
CREATE TYPE "TxDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_merchant_id_fkey";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "buyer_account_id" TEXT,
ADD COLUMN     "direction" "TxDirection" NOT NULL DEFAULT 'INBOUND',
ADD COLUMN     "external_merchant_cbu" TEXT,
ADD COLUMN     "external_merchant_cuit" TEXT,
ADD COLUMN     "external_merchant_name" TEXT,
ADD COLUMN     "scanned_qr_data" TEXT,
ALTER COLUMN "merchant_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Transaction_direction_idx" ON "Transaction"("direction");

-- CreateIndex
CREATE INDEX "Transaction_external_merchant_cuit_idx" ON "Transaction"("external_merchant_cuit");

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
