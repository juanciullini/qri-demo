import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';

// ── Types ──

export interface SettlementFilters {
  merchant_id?: string;
  status?: 'PENDING' | 'SETTLED' | 'RECONCILED';
  date_from?: Date;
  date_to?: Date;
  page?: number;
  limit?: number;
}

// ── Generate Settlement ──

export async function generateSettlement(
  merchantId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  // Check for overlapping settlement
  const existingSettlement = await prisma.settlement.findFirst({
    where: {
      merchant_id: merchantId,
      period_start: { lte: periodEnd },
      period_end: { gte: periodStart },
    },
  });

  if (existingSettlement) {
    throw new AppError(
      409,
      'A settlement already exists for the overlapping period',
      'SETTLEMENT_OVERLAP',
    );
  }

  // Get all completed transactions in the period
  const transactions = await prisma.transaction.findMany({
    where: {
      merchant_id: merchantId,
      status: 'ACREDITADO',
      completed_at: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      id: true,
      amount: true,
      platform_commission: true,
      merchant_net_amount: true,
      commission_data: true,
      mcc: true,
    },
  });

  // Calculate totals and build commission detail by MCC
  const mccCodes = merchant.mcc_codes as Array<{ mcc: string; desc: string; commission: number }>;
  const mccMap = new Map(mccCodes.map((m) => [m.mcc, m.commission]));

  let totalAmount = 0;
  let totalCommission = 0;

  // Track per-MCC commission detail
  const mccDetail = new Map<string, { tx_count: number; gross_amount: number; commission_amount: number }>();

  for (const tx of transactions) {
    const amount = Number(tx.amount);
    totalAmount += amount;

    let txCommission = 0;

    // Use platform_commission if available (new explicit field)
    if (tx.platform_commission !== null) {
      txCommission = Number(tx.platform_commission);
    } else {
      // Fallback: calculate from MCC commission rate (backward compat for old txs)
      const commissionRate = mccMap.get(tx.mcc ?? '') ?? 0;
      txCommission = amount * (commissionRate / 100);
    }

    totalCommission += txCommission;

    // Accumulate MCC detail
    const mcc = tx.mcc ?? 'N/A';
    const existing = mccDetail.get(mcc) ?? { tx_count: 0, gross_amount: 0, commission_amount: 0 };
    existing.tx_count += 1;
    existing.gross_amount += amount;
    existing.commission_amount += txCommission;
    mccDetail.set(mcc, existing);
  }

  const merchantNet = totalAmount - totalCommission;

  // Round to 2 decimal places
  const roundedTotalAmount = Math.round(totalAmount * 100) / 100;
  const roundedTotalCommission = Math.round(totalCommission * 100) / 100;
  const roundedMerchantNet = Math.round(merchantNet * 100) / 100;
  const avgCommissionRate = totalAmount > 0
    ? Math.round((totalCommission / totalAmount) * 100 * 1000) / 1000
    : 0;

  // Build commission_detail array
  const commissionDetail = Array.from(mccDetail.entries()).map(([mcc, detail]) => ({
    mcc,
    tx_count: detail.tx_count,
    gross_amount: Math.round(detail.gross_amount * 100) / 100,
    commission_amount: Math.round(detail.commission_amount * 100) / 100,
    rate: detail.gross_amount > 0
      ? Math.round((detail.commission_amount / detail.gross_amount) * 100 * 1000) / 1000
      : 0,
  }));

  const settlement = await prisma.settlement.create({
    data: {
      merchant_id: merchantId,
      period_start: periodStart,
      period_end: periodEnd,
      total_transactions: transactions.length,
      total_amount: roundedTotalAmount,
      total_commission: roundedTotalCommission,
      merchant_net: roundedMerchantNet,
      commission_detail: commissionDetail,
      avg_commission_rate: avgCommissionRate,
      status: 'PENDING',
    },
  });

  logger.info(
    {
      settlementId: settlement.id,
      merchantId,
      periodStart,
      periodEnd,
      totalTransactions: transactions.length,
      totalAmount: roundedTotalAmount,
    },
    'Settlement generated',
  );

  return settlement;
}

// ── Get Settlements (paginated) ──

export async function getSettlements(filters: SettlementFilters) {
  const where: Record<string, unknown> = {};

  if (filters.merchant_id) where.merchant_id = filters.merchant_id;
  if (filters.status) where.status = filters.status;
  if (filters.date_from || filters.date_to) {
    where.period_start = {};
    if (filters.date_from) (where.period_start as Record<string, unknown>).gte = filters.date_from;
    if (filters.date_to) (where.period_start as Record<string, unknown>).lte = filters.date_to;
  }

  const page = filters.page ?? 1;
  const limit = filters.limit ?? 20;
  const skip = (page - 1) * limit;

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        merchant: {
          select: { id: true, business_name: true, cuit: true },
        },
      },
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    data: settlements,
    pagination: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };
}

// ── Get Settlement By ID ──

