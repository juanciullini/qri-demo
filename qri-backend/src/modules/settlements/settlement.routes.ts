import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  generateSettlementHandler,
  getSettlementsHandler,
  getSettlementByIdHandler,
  exportSettlementHandler,
} from './settlement.controller.js';

export async function settlementRoutes(app: FastifyInstance): Promise<void> {
  // All settlement routes require authentication
  app.addHook('preHandler', authMiddleware);

  // ── List settlements ──
  app.get('/', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getSettlementsHandler);

  // ── Generate settlement (ADMIN, OPERATOR only) ──
  app.post('/', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, generateSettlementHandler);

  // ── Get settlement by ID ──
  app.get('/:id', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getSettlementByIdHandler);

  // ── Export settlement ──
  app.get('/:id/export', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, exportSettlementHandler);
}
