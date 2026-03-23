import api from '@/services/api';
import type {
  CreateMerchantData,
  Merchant,
  MerchantFilters,
  MerchantStats,
  PaginatedResponse,
  UpdateMerchantData,
} from '@/types';

// ── Mappers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMerchant(raw: any): Merchant {
  return {
    id: raw._id ?? raw.id,
    name: raw.business_name ?? raw.name,
    cuit: raw.cuit ?? '',
    cbu: raw.cbu ?? '',
    mcc: raw.mcc_codes?.[0]?.mcc ?? raw.mcc ?? '',
    status: raw.status ?? 'PENDING',
    email: raw.contact_email ?? raw.email ?? '',
    phone: raw.phone,
    address: raw.address,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaginatedMerchants(raw: any): PaginatedResponse<Merchant> {
  const items = raw.data ?? raw.merchants ?? [];
  const pagination = raw.pagination ?? raw;
  return {
    data: items.map(mapMerchant),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

function mapMerchantRequest(
  payload: CreateMerchantData | UpdateMerchantData,
): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if ('name' in payload && payload.name !== undefined) body.business_name = payload.name;
  if ('cuit' in payload && payload.cuit !== undefined) body.cuit = payload.cuit;
  if ('cbu' in payload && payload.cbu !== undefined) body.cbu = payload.cbu;
  if ('mcc' in payload && payload.mcc !== undefined) body.mcc_codes = [{ mcc: payload.mcc }];
  if ('email' in payload && payload.email !== undefined) body.contact_email = payload.email;
  if ('phone' in payload && payload.phone !== undefined) body.phone = payload.phone;
  if ('address' in payload && payload.address !== undefined) body.address = payload.address;
  return body;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapMerchantStats(raw: any): MerchantStats {
  return {
    totalTransactions: raw.total_transactions ?? raw.totalTransactions ?? 0,
    totalAmount: raw.total_amount ?? raw.totalAmount ?? 0,
    averageTicket: raw.average_ticket ?? raw.averageTicket ?? 0,
    activeQrCodes: raw.active_qr_codes ?? raw.activeQrCodes ?? 0,
    period: raw.period ?? '',
  };
}

// ── API calls ──

export async function getMerchants(
  filters?: MerchantFilters,
): Promise<PaginatedResponse<Merchant>> {
  const { data } = await api.get('/merchants', { params: filters });
  return mapPaginatedMerchants(data);
}

export async function getMerchant(id: string): Promise<Merchant> {
  const { data } = await api.get(`/merchants/${id}`);
  return mapMerchant(data.data ?? data);
}

export async function createMerchant(
  payload: CreateMerchantData,
): Promise<Merchant> {
  const { data } = await api.post('/merchants', mapMerchantRequest(payload));
  return mapMerchant(data.data ?? data);
}

export async function updateMerchant(
  id: string,
  payload: UpdateMerchantData,
): Promise<Merchant> {
  const { data } = await api.patch(`/merchants/${id}`, mapMerchantRequest(payload));
  return mapMerchant(data.data ?? data);
}

export async function deleteMerchant(id: string): Promise<void> {
  await api.delete(`/merchants/${id}`);
}

export async function activateMerchant(id: string): Promise<Merchant> {
  const { data } = await api.post(`/merchants/${id}/activate`);
  return mapMerchant(data.data ?? data);
}

export async function suspendMerchant(id: string): Promise<Merchant> {
  const { data } = await api.post(`/merchants/${id}/suspend`);
  return mapMerchant(data.data ?? data);
}

export async function getMerchantStats(id: string): Promise<MerchantStats> {
  const { data } = await api.get(`/merchants/${id}/stats`);
  return mapMerchantStats(data.data ?? data);
}
