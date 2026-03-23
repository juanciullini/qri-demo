import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getMerchants,
  getMerchant,
  createMerchant,
  updateMerchant,
  deleteMerchant,
  activateMerchant,
  suspendMerchant,
  getMerchantStats,
} from '@/services/merchants.service'

vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))

import api from '@/services/api'

const mockedApi = vi.mocked(api)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Mapper tests (via API call round-trips) ──

describe('getMerchants', () => {
  it('maps paginated response with snake_case fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'm1',
            business_name: 'Tienda Test',
            cuit: '20345678901',
            cbu: '1234567890123456789012',
            mcc_codes: [{ mcc: '5411' }],
            status: 'ACTIVE',
            contact_email: 'test@test.com',
            phone: '1155554444',
            address: 'Av. Corrientes 1234',
            created_at: '2025-01-01T00:00:00Z',
            updated_at: '2025-01-02T00:00:00Z',
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getMerchants({ page: 1, limit: 10 })

    expect(mockedApi.get).toHaveBeenCalledWith('/merchants', {
      params: { page: 1, limit: 10 },
    })
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toEqual({
      id: 'm1',
      name: 'Tienda Test',
      cuit: '20345678901',
      cbu: '1234567890123456789012',
      mcc: '5411',
      status: 'ACTIVE',
      email: 'test@test.com',
      phone: '1155554444',
      address: 'Av. Corrientes 1234',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-02T00:00:00Z',
    })
    expect(result.total).toBe(1)
    expect(result.page).toBe(1)
    expect(result.totalPages).toBe(1)
  })

  it('handles camelCase fallback fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          {
            id: 'm2',
            name: 'Kiosco',
            cuit: '20111111111',
            cbu: '0000000000000000000000',
            mcc: '5999',
            status: 'PENDING',
            email: 'kiosco@test.com',
            createdAt: '2025-01-01T00:00:00Z',
            updatedAt: '2025-01-01T00:00:00Z',
          },
        ],
        pagination: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    })

    const result = await getMerchants()

    expect(result.data[0].name).toBe('Kiosco')
    expect(result.data[0].mcc).toBe('5999')
    expect(result.data[0].email).toBe('kiosco@test.com')
    expect(result.totalPages).toBe(1)
  })

  it('uses _id fallback for id', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ _id: 'mongo-id', business_name: 'Test' }],
        pagination: { total: 1, page: 1, limit: 10, total_pages: 1 },
      },
    })

    const result = await getMerchants()
    expect(result.data[0].id).toBe('mongo-id')
  })

  it('falls back to merchants array when data is missing', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        merchants: [{ id: 'm3', business_name: 'Fallback' }],
        total: 1,
        page: 1,
        limit: 10,
        total_pages: 1,
      },
    })

    const result = await getMerchants()
    expect(result.data[0].id).toBe('m3')
  })
})

describe('getMerchant', () => {
  it('maps a single merchant with data wrapper', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          id: 'm1',
          business_name: 'Solo',
          cuit: '20345678901',
          cbu: '123',
          mcc_codes: [{ mcc: '5411' }],
          status: 'ACTIVE',
          contact_email: 'solo@test.com',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      },
    })

    const result = await getMerchant('m1')
    expect(mockedApi.get).toHaveBeenCalledWith('/merchants/m1')
    expect(result.name).toBe('Solo')
    expect(result.email).toBe('solo@test.com')
  })

  it('handles response without data wrapper', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        id: 'm1',
        business_name: 'NoWrapper',
        cuit: '20345678901',
        cbu: '123',
        status: 'ACTIVE',
        contact_email: 'nw@test.com',
        created_at: '2025-01-01T00:00:00Z',
        updated_at: '2025-01-01T00:00:00Z',
      },
    })

    const result = await getMerchant('m1')
    expect(result.name).toBe('NoWrapper')
  })
})

