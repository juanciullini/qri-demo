import { z } from 'zod';

export const scanQRSchema = z.object({
  qr_data: z.string().min(10, 'QR data too short'),
});

export type ScanQRInput = z.infer<typeof scanQRSchema>;

export const paySchema = z.object({
  qr_data: z.string().min(10, 'QR data too short'),
  amount: z.number().positive().optional(),
  buyer_cbu: z.string().length(22, 'CBU must be 22 characters'),
  buyer_cuit: z.string().length(11, 'CUIT must be 11 characters'),
  description: z.string().max(200).optional(),
});

export type PayInput = z.infer<typeof paySchema>;

export const walletTransactionFiltersSchema = z.object({
  status: z.string().optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  amount_min: z.coerce.number().positive().optional(),
  amount_max: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type WalletTransactionFilters = z.infer<typeof walletTransactionFiltersSchema>;
