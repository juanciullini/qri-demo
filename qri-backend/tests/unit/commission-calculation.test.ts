import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const mockFindUnique = vi.fn();
vi.mock('../../src/utils/prisma.js', () => ({
  prisma: {
    merchant: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

// Mock logger
vi.mock('../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocking
const { calculateCommission } = await import('../../src/modules/commissions/commissions.service.js');

describe('calculateCommission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero commission when merchantId is null', async () => {
    const result = await calculateCommission(1000, '5411', 'INBOUND', null);
    expect(result).toEqual({
      rate: 0,
      commission_amount: 0,
      merchant_net: 1000,
      source: 'none',
    });
  });

  it('returns zero commission when merchant not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await calculateCommission(1000, '5411', 'INBOUND', 'merchant-1');
    expect(result.source).toBe('none');
    expect(result.commission_amount).toBe(0);
  });

  it('uses profile rate matching MCC and direction INBOUND', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 1.5,
        rates: [
          { mcc: '5411', rate: 0.6, direction: 'INBOUND' },
          { mcc: '5812', rate: 0.8, direction: 'INBOUND' },
        ],
      },
      mcc_codes: [],
    });

    const result = await calculateCommission(10000, '5411', 'INBOUND', 'merchant-1');
    expect(result.rate).toBe(0.6);
    expect(result.commission_amount).toBe(60);
    expect(result.merchant_net).toBe(9940);
    expect(result.source).toBe('profile_mcc');
  });

  it('uses profile rate with direction BOTH for any direction', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 1.5,
        rates: [
          { mcc: '5411', rate: 0.6, direction: 'BOTH' },
        ],
      },
      mcc_codes: [],
    });

    const inbound = await calculateCommission(10000, '5411', 'INBOUND', 'merchant-1');
    expect(inbound.rate).toBe(0.6);
    expect(inbound.source).toBe('profile_mcc');

    const outbound = await calculateCommission(10000, '5411', 'OUTBOUND', 'merchant-1');
    expect(outbound.rate).toBe(0.6);
    expect(outbound.source).toBe('profile_mcc');
  });

  it('does NOT match INBOUND rate for OUTBOUND direction', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 1.5,
        rates: [
          { mcc: '5411', rate: 0.6, direction: 'INBOUND' },
        ],
      },
      mcc_codes: [],
    });

    const result = await calculateCommission(10000, '5411', 'OUTBOUND', 'merchant-1');
    // Should fallback to default_rate since no OUTBOUND match
    expect(result.rate).toBe(1.5);
    expect(result.source).toBe('profile_default');
  });

  it('falls back to profile default_rate when MCC not matched', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 2.0,
        rates: [
          { mcc: '5411', rate: 0.6, direction: 'BOTH' },
        ],
      },
      mcc_codes: [],
    });

    const result = await calculateCommission(5000, '9999', 'INBOUND', 'merchant-1');
    expect(result.rate).toBe(2.0);
    expect(result.commission_amount).toBe(100); // 5000 * 2%
    expect(result.merchant_net).toBe(4900);
    expect(result.source).toBe('profile_default');
  });

  it('falls back to merchant.mcc_codes when no profile', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: null,
      mcc_codes: [
        { mcc: '5411', commission: 0.8 },
        { mcc: '5812', commission: 1.2 },
      ],
    });

    const result = await calculateCommission(10000, '5411', 'INBOUND', 'merchant-1');
    expect(result.rate).toBe(0.8);
    expect(result.commission_amount).toBe(80);
    expect(result.merchant_net).toBe(9920);
    expect(result.source).toBe('merchant_mcc');
  });

  it('falls back to merchant.mcc_codes when profile is inactive', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: false,
        default_rate: 1.5,
        rates: [{ mcc: '5411', rate: 0.6, direction: 'BOTH' }],
      },
      mcc_codes: [
        { mcc: '5411', commission: 0.9 },
      ],
    });

    const result = await calculateCommission(10000, '5411', 'INBOUND', 'merchant-1');
    expect(result.rate).toBe(0.9);
    expect(result.source).toBe('merchant_mcc');
  });

  it('returns zero commission when no profile and no mcc_codes match', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: null,
      mcc_codes: [
        { mcc: '5411', commission: 0.8 },
      ],
    });

    const result = await calculateCommission(10000, '9999', 'INBOUND', 'merchant-1');
    expect(result.rate).toBe(0);
    expect(result.commission_amount).toBe(0);
    expect(result.merchant_net).toBe(10000);
    expect(result.source).toBe('none');
  });

  it('rounds commission to 2 decimal places', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 1.333,
        rates: [],
      },
      mcc_codes: [],
    });

    const result = await calculateCommission(1000, '5411', 'INBOUND', 'merchant-1');
    // 1000 * 1.333% = 13.33
    expect(result.commission_amount).toBe(13.33);
    expect(result.merchant_net).toBe(986.67);
  });

  it('handles OUTBOUND direction separately from INBOUND', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'merchant-1',
      commission_profile: {
        is_active: true,
        default_rate: 1.5,
        rates: [
          { mcc: '5411', rate: 0.6, direction: 'INBOUND' },
          { mcc: '5411', rate: 1.0, direction: 'OUTBOUND' },
        ],
      },
      mcc_codes: [],
    });

    const inbound = await calculateCommission(10000, '5411', 'INBOUND', 'merchant-1');
    expect(inbound.rate).toBe(0.6);

    const outbound = await calculateCommission(10000, '5411', 'OUTBOUND', 'merchant-1');
    expect(outbound.rate).toBe(1.0);
  });
});
