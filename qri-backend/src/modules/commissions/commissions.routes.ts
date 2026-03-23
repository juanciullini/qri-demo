import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  createProfileHandler,
  updateProfileHandler,
  getProfilesHandler,
  getProfileByIdHandler,
  deleteProfileHandler,
  assignProfileHandler,
  getDashboardHandler,
} from './commissions.controller.js';

export async function commissionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authMiddleware);

  // ── Profiles CRUD (ADMIN only) ──
  app.get('/profiles', {
    preHandler: [requireRole(Role.ADMIN)],
  }, getProfilesHandler);

  app.post('/profiles', {
    preHandler: [requireRole(Role.ADMIN)],
  }, createProfileHandler);

  app.get('/profiles/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, getProfileByIdHandler);

  app.put('/profiles/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, updateProfileHandler);

  app.delete('/profiles/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, deleteProfileHandler);

  // ── Assign profile to merchant (ADMIN only) ──
  app.post('/assign', {
    preHandler: [requireRole(Role.ADMIN)],
  }, assignProfileHandler);

  // ── Dashboard (all authenticated roles) ──
  app.get('/dashboard', {
    preHandler: [requireRole(Role.ADMIN, Role.OPERATOR, Role.MERCHANT, Role.VIEWER)],
  }, getDashboardHandler);
}
