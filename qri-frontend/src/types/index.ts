// ── Auth ──

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'MERCHANT' | 'VIEWER';
  merchantId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface RefreshResponse {
  access_token: string;
  refresh_token: string;
}

// ── Pagination ──

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

// ── Merchants ──

export interface Merchant {
  id: string;
  name: string;
  cuit: string;
  cbu: string;
  mcc: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING' | 'DEACTIVATED';
  email: string;
  phone?: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantFilters extends PaginationParams {
  status?: Merchant['status'];
  search?: string;
}

export interface CreateMerchantData {
  name: string;
  cuit: string;
  cbu: string;
  mcc: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface UpdateMerchantData {
  name?: string;
  cbu?: string;
  mcc?: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface MerchantStats {
  totalTransactions: number;
  totalAmount: number;
  averageTicket: number;
  activeQrCodes: number;
  period: string;
}

// ── Transactions ──

export type TxDirection = 'INBOUND' | 'OUTBOUND';

export interface Transaction {
  id: string;
  direction: TxDirection;
  merchantId?: string;
  merchantName: string;
  qrId: string;
  amount: number;
  currency: string;
  status: 'CREADO' | 'EN_CURSO' | 'ACREDITADO' | 'REVERSADO' | 'DEVUELTO';
  qrIdTrx: string;
  payerCuit?: string;
  payerName?: string;
  mcc: string;
  coelsaRef?: string;
  externalMerchantCuit?: string;
  externalMerchantName?: string;
  externalMerchantCbu?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionFilters extends PaginationParams {
  status?: Transaction['status'];
  direction?: TxDirection;
  merchant_id?: string;
  date_from?: string;
  date_to?: string;
  amount_min?: number;
  amount_max?: number;
  mcc?: string;
  qr_id_trx?: string;
}

export interface ParsedQRInfo {
  merchantName: string;
  merchantCuit: string;
  merchantCbu: string;
  mcc: string;
  amount?: number;
  currency: string;
  pointOfInitiation: 'STATIC' | 'DYNAMIC';
  isValid: boolean;
}

export interface WalletPayRequest {
  qr_data: string;
  amount?: number;
  buyer_cbu: string;
  buyer_cuit: string;
  description?: string;
}

export interface TransactionStats {
  totalCount: number;
  totalAmount: number;
  averageAmount: number;
  byStatus: Record<string, number>;
  byDay: Array<{ date: string; count: number; amount: number }>;
}

export interface RefundRequest {
  reason: string;
}

// ── QR Codes ──

export interface QrCode {
  id: string;
  merchantId: string;
  merchantName: string;
  type: 'STATIC' | 'DYNAMIC';
  alias: string;
  payload: string;
  amount?: number;
  currency: string;
  description?: string;
  expiresAt?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'DELETED';
  createdAt: string;
  updatedAt: string;
}

export interface QrFilters extends PaginationParams {
  merchant_id?: string;
  type?: QrCode['type'];
  status?: QrCode['status'];
}

export interface CreateStaticQrData {
  merchantId: string;
  alias: string;
  description?: string;
}

export interface CreateDynamicQrData {
  merchantId: string;
  alias: string;
  amount: number;
  currency?: string;
  description?: string;
  expiresInMinutes?: number;
}

// ── Settlements ──

export interface Settlement {
  id: string;
  merchantId: string;
  merchantName: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  transactionCount: number;
  totalCommission: number;
  merchantNet: number;
  avgCommissionRate: number | null;
  commissionDetail: CommissionDetailItem[] | null;
  periodFrom: string;
  periodTo: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionDetailItem {
  mcc: string;
  txCount: number;
  grossAmount: number;
  commissionAmount: number;
  rate: number;
}

export interface SettlementFilters extends PaginationParams {
  merchant_id?: string;
  status?: Settlement['status'];
  date_from?: string;
  date_to?: string;
}

export interface CreateSettlementData {
  merchantId: string;
  periodFrom: string;
  periodTo: string;
}

// ── Users (admin) ──

export interface UserFilters extends PaginationParams {
  role?: User['role'];
  search?: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
  role: User['role'];
  merchantId?: string;
}

export interface UpdateUserData {
  name?: string;
  email?: string;
  role?: User['role'];
  merchantId?: string;
}

// ── System ──

export interface HealthStatus {
  status: string;
  uptime: number;
  version: string;
  timestamp: string;
}

export interface CoelsaStatus {
  connected: boolean;
  lastPing: string;
  latencyMs: number;
}

export interface SystemConfig {
  key: string;
  value: string;
  description?: string;
}

// ── Sandbox ──

export interface SandboxScenario {
  id: string;
  name: string;
  description: string;
}

export interface SandboxConfig {
  enabled: boolean;
  scenarioId: string;
  delay?: number;
}

// ── Commissions ──

export interface CommissionProfile {
  id: string;
  name: string;
  description: string | null;
  isDefault: boolean;
  defaultRate: number;
  rates: CommissionProfileRate[];
  isActive: boolean;
  merchantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionProfileRate {
  mcc: string;
  rate: number;
  direction: 'INBOUND' | 'OUTBOUND' | 'BOTH';
}

export interface CommissionDashboard {
  totals: {
    totalCommissions: number;
    totalGross: number;
    totalMerchantNet: number;
    avgRate: number;
    txCount: number;
  };
  byMerchant: CommissionByMerchant[];
  byMcc: CommissionByMcc[];
  dailyEvolution: CommissionDailyPoint[];
}

export interface CommissionByMerchant {
  merchantId: string;
  merchantName: string;
  gross: number;
  commission: number;
  avgRate: number;
  txCount: number;
}

export interface CommissionByMcc {
  mcc: string;
  gross: number;
  commission: number;
  avgRate: number;
  txCount: number;
}

export interface CommissionDailyPoint {
  period: string;
  gross: number;
  commission: number;
  txCount: number;
}

export interface CommissionDashboardFilters {
  date_from?: string;
  date_to?: string;
  merchant_id?: string;
  mcc?: string;
  direction?: 'INBOUND' | 'OUTBOUND';
  granularity?: 'day' | 'week' | 'month';
}

export interface CreateCommissionProfileData {
  name: string;
  description?: string;
  is_default: boolean;
  default_rate: number;
  rates: CommissionProfileRate[];
}

export interface UpdateCommissionProfileData {
  name?: string;
  description?: string | null;
  is_default?: boolean;
  default_rate?: number;
  rates?: CommissionProfileRate[];
  is_active?: boolean;
}

// ── WebSocket events ──

export interface WsTransactionEvent {
  type: 'transaction:created' | 'transaction:updated' | 'transaction:refunded';
  data: Transaction;
}

export interface WsSystemEvent {
  type: 'system:coelsa-status' | 'system:health';
  data: CoelsaStatus | HealthStatus;
}
