import { z } from 'zod';

// ── Create User ──

export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100),
  role: z.enum(['ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER']),
  merchant_id: z.string().uuid('Invalid merchant ID').optional(),
}).refine(
  (data) => {
    // MERCHANT role requires a merchant_id
    if (data.role === 'MERCHANT' && !data.merchant_id) {
      return false;
    }
    return true;
  },
  { message: 'merchant_id is required for MERCHANT role', path: ['merchant_id'] },
);

export type CreateUserInput = z.infer<typeof createUserSchema>;

// ── Update User ──

export const updateUserSchema = z.object({
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  name: z.string().min(1, 'Name is required').max(100).optional(),
  role: z.enum(['ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER']).optional(),
  merchant_id: z.string().uuid('Invalid merchant ID').nullable().optional(),
  is_active: z.boolean().optional(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

// ── User Filters ──

export const userFiltersSchema = z.object({
  role: z.enum(['ADMIN', 'OPERATOR', 'MERCHANT', 'VIEWER']).optional(),
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
  merchant_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UserFilters = z.infer<typeof userFiltersSchema>;
