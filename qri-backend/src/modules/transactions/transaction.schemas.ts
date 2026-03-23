import { z } from 'zod';
import { TxStatus } from '../../config/constants.js';

// ── Filter schema for listing transactions ──

export const transactionFiltersSchema = z.object({
  merchant_id: z.string().uuid().optional(),
  status: z.nativeEnum(TxStatus as Record<string, string>).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  amount_min: z.coerce.number().positive().optional(),
  amount_max: z.coerce.number().positive().optional(),
  mcc: z.string().regex(/^\d{4}$/, 'MCC must be 4 digits').optional(),
  payment_reference: z.string().optional(),
  qr_id_trx: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;

// ── Refund schema ──

export const refundSchema = z.object({
  amount: z
    .number()
    .positive('Refund amount must be positive')
    .max(999999999.99)
    .nullable()
    .optional(), // null or omitted = full refund
  reason: z.string().min(1).max(100, 'Reason must be 100 characters or less'),
});

export type RefundInput = z.infer<typeof refundSchema>;

// ── Export schema ──

export const exportSchema = z.object({
  format: z.enum(['csv', 'excel']),
  merchant_id: z.string().uuid().optional(),
  status: z.nativeEnum(TxStatus as Record<string, string>).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  amount_min: z.coerce.number().positive().optional(),
  amount_max: z.coerce.number().positive().optional(),
  mcc: z.string().regex(/^\d{4}$/, 'MCC must be 4 digits').optional(),
  payment_reference: z.string().optional(),
  qr_id_trx: z.string().optional(),
});

export type ExportInput = z.infer<typeof exportSchema>;
