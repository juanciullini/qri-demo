import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import type { ProfileRate, CreateProfileInput, UpdateProfileInput, ProfileFilters, DashboardFilters } from './commissions.schemas.js';

// ── Commission Calculation Result ──

export interface CommissionResult {
  rate: number;
  commission_amount: number;
  merchant_net: number;
  source: 'profile_mcc' | 'profile_default' | 'merchant_mcc' | 'none';
}

// ── Core: Calculate Commission ──

export async function calculateCommission(
  amount: number,
  mcc: string | null,
  direction: 'INBOUND' | 'OUTBOUND',
  merchantId: string | null,
): Promise<CommissionResult> {
  if (!merchantId) {
    return { rate: 0, commission_amount: 0, merchant_net: amount, source: 'none' };
  }

  const merchant = await prisma.merchant.findUnique({
    where: { id: merchantId },
    include: { commission_profile: true },
  });

  if (!merchant) {
    return { rate: 0, commission_amount: 0, merchant_net: amount, source: 'none' };
  }

  const profile = merchant.commission_profile;

  // 1. Try profile rate matching MCC + direction
  if (profile && profile.is_active) {
    const rates = profile.rates as ProfileRate[];
    const matched = rates.find(
      (r) => r.mcc === mcc && (r.direction === direction || r.direction === 'BOTH'),
    );

    if (matched) {
      const commissionAmount = Math.round(amount * (matched.rate / 100) * 100) / 100;
      return {
        rate: matched.rate,
        commission_amount: commissionAmount,
        merchant_net: Math.round((amount - commissionAmount) * 100) / 100,
        source: 'profile_mcc',
      };
    }

    // 2. Fallback to profile default_rate
    const defaultRate = Number(profile.default_rate);
    const commissionAmount = Math.round(amount * (defaultRate / 100) * 100) / 100;
    return {
      rate: defaultRate,
      commission_amount: commissionAmount,
      merchant_net: Math.round((amount - commissionAmount) * 100) / 100,
      source: 'profile_default',
    };
  }

  // 3. Fallback to merchant.mcc_codes (backward compat)
  const mccCodes = merchant.mcc_codes as Array<{ mcc: string; commission?: number }>;
  const mccMatch = mccCodes.find((m) => m.mcc === mcc);

  if (mccMatch?.commission !== undefined) {
    const rate = mccMatch.commission;
    const commissionAmount = Math.round(amount * (rate / 100) * 100) / 100;
    return {
      rate,
      commission_amount: commissionAmount,
      merchant_net: Math.round((amount - commissionAmount) * 100) / 100,
      source: 'merchant_mcc',
    };
  }

  return { rate: 0, commission_amount: 0, merchant_net: amount, source: 'none' };
}

// ── CRUD: Profiles ──

