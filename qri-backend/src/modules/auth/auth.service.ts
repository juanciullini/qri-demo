import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { env } from '../../config/env.js';
import { prisma } from '../../utils/prisma.js';
import { redis } from '../../utils/redis.js';
import { AppError } from '../../middleware/error-handler.js';
import type { JwtPayload } from '../../middleware/auth.middleware.js';
import type { LoginInput } from './auth.schemas.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60; // 7 days in seconds

function generateTokens(payload: JwtPayload): { access_token: string; refresh_token: string } {
  const access_token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
  const refresh_token = jwt.sign({ userId: payload.userId, type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });
  return { access_token, refresh_token };
}

export async function login(input: LoginInput): Promise<{ access_token: string; refresh_token: string; user: object }> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user || !user.is_active) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const valid = await bcrypt.compare(input.password, user.password_hash);
  if (!valid) {
    throw new AppError(401, 'Invalid credentials', 'INVALID_CREDENTIALS');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    merchantId: user.merchant_id ?? undefined,
  };

  const tokens = generateTokens(payload);

  // Store refresh token in Redis
  await redis.set(`refresh:${user.id}:${tokens.refresh_token}`, '1', 'EX', REFRESH_TOKEN_TTL);

  return {
    ...tokens,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export async function refresh(refreshToken: string): Promise<{ access_token: string; refresh_token: string }> {
  let decoded: { userId: string; type: string };
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as typeof decoded;
  } catch {
    throw new AppError(401, 'Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (decoded.type !== 'refresh') {
    throw new AppError(401, 'Invalid token type', 'INVALID_REFRESH_TOKEN');
  }

  // Check if refresh token exists in Redis
  const exists = await redis.get(`refresh:${decoded.userId}:${refreshToken}`);
  if (!exists) {
    throw new AppError(401, 'Refresh token revoked', 'TOKEN_REVOKED');
  }

  const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
  if (!user || !user.is_active) {
    throw new AppError(401, 'User not found or inactive', 'USER_INACTIVE');
  }

  // Rotate: delete old, create new
  await redis.del(`refresh:${decoded.userId}:${refreshToken}`);

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    merchantId: user.merchant_id ?? undefined,
  };

  const tokens = generateTokens(payload);
  await redis.set(`refresh:${user.id}:${tokens.refresh_token}`, '1', 'EX', REFRESH_TOKEN_TTL);

  return tokens;
}

export async function logout(userId: string, refreshToken: string): Promise<void> {
  await redis.del(`refresh:${userId}:${refreshToken}`);
}

export async function getMe(userId: string): Promise<object> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, merchant_id: true, is_active: true, created_at: true },
  });
  if (!user) {
    throw new AppError(404, 'User not found', 'NOT_FOUND');
  }
  return user;
}
