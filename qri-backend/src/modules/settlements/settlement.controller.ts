import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as settlementService from './settlement.service.js';
import { AppError } from '../../middleware/error-handler.js';
import { Role } from '../../config/constants.js';

// ── Validation schemas ──

const generateSettlementSchema = z.object({
  merchant_id: z.string().uuid(),
  period_start: z.coerce.date(),
  period_end: z.coerce.date(),
}).refine(
  (data) => data.period_end > data.period_start,
  { message: 'period_end must be after period_start', path: ['period_end'] },
);

const settlementFiltersSchema = z.object({
  merchant_id: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'SETTLED', 'RECONCILED']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const exportSchema = z.object({
  format: z.enum(['csv', 'excel']),
});

// ── Generate Settlement ──

export async function generateSettlementHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = generateSettlementSchema.parse(request.body);
  const settlement = await settlementService.generateSettlement(
    body.merchant_id,
    body.period_start,
    body.period_end,
  );
  reply.status(201).send(settlement);
}

// ── Get Settlements ──

export async function getSettlementsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = settlementFiltersSchema.parse(request.query);

  // MERCHANT role can only see their own settlements
  if (request.user?.role === Role.MERCHANT) {
    if (!request.user.merchantId) {
      throw new AppError(403, 'No merchant associated with this user', 'NO_MERCHANT');
    }
    filters.merchant_id = request.user.merchantId;
  }

  const result = await settlementService.getSettlements(filters);
  reply.send(result);
}

// ── Get Settlement By ID ──

export async function getSettlementByIdHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const settlement = await settlementService.getSettlementById(id);

  // MERCHANT role can only see their own settlements
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== settlement.merchant_id) {
    throw new AppError(403, 'Access denied to this settlement', 'FORBIDDEN');
  }

  reply.send(settlement);
}

// ── Export Settlement ──

export async function exportSettlementHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const query = exportSchema.parse(request.query);

  // Check access for MERCHANT role
  const settlement = await settlementService.getSettlementById(id);
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== settlement.merchant_id) {
    throw new AppError(403, 'Access denied to this settlement', 'FORBIDDEN');
  }

  const result = await settlementService.exportSettlement(id, query.format);

  reply
    .header('Content-Type', result.contentType)
    .header('Content-Disposition', `attachment; filename="${result.filename}"`)
    .send(result.data);
}
