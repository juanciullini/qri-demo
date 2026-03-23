import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getTransactions,
  getTransaction,
  getTransactionStats,
  requestRefund,
  exportTransactions,
} from '@/services/transactions.service'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '@/services/api'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── mapTransaction ──

describe('getTransactions', () => {
  it('maps paginated response with snake_case fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 't1',
            direction: 'INBOUND',
            merchant_id: 'm1',
            merchant: { business_name: 'Tienda', _id: 'm1' },
            qr_id: 'qr1',
            amount: 1500.5,
            currency: 'ARS',
            status: 'ACREDITADO',
            qr_id_trx: 'trx-001',
            buyer_cuit: '20345678901',
            buyer_name: 'Juan Perez',
            mcc: '5411',
            coelsa_ref: 'REF-123',
            external_merchant_cuit: '30111111111',
            external_merchant_name: 'Externo SA',
            external_merchant_cbu: '0000000000000000000001',
            refunded_at: null,
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getTransactions({ page: 1, limit: 10 })

    expect(mockedApi.get).toHaveBeenCalledWith('/transactions', {
      params: { page: 1, limit: 10 },
    })
    expect(result.data).toHaveLength(1)
    const tx = result.data[0]
    expect(tx.id).toBe('t1')
    expect(tx.direction).toBe('INBOUND')
    expect(tx.merchantId).toBe('m1')
    expect(tx.merchantName).toBe('Tienda')
    expect(tx.qrId).toBe('qr1')
    expect(tx.amount).toBe(1500.5)
    expect(tx.status).toBe('ACREDITADO')
    expect(tx.qrIdTrx).toBe('trx-001')
    expect(tx.payerCuit).toBe('20345678901')
    expect(tx.payerName).toBe('Juan Perez')
    expect(tx.coelsaRef).toBe('REF-123')
    expect(tx.externalMerchantCuit).toBe('30111111111')
    expect(tx.externalMerchantName).toBe('Externo SA')
    expect(tx.externalMerchantCbu).toBe('0000000000000000000001')
    expect(tx.createdAt).toBe('2025-01-01T00:00:00Z')
  })

  it('parses string amounts to numbers', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: 't2', amount: '2500.75', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getTransactions()
    expect(result.data[0].amount).toBe(2500.75)
    expect(typeof result.data[0].amount).toBe('number')
  })

  it('defaults amount to 0 when missing', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: 't3', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getTransactions()
    expect(result.data[0].amount).toBe(0)
  })

  it('uses _id fallback', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ _id: 'mongo-t1', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getTransactions()
    expect(result.data[0].id).toBe('mongo-t1')
  })

  it('falls back to transactions array', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        transactions: [{ id: 't4', status: 'CREADO' }],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
      },
    })

    const result = await getTransactions()
    expect(result.data[0].id).toBe('t4')
  })

  it('resolves merchantName from multiple fallback sources', async () => {
    // merchant_name fallback
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: 't5', merchant_name: 'FromMerchantName', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })
    let result = await getTransactions()
    expect(result.data[0].merchantName).toBe('FromMerchantName')

    // merchantName camelCase fallback
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: 't6', merchantName: 'FromCamelCase', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })
    result = await getTransactions()
    expect(result.data[0].merchantName).toBe('FromCamelCase')

    // external_merchant_name fallback
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          { id: 't7', external_merchant_name: 'FromExternal', status: 'CREADO' },
        ],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })
    result = await getTransactions()
    expect(result.data[0].merchantName).toBe('FromExternal')
  })

  it('defaults direction to INBOUND', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: 't8', status: 'CREADO' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getTransactions()
    expect(result.data[0].direction).toBe('INBOUND')
  })
})

