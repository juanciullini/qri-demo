import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma.js';
import { logger } from '../../utils/logger.js';
import { AppError } from '../../middleware/error-handler.js';
import { TxStatus } from '../../config/constants.js';
import { env } from '../../config/env.js';
import { parseQRString } from '../qr/qr.generator.js';
import { CoelsaAdapter } from '../coelsa/coelsa.adapter.js';
import { handleOperationFinished } from '../transactions/transaction.service.js';
import type { PayInput, WalletTransactionFilters } from './wallet.schemas.js';

// ── Helper: COELSA message log entry ──

function coelsaMessage(type: string, direction: 'inbound' | 'outbound', payload: unknown): {
  type: string;
  direction: 'inbound' | 'outbound';
  timestamp: string;
  payload: unknown;
} {
  return { type, direction, timestamp: new Date().toISOString(), payload };
}

// ── Scan QR ──

export function scanQR(qrData: string): {
  merchantName: string;
  merchantCuit: string;
  merchantCbu: string;
  mcc: string;
  amount?: number;
  currency: string;
  pointOfInitiation: 'STATIC' | 'DYNAMIC';
  isValid: boolean;
} {
  const parsed = parseQRString(qrData);

  if (!parsed.isValid) {
    throw new AppError(400, 'QR data is invalid (CRC mismatch or malformed)', 'INVALID_QR');
  }

  return {
    merchantName: parsed.merchantName,
    merchantCuit: parsed.merchantAccountInfo.merchantCuit,
    merchantCbu: parsed.merchantAccountInfo.merchantCbu,
    mcc: parsed.mcc,
    amount: parsed.amount,
    currency: parsed.currency === '032' ? 'ARS' : parsed.currency,
    pointOfInitiation: parsed.pointOfInitiation,
    isValid: parsed.isValid,
  };
}

// ── Initiate Payment ──

