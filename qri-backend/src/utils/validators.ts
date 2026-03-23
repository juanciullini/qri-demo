/**
 * Validate Argentine CUIT using modulo 11 algorithm.
 */
export function isValidCuit(cuit: string): boolean {
  if (!/^\d{11}$/.test(cuit)) return false;
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  const digits = cuit.split('').map(Number);
  const checkDigit = digits[10];
  const sum = weights.reduce((acc, w, i) => acc + w * digits[i], 0);
  const mod = 11 - (sum % 11);
  const expected = mod === 11 ? 0 : mod === 10 ? 9 : mod;
  return checkDigit === expected;
}

/**
 * Validate CBU/CVU format (22 digits).
 */
export function isValidCbu(cbu: string): boolean {
  return /^\d{22}$/.test(cbu);
}

/**
 * Validate MCC (4 digit numeric string).
 */
export function isValidMcc(mcc: string): boolean {
  return /^\d{4}$/.test(mcc);
}

/**
 * Validate amount is positive.
 */
export function isValidAmount(amount: number): boolean {
  return amount > 0 && amount <= 999999999.99;
}
