import api from '@/services/api';
import type {
  ParsedQRInfo,
  WalletPayRequest,
  PaginatedResponse,
  Transaction,
  TransactionFilters,
} from '@/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapTransaction(raw: any): Transaction {
  const direction = raw.direction ?? 'OUTBOUND';
  return {
    id: raw._id ?? raw.id,
    direction,
    merchantId: raw.merchant_id ?? raw.merchantId,
    merchantName: raw.external_merchant_name ?? raw.externalMerchantName ?? raw.merchant?.business_name ?? '',
    qrId: raw.qr_id ?? raw.qrId ?? '',
    amount: typeof raw.amount === 'string' ? parseFloat(raw.amount) : (raw.amount ?? 0),
    currency: raw.currency ?? 'ARS',
    status: raw.status ?? 'CREADO',
    qrIdTrx: raw.qr_id_trx ?? raw.qrIdTrx ?? '',
    payerCuit: raw.buyer_cuit ?? raw.payerCuit,
    payerName: raw.buyer_name ?? raw.payerName,
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

export async function scanQR(qrData: string): Promise<ParsedQRInfo> {
  const { data } = await api.post('/wallet/scan', { qr_data: qrData });
  return data;
}

export async function pay(request: WalletPayRequest): Promise<{
  transactionId: string;
  status: string;
  id_debin?: string;
}> {
  const { data } = await api.post('/wallet/pay', request);
  return data;
}

export async function getWalletTransactions(
  filters?: Omit<TransactionFilters, 'direction' | 'merchant_id'>,
): Promise<PaginatedResponse<Transaction>> {
  const { data } = await api.get('/wallet/transactions', { params: filters });
  const items = data.data ?? [];
  const pagination = data.pagination ?? data;
  return {
    data: items.map(mapTransaction),
    total: pagination.total ?? items.length,
    page: pagination.page ?? 1,
    limit: pagination.limit ?? items.length,
    totalPages: pagination.total_pages ?? pagination.totalPages ?? 1,
  };
}

export async function getWalletTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get(`/wallet/transactions/${id}`);
  return mapTransaction(data.data ?? data);
}
