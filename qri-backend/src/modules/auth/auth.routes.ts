import type { FastifyInstance } from 'fastify';
import { loginHandler, refreshHandler, logoutHandler, meHandler } from './auth.controller.js';
import { authMiddleware } from '../../middleware/auth.middleware.js';

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/login', loginHandler);
  app.post('/refresh', refreshHandler);
  app.post('/logout', { preHandler: [authMiddleware] }, logoutHandler);
  app.get('/me', { preHandler: [authMiddleware] }, meHandler);
}
