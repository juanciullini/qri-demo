import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { txLogger, logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import { TxStatus, CURRENCY_ARS } from '../../config/constants.js';
import { CoelsaAdapter } from '../coelsa/coelsa.adapter.js';
import { validateTransition } from './transaction.state-machine.js';
import type {
  QRIntencionPagoRequest,
  QRIntencionPagoResponse,
  QRConfirmaDebitoRequest,
  QRConfirmaDebitoResponse,
  QRReversoRequest,
  QROperacionFinalizadaRequest,
  QROperacionFinalizadaAdquirenteRequest,
  CoelsaInterchangeItem,
} from '../coelsa/coelsa.types.js';
import type { TransactionFilters } from './transaction.schemas.js';
import { calculateCommission } from '../commissions/commissions.service.js';

// ── Helper: build a COELSA message log entry ──

interface CoelsaMessageEntry {
  type: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  payload: unknown;
}

function coelsaMessage(type: string, direction: 'inbound' | 'outbound', payload: unknown): CoelsaMessageEntry {
  return { type, direction, timestamp: new Date().toISOString(), payload };
}

// ── Helper: generate a unique payment reference ──

function generatePaymentReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `PR-${ts}-${rand}`;
}

// ── Helper: compute commission data from interchange ──

function computeCommissionData(interchange: CoelsaInterchangeItem | CoelsaInterchangeItem[]): {
  importe_bruto: number;
  importe_neto: number;
  comision_comercio: number;
  importe_comision: number;
  comision_administrador: number;
} {
  // ConfirmaDebito sends a single object; IntencionPago sends an array
  const item = Array.isArray(interchange) ? interchange[0] : interchange;
  return {
    importe_bruto: item.importe_bruto,
    importe_neto: item.importe_neto,
    comision_comercio: item.comision_comercio,
    importe_comision: item.importe_comision,
    comision_administrador: item.comision_administrador,
  };
}

// ══════════════════════════════════════════════════════════
// COELSA Webhook Handlers
// ══════════════════════════════════════════════════════════

/**
 * QRIntencionPago: COELSA notifies us that a buyer wants to pay.
 * Must respond in <2s.
 *
 * - Find the merchant by vendedor.cuit
 * - Validate MCC from interchange matches merchant config
 * - Validate amount > 0
 * - Create or find existing transaction (IDEMPOTENT by qr_id_trx)
 * - Return PASS with mcc, codigo_postal, payment_reference or FAIL
 */
