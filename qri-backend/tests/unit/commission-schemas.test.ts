import { describe, it, expect } from 'vitest';
import {
  profileRateSchema,
  createProfileSchema,
  assignProfileSchema,
  dashboardFiltersSchema,
} from '../../src/modules/commissions/commissions.schemas.js';

describe('profileRateSchema', () => {
  it('accepts valid rate', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: 0.6,
      direction: 'BOTH',
    });
    expect(result.success).toBe(true);
  });

  it('rejects MCC with less than 4 digits', () => {
    const result = profileRateSchema.safeParse({
      mcc: '541',
      rate: 0.6,
      direction: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('rejects MCC with more than 4 digits', () => {
    const result = profileRateSchema.safeParse({
      mcc: '54111',
      rate: 0.6,
      direction: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('rejects MCC with non-digits', () => {
    const result = profileRateSchema.safeParse({
      mcc: '54AB',
      rate: 0.6,
      direction: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rate below 0', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: -1,
      direction: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('rejects rate above 100', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: 101,
      direction: 'BOTH',
    });
    expect(result.success).toBe(false);
  });

  it('accepts rate of exactly 0', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: 0,
      direction: 'INBOUND',
    });
    expect(result.success).toBe(true);
  });

  it('accepts rate of exactly 100', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: 100,
      direction: 'OUTBOUND',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid direction', () => {
    const result = profileRateSchema.safeParse({
      mcc: '5411',
      rate: 0.6,
      direction: 'INVALID',
    });
    expect(result.success).toBe(false);
  });

  it('accepts all valid directions', () => {
    for (const direction of ['INBOUND', 'OUTBOUND', 'BOTH']) {
      const result = profileRateSchema.safeParse({
        mcc: '5411',
        rate: 0.6,
        direction,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('createProfileSchema', () => {
  it('accepts valid profile', () => {
    const result = createProfileSchema.safeParse({
      name: 'Plan Estandar',
      default_rate: 1.5,
      rates: [{ mcc: '5411', rate: 0.6, direction: 'BOTH' }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.is_default).toBe(false); // default value
    }
  });

  it('rejects missing name', () => {
    const result = createProfileSchema.safeParse({
      default_rate: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty name', () => {
    const result = createProfileSchema.safeParse({
      name: '',
      default_rate: 1.5,
    });
    expect(result.success).toBe(false);
  });

  it('defaults rates to empty array', () => {
    const result = createProfileSchema.safeParse({
      name: 'Test',
      default_rate: 1.5,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rates).toEqual([]);
    }
  });

  it('rejects invalid rates', () => {
    const result = createProfileSchema.safeParse({
      name: 'Test',
      default_rate: 1.5,
      rates: [{ mcc: 'XX', rate: -1, direction: 'WRONG' }],
    });
    expect(result.success).toBe(false);
  });
});

describe('assignProfileSchema', () => {
  it('accepts valid uuid for merchant and profile', () => {
    const result = assignProfileSchema.safeParse({
      merchant_id: '123e4567-e89b-12d3-a456-426614174000',
      profile_id: '123e4567-e89b-12d3-a456-426614174001',
    });
    expect(result.success).toBe(true);
  });

  it('accepts null profile_id (unassign)', () => {
    const result = assignProfileSchema.safeParse({
      merchant_id: '123e4567-e89b-12d3-a456-426614174000',
      profile_id: null,
    });
    expect(result.success).toBe(true);
  });

  it('rejects non-uuid merchant_id', () => {
    const result = assignProfileSchema.safeParse({
      merchant_id: 'not-a-uuid',
      profile_id: null,
    });
    expect(result.success).toBe(false);
  });
});

describe('dashboardFiltersSchema', () => {
  it('defaults granularity to day', () => {
    const result = dashboardFiltersSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.granularity).toBe('day');
    }
  });

  it('accepts all valid granularities', () => {
    for (const g of ['day', 'week', 'month']) {
      const result = dashboardFiltersSchema.safeParse({ granularity: g });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid granularity', () => {
    const result = dashboardFiltersSchema.safeParse({ granularity: 'year' });
    expect(result.success).toBe(false);
  });

  it('accepts valid MCC filter', () => {
    const result = dashboardFiltersSchema.safeParse({ mcc: '5411' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid MCC filter', () => {
    const result = dashboardFiltersSchema.safeParse({ mcc: 'abc' });
    expect(result.success).toBe(false);
  });
});
