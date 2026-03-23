import type { FastifyReply, FastifyRequest } from 'fastify';
import { createMerchantSchema, updateMerchantSchema, merchantFiltersSchema } from './merchant.schemas.js';
import * as merchantService from './merchant.service.js';
import { AppError } from '../../middleware/error-handler.js';
import { Role } from '../../config/constants.js';

// ── Create Merchant ──

export async function createMerchantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = createMerchantSchema.parse(request.body);
  const merchant = await merchantService.createMerchant(body);
  reply.status(201).send(merchant);
}

// ── Get Merchants ──

export async function getMerchantsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const filters = merchantFiltersSchema.parse(request.query);

  // MERCHANT role can only see their own merchant
  if (request.user?.role === Role.MERCHANT) {
    if (!request.user.merchantId) {
      throw new AppError(403, 'No merchant associated with this user', 'NO_MERCHANT');
    }
    const merchant = await merchantService.getMerchantById(request.user.merchantId);
    reply.send({ data: [merchant], pagination: { page: 1, limit: 1, total: 1, total_pages: 1 } });
    return;
  }

  const result = await merchantService.getMerchants(filters);
  reply.send(result);
}

// ── Get Merchant By ID ──

export async function getMerchantByIdHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };

  // MERCHANT role can only see their own merchant
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== id) {
    throw new AppError(403, 'Access denied to this merchant', 'FORBIDDEN');
  }

  const merchant = await merchantService.getMerchantById(id);
  reply.send(merchant);
}

// ── Update Merchant ──

export async function updateMerchantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const body = updateMerchantSchema.parse(request.body);
  const merchant = await merchantService.updateMerchant(id, body);
  reply.send(merchant);
}

// ── Delete Merchant ──

export async function deleteMerchantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const merchant = await merchantService.deleteMerchant(id);
  reply.send(merchant);
}

// ── Activate Merchant ──

export async function activateMerchantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const merchant = await merchantService.activateMerchant(id);
  reply.send(merchant);
}

// ── Suspend Merchant ──

export async function suspendMerchantHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };
  const merchant = await merchantService.suspendMerchant(id);
  reply.send(merchant);
}

// ── Get Merchant Stats ──

export async function getMerchantStatsHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const { id } = request.params as { id: string };

  // MERCHANT role can only see their own stats
  if (request.user?.role === Role.MERCHANT && request.user.merchantId !== id) {
    throw new AppError(403, 'Access denied to this merchant', 'FORBIDDEN');
  }

  const stats = await merchantService.getMerchantStats(id);
  reply.send(stats);
}