export async function handleIntentionPayment(
  request: QRIntencionPagoRequest,
  sandboxScenario?: string,
): Promise<QRIntencionPagoResponse> {
  const { vendedor, comprador, detalle, interchange } = request.operacion;
  const log = txLogger(detalle.qr_id_trx);

  log.info({ cuit: vendedor.cuit, amount: detalle.importe }, 'IntencionPago received');

  // ── Base response fields ──
  const baseResponse = {
    qr_id_trx: detalle.qr_id_trx,
    id_debin: detalle.id_debin,
    id_billetera: detalle.id_billetera,
    fecha_negocio: detalle.fecha_negocio,
  };

  try {
    // ── Idempotency: check for existing transaction with same qr_id_trx ──
    const existing = await prisma.transaction.findUnique({
      where: { qr_id_trx: detalle.qr_id_trx },
      include: { merchant: true },
    });

    if (existing) {
      log.info({ txId: existing.id, status: existing.status }, 'IntencionPago idempotent hit');

      // If the transaction already passed intention, return the same success response
      if (existing.payment_reference && existing.mcc) {
        return {
          ...baseResponse,
          validation_data: {
            mcc: existing.mcc,
            codigo_postal: existing.postal_code ?? '',
            payment_reference: existing.payment_reference,
          },
          validation_status: { status: 'PASS', on_error: null },
        };
      }

      // If it was previously rejected, return the stored error
      if (existing.error_code) {
        return {
          ...baseResponse,
          validation_data: null,
          validation_status: {
            status: 'FAIL',
            on_error: {
              code: existing.error_code,
              description: existing.error_description ?? 'Error processing intention',
            },
          },
        };
      }
    }

    // ── Find merchant by CUIT ──
    const merchant = await prisma.merchant.findUnique({
      where: { cuit: vendedor.cuit },
    });

    if (!merchant) {
      log.warn({ cuit: vendedor.cuit }, 'Merchant not found');
      return {
        ...baseResponse,
        validation_data: null,
        validation_status: {
          status: 'FAIL',
          on_error: { code: '5702', description: 'VENDEDOR VIRTUAL INVALIDO' },
        },
      };
    }

    if (merchant.status !== 'ACTIVE') {
      log.warn({ merchantId: merchant.id, status: merchant.status }, 'Merchant not active');
      return {
        ...baseResponse,
        validation_data: null,
        validation_status: {
          status: 'FAIL',
          on_error: { code: '5710', description: 'ADQUIRIENTE DENIEGA OPERACION' },
        },
      };
    }

    // ── Validate MCC from interchange ──
    const interchangeItem = interchange[0];
    if (!interchangeItem) {
      log.warn('No interchange data received');
      return {
        ...baseResponse,
        validation_data: null,
        validation_status: {
          status: 'FAIL',
          on_error: { code: '5711', description: 'FALLA VALIDACION CONTRA ADQUIRIENTE' },
        },
      };
    }

    const incomingMcc = interchangeItem.mcc;
    const merchantMccs = merchant.mcc_codes as Array<{ mcc: string; desc?: string; commission?: number }>;
    const matchedMcc = merchantMccs.find((m) => m.mcc === incomingMcc);

    if (!matchedMcc) {
      log.warn({ incomingMcc, merchantMccs }, 'MCC mismatch');
      return {
        ...baseResponse,
        validation_data: null,
        validation_status: {
          status: 'FAIL',
          on_error: { code: '5711', description: 'FALLA VALIDACION CONTRA ADQUIRIENTE' },
        },
      };
    }

    // ── Validate amount ──
    if (detalle.importe <= 0) {
      log.warn({ amount: detalle.importe }, 'Invalid amount');
      return {
        ...baseResponse,
        validation_data: null,
        validation_status: {
          status: 'FAIL',
          on_error: { code: '5711', description: 'FALLA VALIDACION CONTRA ADQUIRIENTE' },
        },
      };
    }

    // ── Create transaction (or update idempotent existing) ──
    const paymentReference = generatePaymentReference();
    const inboundMessage = coelsaMessage('QRIntencionPago', 'inbound', request);

    const transaction = existing
      ? await prisma.transaction.update({
          where: { id: existing.id },
          data: {
            status: TxStatus.EN_CURSO,
            mcc: incomingMcc,
            postal_code: merchant.postal_code ?? '',
            payment_reference: existing.payment_reference ?? paymentReference,
            interchange: interchange as unknown as Prisma.InputJsonValue,
            buyer_cuit: comprador.cuit,
            buyer_cbu: comprador.cuenta.cbu,
            intention_response_at: new Date(),
            coelsa_messages: {
              push: inboundMessage as unknown as Prisma.InputJsonValue,
            },
          },
        })
      : await prisma.transaction.create({
          data: {
            qr_id_trx: detalle.qr_id_trx,
            id_debin: detalle.id_debin,
            merchant_id: merchant.id,
            status: TxStatus.EN_CURSO,
            amount: new Prisma.Decimal(detalle.importe),
            currency: detalle.moneda === '032' ? 'ARS' : detalle.moneda,
            buyer_cuit: comprador.cuit,
            buyer_cbu: comprador.cuenta.cbu,
            mcc: incomingMcc,
            postal_code: merchant.postal_code ?? '',
            payment_reference: paymentReference,
            interchange: interchange as unknown as Prisma.InputJsonValue,
            intention_sent_at: new Date(),
            intention_response_at: new Date(),
            coelsa_messages: [inboundMessage as unknown as Prisma.InputJsonValue],
          },
        });

    const outboundPayload = {
      ...baseResponse,
      validation_data: {
        mcc: incomingMcc,
        codigo_postal: merchant.postal_code ?? '',
        payment_reference: transaction.payment_reference ?? paymentReference,
      },
      validation_status: { status: 'PASS' as const, on_error: null },
    };

    // Log outbound response
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        coelsa_messages: {
          push: coelsaMessage('QRIntencionPago', 'outbound', outboundPayload) as unknown as Prisma.InputJsonValue,
        },
      },
    });

    log.info({ txId: transaction.id, paymentReference: transaction.payment_reference }, 'IntencionPago PASS');

    return outboundPayload;
  } catch (error) {
    // If it is an AppError or already handled, rethrow
    if (error instanceof AppError) throw error;

    log.error(error, 'IntencionPago unexpected error');
    return {
      ...baseResponse,
      validation_data: null,
      validation_status: {
        status: 'FAIL',
        on_error: { code: '5799', description: 'ERROR GENERAL' },
      },
    };
  }
}

