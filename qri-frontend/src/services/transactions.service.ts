import api from '@/services/api';
import type {
  PaginatedResponse,
  RefundRequest,
  Transaction,
  TransactionFilters,
  TransactionStats,
} from '@/types';

// ── Mappers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransaction(raw: any): Transaction {
  const direction = raw.direction ?? 'INBOUND';
  const merchantName = raw.merchant?.business_name ?? raw.merchant_name ?? raw.merchantName
    ?? raw.external_merchant_name ?? raw.externalMerchantName ?? '';
  return {
    id: raw._id ?? raw.id,
    direction,
    merchantId: raw.merchant_id ?? raw.merchant?._id ?? raw.merchantId,
    merchantName,
    qrId: raw.qr_id ?? raw.qrId ?? '',
    amount: typeof raw.amount === 'string' ? parseFloat(raw.amount) : (raw.amount ?? 0),
    currency: raw.currency ?? 'ARS',
    status: raw.status ?? 'CREADO',
    qrIdTrx: raw.qr_id_trx ?? raw.qrIdTrx ?? '',
    payerCuit: raw.buyer_cuit ?? raw.payer_cuit ?? raw.payerCuit,
    payerName: raw.buyer_name ?? raw.payer_name ?? raw.payerName,
    mcc: raw.mcc ?? '',
    coelsaRef: raw.coelsa_ref ?? raw.coelsaRef,
    externalMerchantCuit: raw.external_merchant_cuit ?? raw.externalMerchantCuit,
    externalMerchantName: raw.external_merchant_name ?? raw.externalMerchantName,
    externalMerchantCbu: raw.external_merchant_cbu ?? raw.externalMerchantCbu,
    refundedAt: raw.refunded_at ?? raw.refundedAt,
    createdAt: raw.created_at ?? raw.createdAt ?? '',
    updatedAt: raw.updated_at ?? raw.updatedAt ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPaginatedTransactions(raw: any): PaginatedResponse<Transaction> {
  const items = raw.data ?? raw.transactions ?? [];
  const pagination = raw.pagination ?? raw;
  return {
    data: items.map(mapTransaction),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransactionStats(raw: any): TransactionStats {
  return {
    totalCount: raw.total_count ?? raw.totalCount ?? 0,
    totalAmount: raw.total_amount ?? raw.totalAmount ?? 0,
    averageAmount: raw.average_amount ?? raw.averageAmount ?? 0,
    byStatus: raw.by_status ?? raw.byStatus ?? {},
    byDay: (raw.by_day ?? raw.byDay ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (d: any) => ({
        date: d.date,
        count: d.count ?? 0,
        amount: typeof d.amount === 'string' ? parseFloat(d.amount) : (d.amount ?? 0),
      }),
    ),
  };
}

// ── API calls ──

export async function getTransactions(
  filters?: TransactionFilters,
): Promise<PaginatedResponse<Transaction>> {
  const { data } = await api.get('/transactions', { params: filters });
  return mapPaginatedTransactions(data);
}

export async function getTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get(`/transactions/${id}`);
  return mapTransaction(data.data ?? data);
}

export async function getTransactionStats(
  filters?: Omit<TransactionFilters, 'page' | 'limit'>,
): Promise<TransactionStats> {
  const { data } = await api.get('/transactions/stats', { params: filters });
  return mapTransactionStats(data.data ?? data);
}

export async function requestRefund(
  id: string,
  payload: RefundRequest,
): Promise<Transaction> {
  const { data } = await api.post(`/transactions/${id}/refund`, payload);
  return mapTransaction(data.data ?? data);
}

export async function exportTransactions(
  filters?: Omit<TransactionFilters, 'page' | 'limit'>,
): Promise<Blob> {
  const { data } = await api.get<Blob>('/transactions/export', {
    params: filters,
    responseType: 'blob',
  });
  return data;
}