describe('createMerchant', () => {
  it('maps request payload to API format and returns mapped result', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        data: {
          id: 'm-new',
          business_name: 'Nuevo',
          cuit: '20345678901',
          cbu: '123',
          mcc_codes: [{ mcc: '5411' }],
          status: 'PENDING',
          contact_email: 'nuevo@test.com',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      },
    })

    const result = await createMerchant({
      name: 'Nuevo',
      cuit: '20345678901',
      cbu: '123',
      mcc: '5411',
      email: 'nuevo@test.com',
    })

    expect(mockedApi.post).toHaveBeenCalledWith('/merchants', {
      business_name: 'Nuevo',
      cuit: '20345678901',
      cbu: '123',
      mcc_codes: [{ mcc: '5411' }],
      contact_email: 'nuevo@test.com',
    })
    expect(result.id).toBe('m-new')
    expect(result.name).toBe('Nuevo')
  })
})

describe('updateMerchant', () => {
  it('only sends defined fields', async () => {
    mockedApi.patch.mockResolvedValue({
      data: {
        data: {
          id: 'm1',
          business_name: 'Updated',
          cuit: '20345678901',
          cbu: '123',
          status: 'ACTIVE',
          contact_email: 'up@test.com',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-02T00:00:00Z',
        },
      },
    })

    const result = await updateMerchant('m1', { name: 'Updated' })

    expect(mockedApi.patch).toHaveBeenCalledWith('/merchants/m1', {
      business_name: 'Updated',
    })
    expect(result.name).toBe('Updated')
  })

  it('maps phone and address fields', async () => {
    mockedApi.patch.mockResolvedValue({
      data: { data: { id: 'm1', business_name: 'X', status: 'ACTIVE' } },
    })

    await updateMerchant('m1', { phone: '1155551234', address: 'Calle 123' })

    expect(mockedApi.patch).toHaveBeenCalledWith('/merchants/m1', {
      phone: '1155551234',
      address: 'Calle 123',
    })
  })
})

describe('deleteMerchant', () => {
  it('calls delete endpoint', async () => {
    mockedApi.delete.mockResolvedValue({ data: {} })

    await deleteMerchant('m1')
    expect(mockedApi.delete).toHaveBeenCalledWith('/merchants/m1')
  })
})

describe('activateMerchant', () => {
  it('calls activate endpoint and returns mapped merchant', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        data: {
          id: 'm1',
          business_name: 'Activated',
          status: 'ACTIVE',
          cuit: '20345678901',
          cbu: '123',
          contact_email: 'a@test.com',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      },
    })

    const result = await activateMerchant('m1')
    expect(mockedApi.post).toHaveBeenCalledWith('/merchants/m1/activate')
    expect(result.status).toBe('ACTIVE')
  })
})

describe('suspendMerchant', () => {
  it('calls suspend endpoint and returns mapped merchant', async () => {
    mockedApi.post.mockResolvedValue({
      data: {
        data: {
          id: 'm1',
          business_name: 'Suspended',
          status: 'SUSPENDED',
          cuit: '20345678901',
          cbu: '123',
          contact_email: 's@test.com',
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
        },
      },
    })

    const result = await suspendMerchant('m1')
    expect(mockedApi.post).toHaveBeenCalledWith('/merchants/m1/suspend')
    expect(result.status).toBe('SUSPENDED')
  })
})

describe('getMerchantStats', () => {
  it('maps stats with snake_case fields', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          total_transactions: 150,
          total_amount: 75000,
          average_ticket: 500,
          active_qr_codes: 3,
          period: '2025-01',
        },
      },
    })

    const result = await getMerchantStats('m1')
    expect(mockedApi.get).toHaveBeenCalledWith('/merchants/m1/stats')
    expect(result).toEqual({
      totalTransactions: 150,
      totalAmount: 75000,
      averageTicket: 500,
      activeQrCodes: 3,
      period: '2025-01',
    })
  })

  it('handles camelCase fallbacks', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: {
          totalTransactions: 10,
          totalAmount: 5000,
          averageTicket: 500,
          activeQrCodes: 1,
          period: '2025-02',
        },
      },
    })

    const result = await getMerchantStats('m1')
    expect(result.totalTransactions).toBe(10)
    expect(result.activeQrCodes).toBe(1)
  })

  it('defaults to zero for missing fields', async () => {
    mockedApi.get.mockResolvedValue({ data: { data: {} } })

    const result = await getMerchantStats('m1')
    expect(result.totalTransactions).toBe(0)
    expect(result.totalAmount).toBe(0)
    expect(result.averageTicket).toBe(0)
    expect(result.activeQrCodes).toBe(0)
    expect(result.period).toBe('')
  })
})
