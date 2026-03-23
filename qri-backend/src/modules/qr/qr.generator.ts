import { env } from '../../config/env.js';

// ── TLV Parsing (inbound QR) ──

export interface TLVElement {
  tag: string;
  length: number;
  value: string;
}

export interface ParsedQRData {
  pointOfInitiation: 'STATIC' | 'DYNAMIC';
  merchantAccountInfo: {
    reverseDomain: string;
    merchantCbu: string;
    merchantCuit: string;
    pspCuit: string;
  };
  mcc: string;
  currency: string;
  amount?: number;
  merchantName: string;
  merchantCity: string;
  additionalData?: { reference?: string; terminal?: string };
  isValid: boolean;
  rawData: string;
}

/**
 * Parse a TLV-encoded string into an array of TLV elements.
 */
export function parseTLV(data: string): TLVElement[] {
  const elements: TLVElement[] = [];
  let pos = 0;

  while (pos < data.length) {
    if (pos + 4 > data.length) break;
    const tag = data.substring(pos, pos + 2);
    const length = parseInt(data.substring(pos + 2, pos + 4), 10);
    if (isNaN(length) || pos + 4 + length > data.length) break;
    const value = data.substring(pos + 4, pos + 4 + length);
    elements.push({ tag, length, value });
    pos += 4 + length;
  }

  return elements;
}

/**
 * Parse an EMVCo QR string (Argentine Transferencias 3.0 format).
 * Validates CRC-16 and extracts merchant info, amount, etc.
 */
export function parseQRString(qrString: string): ParsedQRData {
  const result: ParsedQRData = {
    pointOfInitiation: 'STATIC',
    merchantAccountInfo: { reverseDomain: '', merchantCbu: '', merchantCuit: '', pspCuit: '' },
    mcc: '',
    currency: '',
    merchantName: '',
    merchantCity: '',
    isValid: false,
    rawData: qrString,
  };

  // Validate CRC (tag 63 at the end, 4 chars for "6304" + 4 chars CRC value)
  if (qrString.length < 8) return result;
  const dataForCrc = qrString.substring(0, qrString.length - 4);
  const expectedCrc = qrString.substring(qrString.length - 4);
  const calculatedCrc = crc16ccitt(dataForCrc);
  if (calculatedCrc !== expectedCrc) return result;

  const elements = parseTLV(qrString);

  for (const el of elements) {
    switch (el.tag) {
      case '01':
        result.pointOfInitiation = el.value === '12' ? 'DYNAMIC' : 'STATIC';
        break;
      case '26': {
        const subElements = parseTLV(el.value);
        for (const sub of subElements) {
          switch (sub.tag) {
            case '00': result.merchantAccountInfo.reverseDomain = sub.value; break;
            case '01': result.merchantAccountInfo.merchantCbu = sub.value; break;
            case '02': result.merchantAccountInfo.merchantCuit = sub.value; break;
            case '03': result.merchantAccountInfo.pspCuit = sub.value; break;
          }
        }
        break;
      }
      case '52': result.mcc = el.value; break;
      case '53': result.currency = el.value; break;
      case '54': result.amount = parseFloat(el.value); break;
      case '59': result.merchantName = el.value; break;
      case '60': result.merchantCity = el.value; break;
      case '62': {
        const addData = parseTLV(el.value);
        result.additionalData = {};
        for (const sub of addData) {
          if (sub.tag === '05') result.additionalData.reference = sub.value;
          if (sub.tag === '07') result.additionalData.terminal = sub.value;
        }
        break;
      }
    }
  }

  result.isValid = true;
  return result;
}

// ── TLV Generation (outbound QR) ──

/**
 * Build a TLV (Tag-Length-Value) element for EMVCo QR.
 * Length is zero-padded to 2 digits.
 */
export function tlv(tag: string, value: string): string {
  const length = value.length.toString().padStart(2, '0');
  return `${tag}${length}${value}`;
}

