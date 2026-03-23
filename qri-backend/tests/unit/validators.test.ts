import { isValidCuit, isValidCbu, isValidMcc, isValidAmount } from '../../src/utils/validators.js';

describe('isValidCuit', () => {
  it('should return true for known valid CUIT 20345678906', () => {
    expect(isValidCuit('20345678906')).toBe(true);
  });

  it('should return true for known valid CUIT 30709900044', () => {
    expect(isValidCuit('30709900044')).toBe(true);
  });

  it('should return true for known valid CUIT 27123456780', () => {
    expect(isValidCuit('27123456780')).toBe(true);
  });

  it('should return false for a CUIT with wrong check digit', () => {
    // 20345678901 has the wrong check digit (should be 9)
    expect(isValidCuit('20345678901')).toBe(false);
  });

  it('should return false for a CUIT that is too short', () => {
    expect(isValidCuit('2034567890')).toBe(false);
  });

  it('should return false for a CUIT that is too long', () => {
    expect(isValidCuit('203456789090')).toBe(false);
  });

  it('should return false for non-numeric input', () => {
    expect(isValidCuit('2034567890a')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidCuit('')).toBe(false);
  });

  it('should return false for a CUIT with spaces', () => {
    expect(isValidCuit('20 34567890')).toBe(false);
  });

  it('should return false for a CUIT with dashes', () => {
    expect(isValidCuit('20-34567890-9')).toBe(false);
  });
});

describe('isValidCbu', () => {
  it('should return true for a valid 22-digit CBU', () => {
    expect(isValidCbu('0000000000000000000000')).toBe(true);
  });

  it('should return true for another valid 22-digit CBU', () => {
    expect(isValidCbu('1234567890123456789012')).toBe(true);
  });

  it('should return false for a CBU with 21 digits', () => {
    expect(isValidCbu('000000000000000000000')).toBe(false);
  });

  it('should return false for a CBU with 23 digits', () => {
    expect(isValidCbu('00000000000000000000000')).toBe(false);
  });

  it('should return false for non-numeric input', () => {
    expect(isValidCbu('00000000000000000000ab')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidCbu('')).toBe(false);
  });

  it('should return false for a CBU with spaces', () => {
    expect(isValidCbu('00000000000 0000000000')).toBe(false);
  });
});

describe('isValidMcc', () => {
  it('should return true for a valid 4-digit MCC 5411', () => {
    expect(isValidMcc('5411')).toBe(true);
  });

  it('should return true for MCC 0000', () => {
    expect(isValidMcc('0000')).toBe(true);
  });

  it('should return true for MCC 9999', () => {
    expect(isValidMcc('9999')).toBe(true);
  });

  it('should return false for a 3-digit string', () => {
    expect(isValidMcc('541')).toBe(false);
  });

  it('should return false for a 5-digit string', () => {
    expect(isValidMcc('54111')).toBe(false);
  });

  it('should return false for letters', () => {
    expect(isValidMcc('abcd')).toBe(false);
  });

  it('should return false for an empty string', () => {
    expect(isValidMcc('')).toBe(false);
  });

  it('should return false for mixed alphanumeric input', () => {
    expect(isValidMcc('54a1')).toBe(false);
  });
});

describe('isValidAmount', () => {
  it('should return true for amount 1', () => {
    expect(isValidAmount(1)).toBe(true);
  });

  it('should return true for the maximum amount 999999999.99', () => {
    expect(isValidAmount(999999999.99)).toBe(true);
  });

  it('should return true for a small positive amount 0.01', () => {
    expect(isValidAmount(0.01)).toBe(true);
  });

  it('should return true for a typical amount', () => {
    expect(isValidAmount(1500.50)).toBe(true);
  });

  it('should return false for zero', () => {
    expect(isValidAmount(0)).toBe(false);
  });

  it('should return false for a negative amount', () => {
    expect(isValidAmount(-1)).toBe(false);
  });

  it('should return false for an amount exceeding the maximum', () => {
    expect(isValidAmount(1000000000)).toBe(false);
  });

  it('should return false for a large negative amount', () => {
    expect(isValidAmount(-999999999.99)).toBe(false);
  });
});
