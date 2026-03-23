// ── WebSocket Event Types (Addendum section 4) ──

export interface TransactionCreatedPayload {
  id: string;
  qr_id_trx: string;
  merchant_id: string;
  merchant_name: string;
  amount: number;
  status: 'CREADO';
  created_at: string;
}

export interface TransactionStatusChangedPayload {
  id: string;
  qr_id_trx: string;
  merchant_id: string;
  status: string;
  previous_status: string;
  timestamp: string;
}

export interface TransactionCompletedPayload {
  id: string;
  qr_id_trx: string;
  merchant_id: string;
  merchant_name: string;
  amount: number;
  status: 'ACREDITADO';
  payment_reference: string | null;
  commission_data: unknown;
  completed_at: string;
}

export interface TransactionErrorPayload {
  id: string;
  qr_id_trx: string;
  merchant_id: string;
  status: 'REVERSADO';
  error_code: string | null;
  error_description: string | null;
  reversal_code: string | null;
}

export interface TransactionRefundedPayload {
  id: string;
  qr_id_trx: string;
  merchant_id: string;
  refund_amount: number;
  refund_id: string | null;
  status: 'DEVUELTO';
}

export interface SystemCoelsaStatusPayload {
  connected: boolean;
  last_check: string;
}

export interface SystemAlertPayload {
  type: 'error' | 'warning';
  message: string;
  details?: unknown;
}

export const WS_EVENTS = {
  TRANSACTION_CREATED: 'transaction:created',
  TRANSACTION_STATUS_CHANGED: 'transaction:status_changed',
  TRANSACTION_COMPLETED: 'transaction:completed',
  TRANSACTION_ERROR: 'transaction:error',
  TRANSACTION_REFUNDED: 'transaction:refunded',
  SYSTEM_COELSA_STATUS: 'system:coelsa_status',
  SYSTEM_ALERT: 'system:alert',
} as const;
