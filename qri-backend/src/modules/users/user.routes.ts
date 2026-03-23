import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { Role } from '../../config/constants.js';
import {
  createUserHandler,
  getUsersHandler,
  getUserByIdHandler,
  updateUserHandler,
  deleteUserHandler,
} from './user.controller.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  // All user management routes require authentication and ADMIN role
  app.addHook('preHandler', authMiddleware);

  // ── List users (ADMIN only) ──
  app.get('/', {
    preHandler: [requireRole(Role.ADMIN)],
  }, getUsersHandler);

  // ── Create user (ADMIN only) ──
  app.post('/', {
    preHandler: [requireRole(Role.ADMIN)],
  }, createUserHandler);

  // ── Get user by ID (ADMIN only) ──
  app.get('/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, getUserByIdHandler);

  // ── Update user (ADMIN only) ──
  app.put('/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, updateUserHandler);

  // ── Delete user - soft delete (ADMIN only) ──
  app.delete('/:id', {
    preHandler: [requireRole(Role.ADMIN)],
  }, deleteUserHandler);
}
