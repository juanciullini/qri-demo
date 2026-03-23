import { describe, it, expect } from 'vitest'
import {
  cn,
  formatDateAR,
  formatDateShort,
  formatTimeAR,
  formatMoney,
  formatCuit,
  txStatusColor,
  merchantStatusColor,
} from '@/lib/utils'

// ── cn() ──

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isHidden = false
    expect(cn('base', isHidden && 'hidden', 'extra')).toBe('base extra')
  })

  it('merges conflicting tailwind classes (last wins)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})

// ── Date formatting ──

describe('formatDateAR', () => {
  it('formats ISO string to dd/MM/yyyy HH:mm:ss', () => {
    const result = formatDateAR('2025-03-15T14:30:45.000Z')
    // The exact output depends on the local timezone, but the format should match
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}$/)
  })

  it('accepts a Date object', () => {
    const date = new Date(2025, 2, 15, 14, 30, 45) // March 15, 2025
    const result = formatDateAR(date)
    expect(result).toBe('15/03/2025 14:30:45')
  })
})

describe('formatDateShort', () => {
  it('formats ISO string to dd/MM/yyyy', () => {
    const result = formatDateShort('2025-03-15T14:30:45.000Z')
    expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4}$/)
  })

  it('accepts a Date object', () => {
    const date = new Date(2025, 0, 1) // January 1, 2025
    const result = formatDateShort(date)
    expect(result).toBe('01/01/2025')
  })
})

describe('formatTimeAR', () => {
  it('formats ISO string to HH:mm:ss', () => {
    const result = formatTimeAR('2025-03-15T14:30:45.000Z')
    expect(result).toMatch(/^\d{2}:\d{2}:\d{2}$/)
  })

  it('accepts a Date object', () => {
    const date = new Date(2025, 0, 1, 9, 5, 3)
    const result = formatTimeAR(date)
    expect(result).toBe('09:05:03')
  })
})

// ── Money formatting ──

describe('formatMoney', () => {
  it('formats a number as ARS currency', () => {
    const result = formatMoney(1500.5)
    // Intl output varies by environment, but should contain the number
    expect(result).toContain('1.500,50')
  })

  it('defaults to ARS currency', () => {
    const result = formatMoney(100)
    expect(result).toContain('100')
  })

  it('accepts a custom currency', () => {
    const result = formatMoney(100, 'USD')
    expect(result).toContain('100')
  })

  it('formats zero', () => {
    const result = formatMoney(0)
    expect(result).toContain('0')
  })
})

// ── CUIT formatting ──

describe('formatCuit', () => {
  it('formats an 11-digit CUIT as XX-XXXXXXXX-X', () => {
    expect(formatCuit('20345678901')).toBe('20-34567890-1')
  })

  it('returns input unchanged if length is not 11', () => {
    expect(formatCuit('123')).toBe('123')
    expect(formatCuit('')).toBe('')
    expect(formatCuit('123456789012')).toBe('123456789012')
  })
})

// ── Status colors ──

describe('txStatusColor', () => {
  it('returns success classes for ACREDITADO', () => {
    expect(txStatusColor('ACREDITADO')).toContain('text-success')
  })

  it('returns error classes for REVERSADO', () => {
    expect(txStatusColor('REVERSADO')).toContain('text-error')
  })

  it('returns warning classes for DEVUELTO', () => {
    expect(txStatusColor('DEVUELTO')).toContain('text-warning')
  })

  it('returns primary classes for EN_CURSO', () => {
    expect(txStatusColor('EN_CURSO')).toContain('text-primary')
  })

  it('returns muted classes for CREADO', () => {
    expect(txStatusColor('CREADO')).toContain('text-muted-foreground')
  })

  it('returns muted classes for unknown status', () => {
    expect(txStatusColor('UNKNOWN')).toContain('text-muted-foreground')
  })
})

describe('merchantStatusColor', () => {
  it('returns success classes for ACTIVE', () => {
    expect(merchantStatusColor('ACTIVE')).toContain('text-success')
  })

  it('returns warning classes for SUSPENDED', () => {
    expect(merchantStatusColor('SUSPENDED')).toContain('text-warning')
  })

  it('returns muted classes for PENDING', () => {
    expect(merchantStatusColor('PENDING')).toContain('text-muted-foreground')
  })

  it('returns error classes for DEACTIVATED', () => {
    expect(merchantStatusColor('DEACTIVATED')).toContain('text-error')
  })

  it('returns muted classes for unknown status', () => {
    expect(merchantStatusColor('UNKNOWN')).toContain('text-muted-foreground')
  })
})
