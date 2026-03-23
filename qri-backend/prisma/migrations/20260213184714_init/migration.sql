-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER');

-- CreateEnum
CREATE TYPE "MerchantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "CoelsaStatus" AS ENUM ('PENDING', 'REGISTERING', 'ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SettlementFreq" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "QrType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "QrStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'DISABLED');

-- CreateEnum
CREATE TYPE "TxStatus" AS ENUM ('CREADO', 'INTENCION_ENVIADA', 'INTENCION_ACEPTADA', 'DEBITO_PENDIENTE', 'DEBITO_CONFIRMADO', 'CREDITO_ENVIADO', 'EN_CURSO', 'ACREDITADO', 'REVERSADO', 'DEVUELTO');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'RECONCILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OPERATOR',
    "merchant_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "cuit" TEXT NOT NULL,
    "cbu" TEXT NOT NULL,
    "cvu" TEXT,
    "banco" TEXT,
    "sucursal" TEXT,
    "terminal" TEXT,
    "address" TEXT,
    "postal_code" TEXT,
    "city" TEXT,
    "mcc_codes" JSONB NOT NULL,
    "coelsa_status" "CoelsaStatus" NOT NULL DEFAULT 'PENDING',
    "status" "MerchantStatus" NOT NULL DEFAULT 'ACTIVE',
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "settlement_freq" "SettlementFreq" NOT NULL DEFAULT 'DAILY',
    "split_percentage" DECIMAL(5,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QrCode" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "type" "QrType" NOT NULL,
    "qr_data" TEXT NOT NULL,
    "qr_hash" TEXT,
    "qr_id_trx" TEXT,
    "amount" DECIMAL(15,2),
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "label" TEXT,
    "expires_at" TIMESTAMP(3),
    "status" "QrStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QrCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "qr_id_trx" TEXT NOT NULL,
    "id_debin" TEXT,
    "merchant_id" TEXT NOT NULL,
    "qr_code_id" TEXT,
    "status" "TxStatus" NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "buyer_cuit" TEXT,
    "buyer_cbu" TEXT,
    "mcc" TEXT,
    "postal_code" TEXT,
    "payment_reference" TEXT,
    "interchange" JSONB,
    "commission_data" JSONB,
    "error_code" TEXT,
    "error_description" TEXT,
    "reversal_code" TEXT,
    "reversal_reason" TEXT,
    "refund_id" TEXT,
    "coelsa_messages" JSONB[],
    "credit_forced" BOOLEAN NOT NULL DEFAULT false,
    "credit_forced_pending" BOOLEAN NOT NULL DEFAULT false,
    "reconciliation_status" TEXT,
    "intention_sent_at" TIMESTAMP(3),
    "intention_response_at" TIMESTAMP(3),
    "debit_confirmed_at" TIMESTAMP(3),
    "credit_sent_at" TIMESTAMP(3),
    "confirm_sent_at" TIMESTAMP(3),
    "confirm_response_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Settlement" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_transactions" INTEGER NOT NULL,
    "total_amount" DECIMAL(15,2) NOT NULL,
    "total_commission" DECIMAL(15,2) NOT NULL,
    "merchant_net" DECIMAL(15,2) NOT NULL,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "changes" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_merchant_id_idx" ON "User"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_cuit_key" ON "Merchant"("cuit");

-- CreateIndex
CREATE INDEX "Merchant_cuit_idx" ON "Merchant"("cuit");

-- CreateIndex
CREATE INDEX "Merchant_cvu_idx" ON "Merchant"("cvu");

-- CreateIndex
CREATE INDEX "Merchant_status_idx" ON "Merchant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "QrCode_qr_id_trx_key" ON "QrCode"("qr_id_trx");

-- CreateIndex
CREATE INDEX "QrCode_merchant_id_idx" ON "QrCode"("merchant_id");

-- CreateIndex
CREATE INDEX "QrCode_qr_id_trx_idx" ON "QrCode"("qr_id_trx");

-- CreateIndex
CREATE INDEX "QrCode_status_idx" ON "QrCode"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_qr_id_trx_key" ON "Transaction"("qr_id_trx");

-- CreateIndex
CREATE INDEX "Transaction_qr_id_trx_idx" ON "Transaction"("qr_id_trx");

-- CreateIndex
CREATE INDEX "Transaction_merchant_id_idx" ON "Transaction"("merchant_id");

-- CreateIndex
CREATE INDEX "Transaction_status_idx" ON "Transaction"("status");

-- CreateIndex
CREATE INDEX "Transaction_created_at_idx" ON "Transaction"("created_at");

-- CreateIndex
CREATE INDEX "Transaction_payment_reference_idx" ON "Transaction"("payment_reference");

-- CreateIndex
CREATE INDEX "Settlement_merchant_id_idx" ON "Settlement"("merchant_id");

-- CreateIndex
CREATE INDEX "Settlement_status_idx" ON "Settlement"("status");

-- CreateIndex
CREATE INDEX "Settlement_period_start_period_end_idx" ON "Settlement"("period_start", "period_end");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entity_id_idx" ON "AuditLog"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "AuditLog_user_id_idx" ON "AuditLog"("user_id");

-- CreateIndex
CREATE INDEX "AuditLog_created_at_idx" ON "AuditLog"("created_at");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QrCode" ADD CONSTRAINT "QrCode_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_qr_code_id_fkey" FOREIGN KEY ("qr_code_id") REFERENCES "QrCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