/**
 * QRConfirmaDebito: COELSA confirms the buyer's debit was executed.
 * Must respond in <2s.
 *
 * - Find transaction by qr_id_trx
 * - Validate state is EN_CURSO (state machine)
 * - Change to ACREDITADO
 * - Calculate commission_data from interchange
 * - Return APPROVED with payment_reference or REJECTED
 */
export async function handleConfirmDebit(
  request: QRConfirmaDebitoRequest,
  sandboxScenario?: string,
): Promise<QRConfirmaDebitoResponse> {
  const { vendedor, comprador, detalle, interchange, respuesta } = request.operacion;
  const log = txLogger(detalle.qr_id_trx);

  log.info(
    { qr_id_trx: detalle.qr_id_trx, coelsa_code: respuesta.codigo },
    'ConfirmaDebito received',
  );

  const baseResponse = {
    qr_id_trx: detalle.qr_id_trx,
    id_debin: detalle.id_debin,
    id_billetera: detalle.id_billetera,
    fecha_negocio: detalle.fecha_negocio,
  };

  try {
    // ── Find the transaction ──
    const transaction = await prisma.transaction.findUnique({
      where: { qr_id_trx: detalle.qr_id_trx },
    });

    if (!transaction) {
      log.warn('Transaction not found for ConfirmaDebito');
      return {
        ...baseResponse,
        transaction_status: {
          status: 'REJECTED',
          on_error: { code: '2899', description: 'Transaction not found' },
        },
      };
    }

    // ── Validate COELSA debit result ──
    if (respuesta.codigo !== '2800') {
      log.warn({ code: respuesta.codigo, desc: respuesta.descripcion }, 'COELSA debit not confirmed');

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          error_code: respuesta.codigo,
          error_description: respuesta.descripcion,
          coelsa_messages: {
            push: coelsaMessage('QRConfirmaDebito', 'inbound', request) as unknown as Prisma.InputJsonValue,
          },
        },
      });

      return {
        ...baseResponse,
        transaction_status: {
          status: 'REJECTED',
          on_error: { code: respuesta.codigo, description: respuesta.descripcion },
        },
      };
    }

    // ── Validate state transition ──
    validateTransition(transaction.status, TxStatus.ACREDITADO);

    // ── Calculate COELSA interchange commission ──
    const commissionData = computeCommissionData(interchange);
    const inboundMessage = coelsaMessage('QRConfirmaDebito', 'inbound', request);

    // ── Calculate platform commission ──
    let platformCommission: number | undefined;
    let merchantNetAmount: number | undefined;
    try {
      const commResult = await calculateCommission(
        Number(transaction.amount),
        transaction.mcc,
        'INBOUND',
        transaction.merchant_id,
      );
      platformCommission = commResult.commission_amount;
      merchantNetAmount = commResult.merchant_net;
    } catch (commError) {
      log.warn(commError, 'Failed to calculate platform commission, continuing without it');
    }

    // ── Update to ACREDITADO ──
    const updated = await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TxStatus.ACREDITADO,
        commission_data: commissionData as unknown as Prisma.InputJsonValue,
        platform_commission: platformCommission ?? null,
        merchant_net_amount: merchantNetAmount ?? null,
        debit_confirmed_at: new Date(),
        completed_at: new Date(),
        coelsa_messages: {
          push: inboundMessage as unknown as Prisma.InputJsonValue,
        },
      },
    });

    const outboundPayload: QRConfirmaDebitoResponse = {
      ...baseResponse,
      payment_reference: updated.payment_reference ?? '',
      transaction_status: { status: 'APPROVED', on_error: null },
    };

    // Log outbound response
    await prisma.transaction.update({
      where: { id: updated.id },
      data: {
        coelsa_messages: {
          push: coelsaMessage('QRConfirmaDebito', 'outbound', outboundPayload) as unknown as Prisma.InputJsonValue,
        },
      },
    });

    log.info({ txId: updated.id }, 'ConfirmaDebito APPROVED');
    return outboundPayload;
  } catch (error) {
    if (error instanceof AppError) {
      log.warn({ code: error.code, message: error.message }, 'ConfirmaDebito rejected');
      return {
        ...baseResponse,
        transaction_status: {
          status: 'REJECTED',
          on_error: { code: error.code ?? '2899', description: error.message },
        },
      };
    }

    log.error(error, 'ConfirmaDebito unexpected error');
    return {
      ...baseResponse,
      transaction_status: {
        status: 'REJECTED',
        on_error: { code: '2899', description: 'ERROR GENERAL' },
      },
    };
  }
}