export async function getSettlementById(id: string) {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    include: {
      merchant: {
        select: { id: true, business_name: true, cuit: true, cbu: true, settlement_freq: true },
      },
    },
  });

  if (!settlement) {
    throw new AppError(404, 'Settlement not found', 'SETTLEMENT_NOT_FOUND');
  }

  // Get transactions within the settlement period for this merchant
  const transactions = await prisma.transaction.findMany({
    where: {
      merchant_id: settlement.merchant_id,
      status: 'ACREDITADO',
      completed_at: {
        gte: settlement.period_start,
        lte: settlement.period_end,
      },
    },
    select: {
      id: true,
      qr_id_trx: true,
      amount: true,
      commission_data: true,
      mcc: true,
      completed_at: true,
      created_at: true,
    },
    orderBy: { completed_at: 'desc' },
  });

  return {
    ...settlement,
    transactions,
  };
}

// ── Export Settlement ──

export async function exportSettlement(
  id: string,
  format: 'csv' | 'excel',
): Promise<{ data: Buffer; contentType: string; filename: string }> {
  const settlementData = await getSettlementById(id);

  if (format === 'csv') {
    const headers = [
      'ID',
      'QR ID TRX',
      'Monto',
      'MCC',
      'Comision',
      'Neto Comercio',
      'Fecha Completado',
      'Fecha Creacion',
    ].join(',');

    const rows = settlementData.transactions.map((tx) => {
      const commData = tx.commission_data as { total?: number; merchant_net?: number } | null;
      const commission = commData?.total ?? 0;
      const merchantNet = commData?.merchant_net ?? Number(tx.amount) - Number(commission);
      return [
        tx.id,
        tx.qr_id_trx,
        Number(tx.amount).toFixed(2),
        tx.mcc ?? '',
        Number(commission).toFixed(2),
        Number(merchantNet).toFixed(2),
        tx.completed_at?.toISOString() ?? '',
        tx.created_at.toISOString(),
      ].join(',');
    });

    const summaryRows = [
      '',
      `Resumen de Liquidacion`,
      `Comercio,${settlementData.merchant.business_name}`,
      `CUIT,${settlementData.merchant.cuit}`,
      `Periodo,${settlementData.period_start.toISOString().split('T')[0]} - ${settlementData.period_end.toISOString().split('T')[0]}`,
      `Total Transacciones,${settlementData.total_transactions}`,
      `Monto Total,$${Number(settlementData.total_amount).toFixed(2)}`,
      `Comision Total,$${Number(settlementData.total_commission).toFixed(2)}`,
      `Neto Comercio,$${Number(settlementData.merchant_net).toFixed(2)}`,
    ];

    const csvContent = [headers, ...rows, ...summaryRows].join('\n');
    const filename = `liquidacion-${settlementData.merchant.cuit}-${settlementData.period_start.toISOString().split('T')[0]}.csv`;

    return {
      data: Buffer.from(csvContent, 'utf-8'),
      contentType: 'text/csv; charset=utf-8',
      filename,
    };
  }

  // Excel format: generate as TSV (Tab-Separated Values) which Excel can open
  const headers = [
    'ID',
    'QR ID TRX',
    'Monto',
    'MCC',
    'Comision',
    'Neto Comercio',
    'Fecha Completado',
    'Fecha Creacion',
  ].join('\t');

  const rows = settlementData.transactions.map((tx) => {
    const commData = tx.commission_data as { total?: number; merchant_net?: number } | null;
    const commission = commData?.total ?? 0;
    const merchantNet = commData?.merchant_net ?? Number(tx.amount) - Number(commission);
    return [
      tx.id,
      tx.qr_id_trx,
      Number(tx.amount).toFixed(2),
      tx.mcc ?? '',
      Number(commission).toFixed(2),
      Number(merchantNet).toFixed(2),
      tx.completed_at?.toISOString() ?? '',
      tx.created_at.toISOString(),
    ].join('\t');
  });

  const summaryRows = [
    '',
    `Resumen de Liquidacion`,
    `Comercio\t${settlementData.merchant.business_name}`,
    `CUIT\t${settlementData.merchant.cuit}`,
    `Periodo\t${settlementData.period_start.toISOString().split('T')[0]} - ${settlementData.period_end.toISOString().split('T')[0]}`,
    `Total Transacciones\t${settlementData.total_transactions}`,
    `Monto Total\t${Number(settlementData.total_amount).toFixed(2)}`,
    `Comision Total\t${Number(settlementData.total_commission).toFixed(2)}`,
    `Neto Comercio\t${Number(settlementData.merchant_net).toFixed(2)}`,
  ];

  const tsvContent = [headers, ...rows, ...summaryRows].join('\n');
  const filename = `liquidacion-${settlementData.merchant.cuit}-${settlementData.period_start.toISOString().split('T')[0]}.xls`;

  return {
    data: Buffer.from(tsvContent, 'utf-8'),
    contentType: 'application/vnd.ms-excel',
    filename,
  };
}