/**
 * Calculate CRC-16/CCITT-FALSE checksum.
 * Polynomial: 0x1021, Initial value: 0xFFFF.
 * Returns 4-character uppercase hex string.
 */
export function crc16ccitt(data: string): string {
  let crc = 0xFFFF;

  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/**
 * Merchant data expected by the QR generator.
 */
export interface QRMerchantData {
  cbu: string;
  cuit: string;
  business_name: string;
  city?: string | null;
  postal_code?: string | null;
  mcc_codes: Array<{ mcc: string; desc: string; commission: number }>;
}

/**
 * QR generation options.
 */
export interface QRGenerationOptions {
  type: 'STATIC' | 'DYNAMIC';
  amount?: number;
  reference?: string;
  terminal?: string;
}

/**
 * Generate an EMVCo/CIMPRA compliant QR string for Argentine interoperable payments.
 *
 * Tag structure:
 * - 00: Payload Format Indicator ('01')
 * - 01: Point of Initiation ('11' = static, '12' = dynamic)
 * - 26: Merchant Account Information template
 *     - 00: PSP Reverse Domain
 *     - 01: Merchant CBU
 *     - 02: Merchant CUIT
 *     - 03: PSP CUIT
 * - 52: Merchant Category Code (first MCC)
 * - 53: Transaction Currency ('032' = ARS)
 * - 54: Transaction Amount (dynamic QR only)
 * - 58: Country Code ('AR')
 * - 59: Merchant Name (max 25 chars)
 * - 60: Merchant City / Postal Code (max 15 chars)
 * - 62: Additional Data Field template
 *     - 05: Reference Label
 *     - 07: Terminal Label
 * - 63: CRC-16 checksum
 */
export function generateQRString(merchant: QRMerchantData, options: QRGenerationOptions): string {
  let qr = '';

  // Tag 00 - Payload Format Indicator
  qr += tlv('00', '01');

  // Tag 01 - Point of Initiation Method
  qr += tlv('01', options.type === 'STATIC' ? '11' : '12');

  // Tag 26 - Merchant Account Information (template)
  const tag26Content =
    tlv('00', env.PSP_REVERSE_DOMAIN) +
    tlv('01', merchant.cbu) +
    tlv('02', merchant.cuit) +
    tlv('03', env.PSP_CUIT);
  qr += tlv('26', tag26Content);

  // Tag 52 - Merchant Category Code (use first MCC)
  const mcc = merchant.mcc_codes.length > 0 ? merchant.mcc_codes[0].mcc : '0000';
  qr += tlv('52', mcc);

  // Tag 53 - Transaction Currency (ARS = 032)
  qr += tlv('53', '032');

  // Tag 54 - Transaction Amount (only for dynamic QR)
  if (options.type === 'DYNAMIC' && options.amount !== undefined && options.amount > 0) {
    qr += tlv('54', options.amount.toFixed(2));
  }

  // Tag 58 - Country Code
  qr += tlv('58', 'AR');

  // Tag 59 - Merchant Name (max 25 characters)
  const merchantName = merchant.business_name.substring(0, 25);
  qr += tlv('59', merchantName);

  // Tag 60 - Merchant City or Postal Code (max 15 characters)
  const location = (merchant.city || merchant.postal_code || 'AR').substring(0, 15);
  qr += tlv('60', location);

  // Tag 62 - Additional Data Field Template
  let tag62Content = '';
  if (options.reference) {
    tag62Content += tlv('05', options.reference);
  }
  if (options.terminal) {
    tag62Content += tlv('07', options.terminal);
  }
  if (tag62Content.length > 0) {
    qr += tlv('62', tag62Content);
  }

  // Tag 63 - CRC-16 (append '6304' first, then calculate CRC over entire string including '6304')
  const dataForCrc = qr + '6304';
  const checksum = crc16ccitt(dataForCrc);
  qr += tlv('63', checksum);

  return qr;
}
