import type { FastifyReply, FastifyRequest } from 'fastify';
import type { RoleType } from '../config/constants.js';
import { AppError } from './error-handler.js';

export function requireRole(...roles: RoleType[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new AppError(401, 'Authentication required', 'UNAUTHORIZED');
    }
    if (!roles.includes(request.user.role as RoleType)) {
      throw new AppError(403, 'Insufficient permissions', 'FORBIDDEN');
    }
  };
}
