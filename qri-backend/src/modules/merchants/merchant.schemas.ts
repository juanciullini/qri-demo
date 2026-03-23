import { z } from 'zod';

// ── MCC Code schema ──

const mccCodeSchema = z.object({
  mcc: z.string().regex(/^\d{4}$/, 'MCC must be exactly 4 digits'),
  desc: z.string().min(1, 'MCC description is required'),
  commission: z.number().min(0, 'Commission must be >= 0').max(100, 'Commission must be <= 100'),
});

// ── Create Merchant ──

export const createMerchantSchema = z.object({
  business_name: z.string().min(1, 'Business name is required').max(100),
  cuit: z
    .string()
    .regex(/^\d{11}$/, 'CUIT must be exactly 11 digits'),
  cbu: z
    .string()
    .regex(/^\d{22}$/, 'CBU must be exactly 22 digits'),
  cvu: z
    .string()
    .regex(/^\d{22}$/, 'CVU must be exactly 22 digits')
    .optional(),
  banco: z.string().max(50).optional(),
  sucursal: z.string().max(50).optional(),
  terminal: z.string().max(50).optional(),
  address: z.string().max(200).optional(),
  postal_code: z.string().max(10).optional(),
  city: z.string().max(100).optional(),
  mcc_codes: z
    .array(mccCodeSchema)
    .min(1, 'At least one MCC code is required'),
  contact_email: z.string().email('Invalid email format').optional(),
  contact_phone: z.string().max(30).optional(),
  settlement_freq: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  split_percentage: z
    .number()
    .min(0, 'Split percentage must be >= 0')
    .max(0.999, 'Split percentage must be <= 0.999')
    .optional(),
});

export type CreateMerchantInput = z.infer<typeof createMerchantSchema>;

// ── Update Merchant ──

export const updateMerchantSchema = createMerchantSchema.partial();

export type UpdateMerchantInput = z.infer<typeof updateMerchantSchema>;

// ── Merchant Filters ──

export const merchantFiltersSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type MerchantFilters = z.infer<typeof merchantFiltersSchema>;
