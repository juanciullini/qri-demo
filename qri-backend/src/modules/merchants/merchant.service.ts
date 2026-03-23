import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { CoelsaAdapter } from '../coelsa/coelsa.adapter.js';
import { isValidCuit, isValidCbu, isValidMcc } from '../../utils/validators.js';
import { logger } from '../../utils/logger.js';
import type { CreateMerchantInput, UpdateMerchantInput, MerchantFilters } from './merchant.schemas.js';

// ── Create Merchant ──

export async function createMerchant(input: CreateMerchantInput) {
  // Validate CUIT mod 11
  if (!isValidCuit(input.cuit)) {
    throw new AppError(400, 'Invalid CUIT: mod 11 check failed', 'INVALID_CUIT');
  }

  // Validate CBU 22 digits
  if (!isValidCbu(input.cbu)) {
    throw new AppError(400, 'Invalid CBU: must be exactly 22 digits', 'INVALID_CBU');
  }

  // Validate each MCC code
  for (const mcc of input.mcc_codes) {
    if (!isValidMcc(mcc.mcc)) {
      throw new AppError(400, `Invalid MCC code: ${mcc.mcc} must be 4 digits`, 'INVALID_MCC');
    }
  }

  // Check for duplicate CUIT
  const existing = await prisma.merchant.findUnique({ where: { cuit: input.cuit } });
  if (existing) {
    throw new AppError(409, 'A merchant with this CUIT already exists', 'DUPLICATE_CUIT');
  }

  // Create in database
  const merchant = await prisma.merchant.create({
    data: {
      business_name: input.business_name,
      cuit: input.cuit,
      cbu: input.cbu,
      cvu: input.cvu,
      banco: input.banco,
      sucursal: input.sucursal,
      terminal: input.terminal,
      address: input.address,
      postal_code: input.postal_code,
      city: input.city,
      mcc_codes: input.mcc_codes,
      contact_email: input.contact_email,
      contact_phone: input.contact_phone,
      settlement_freq: input.settlement_freq ?? 'DAILY',
      split_percentage: input.split_percentage,
      coelsa_status: 'REGISTERING',
    },
  });

  // Register with COELSA
  try {
    const coelsaResponse = await CoelsaAdapter.registerMerchant({
      comercio: {
        com_cvu: input.cvu ?? input.cbu,
        com_cuit: input.cuit,
        com_cbu: input.cbu,
        com_porcentaje: input.split_percentage ?? 0,
        com_habilitado: true,
      },
    });

    const coelsaOk = coelsaResponse.respuesta?.codigo === '0000';

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: {
        coelsa_status: coelsaOk ? 'ACTIVE' : 'PENDING',
      },
    });

    if (!coelsaOk) {
      logger.warn(
        { merchantId: merchant.id, coelsaResponse },
        'COELSA merchant registration returned non-OK response',
      );
    }
  } catch (err) {
    logger.error({ merchantId: merchant.id, err }, 'Failed to register merchant with COELSA');
    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { coelsa_status: 'PENDING' },
    });
  }

  return prisma.merchant.findUniqueOrThrow({ where: { id: merchant.id } });
}

// ── Get Merchants (paginated with filters) ──

