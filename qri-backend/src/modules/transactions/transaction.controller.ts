import type { FastifyReply, FastifyRequest } from 'fastify';
import { transactionFiltersSchema, refundSchema, exportSchema } from './transaction.schemas.js';
import * as transactionService from './transaction.service.js';
import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { Role } from '../../config/constants.js';

// ── Helper: resolve merchant scope for MERCHANT role users ──

function getMerchantScope(request: FastifyRequest): string | undefined {
  if (request.user?.role === Role.MERCHANT) {
    return request.user.merchantId;
  }
  return undefined;
}

/**
 * GET /api/transactions
 * List transactions with filters and pagination.
 */
export async function listTransactions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = transactionFiltersSchema.parse(request.query);
  const merchantScope = getMerchantScope(request);

  const result = await transactionService.getTransactions(filters, merchantScope);
  reply.send(result);
}

/**
 * GET /api/transactions/:id
 * Get a single transaction by ID with full detail.
 */
export async function getTransaction(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const merchantScope = getMerchantScope(request);

  const transaction = await transactionService.getTransactionById(id, merchantScope);
  reply.send(transaction);
}

/**
 * GET /api/transactions/stats
 * Get aggregated transaction statistics.
 */
export async function getStats(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = transactionFiltersSchema.parse(request.query);
  const merchantScope = getMerchantScope(request);

  const stats = await transactionService.getTransactionStats(filters, merchantScope);
  reply.send(stats);
}

/**
 * POST /api/transactions/:id/refund
 * Request a refund for a specific transaction.
 */
export async function requestRefund(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { id } = request.params;
  const body = refundSchema.parse(request.body);

  const result = await transactionService.requestRefund(
    id,
    body.amount,
    body.reason,
  );

  reply.send(result);
}

/**
 * GET /api/transactions/export
 * Export transactions as CSV or Excel.
 */
export async function exportTransactions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const params = exportSchema.parse(request.query);
  const merchantScope = getMerchantScope(request);

  const where = transactionService.buildTransactionWhereClause(params, merchantScope);

  const transactions = await prisma.transaction.findMany({
    where,
    orderBy: { created_at: 'desc' },
    take: 10000, // Safety limit for exports
    include: {
      merchant: {
        select: { business_name: true, cuit: true },
      },
    },
  });

  if (params.format === 'csv') {
    const headers = [
      'id',
      'qr_id_trx',
      'merchant_name',
      'merchant_cuit',
      'status',
      'amount',
      'currency',
      'mcc',
      'payment_reference',
      'buyer_cuit',
      'error_code',
      'reversal_code',
      'created_at',
      'completed_at',
    ];

    const rows = transactions.map((tx) => [
      tx.id,
      tx.qr_id_trx,
      tx.merchant?.business_name ?? tx.external_merchant_name ?? '',
      tx.merchant?.cuit ?? tx.external_merchant_cuit ?? '',
      tx.status,
      tx.amount.toString(),
      tx.currency,
      tx.mcc ?? '',
      tx.payment_reference ?? '',
      tx.buyer_cuit ?? '',
      tx.error_code ?? '',
      tx.reversal_code ?? '',
      tx.created_at.toISOString(),
      tx.completed_at?.toISOString() ?? '',
    ]);

    // Escape CSV fields
    const escapeCsv = (field: string): string => {
      if (field.includes(',') || field.includes('"') || field.includes('\n')) {
        return `"${field.replace(/"/g, '""')}"`;
      }
      return field;
    };

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map(escapeCsv).join(',')),
    ].join('\n');

    reply
      .header('Content-Type', 'text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="transactions_${Date.now()}.csv"`)
      .send(csv);
    return;
  }

  // Excel format: return JSON with metadata (frontend handles XLSX generation via SheetJS)
  reply.send({
    format: 'excel',
    filename: `transactions_${Date.now()}.xlsx`,
    total: transactions.length,
    data: transactions.map((tx) => ({
      id: tx.id,
      qr_id_trx: tx.qr_id_trx,
      merchant_name: tx.merchant?.business_name ?? tx.external_merchant_name ?? '',
      merchant_cuit: tx.merchant?.cuit ?? tx.external_merchant_cuit ?? '',
      status: tx.status,
      amount: Number(tx.amount),
      currency: tx.currency,
      mcc: tx.mcc,
      payment_reference: tx.payment_reference,
      buyer_cuit: tx.buyer_cuit,
      error_code: tx.error_code,
      reversal_code: tx.reversal_code,
      commission_data: tx.commission_data,
      created_at: tx.created_at.toISOString(),
      completed_at: tx.completed_at?.toISOString() ?? null,
    })),
  });
}
