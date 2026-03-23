import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  createMerchantHandler,
  getMerchantsHandler,
  getMerchantByIdHandler,
  updateMerchantHandler,
  deleteMerchantHandler,
  activateMerchantHandler,
  suspendMerchantHandler,
  getMerchantStatsHandler,
} from './merchant.controller.js';

export async function merchantRoutes(app: FastifyInstance): Promise<void> {
  // All merchant routes require authentication
  app.addHook('preHandler', authMiddleware);

  // ── List merchants (ADMIN, OPERATOR, MERCHANT sees own) ──
  app.get('/', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getMerchantsHandler);

  // ── Create merchant (ADMIN, OPERATOR only) ──
  app.post('/', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, createMerchantHandler);

  // ── Get merchant by ID (ADMIN, OPERATOR, MERCHANT sees own) ──
  app.get('/:id', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getMerchantByIdHandler);

  // ── Update merchant (ADMIN, OPERATOR only) ──
  app.put('/:id', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, updateMerchantHandler);

  // ── Delete merchant - soft delete (ADMIN only) ──
  app.delete('/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, deleteMerchantHandler);

  // ── Activate merchant (ADMIN, OPERATOR) ──
  app.post('/:id/activate', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, activateMerchantHandler);

  // ── Suspend merchant (ADMIN, OPERATOR) ──
  app.post('/:id/suspend', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, suspendMerchantHandler);

  // ── Get merchant stats (ADMIN, OPERATOR, MERCHANT sees own) ──
  app.get('/:id/stats', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getMerchantStatsHandler);
}