export async function getMerchants(filters: MerchantFilters) {
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.search) {
    where.OR = [
      { business_name: { contains: filters.search, mode: 'insensitive' } },
      { cuit: { contains: filters.search } },
      { cbu: { contains: filters.search } },
      { contact_email: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [merchants, total] = await Promise.all([
    prisma.merchant.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { created_at: 'desc' },
    }),
    prisma.merchant.count({ where }),
  ]);

  return {
    data: merchants,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Get Merchant By ID ──

export async function getMerchantById(id: string) {
  const merchant = await prisma.merchant.findUnique({
    where: { id },
    include: {
      qr_codes: { take: 10, orderBy: { created_at: 'desc' } },
      users: {
        select: { id: true, email: true, name: true, role: true, is_active: true },
      },
      _count: {
        select: { transactions: true, qr_codes: true, settlements: true },
      },
    },
  });

  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  return merchant;
}

// ── Update Merchant ──

export async function updateMerchant(id: string, input: UpdateMerchantInput) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (merchant.status === 'DEACTIVATED') {
    throw new AppError(400, 'Cannot update a deactivated merchant', 'MERCHANT_DEACTIVATED');
  }

  // Validate CUIT if provided
  if (input.cuit && !isValidCuit(input.cuit)) {
    throw new AppError(400, 'Invalid CUIT: mod 11 check failed', 'INVALID_CUIT');
  }

  // Validate CBU if provided
  if (input.cbu && !isValidCbu(input.cbu)) {
    throw new AppError(400, 'Invalid CBU: must be exactly 22 digits', 'INVALID_CBU');
  }

  // Validate MCC codes if provided
  if (input.mcc_codes) {
    for (const mcc of input.mcc_codes) {
      if (!isValidMcc(mcc.mcc)) {
        throw new AppError(400, `Invalid MCC code: ${mcc.mcc} must be 4 digits`, 'INVALID_MCC');
      }
    }
  }

  // Check for CUIT uniqueness if changing
  if (input.cuit && input.cuit !== merchant.cuit) {
    const existing = await prisma.merchant.findUnique({ where: { cuit: input.cuit } });
    if (existing) {
      throw new AppError(409, 'A merchant with this CUIT already exists', 'DUPLICATE_CUIT');
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (input.business_name !== undefined) updateData.business_name = input.business_name;
  if (input.cuit !== undefined) updateData.cuit = input.cuit;
  if (input.cbu !== undefined) updateData.cbu = input.cbu;
  if (input.cvu !== undefined) updateData.cvu = input.cvu;
  if (input.banco !== undefined) updateData.banco = input.banco;
  if (input.sucursal !== undefined) updateData.sucursal = input.sucursal;
  if (input.terminal !== undefined) updateData.terminal = input.terminal;
  if (input.address !== undefined) updateData.address = input.address;
  if (input.postal_code !== undefined) updateData.postal_code = input.postal_code;
  if (input.city !== undefined) updateData.city = input.city;
  if (input.mcc_codes !== undefined) updateData.mcc_codes = input.mcc_codes;
  if (input.contact_email !== undefined) updateData.contact_email = input.contact_email;
  if (input.contact_phone !== undefined) updateData.contact_phone = input.contact_phone;
  if (input.settlement_freq !== undefined) updateData.settlement_freq = input.settlement_freq;
  if (input.split_percentage !== undefined) updateData.split_percentage = input.split_percentage;

  const updated = await prisma.merchant.update({
    where: { id },
    data: updateData,
  });

  // Notify COELSA if CBU or split_percentage changed
  const cbuChanged = input.cbu !== undefined && input.cbu !== merchant.cbu;
  const splitChanged =
    input.split_percentage !== undefined &&
    Number(input.split_percentage) !== Number(merchant.split_percentage);

  if (cbuChanged || splitChanged) {
    try {
      await CoelsaAdapter.updateMerchant(
        updated.cvu ?? updated.cbu,
        updated.cuit,
        {
          com_cbu: cbuChanged ? updated.cbu : undefined,
          com_porcentaje: splitChanged ? Number(updated.split_percentage) : undefined,
        },
      );
    } catch (err) {
      logger.error({ merchantId: id, err }, 'Failed to update merchant in COELSA');
    }
  }

  return updated;
}

// ── Delete Merchant (soft delete) ──

export async function deleteMerchant(id: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (merchant.status === 'DEACTIVATED') {
    throw new AppError(400, 'Merchant is already deactivated', 'ALREADY_DEACTIVATED');
  }

  // Soft delete in database
  const updated = await prisma.merchant.update({
    where: { id },
    data: { status: 'DEACTIVATED' },
  });

  // Notify COELSA
  try {
    await CoelsaAdapter.deleteMerchant(merchant.cvu ?? merchant.cbu, merchant.cuit);
  } catch (err) {
    logger.error({ merchantId: id, err }, 'Failed to delete merchant from COELSA');
  }

  return updated;
}

// ── Activate Merchant ──

export async function activateMerchant(id: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (merchant.status === 'ACTIVE') {
    throw new AppError(400, 'Merchant is already active', 'ALREADY_ACTIVE');
  }

  return prisma.merchant.update({
    where: { id },
    data: { status: 'ACTIVE' },
  });
}

// ── Suspend Merchant ──

export async function suspendMerchant(id: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  if (merchant.status === 'SUSPENDED') {
    throw new AppError(400, 'Merchant is already suspended', 'ALREADY_SUSPENDED');
  }

  if (merchant.status === 'DEACTIVATED') {
    throw new AppError(400, 'Cannot suspend a deactivated merchant', 'MERCHANT_DEACTIVATED');
  }

  return prisma.merchant.update({
    where: { id },
    data: { status: 'SUSPENDED' },
  });
}

// ── Get Merchant Stats ──

export async function getMerchantStats(id: string) {
  const merchant = await prisma.merchant.findUnique({ where: { id } });
  if (!merchant) {
    throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
  }

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalTransactions, todayTransactions, monthTransactions, totalVolume, todayVolume, monthVolume, statusBreakdown] =
    await Promise.all([
      // Total transactions count
      prisma.transaction.count({ where: { merchant_id: id } }),

      // Today transactions count
      prisma.transaction.count({
        where: { merchant_id: id, created_at: { gte: startOfDay } },
      }),

      // Month transactions count
      prisma.transaction.count({
        where: { merchant_id: id, created_at: { gte: startOfMonth } },
      }),

      // Total volume
      prisma.transaction.aggregate({
        where: { merchant_id: id, status: 'ACREDITADO' },
        _sum: { amount: true },
      }),

      // Today volume
      prisma.transaction.aggregate({
        where: { merchant_id: id, status: 'ACREDITADO', created_at: { gte: startOfDay } },
        _sum: { amount: true },
      }),

      // Month volume
      prisma.transaction.aggregate({
        where: { merchant_id: id, status: 'ACREDITADO', created_at: { gte: startOfMonth } },
        _sum: { amount: true },
      }),

      // Status breakdown
      prisma.transaction.groupBy({
        by: ['status'],
        where: { merchant_id: id },
        _count: { status: true },
      }),
    ]);

  return {
    merchant_id: id,
    transactions: {
      total: totalTransactions,
      today: todayTransactions,
      this_month: monthTransactions,
    },
    volume: {
      total: totalVolume._sum.amount ?? 0,
      today: todayVolume._sum.amount ?? 0,
      this_month: monthVolume._sum.amount ?? 0,
    },
    status_breakdown: statusBreakdown.map((s) => ({
      status: s.status,
      count: s._count.status,
    })),
  };
}
