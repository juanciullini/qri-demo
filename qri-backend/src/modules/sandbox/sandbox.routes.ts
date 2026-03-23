import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { CoelsaAdapter } from '../coelsa/coelsa.adapter.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';

// ── Validation schema for config update ──

const sandboxConfigSchema = z.object({
  default_scenario: z.enum([
    'happy_path',
    'timeout_intention',
    'fail_intention',
    'reject_confirm',
    'timeout_confirm',
    'error_debit',
    'error_credit',
    'expired',
    'refund_total',
    'refund_partial',
    'custom_delay',
  ]).optional(),
  response_delay_ms: z.number().int().min(0).max(30000).optional(),
});

export async function sandboxRoutes(app: FastifyInstance): Promise<void> {
  // All sandbox routes require authentication
  app.addHook('preHandler', authMiddleware);

  // ── GET /scenarios - List available sandbox scenarios ──
  app.get('/scenarios', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const scenarios = CoelsaAdapter.sandbox.getScenarios();
    reply.send({ scenarios });
  });

  // ── GET /config - Get current sandbox configuration ──
  app.get('/config', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const config = CoelsaAdapter.sandbox.getConfig();
    reply.send(config);
  });

  // ── POST /config - Update sandbox configuration ──
  app.post('/config', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)],
  }, async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const body = sandboxConfigSchema.parse(request.body);
    CoelsaAdapter.sandbox.setConfig(body);
    const updatedConfig = CoelsaAdapter.sandbox.getConfig();
    reply.send(updatedConfig);
  });
}