describe('getTransaction', () => {
  it('maps a single transaction with data wrapper', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          id: 't1',
          direction: 'OUTBOUND',
          amount: 999,
          status: 'EN_CURSO',
          merchant: { business_name: 'TestMerchant' },
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      },
    })

    const result = await getTransaction('t1')
    expect(mockedApi.get).toHaveBeenCalledWith('/transactions/t1')
    expect(result.direction).toBe('OUTBOUND')
    expect(result.merchantName).toBe('TestMerchant')
  })

  it('handles response without data wrapper', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        id: 't1',
        amount: 500,
        status: 'CREADO',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    })

    const result = await getTransaction('t1')
    expect(result.amount).toBe(500)
  })
})

// ── mapTransactionStats ──

describe('getTransactionStats', () => {
  it('maps stats with snake_case fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          total_count: 100,
          total_amount: 50000,
          average_amount: 500,
          by_status: { ACREDITADO: 80, REVERSADO: 20 },
          by_day: [
            { date: '2025-01-01', count: 10, amount: 5000 },
            { date: '2025-01-02', count: 15, amount: '7500' },
          ],
        },
      },
    })

    const result = await getTransactionStats()
    expect(mockedApi.get).toHaveBeenCalledWith('/transactions/stats', {
      params: undefined,
    })
    expect(result.totalCount).toBe(100)
    expect(result.totalAmount).toBe(50000)
    expect(result.averageAmount).toBe(500)
    expect(result.byStatus).toEqual({ ACREDITADO: 80, REVERSADO: 20 })
    expect(result.byDay).toHaveLength(2)
    expect(result.byDay[0]).toEqual({
      date: '2025-01-01',
      count: 10,
      amount: 5000,
    })
    // String amount should be parsed to number
    expect(result.byDay[1].amount).toBe(7500)
    expect(typeof result.byDay[1].amount).toBe('number')
  })

  it('handles camelCase fallbacks', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          totalCount: 50,
          totalAmount: 25000,
          averageAmount: 500,
          byStatus: {},
          byDay: [],
        },
      },
    })

    const result = await getTransactionStats()
    expect(result.totalCount).toBe(50)
    expect(result.totalAmount).toBe(25000)
  })

  it('defaults to zeros and empty arrays for missing fields', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: {} } })

    const result = await getTransactionStats()
    expect(result.totalCount).toBe(0)
    expect(result.totalAmount).toBe(0)
    expect(result.averageAmount).toBe(0)
    expect(result.byStatus).toEqual({})
    expect(result.byDay).toEqual([])
  })

  it('passes filters as params', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: { totalCount: 0, totalAmount: 0, averageAmount: 0, byStatus: {}, byDay: [] } },
    })

    await getTransactionStats({ status: 'ACREDITADO', date_from: '2025-01-01' })
    expect(mockedApi.get).toHaveBeenCalledWith('/transactions/stats', {
      params: { status: 'ACREDITADO', date_from: '2025-01-01' },
    })
  })
})

// ── API calls ──

describe('requestRefund', () => {
  it('posts refund request and returns mapped transaction', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        data: {
          id: 't1',
          status: 'DEVUELTO',
          amount: 1000,
          refunded_at: '2025-01-03T00:00:00Z',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-03T00:00:00Z',
        },
      },
    })

    const result = await requestRefund('t1', { reason: 'Cliente solicitó' })
    expect(mockedApi.post).toHaveBeenCalledWith('/transactions/t1/refund', {
      reason: 'Cliente solicitó',
    })
    expect(result.status).toBe('DEVUELTO')
    expect(result.refundedAt).toBe('2025-01-03T00:00:00Z')
  })
})

describe('exportTransactions', () => {
  it('requests blob export with filters', async () => {
    const mockBlob = new Blob(['csv-data'], { type: 'text/csv' })
    mockedApi.get.mockResolvedValue({ data: mockBlob })

    const result = await exportTransactions({ status: 'ACREDITADO' })
    expect(mockedApi.get).toHaveBeenCalledWith('/transactions/export', {
      params: { status: 'ACREDITADO' },
      responseType: 'blob',
    })
    expect(result).toBeInstanceOf(Blob)
  })
})
