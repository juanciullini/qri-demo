import type { FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import * as systemService from './system.service.js';

// ── Health Check ──

export async function healthCheckHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const health = await systemService.healthCheck();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  reply.status(statusCode).send(health);
}

// ── COELSA Status ──

export async function coelsaStatusHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const status = await systemService.coelsaStatus();
  reply.send(status);
}

// ── Get Config ──

export async function getConfigHandler(_request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const config = await systemService.getConfig();
  reply.send(config);
}

// ── Update Config ──

const updateConfigSchema = z.object({
  key: z.string().min(1, 'Key is required'),
  value: z.unknown(),
});

export async function updateConfigHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = updateConfigSchema.parse(request.body);
  const config = await systemService.updateConfig(body.key, body.value);
  reply.send(config);
}
