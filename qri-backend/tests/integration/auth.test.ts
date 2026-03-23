import { vi, describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';

// ── Mock modules (must be hoisted before any import that uses them) ──

vi.mock('../../src/utils/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../src/utils/redis.js', () => ({
  redis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test-jwt-secret-key-for-testing-only',
    JWT_REFRESH_SECRET: 'test-refresh-secret-key-for-testing-only',
  },
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

// ── Import service AFTER mocks are declared ──

import { login, getMe } from '../../src/modules/auth/auth.service.js';
import { prisma } from '../../src/utils/prisma.js';
import { AppError } from '../../src/middleware/error-handler.js';

// ── Test data ──

const PLAIN_PASSWORD = 'Admin2026$';
const PASSWORD_HASH = bcrypt.hashSync(PLAIN_PASSWORD, 10);

function mockUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'admin@qri.app',
    password_hash: PASSWORD_HASH,
    name: 'Admin',
    role: 'ADMIN',
    is_active: true,
    merchant_id: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

// ── Tests ──

describe('Auth Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────
  // login
  // ────────────────────────────────────────────────

  describe('login', () => {
    it('should return tokens and user on valid credentials', async () => {
      const user = mockUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

      const result = await login({ email: 'admin@qri.app', password: PLAIN_PASSWORD });

      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('user');
      expect(typeof result.access_token).toBe('string');
      expect(typeof result.refresh_token).toBe('string');
      expect(result.access_token.split('.')).toHaveLength(3); // valid JWT structure
      expect(result.refresh_token.split('.')).toHaveLength(3);
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'admin@qri.app',
        name: 'Admin',
        role: 'ADMIN',
      });
    });

    it('should throw AppError 401 when email does not exist', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(login({ email: 'nonexistent@qri.app', password: PLAIN_PASSWORD }))
        .rejects
        .toThrow(AppError);

      try {
        await login({ email: 'nonexistent@qri.app', password: PLAIN_PASSWORD });
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(401);
        expect((err as AppError).code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw AppError 401 when password is incorrect', async () => {
      const user = mockUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

      await expect(login({ email: 'admin@qri.app', password: 'WrongPassword99!' }))
        .rejects
        .toThrow(AppError);

      try {
        await login({ email: 'admin@qri.app', password: 'WrongPassword99!' });
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(401);
        expect((err as AppError).code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should throw AppError 401 when user is inactive', async () => {
      // NOTE: The auth service checks `!user || !user.is_active` together and throws 401
      // (not 403 as one might expect). This matches the actual implementation.
      const user = mockUser({ is_active: false });
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

      await expect(login({ email: 'admin@qri.app', password: PLAIN_PASSWORD }))
        .rejects
        .toThrow(AppError);

      try {
        await login({ email: 'admin@qri.app', password: PLAIN_PASSWORD });
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(401);
        expect((err as AppError).code).toBe('INVALID_CREDENTIALS');
      }
    });

    it('should store the refresh token in Redis after successful login', async () => {
      const { redis } = await import('../../src/utils/redis.js');
      const user = mockUser();
      vi.mocked(prisma.user.findUnique).mockResolvedValue(user as never);

      const result = await login({ email: 'admin@qri.app', password: PLAIN_PASSWORD });

      expect(redis.set).toHaveBeenCalledWith(
        `refresh:user-1:${result.refresh_token}`,
        '1',
        'EX',
        7 * 24 * 60 * 60,
      );
    });
  });

  // ────────────────────────────────────────────────
  // getMe
  // ────────────────────────────────────────────────

  describe('getMe', () => {
    it('should return user data for a valid userId', async () => {
      const selectedFields = {
        id: 'user-1',
        email: 'admin@qri.app',
        name: 'Admin',
        role: 'ADMIN',
        merchant_id: null,
        is_active: true,
        created_at: new Date('2026-01-01T00:00:00Z'),
      };
      vi.mocked(prisma.user.findUnique).mockResolvedValue(selectedFields as never);

      const result = await getMe('user-1');

      expect(result).toEqual(selectedFields);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          merchant_id: true,
          is_active: true,
          created_at: true,
        },
      });
    });

    it('should throw AppError 404 when user is not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);

      await expect(getMe('nonexistent-user'))
        .rejects
        .toThrow(AppError);

      try {
        await getMe('nonexistent-user');
      } catch (err) {
        expect(err).toBeInstanceOf(AppError);
        expect((err as AppError).statusCode).toBe(404);
        expect((err as AppError).code).toBe('NOT_FOUND');
      }
    });
  });
});