/**
 * QRReverso: COELSA requests reversal of a transaction.
 *
 * - Find transaction by qr_id_trx
 * - Change to REVERSADO
 * - Record reversal_code and reversal_reason
 */
export async function handleReversal(request: QRReversoRequest): Promise<void> {
  const { detalle, motivo } = request.operacion;
  const log = txLogger(detalle.qr_id_trx);

  log.info({ code: motivo.codigo, reason: motivo.descripcion }, 'QRReverso received');

  const transaction = await prisma.transaction.findUnique({
    where: { qr_id_trx: detalle.qr_id_trx },
  });

  if (!transaction) {
    log.warn('Transaction not found for reversal');
    // COELSA does not expect a response body for reversal; just log and return
    return;
  }

  // Validate state transition (if already REVERSADO or DEVUELTO, skip gracefully)
  if (transaction.status === TxStatus.REVERSADO) {
    log.info('Transaction already reversed, idempotent skip');
    return;
  }

  validateTransition(transaction.status, TxStatus.REVERSADO);

  const inboundMessage = coelsaMessage('QRReverso', 'inbound', request);

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: {
      status: TxStatus.REVERSADO,
      reversal_code: motivo.codigo,
      reversal_reason: motivo.descripcion,
      completed_at: new Date(),
      coelsa_messages: {
        push: inboundMessage as unknown as Prisma.InputJsonValue,
      },
    },
  });

  log.info({ txId: transaction.id }, 'Transaction reversed');
}

/**
 * QROperacionFinalizada: COELSA notifies the final status of an operation.
 *
 * - Record the final status code and description
 */
