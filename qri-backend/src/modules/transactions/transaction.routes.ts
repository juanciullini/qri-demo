import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  listTransactions,
  getTransaction,
  getStats,
  requestRefund,
  exportTransactions,
} from './transaction.controller.js';

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  // All transaction routes require authentication
  app.addHook('preHandler', authMiddleware);

  // GET / - List transactions (all roles; MERCHANT auto-scoped)
  app.get(
    '/',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)] },
    listTransactions,
  );

  // GET /stats - Aggregated statistics (ADMIN, OPERATOR only)
  app.get(
    '/stats',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    getStats,
  );

  // GET /export - Export transactions as CSV/Excel (ADMIN, OPERATOR only)
  app.get(
    '/export',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    exportTransactions,
  );

  // GET /:id - Transaction detail (all roles; MERCHANT sees only own)
  app.get<{ Params: { id: string } }>(
    '/:id',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)] },
    getTransaction,
  );

  // POST /:id/refund - Request refund (ADMIN, OPERATOR only)
  app.post<{ Params: { id: string } }>(
    '/:id/refund',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    requestRefund,
  );
}
