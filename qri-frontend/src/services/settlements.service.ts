import api from '@/services/api';
import type {
  CreateSettlementData,
  PaginatedResponse,
  Settlement,
  SettlementFilters,
} from '@/types';

// ── Mappers ──

function mapSettlementStatus(status: string): Settlement['status'] {
  switch (status) {
    case 'SETTLED':
    case 'RECONCILED':
      return 'COMPLETED';
    case 'PROCESSING':
      return 'PROCESSING';
    case 'PENDING':
      return 'PENDING';
    case 'FAILED':
      return 'FAILED';
    case 'COMPLETED':
      return 'COMPLETED';
    default:
      return status as Settlement['status'];
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCommissionDetail(raw: any[]): Settlement['commissionDetail'] {
  if (!raw || !Array.isArray(raw)) return null;
  return raw.map((d) => ({
    mcc: d.mcc ?? '',
    txCount: d.tx_count ?? d.txCount ?? 0,
    grossAmount: d.gross_amount ?? d.grossAmount ?? 0,
    commissionAmount: d.commission_amount ?? d.commissionAmount ?? 0,
    rate: d.rate ?? 0,
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSettlement(raw: any): Settlement {
  return {
    id: raw._id ?? raw.id,
    merchantId: raw.merchant_id ?? raw.merchant?._id ?? raw.merchantId ?? '',
    merchantName: raw.merchant?.business_name ?? raw.merchant_name ?? raw.merchantName ?? '',
    amount: raw.total_amount ?? raw.amount ?? 0,
    currency: raw.currency ?? 'ARS',
    status: mapSettlementStatus(raw.status ?? 'PENDING'),
    transactionCount: raw.total_transactions ?? raw.transaction_count ?? raw.transactionCount ?? 0,
    totalCommission: Number(raw.total_commission ?? raw.totalCommission ?? 0),
    merchantNet: Number(raw.merchant_net ?? raw.merchantNet ?? 0),
    avgCommissionRate: raw.avg_commission_rate != null ? Number(raw.avg_commission_rate) : raw.avgCommissionRate != null ? Number(raw.avgCommissionRate) : null,
    commissionDetail: mapCommissionDetail(raw.commission_detail ?? raw.commissionDetail),
    periodFrom: raw.period_start ?? raw.period_from ?? raw.periodFrom ?? '',
    periodTo: raw.period_end ?? raw.period_to ?? raw.periodTo ?? '',
    settledAt: raw.settled_at ?? raw.settledAt,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaginatedSettlements(raw: any): PaginatedResponse<Settlement> {
  const items = raw.data ?? raw.settlements ?? [];
  const pagination = raw.pagination ?? raw;
  return {
    data: items.map(mapSettlement),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

function mapSettlementRequest(payload: CreateSettlementData): Record<string, unknown> {
  return {
    merchant_id: payload.merchantId,
    period_start: payload.periodFrom,
    period_end: payload.periodTo,
  };
}

// ── API calls ──

export async function getSettlements(
  filters?: SettlementFilters,
): Promise<PaginatedResponse<Settlement>> {
  const { data } = await api.get('/settlements', { params: filters });
  return mapPaginatedSettlements(data);
}

export async function getSettlement(id: string): Promise<Settlement> {
  const { data } = await api.get(`/settlements/${id}`);
  return mapSettlement(data.data ?? data);
}

export async function createSettlement(
  payload: CreateSettlementData,
): Promise<Settlement> {
  const { data } = await api.post('/settlements', mapSettlementRequest(payload));
  return mapSettlement(data.data ?? data);
}