export async function initiatePayment(
  input: PayInput,
  userId: string,
): Promise<{ transactionId: string; status: string; id_debin?: string; qr_id_trx: string }> {
  const parsed = parseQRString(input.qr_data);

  if (!parsed.isValid) {
    throw new AppError(400, 'QR data is invalid', 'INVALID_QR');
  }

  // Determine amount: dynamic QR has amount embedded, static needs it from input
  const amount = parsed.pointOfInitiation === 'DYNAMIC' && parsed.amount
    ? parsed.amount
    : input.amount;

  if (!amount || amount <= 0) {
    throw new AppError(400, 'Amount is required for static QR codes', 'AMOUNT_REQUIRED');
  }

  const qrIdTrx = randomUUID();

  // Create the outbound transaction
  const transaction = await prisma.transaction.create({
    data: {
      qr_id_trx: qrIdTrx,
      direction: 'OUTBOUND',
      merchant_id: null,
      status: TxStatus.CREADO,
      amount: new Prisma.Decimal(amount),
      currency: parsed.currency === '032' ? 'ARS' : (parsed.currency || 'ARS'),
      buyer_cuit: input.buyer_cuit,
      buyer_cbu: input.buyer_cbu,
      buyer_account_id: userId,
      mcc: parsed.mcc,
      external_merchant_cuit: parsed.merchantAccountInfo.merchantCuit,
      external_merchant_name: parsed.merchantName,
      external_merchant_cbu: parsed.merchantAccountInfo.merchantCbu,
      scanned_qr_data: input.qr_data,
      coelsa_messages: [],
    },
  });

  // Build QRDebin request
  const debinRequest = {
    operacion: {
      administrador: { cuit: env.PSP_CUIT },
      vendedor: {
        cuit: parsed.merchantAccountInfo.merchantCuit,
        cbu: parsed.merchantAccountInfo.merchantCbu,
        banco: parsed.merchantAccountInfo.merchantCbu.substring(0, 3),
        sucursal: parsed.merchantAccountInfo.merchantCbu.substring(3, 7),
      },
      comprador: {
        cuenta: { cbu: input.buyer_cbu },
        cuit: input.buyer_cuit,
      },
      detalle: {
        concepto: 'VAR',
        moneda: '032',
        importe: amount,
        tiempo_expiracion: 10,
        descripcion: input.description,
        qr: input.qr_data,
        qr_id_trx: qrIdTrx,
        id_billetera: env.COELSA_BILLETERA_ID,
      },
      datos_generador: {
        ip_cliente: '',
        tipo_dispositivo: '',
        plataforma: '',
        imsi: '',
        imei: '',
      },
    },
  };

  const outboundMessage = coelsaMessage('QRDebin', 'outbound', debinRequest);

  try {
    const response = await CoelsaAdapter.sendQRDebin(debinRequest);
    const inboundMessage = coelsaMessage('QRDebin', 'inbound', response);

    if (response.respuesta.codigo === '7100') {
      const debinId = response.debin?.id;

      await prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          status: TxStatus.EN_CURSO,
          id_debin: debinId,
          coelsa_messages: [
            outboundMessage as unknown as Prisma.InputJsonValue,
            inboundMessage as unknown as Prisma.InputJsonValue,
          ],
        },
      });

      // Sandbox: auto-complete after 2 seconds
      if (env.COELSA_MODE === 'sandbox') {
        setTimeout(async () => {
          try {
            await handleOperationFinished({
              operacion_original: {
                id: debinId ?? qrIdTrx,
                tipo: 'debinqr',
                qr_id_trx: qrIdTrx,
                importe: amount,
              },
              respuesta: { codigo: '5700', descripcion: 'OPERACION PROCESADA CORRECTAMENTE' },
            });
          } catch (err) {
            logger.error(err, 'Sandbox auto-complete failed for outbound payment');
          }
        }, 2000);
      }

      return { transactionId: transaction.id, status: TxStatus.EN_CURSO, id_debin: debinId, qr_id_trx: qrIdTrx };
    }

    // Error from Coelsa
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TxStatus.REVERSADO,
        error_code: response.respuesta.codigo,
        error_description: response.respuesta.descripcion,
        completed_at: new Date(),
        coelsa_messages: [
          outboundMessage as unknown as Prisma.InputJsonValue,
          inboundMessage as unknown as Prisma.InputJsonValue,
        ],
      },
    });

    return { transactionId: transaction.id, status: TxStatus.REVERSADO, qr_id_trx: qrIdTrx };
  } catch (error) {
    logger.error(error, 'Error sending QRDebin');

    await prisma.transaction.update({
      where: { id: transaction.id },
      data: {
        status: TxStatus.REVERSADO,
        error_code: 'NETWORK_ERROR',
        error_description: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date(),
        coelsa_messages: [outboundMessage as unknown as Prisma.InputJsonValue],
      },
    });

    throw new AppError(502, 'Failed to communicate with Coelsa', 'COELSA_ERROR');
  }
}

// ── List wallet transactions ──

export async function getWalletTransactions(
  filters: WalletTransactionFilters,
  userId: string,
): Promise<{ data: unknown[]; total: number; page: number; limit: number; totalPages: number }> {
  const where: Prisma.TransactionWhereInput = {
    direction: 'OUTBOUND',
    buyer_account_id: userId,
  };

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

  const skip = (filters.page - 1) * filters.limit;

  const [data, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      skip,
      take: filters.limit,
      orderBy: { created_at: 'desc' },
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

// ── Get single wallet transaction ──

export async function getWalletTransactionById(
  id: string,
  userId: string,
): Promise<unknown> {
  const transaction = await prisma.transaction.findFirst({
    where: {
      id,
      direction: 'OUTBOUND',
      buyer_account_id: userId,
    },
  });

  if (!transaction) {
    throw new AppError(404, 'Transaction not found', 'NOT_FOUND');
  }

  return transaction;
}
