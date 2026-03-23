import { z } from 'zod';

// ── Rate item within a profile ──

export const profileRateSchema = z.object({
  mcc: z.string().regex(/^\d{4}$/, 'MCC must be exactly 4 digits'),
  rate: z.number().min(0).max(100),
  direction: z.enum(['INBOUND', 'OUTBOUND', 'BOTH']),
});

export type ProfileRate = z.infer<typeof profileRateSchema>;

// ── Create profile ──

export const createProfileSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  is_default: z.boolean().default(false),
  default_rate: z.number().min(0).max(100),
  rates: z.array(profileRateSchema).default([]),
});

export type CreateProfileInput = z.infer<typeof createProfileSchema>;

// ── Update profile ──

export const updateProfileSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional().nullable(),
  is_default: z.boolean().optional(),
  default_rate: z.number().min(0).max(100).optional(),
  rates: z.array(profileRateSchema).optional(),
  is_active: z.boolean().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// ── Assign profile to merchant ──

export const assignProfileSchema = z.object({
  merchant_id: z.string().uuid(),
  profile_id: z.string().uuid().nullable(),
});

export type AssignProfileInput = z.infer<typeof assignProfileSchema>;

// ── Profile filters ──

export const profileFiltersSchema = z.object({
  is_active: z.coerce.boolean().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ProfileFilters = z.infer<typeof profileFiltersSchema>;

// ── Dashboard filters ──

export const dashboardFiltersSchema = z.object({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  merchant_id: z.string().uuid().optional(),
  mcc: z.string().regex(/^\d{4}$/).optional(),
  direction: z.enum(['INBOUND', 'OUTBOUND']).optional(),
  granularity: z.enum(['day', 'week', 'month']).default('day'),
});

export type DashboardFilters = z.infer<typeof dashboardFiltersSchema>;