export async function handleOperationFinished(request: QROperacionFinalizadaRequest): Promise<void> {
  const { operacion_original, respuesta } = request;
  const qrIdTrx = operacion_original.qr_id_trx;
  const log = txLogger(qrIdTrx);

  log.info({ code: respuesta.codigo, description: respuesta.descripcion }, 'OperacionFinalizada received');

  const transaction = await prisma.transaction.findUnique({
    where: { qr_id_trx: qrIdTrx },
  });

  if (!transaction) {
    log.warn('Transaction not found for OperacionFinalizada');
    return;
  }

  const inboundMessage = coelsaMessage('QROperacionFinalizada', 'inbound', request);

  // Determine if this is a refund notification (5705 = total, 5708 = partial)
  const isRefund = respuesta.codigo === '5705' || respuesta.codigo === '5708';

  const updateData: Prisma.TransactionUpdateInput = {
    completed_at: new Date(),
    coelsa_messages: {
      push: inboundMessage as unknown as Prisma.InputJsonValue,
    },
  };

  if (isRefund && transaction.status === TxStatus.ACREDITADO) {
    updateData.status = TxStatus.DEVUELTO;
  }

  // For outbound (wallet) transactions: 5700 means success, transition EN_CURSO → ACREDITADO
  if (respuesta.codigo === '5700' && transaction.status === TxStatus.EN_CURSO && transaction.direction === 'OUTBOUND') {
    updateData.status = TxStatus.ACREDITADO;

    // Calculate OUTBOUND platform commission
    try {
      const commResult = await calculateCommission(
        Number(transaction.amount),
        transaction.mcc,
        'OUTBOUND',
        transaction.merchant_id,
      );
      updateData.platform_commission = commResult.commission_amount;
      updateData.merchant_net_amount = commResult.merchant_net;
    } catch (commError) {
      log.warn(commError, 'Failed to calculate OUTBOUND platform commission');
    }
  }

  // Store the final COELSA response code if it represents an error
  if (respuesta.codigo !== '5700') {
    updateData.error_code = respuesta.codigo;
    updateData.error_description = respuesta.descripcion;
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: updateData,
  });

  log.info({ txId: transaction.id, finalCode: respuesta.codigo }, 'OperacionFinalizada recorded');
}

/**
 * QROperacionFinalizadaAdquirente: COELSA notifies the final status
 * of an INBOUND operation (we are the PSP/Adquirente).
 *
 * - Typically confirms 5700 (success) after ConfirmaDebito already set ACREDITADO
 * - Errors for INBOUND come via QRReverso, not this webhook
 * - Record the message and ensure completed_at is set
 */
export async function handleOperationFinishedAcquirer(request: QROperacionFinalizadaAdquirenteRequest): Promise<void> {
  const { operacion_original, respuesta } = request;
  const qrIdTrx = operacion_original.qr_id_trx;
  const log = txLogger(qrIdTrx);

  log.info({ code: respuesta.codigo, description: respuesta.descripcion }, 'OperacionFinalizadaAdquirente received');

  const transaction = await prisma.transaction.findUnique({
    where: { qr_id_trx: qrIdTrx },
  });

  if (!transaction) {
    log.warn('Transaction not found for OperacionFinalizadaAdquirente');
    return;
  }

  const inboundMessage = coelsaMessage('QROperacionFinalizadaAdquirente', 'inbound', request);

  const updateData: Prisma.TransactionUpdateInput = {
    coelsa_messages: {
      push: inboundMessage as unknown as Prisma.InputJsonValue,
    },
  };

  // 5700 = operation completed successfully
  if (respuesta.codigo === '5700') {
    // If somehow still EN_CURSO (ConfirmaDebito didn't arrive), transition to ACREDITADO
    if (transaction.status === TxStatus.EN_CURSO) {
      updateData.status = TxStatus.ACREDITADO;
    }
    if (!transaction.completed_at) {
      updateData.completed_at = new Date();
    }
  } else {
    updateData.error_code = respuesta.codigo;
    updateData.error_description = respuesta.descripcion;
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: updateData,
  });

  log.info({ txId: transaction.id, finalCode: respuesta.codigo }, 'OperacionFinalizadaAdquirente recorded');
}

// ══════════════════════════════════════════════════════════
// Dashboard / API Handlers
// ══════════════════════════════════════════════════════════

