import bcrypt from 'bcryptjs';
import { prisma } from '../../utils/prisma.js';
import { AppError } from '../../middleware/error-handler.js';
import { logger } from '../../utils/logger.js';
import type { CreateUserInput, UpdateUserInput, UserFilters } from './user.schemas.js';

const BCRYPT_SALT_ROUNDS = 12;

// ── Create User ──

export async function createUser(input: CreateUserInput) {
  // Check for duplicate email
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    throw new AppError(409, 'A user with this email already exists', 'DUPLICATE_EMAIL');
  }

  // Verify merchant exists if merchant_id is provided
  if (input.merchant_id) {
    const merchant = await prisma.merchant.findUnique({ where: { id: input.merchant_id } });
    if (!merchant) {
      throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
    }
  }

  // Hash password
  const password_hash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password_hash,
      name: input.name,
      role: input.role,
      merchant_id: input.merchant_id ?? null,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      merchant_id: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  logger.info({ userId: user.id, email: user.email, role: user.role }, 'User created');
  return user;
}

// ── Get Users (paginated) ──

export async function getUsers(filters: UserFilters) {
  const where: Record<string, unknown> = {};

  if (filters.role) where.role = filters.role;
  if (filters.is_active !== undefined) where.is_active = filters.is_active;
  if (filters.merchant_id) where.merchant_id = filters.merchant_id;

  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: 'insensitive' } },
      { name: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const skip = (filters.page - 1) * filters.limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        merchant_id: true,
        is_active: true,
        created_at: true,
        updated_at: true,
        merchant: {
          select: { id: true, business_name: true },
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    data: users,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      total_pages: Math.ceil(total / filters.limit),
    },
  };
}

// ── Get User By ID ──

export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      merchant_id: true,
      is_active: true,
      created_at: true,
      updated_at: true,
      merchant: {
        select: { id: true, business_name: true, cuit: true },
      },
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  return user;
}

// ── Update User ──

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  // Check email uniqueness if changing
  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) {
      throw new AppError(409, 'A user with this email already exists', 'DUPLICATE_EMAIL');
    }
  }

  // Verify merchant exists if merchant_id is provided
  if (input.merchant_id) {
    const merchant = await prisma.merchant.findUnique({ where: { id: input.merchant_id } });
    if (!merchant) {
      throw new AppError(404, 'Merchant not found', 'MERCHANT_NOT_FOUND');
    }
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (input.email !== undefined) updateData.email = input.email;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.role !== undefined) updateData.role = input.role;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;
  if (input.merchant_id !== undefined) updateData.merchant_id = input.merchant_id;

  // Hash new password if provided
  if (input.password) {
    updateData.password_hash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      merchant_id: true,
      is_active: true,
      created_at: true,
      updated_at: true,
    },
  });

  logger.info({ userId: id }, 'User updated');
  return updated;
}

// ── Delete User (soft delete: deactivate) ──

export async function deleteUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    throw new AppError(404, 'User not found', 'USER_NOT_FOUND');
  }

  if (!user.is_active) {
    throw new AppError(400, 'User is already deactivated', 'ALREADY_DEACTIVATED');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { is_active: false },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      is_active: true,
      updated_at: true,
    },
  });

  logger.info({ userId: id }, 'User deactivated');
  return updated;
}
