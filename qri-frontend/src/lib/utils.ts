import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ── Date formatting (UTC → AR display) ──

export function formatDateAR(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
  return format(date, 'dd/MM/yyyy HH:mm:ss', { locale: es })
}

export function formatDateShort(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
  return format(date, 'dd/MM/yyyy', { locale: es })
}

export function formatTimeAR(isoDate: string | Date): string {
  const date = typeof isoDate === 'string' ? parseISO(isoDate) : isoDate
  return format(date, 'HH:mm:ss', { locale: es })
}

// ── Money formatting ──

export function formatMoney(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// ── CUIT formatting ──

export function formatCuit(cuit: string): string {
  if (cuit.length !== 11) return cuit
  return `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`
}

// ── Status colors ──

export function txStatusColor(status: string): string {
  switch (status) {
    case 'ACREDITADO': return 'text-success bg-green-50 border-green-200'
    case 'REVERSADO': return 'text-error bg-red-50 border-red-200'
    case 'DEVUELTO': return 'text-warning bg-amber-50 border-amber-200'
    case 'EN_CURSO': return 'text-primary bg-blue-50 border-blue-200'
    case 'CREADO': return 'text-muted-foreground bg-gray-50 border-gray-200'
    default: return 'text-muted-foreground bg-gray-50 border-gray-200'
  }
}

export function merchantStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': return 'text-success bg-green-50 border-green-200'
    case 'SUSPENDED': return 'text-warning bg-amber-50 border-amber-200'
    case 'PENDING': return 'text-muted-foreground bg-gray-50 border-gray-200'
    case 'DEACTIVATED': return 'text-error bg-red-50 border-red-200'
    default: return 'text-muted-foreground bg-gray-50 border-gray-200'
  }
}