export async function createProfile(input: CreateProfileInput) {
  // If is_default, unset other defaults
  if (input.is_default) {
    await prisma.commissionProfile.updateMany({
      where: { is_default: true },
      data: { is_default: false },
    });
  }

  return prisma.commissionProfile.create({
    data: {
      name: input.name,
      description: input.description,
      is_default: input.is_default,
      default_rate: input.default_rate,
      rates: input.rates as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function updateProfile(id: string, input: UpdateProfileInput) {
  const existing = await prisma.commissionProfile.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(404, 'Commission profile not found', 'PROFILE_NOT_FOUND');
  }

  // If setting as default, unset others
  if (input.is_default) {
    await prisma.commissionProfile.updateMany({
      where: { is_default: true, id: { not: id } },
      data: { is_default: false },
    });
  }

  const data: Prisma.CommissionProfileUpdateInput = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.description !== undefined) data.description = input.description;
  if (input.is_default !== undefined) data.is_default = input.is_default;
  if (input.default_rate !== undefined) data.default_rate = input.default_rate;
  if (input.rates !== undefined) data.rates = input.rates as unknown as Prisma.InputJsonValue;
  if (input.is_active !== undefined) data.is_active = input.is_active;

  return prisma.commissionProfile.update({ where: { id }, data });
}

export async function getProfiles(filters: ProfileFilters) {
  const where: Prisma.CommissionProfileWhereInput = {};

  if (filters.is_active !== undefined) where.is_active = filters.is_active;
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [data, total] = await Promise.all([
    prisma.commissionProfile.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { created_at: 'desc' },
      include: { _count: { select: { merchants: true } } },
    }),
    prisma.commissionProfile.count({ where }),
  ]);

  return {
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

export async function getProfileById(id: string) {
  const profile = await prisma.commissionProfile.findUnique({
    where: { id },
    include: { _count: { select: { merchants: true } } },
  });

  if (!profile) {
    throw new AppError(404, 'Commission profile not found', 'PROFILE_NOT_FOUND');
  }

  return profile;
}

export async function deleteProfile(id: string) {
  const profile = await prisma.commissionProfile.findUnique({
    where: { id },
    include: { _count: { select: { merchants: true } } },
  });

  if (!profile) {
    throw new AppError(404, 'Commission profile not found', 'PROFILE_NOT_FOUND');
  }

  if (profile._count.merchants > 0) {
    throw new AppError(
      409,
      `Cannot delete profile with ${profile._count.merchants} assigned merchant(s). Reassign them first.`,
      'PROFILE_HAS_MERCHANTS',
    );
  }

  return prisma.commissionProfile.update({
    where: { id },
    data: { is_active: false },
  });
}

export async function assignProfileToMerchant(merchantId: string, profileId: string | null) {
  const merchant = await prisma.merchant.findUnique({ where: { id: merchantId } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (profileId) {
    const profile = await prisma.commissionProfile.findUnique({ where: { id: profileId } });
    if (!profile) {
      throw new AppError(404, 'Commission profile not found', 'PROFILE_NOT_FOUND');
    }
    if (!profile.is_active) {
      throw new AppError(409, 'Cannot assign inactive profile', 'PROFILE_INACTIVE');
    }
  }

  return prisma.merchant.update({
    where: { id: merchantId },
    data: { commission_profile_id: profileId },
  });
}

// ── Dashboard ──

export async function getCommissionDashboard(filters: DashboardFilters, merchantIdScope?: string) {
  const where: Prisma.TransactionWhereInput = {
    status: 'ACREDITADO',
    platform_commission: { not: null },
  };

  if (merchantIdScope) {
    where.merchant_id = merchantIdScope;
  } else if (filters.merchant_id) {
    where.merchant_id = filters.merchant_id;
  }

  if (filters.direction) {
    where.direction = filters.direction;
  }

  if (filters.mcc) {
    where.mcc = filters.mcc;
  }

  if (filters.date_from || filters.date_to) {
    where.completed_at = {};
    if (filters.date_from) where.completed_at.gte = filters.date_from;
    if (filters.date_to) where.completed_at.lte = filters.date_to;
  }

  // Totals
  const agg = await prisma.transaction.aggregate({
    where,
    _sum: { amount: true, platform_commission: true, merchant_net_amount: true },
    _avg: { platform_commission: true },
    _count: true,
  });

  const totalGross = Number(agg._sum.amount ?? 0);
  const totalCommissions = Number(agg._sum.platform_commission ?? 0);
  const totalMerchantNet = Number(agg._sum.merchant_net_amount ?? 0);
  const txCount = agg._count;
  const avgRate = totalGross > 0 ? Number(((totalCommissions / totalGross) * 100).toFixed(3)) : 0;

  // By merchant
  const byMerchant = await prisma.transaction.groupBy({
    by: ['merchant_id'],
    where,
    _sum: { amount: true, platform_commission: true },
    _avg: { platform_commission: true },
    _count: true,
    orderBy: { _sum: { platform_commission: 'desc' } },
    take: 50,
  });

  // Get merchant names
  const merchantIds = byMerchant.map((m) => m.merchant_id).filter(Boolean) as string[];
  const merchants = merchantIds.length > 0
    ? await prisma.merchant.findMany({
        where: { id: { in: merchantIds } },
        select: { id: true, business_name: true },
      })
    : [];
  const merchantMap = new Map(merchants.map((m) => [m.id, m.business_name]));

  const byMerchantResult = byMerchant.map((m) => ({
    merchant_id: m.merchant_id,
    merchant_name: merchantMap.get(m.merchant_id ?? '') ?? 'Unknown',
    gross: Number(m._sum.amount ?? 0),
    commission: Number(m._sum.platform_commission ?? 0),
    avg_rate: Number(m._sum.amount ?? 0) > 0
      ? Number(((Number(m._sum.platform_commission ?? 0) / Number(m._sum.amount ?? 0)) * 100).toFixed(3))
      : 0,
    tx_count: m._count,
  }));

  // By MCC
  const byMcc = await prisma.transaction.groupBy({
    by: ['mcc'],
    where,
    _sum: { amount: true, platform_commission: true },
    _count: true,
    orderBy: { _sum: { platform_commission: 'desc' } },
  });

  const byMccResult = byMcc.map((m) => ({
    mcc: m.mcc ?? 'N/A',
    gross: Number(m._sum.amount ?? 0),
    commission: Number(m._sum.platform_commission ?? 0),
    avg_rate: Number(m._sum.amount ?? 0) > 0
      ? Number(((Number(m._sum.platform_commission ?? 0) / Number(m._sum.amount ?? 0)) * 100).toFixed(3))
      : 0,
    tx_count: m._count,
  }));

  // Daily evolution via raw SQL
  const granularity = filters.granularity ?? 'day';
  const truncUnit = granularity === 'week' ? 'week' : granularity === 'month' ? 'month' : 'day';

  const dateConditions: string[] = ['platform_commission IS NOT NULL', "status = 'ACREDITADO'"];
  const params: unknown[] = [];
  let paramIdx = 1;

  if (merchantIdScope) {
    dateConditions.push(`merchant_id = $${paramIdx++}`);
    params.push(merchantIdScope);
  } else if (filters.merchant_id) {
    dateConditions.push(`merchant_id = $${paramIdx++}`);
    params.push(filters.merchant_id);
  }

  if (filters.direction) {
    dateConditions.push(`direction = $${paramIdx++}`);
    params.push(filters.direction);
  }

  if (filters.mcc) {
    dateConditions.push(`mcc = $${paramIdx++}`);
    params.push(filters.mcc);
  }

  if (filters.date_from) {
    dateConditions.push(`completed_at >= $${paramIdx++}`);
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    dateConditions.push(`completed_at <= $${paramIdx++}`);
    params.push(filters.date_to);
  }

  const whereClause = dateConditions.join(' AND ');

  const dailyEvolution = await prisma.$queryRawUnsafe<
    Array<{ period: Date; gross: number; commission: number; tx_count: bigint }>
  >(
    `SELECT
      date_trunc('${truncUnit}', completed_at) as period,
      SUM(amount)::numeric as gross,
      SUM(platform_commission)::numeric as commission,
      COUNT(*)::bigint as tx_count
    FROM "Transaction"
    WHERE ${whereClause}
    GROUP BY period
    ORDER BY period ASC`,
    ...params,
  );

  const dailyEvolutionResult = dailyEvolution.map((d) => ({
    period: d.period.toISOString(),
    gross: Number(d.gross),
    commission: Number(d.commission),
    tx_count: Number(d.tx_count),
  }));

  return {
    totals: {
      total_commissions: totalCommissions,
      total_gross: totalGross,
      total_merchant_net: totalMerchantNet,
      avg_rate: avgRate,
      tx_count: txCount,
    },
    by_merchant: byMerchantResult,
    by_mcc: byMccResult,
    daily_evolution: dailyEvolutionResult,
  };
}