/**
 * Get a paginated list of transactions with filters.
 * MERCHANT role users only see their own transactions.
 */
export async function getTransactions(
  filters: TransactionFilters,
  merchantIdScope?: string,
): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }> {
  const where: Prisma.TransactionWhereInput = {};

  // Scope to merchant if MERCHANT role
  if (merchantIdScope) {
    where.merchant_id = merchantIdScope;
  } else if (filters.merchant_id) {
    where.merchant_id = filters.merchant_id;
  }

  if (filters.direction) {
    where.direction = filters.direction as Prisma.EnumTxDirectionFilter;
  }

  if (filters.status) {
    where.status = filters.status as Prisma.EnumTxStatusFilter;
  }

  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = filters.date_from;
    if (filters.date_to) where.created_at.lte = filters.date_to;
  }

  if (filters.amount_min !== undefined || filters.amount_max !== undefined) {
    where.amount = {};
    if (filters.amount_min !== undefined) where.amount.gte = new Prisma.Decimal(filters.amount_min);
    if (filters.amount_max !== undefined) where.amount.lte = new Prisma.Decimal(filters.amount_max);
  }

  if (filters.mcc) {
    where.mcc = filters.mcc;
  }

  if (filters.payment_reference) {
    where.payment_reference = { contains: filters.payment_reference, mode: 'insensitive' };
  }

  if (filters.qr_id_trx) {
    where.qr_id_trx = { contains: filters.qr_id_trx, mode: 'insensitive' };
  }

  const skip = (filters.page - 1) * filters.limit;

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { created_at: 'desc' },
      include: {
        merchant: {
          select: { id: true, business_name: true, cuit: true },
        },
      },
    }),
    prisma.transaction.count({ where }),
  ]);

  return {
    data,
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.ceil(total / filters.limit),
  };
}

/**
 * Get full transaction detail by ID, including timeline and COELSA messages.
 */
export async function getTransactionById(
  id: string,
  merchantIdScope?: string,
): Promise<unknown> {
  const where: Prisma.TransactionWhereInput = { id };
  if (merchantIdScope) where.merchant_id = merchantIdScope;

  const transaction = await prisma.transaction.findFirst({
    where,
    include: {
      merchant: {
        select: { id: true, business_name: true, cuit: true, cbu: true, postal_code: true },
      },
      qr_code: {
        select: { id: true, type: true, label: true },
      },
    },
  });

  if (!transaction) {
    throw new AppError(404, 'Transaction not found', 'NOT_FOUND');
  }

  // Build timeline from timestamps
  const timeline: Array<{ event: string; timestamp: string | null }> = [
    { event: 'created', timestamp: transaction.created_at.toISOString() },
  ];

  if (transaction.intention_sent_at) {
    timeline.push({ event: 'intention_sent', timestamp: transaction.intention_sent_at.toISOString() });
  }
  if (transaction.intention_response_at) {
    timeline.push({ event: 'intention_response', timestamp: transaction.intention_response_at.toISOString() });
  }
  if (transaction.debit_confirmed_at) {
    timeline.push({ event: 'debit_confirmed', timestamp: transaction.debit_confirmed_at.toISOString() });
  }
  if (transaction.credit_sent_at) {
    timeline.push({ event: 'credit_sent', timestamp: transaction.credit_sent_at.toISOString() });
  }
  if (transaction.confirm_sent_at) {
    timeline.push({ event: 'confirm_sent', timestamp: transaction.confirm_sent_at.toISOString() });
  }
  if (transaction.confirm_response_at) {
    timeline.push({ event: 'confirm_response', timestamp: transaction.confirm_response_at.toISOString() });
  }
  if (transaction.completed_at) {
    timeline.push({ event: 'completed', timestamp: transaction.completed_at.toISOString() });
  }

  return {
    ...transaction,
    timeline,
  };
}

/**
 * Get aggregated statistics for transactions.
 */
