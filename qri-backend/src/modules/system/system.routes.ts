import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  healthCheckHandler,
  coelsaStatusHandler,
  getConfigHandler,
  updateConfigHandler,
} from './system.controller.js';

export async function systemRoutes(app: FastifyInstance): Promise<void> {
  // ── Health check (no auth required) ──
  app.get('/health', healthCheckHandler);

  // ── Protected routes ──
  app.register(async (protectedApp) => {
    protectedApp.addHook('preHandler', authMiddleware);

    // ── COELSA status (ADMIN, OPERATOR) ──
    protectedApp.get('/coelsa-status', {
      preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
    }, coelsaStatusHandler);

    // ── Get system config (ADMIN only) ──
    protectedApp.get('/config', {
      preHandler: [requireRole(Role.ADMIN)],
    }, getConfigHandler);

    // ── Update system config (ADMIN only) ──
    protectedApp.post('/config', {
      preHandler: [requireRole(Role.ADMIN)],
    }, updateConfigHandler);
  });
}
