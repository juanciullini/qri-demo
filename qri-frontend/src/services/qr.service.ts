import api from '@/services/api';
import type {
  CreateDynamicQrData,
  CreateStaticQrData,
  PaginatedResponse,
  QrCode,
  QrFilters,
} from '@/types';

// ── Mappers ──

function mapQrStatus(status: string): QrCode['status'] {
  switch (status) {
    case 'ACTIVE':
      return 'ACTIVE';
    case 'EXPIRED':
      return 'EXPIRED';
    case 'DISABLED':
    case 'DELETED':
      return 'DELETED';
    default:
      return status as QrCode['status'];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapQrCode(raw: any): QrCode {
  return {
    id: raw._id ?? raw.id,
    merchantId: raw.merchant_id ?? raw.merchant?._id ?? raw.merchantId ?? '',
    merchantName: raw.merchant?.business_name ?? raw.merchant_name ?? raw.merchantName ?? '',
    type: raw.type ?? 'STATIC',
    alias: raw.label ?? raw.alias ?? '',
    payload: raw.qr_data ?? raw.payload ?? '',
    amount: raw.amount != null
      ? (typeof raw.amount === 'string' ? parseFloat(raw.amount) : raw.amount)
      : undefined,
    currency: raw.currency ?? 'ARS',
    description: raw.description,
    expiresAt: raw.expires_at ?? raw.expiresAt,
    status: mapQrStatus(raw.status ?? 'ACTIVE'),
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaginatedQr(raw: any): PaginatedResponse<QrCode> {
  const items = raw.data ?? raw.qr_codes ?? [];
  const pagination = raw.pagination ?? raw;
  return {
    data: items.map(mapQrCode),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

function mapStaticQrRequest(payload: CreateStaticQrData): Record<string, unknown> {
  return {
    merchant_id: payload.merchantId,
    label: payload.alias,
    description: payload.description,
  };
}

function mapDynamicQrRequest(payload: CreateDynamicQrData): Record<string, unknown> {
  return {
    merchant_id: payload.merchantId,
    label: payload.alias,
    amount: payload.amount,
    currency: payload.currency,
    description: payload.description,
    expiration: payload.expiresInMinutes,
  };
}

// ── API calls ──

export async function getQrCodes(
  filters?: QrFilters,
): Promise<PaginatedResponse<QrCode>> {
  const { data } = await api.get('/qr', { params: filters });
  return mapPaginatedQr(data);
}

export async function getQrCode(id: string): Promise<QrCode> {
  const { data } = await api.get(`/qr/${id}`);
  return mapQrCode(data.data ?? data);
}

export async function createStaticQr(
  payload: CreateStaticQrData,
): Promise<QrCode> {
  const { data } = await api.post('/qr/static', mapStaticQrRequest(payload));
  return mapQrCode(data.data ?? data);
}

export async function createDynamicQr(
  payload: CreateDynamicQrData,
): Promise<QrCode> {
  const { data } = await api.post('/qr/dynamic', mapDynamicQrRequest(payload));
  return mapQrCode(data.data ?? data);
}

export async function getQrImage(
  id: string,
  format: 'png' | 'svg' = 'png',
): Promise<Blob> {
  const { data } = await api.get<Blob>(`/qr/${id}/image`, {
    params: { format },
    responseType: 'blob',
  });
  return data;
}

export async function deleteQrCode(id: string): Promise<void> {
  await api.delete(`/qr/${id}`);
}