export async function getTransactionStats(
  filters: TransactionFilters,
  merchantIdScope?: string,
): Promise<{
  total_count: number;
  successful_count: number;
  reversed_count: number;
  refunded_count: number;
  total_amount: number;
  successful_amount: number;
  success_rate: number;
  avg_processing_time_ms: number | null;
  total_commission: number;
  avg_commission: number;
}> {
  const where: Prisma.TransactionWhereInput = {};

  if (merchantIdScope) {
    where.merchant_id = merchantIdScope;
  } else if (filters.merchant_id) {
    where.merchant_id = filters.merchant_id;
  }

  if (filters.direction) {
    where.direction = filters.direction as Prisma.EnumTxDirectionFilter;
  }

  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = filters.date_from;
    if (filters.date_to) where.created_at.lte = filters.date_to;
  }

  if (filters.mcc) {
    where.mcc = filters.mcc;
  }

  // Counts by status
  const [
    totalCount,
    successfulCount,
    reversedCount,
    refundedCount,
    totalAgg,
    successAgg,
    commissionAgg,
  ] = await Promise.all([
    prisma.transaction.count({ where }),
    prisma.transaction.count({ where: { ...where, status: TxStatus.ACREDITADO } }),
    prisma.transaction.count({ where: { ...where, status: TxStatus.REVERSADO } }),
    prisma.transaction.count({ where: { ...where, status: TxStatus.DEVUELTO } }),
    prisma.transaction.aggregate({
      where,
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, status: TxStatus.ACREDITADO },
      _sum: { amount: true },
    }),
    prisma.transaction.aggregate({
      where: { ...where, status: TxStatus.ACREDITADO, platform_commission: { not: null } },
      _sum: { platform_commission: true },
      _avg: { platform_commission: true },
    }),
  ]);

  // Average processing time: from created_at to completed_at for completed transactions
  const completedTransactions = await prisma.transaction.findMany({
    where: {
      ...where,
      completed_at: { not: null },
      intention_sent_at: { not: null },
    },
    select: {
      intention_sent_at: true,
      completed_at: true,
    },
    take: 1000, // Limit for performance
    orderBy: { created_at: 'desc' },
  });

  let avgProcessingTimeMs: number | null = null;
  if (completedTransactions.length > 0) {
    const totalMs = completedTransactions.reduce((sum, tx) => {
      if (tx.intention_sent_at && tx.completed_at) {
        return sum + (tx.completed_at.getTime() - tx.intention_sent_at.getTime());
      }
      return sum;
    }, 0);
    avgProcessingTimeMs = Math.round(totalMs / completedTransactions.length);
  }

  const successRate = totalCount > 0 ? Number(((successfulCount / totalCount) * 100).toFixed(2)) : 0;

  return {
    total_count: totalCount,
    successful_count: successfulCount,
    reversed_count: reversedCount,
    refunded_count: refundedCount,
    total_amount: Number(totalAgg._sum.amount ?? 0),
    successful_amount: Number(successAgg._sum.amount ?? 0),
    success_rate: successRate,
    avg_processing_time_ms: avgProcessingTimeMs,
    total_commission: Number(commissionAgg._sum.platform_commission ?? 0),
    avg_commission: Number(commissionAgg._avg.platform_commission ?? 0),
  };
}

/**
 * Request a refund (contra-cargo) for a transaction.
 *
 * - Calls CoelsaAdapter.requestRefund
 * - If COELSA responds with code 5600, changes status to DEVUELTO
 */
