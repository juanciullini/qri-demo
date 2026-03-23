import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import { scanQR, pay, listTransactions, getTransaction } from './wallet.controller.js';

export async function walletRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // POST /scan - Parse and validate an external QR
  app.post(
    '/scan',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    scanQR,
  );

  // POST /pay - Initiate an outbound payment
  app.post(
    '/pay',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    pay,
  );

  // GET /transactions - List user's outbound transactions
  app.get(
    '/transactions',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    listTransactions,
  );

  // GET /transactions/:id - Get single outbound transaction detail
  app.get<{ Params: { id: string } }>(
    '/transactions/:id',
    { preHandler: [requireRole(Role.ADMIN, Role.OPERATOR)] },
    getTransaction,
  );
}
