import api from '@/services/api'
import type {
  CommissionProfile,
  CommissionDashboard,
  CommissionDashboardFilters,
  CreateCommissionProfileData,
  UpdateCommissionProfileData,
  PaginatedResponse,
} from '@/types'

// ── Mappers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapProfile(raw: any): CommissionProfile {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    isDefault: raw.is_default ?? false,
    defaultRate: Number(raw.default_rate ?? 0),
    rates: raw.rates ?? [],
    isActive: raw.is_active ?? true,
    merchantCount: raw._count?.merchants ?? 0,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapDashboard(raw: any): CommissionDashboard {
  return {
    totals: {
      totalCommissions: raw.totals?.total_commissions ?? 0,
      totalGross: raw.totals?.total_gross ?? 0,
      totalMerchantNet: raw.totals?.total_merchant_net ?? 0,
      avgRate: raw.totals?.avg_rate ?? 0,
      txCount: raw.totals?.tx_count ?? 0,
    },
    byMerchant: (raw.by_merchant ?? []).map((m: Record<string, unknown>) => ({
      merchantId: m.merchant_id ?? '',
      merchantName: m.merchant_name ?? '',
      gross: Number(m.gross ?? 0),
      commission: Number(m.commission ?? 0),
      avgRate: Number(m.avg_rate ?? 0),
      txCount: Number(m.tx_count ?? 0),
    })),
    byMcc: (raw.by_mcc ?? []).map((m: Record<string, unknown>) => ({
      mcc: m.mcc ?? '',
      gross: Number(m.gross ?? 0),
      commission: Number(m.commission ?? 0),
      avgRate: Number(m.avg_rate ?? 0),
      txCount: Number(m.tx_count ?? 0),
    })),
    dailyEvolution: (raw.daily_evolution ?? []).map((d: Record<string, unknown>) => ({
      period: d.period as string,
      gross: Number(d.gross ?? 0),
      commission: Number(d.commission ?? 0),
      txCount: Number(d.tx_count ?? 0),
    })),
  }
}

// ── API calls ──

export async function getProfiles(
  params?: { is_active?: boolean; search?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<CommissionProfile>> {
  const { data } = await api.get('/commissions/profiles', { params })
  return {
    data: (data.data ?? []).map(mapProfile),
    total: data.total ?? 0,
    page: data.page ?? 1,
    limit: data.limit ?? 20,
    totalPages: data.totalPages ?? 1,
  }
}

export async function getProfile(id: string): Promise<CommissionProfile> {
  const { data } = await api.get(`/commissions/profiles/${id}`)
  return mapProfile(data)
}

export async function createProfile(
  payload: CreateCommissionProfileData,
): Promise<CommissionProfile> {
  const { data } = await api.post('/commissions/profiles', payload)
  return mapProfile(data)
}

export async function updateProfile(
  id: string,
  payload: UpdateCommissionProfileData,
): Promise<CommissionProfile> {
  const { data } = await api.put(`/commissions/profiles/${id}`, payload)
  return mapProfile(data)
}

export async function deleteProfile(id: string): Promise<void> {
  await api.delete(`/commissions/profiles/${id}`)
}

export async function assignProfile(
  merchantId: string,
  profileId: string | null,
): Promise<void> {
  await api.post('/commissions/assign', {
    merchant_id: merchantId,
    profile_id: profileId,
  })
}

export async function getDashboard(
  filters?: CommissionDashboardFilters,
): Promise<CommissionDashboard> {
  const { data } = await api.get('/commissions/dashboard', { params: filters })
  return mapDashboard(data)
}
