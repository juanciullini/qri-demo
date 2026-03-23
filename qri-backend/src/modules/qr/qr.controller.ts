import type { FastifyReply, FastifyRequest } from 'fastify';
import * as qrService from './qr.service.js';
import { AppError } from '../../middleware/error-handler.js';
import { Role } from '../../config/constants.js';
import { z } from 'zod';

// ── Validation schemas ──

const createStaticQRSchema = z.object({
  merchant_id: z.string().uuid(),
  label: z.string().max(100).optional(),
});

const createDynamicQRSchema = z.object({
  merchant_id: z.string().uuid(),
  amount: z.number().positive('Amount must be positive').max(999999999.99),
  expiration: z.number().int().min(1).max(1440).optional(), // minutes, max 24h
});

const qrFiltersSchema = z.object({
  merchant_id: z.string().uuid().optional(),
  type: z.enum(['STATIC', 'DYNAMIC']).optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'DISABLED']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ── Enforce merchant access for MERCHANT role ──

function enforceMerchantAccess(request: FastifyRequest, merchantId: string): void {
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== merchantId) {
    throw new AppError(403, 'Access denied to this merchant', 'FORBIDDEN');
  }
}

// ── Create Static QR ──

export async function createStaticQRHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createStaticQRSchema.parse(request.body);
  enforceMerchantAccess(request, body.merchant_id);
  const qrCode = await qrService.createStaticQR(body.merchant_id, body.label);
  reply.status(201).send(qrCode);
}

// ── Create Dynamic QR ──

export async function createDynamicQRHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createDynamicQRSchema.parse(request.body);
  enforceMerchantAccess(request, body.merchant_id);
  const qrCode = await qrService.createDynamicQR(body.merchant_id, body.amount, body.expiration);
  reply.status(201).send(qrCode);
}

// ── Get QR Codes ──

export async function getQRCodesHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = qrFiltersSchema.parse(request.query);

  // MERCHANT role can only see their own QR codes
  if (request.user?.role === Role.MERCHANT) {
    if (!request.user.merchantId) {
      throw new AppError(403, 'No merchant associated with this user', 'NO_MERCHANT');
    }
    filters.merchant_id = request.user.merchantId;
  }

  const result = await qrService.getQRCodes(filters);
  reply.send(result);
}

// ── Get QR By ID ──

export async function getQRByIdHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const qrCode = await qrService.getQRById(id);

  // MERCHANT role can only see their own QR codes
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== qrCode.merchant_id) {
    throw new AppError(403, 'Access denied to this QR code', 'FORBIDDEN');
  }

  reply.send(qrCode);
}

// ── Get QR Image ──

export async function getQRImageHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const query = request.query as { format?: string; size?: string };

  const format = (query.format === 'svg' ? 'svg' : 'png') as 'png' | 'svg';
  const size = query.size ? Math.min(Math.max(parseInt(query.size, 10) || 300, 100), 1000) : 300;

  const result = await qrService.getQRImage(id, format, size);

  reply
    .header('Content-Type', result.contentType)
    .header('Cache-Control', 'public, max-age=3600')
    .send(result.data);
}

// ── Get QR PDF ──

export async function getQRPdfHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };

  const result = await qrService.getQRPdf(id);

  reply
    .header('Content-Type', result.contentType)
    .header('Content-Disposition', `attachment; filename="${result.filename}"`)
    .send(result.data);
}

// ── Disable QR ──

export async function disableQRHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };

  // Check ownership for MERCHANT role
  const qrCode = await qrService.getQRById(id);
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== qrCode.merchant_id) {
    throw new AppError(403, 'Access denied to this QR code', 'FORBIDDEN');
  }

  const updated = await qrService.disableQR(id);
  reply.send(updated);
}