export async function requestRefund(
  id: string,
  amount: number | null | undefined,
  reason: string,
  merchantIdScope?: string,
): Promise<{ success: boolean; refund_id?: string; coelsa_code: string; coelsa_description: string }> {
  const where: Prisma.TransactionWhereInput = { id };
  if (merchantIdScope) where.merchant_id = merchantIdScope;

  const transaction = await prisma.transaction.findFirst({ where, include: { merchant: true } });

  if (!transaction) {
    throw new AppError(404, 'Transaction not found', 'NOT_FOUND');
  }

  if (transaction.status !== TxStatus.ACREDITADO) {
    throw new AppError(
      409,
      `Cannot refund transaction in status ${transaction.status}. Must be ACREDITADO.`,
      'INVALID_STATE',
    );
  }

  // Use full amount if not specified
  const refundAmount = amount ?? Number(transaction.amount);
  const log = txLogger(transaction.qr_id_trx);

  log.info({ txId: id, refundAmount, reason }, 'Requesting refund');

  const vendedorCuit = transaction.merchant?.cuit ?? transaction.external_merchant_cuit ?? '';
  const vendedorCbu = transaction.merchant?.cbu ?? transaction.external_merchant_cbu ?? '';

  const coelsaRequest = {
    operacion_original: {
      detalle: {
        moneda: CURRENCY_ARS,
        importe: refundAmount,
        motivo: reason,
      },
      vendedor: {
        cuit: vendedorCuit,
        cbu: vendedorCbu,
      },
      tipo: 'contracargo' as const,
      qr_id_trx: transaction.qr_id_trx,
    },
  };

  const outboundMessage = coelsaMessage('QRSolicitudContraCargo', 'outbound', coelsaRequest);

  const response = await CoelsaAdapter.requestRefund(coelsaRequest);

  const inboundMessage = coelsaMessage('QRSolicitudContraCargo', 'inbound', response);

  const isSuccess = response.respuesta.codigo === '5600';

  const updateData: Prisma.TransactionUpdateInput = {
    coelsa_messages: {
      push: [
        outboundMessage as unknown as Prisma.InputJsonValue,
        inboundMessage as unknown as Prisma.InputJsonValue,
      ],
    },
  };

  if (isSuccess) {
    updateData.status = TxStatus.DEVUELTO;
    updateData.refund_id = response.id ?? null;
    updateData.completed_at = new Date();
  }

  await prisma.transaction.update({
    where: { id: transaction.id },
    data: updateData,
  });

  log.info(
    { txId: id, success: isSuccess, code: response.respuesta.codigo },
    'Refund response received',
  );

  return {
    success: isSuccess,
    refund_id: response.id,
    coelsa_code: response.respuesta.codigo,
    coelsa_description: response.respuesta.descripcion,
  };
}

/**
 * Build a Prisma where clause from export/filter params.
 * Reused by export functionality.
 */
export function buildTransactionWhereClause(
  filters: Omit<TransactionFilters, 'page' | 'limit'>,
  merchantIdScope?: string,
): Prisma.TransactionWhereInput {
  const where: Prisma.TransactionWhereInput = {};

  if (merchantIdScope) {
    where.merchant_id = merchantIdScope;
  } else if (filters.merchant_id) {
    where.merchant_id = filters.merchant_id;
  }

  if (filters.direction) {
    where.direction = filters.direction as Prisma.EnumTxDirectionFilter;
  }

  if (filters.status) {
    where.status = filters.status as Prisma.EnumTxStatusFilter;
  }

  if (filters.date_from || filters.date_to) {
    where.created_at = {};
    if (filters.date_from) where.created_at.gte = filters.date_from;
    if (filters.date_to) where.created_at.lte = filters.date_to;
  }

  if (filters.amount_min !== undefined || filters.amount_max !== undefined) {
    where.amount = {};
    if (filters.amount_min !== undefined) where.amount.gte = new Prisma.Decimal(filters.amount_min);
    if (filters.amount_max !== undefined) where.amount.lte = new Prisma.Decimal(filters.amount_max);
  }

  if (filters.mcc) where.mcc = filters.mcc;
  if (filters.payment_reference) where.payment_reference = { contains: filters.payment_reference, mode: 'insensitive' };
  if (filters.qr_id_trx) where.qr_id_trx = { contains: filters.qr_id_trx, mode: 'insensitive' };

  return where;
}
