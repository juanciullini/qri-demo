vi.mock('../../src/config/env.js', () => ({
  env: {
    PSP_REVERSE_DOMAIN: 'ar.com.qri',
    PSP_CUIT: '30709900043',
  },
}));

import { tlv, crc16ccitt, generateQRString } from '../../src/modules/qr/qr.generator.js';
import type { QRMerchantData, QRGenerationOptions } from '../../src/modules/qr/qr.generator.js';

describe('tlv', () => {
  it('should encode tag=00, value=01 as 000201', () => {
    expect(tlv('00', '01')).toBe('000201');
  });

  it('should encode tag=59, value=TestMerchant as 5912TestMerchant', () => {
    expect(tlv('59', 'TestMerchant')).toBe('5912TestMerchant');
  });

  it('should encode an empty value with length 00', () => {
    expect(tlv('54', '')).toBe('5400');
  });

  it('should pad single-digit lengths with a leading zero', () => {
    expect(tlv('58', 'AR')).toBe('5802AR');
  });

  it('should handle longer values with two-digit lengths', () => {
    const value = 'A'.repeat(25);
    expect(tlv('59', value)).toBe(`5925${'A'.repeat(25)}`);
  });

  it('should handle values with length >= 10 correctly', () => {
    const value = '1234567890'; // length 10
    expect(tlv('01', value)).toBe('01101234567890');
  });
});

describe('crc16ccitt', () => {
  it('should return 29B1 for the standard test vector "123456789"', () => {
    expect(crc16ccitt('123456789')).toBe('29B1');
  });

  it('should return FFFF for an empty string', () => {
    // CRC-16/CCITT-FALSE of empty string is the initial value 0xFFFF
    expect(crc16ccitt('')).toBe('FFFF');
  });

  it('should produce a 4-character uppercase hex string', () => {
    const result = crc16ccitt('Hello, World!');
    expect(result).toMatch(/^[0-9A-F]{4}$/);
  });

  it('should produce different CRCs for different inputs', () => {
    const crc1 = crc16ccitt('abc');
    const crc2 = crc16ccitt('def');
    expect(crc1).not.toBe(crc2);
  });

  it('should produce a deterministic result', () => {
    const result1 = crc16ccitt('test data');
    const result2 = crc16ccitt('test data');
    expect(result1).toBe(result2);
  });
});

describe('generateQRString', () => {
  const baseMerchant: QRMerchantData = {
    cbu: '0000000000000000000000',
    cuit: '20345678909',
    business_name: 'Test Merchant',
    city: 'Buenos Aires',
    postal_code: 'C1000',
    mcc_codes: [{ mcc: '5411', desc: 'Grocery Stores', commission: 1.5 }],
  };

  const staticOptions: QRGenerationOptions = {
    type: 'STATIC',
  };

  const dynamicOptions: QRGenerationOptions = {
    type: 'DYNAMIC',
    amount: 1500.50,
    reference: 'REF001',
    terminal: 'TERM01',
  };

  describe('static QR', () => {
    it('should start with payload format indicator 000201', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result.startsWith('000201')).toBe(true);
    });

    it('should include point of initiation 11 for static QR', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      // Tag 01 with value '11' => '010211'
      expect(result).toContain('010211');
    });

    it('should not include tag 54 (amount) for static QR', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      // Tag 54 should not appear between tag 53 and tag 58
      // The string should go directly from currency to country code
      expect(result).not.toMatch(/54\d{2}\d+\.\d{2}/);
    });

    it('should include country code AR', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('5802AR');
    });

    it('should include currency 032 (ARS)', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('5303032');
    });

    it('should include the merchant name', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('Test Merchant');
    });

    it('should include the MCC code 5411', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('52045411');
    });

    it('should end with tag 63 followed by a 4-character CRC', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      // Tag 63 with 4-char hex CRC: '6304' + [A-F0-9]{4}
      expect(result).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('should include the PSP reverse domain in tag 26', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('ar.com.qri');
    });

    it('should include the PSP CUIT in tag 26', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('30709900043');
    });

    it('should include the merchant CBU in tag 26', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      expect(result).toContain('0000000000000000000000');
    });
  });

  describe('dynamic QR', () => {
    it('should include point of initiation 12 for dynamic QR', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      // Tag 01 with value '12' => '010212'
      expect(result).toContain('010212');
    });

    it('should include tag 54 with the amount for dynamic QR', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toContain('1500.50');
    });

    it('should include the reference label in tag 62', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toContain('REF001');
    });

    it('should include the terminal label in tag 62', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toContain('TERM01');
    });

    it('should start with 000201', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result.startsWith('000201')).toBe(true);
    });

    it('should end with tag 63 and a valid CRC', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toMatch(/6304[0-9A-F]{4}$/);
    });

    it('should include country code AR', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toContain('5802AR');
    });

    it('should include currency 032', () => {
      const result = generateQRString(baseMerchant, dynamicOptions);
      expect(result).toContain('5303032');
    });
  });

  describe('CRC integrity', () => {
    it('should produce a valid CRC that matches a manual calculation', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      // Extract everything before the last 4 characters (the CRC value)
      const dataForCrc = result.slice(0, -4);
      const expectedCrc = crc16ccitt(dataForCrc);
      const actualCrc = result.slice(-4);
      expect(actualCrc).toBe(expectedCrc);
    });
  });

  describe('edge cases', () => {
    it('should use default MCC 0000 when mcc_codes is empty', () => {
      const merchantNoMcc: QRMerchantData = {
        ...baseMerchant,
        mcc_codes: [],
      };
      const result = generateQRString(merchantNoMcc, staticOptions);
      expect(result).toContain('52040000');
    });

    it('should truncate merchant name to 25 characters', () => {
      const longNameMerchant: QRMerchantData = {
        ...baseMerchant,
        business_name: 'A Very Long Merchant Name That Exceeds Twenty Five Characters',
      };
      const result = generateQRString(longNameMerchant, staticOptions);
      // Tag 59 should have length 25
      expect(result).toContain('5925');
    });

    it('should use "AR" as fallback when city and postal_code are null', () => {
      const noLocationMerchant: QRMerchantData = {
        ...baseMerchant,
        city: null,
        postal_code: null,
      };
      const result = generateQRString(noLocationMerchant, staticOptions);
      // Tag 60 with value 'AR' (length 2)
      expect(result).toContain('6002AR');
    });

    it('should not include tag 62 when reference and terminal are absent', () => {
      const result = generateQRString(baseMerchant, staticOptions);
      // Tag 62 should not appear
      expect(result).not.toMatch(/62\d{2}(?:05|07)/);
    });

    it('should not include amount in dynamic QR when amount is 0', () => {
      const zeroAmountOptions: QRGenerationOptions = {
        type: 'DYNAMIC',
        amount: 0,
      };
      const result = generateQRString(baseMerchant, zeroAmountOptions);
      // Should behave like static in terms of amount omission since amount is not > 0
      expect(result).not.toMatch(/54\d{2}0\.00/);
    });
  });
});
