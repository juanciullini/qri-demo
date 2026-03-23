import type { FastifyReply, FastifyRequest } from 'fastify';
import { loginSchema, refreshSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export async function loginHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = loginSchema.parse(request.body);
  const result = await authService.login(body);
  reply.send(result);
}

export async function refreshHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = refreshSchema.parse(request.body);
  const result = await authService.refresh(body.refresh_token);
  reply.send(result);
}

export async function logoutHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = refreshSchema.parse(request.body);
  await authService.logout(request.user!.userId, body.refresh_token);
  reply.status(204).send();
}

export async function meHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const user = await authService.getMe(request.user!.userId);
  reply.send(user);
}
