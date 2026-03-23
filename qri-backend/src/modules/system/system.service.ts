import { prisma } from '../../utils/prisma.js';
import { redis } from '../../utils/redis.js';
import { env } from '../../config/env.js';
import { AppError } from '../../middleware/error-handler.js';
import { CoelsaAdapter } from '../coelsa/coelsa.adapter.js';
import { logger } from '../../utils/logger.js';

// ── Health Check ──

export async function healthCheck() {
  const checks: Record<string, { status: string; latency_ms?: number; error?: string }> = {};

  // Database check
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latency_ms: Date.now() - dbStart };
  } catch (err) {
    checks.database = {
      status: 'error',
      latency_ms: Date.now() - dbStart,
      error: err instanceof Error ? err.message : 'Unknown database error',
    };
  }

  // Redis check
  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'ok', latency_ms: Date.now() - redisStart };
  } catch (err) {
    checks.redis = {
      status: 'error',
      latency_ms: Date.now() - redisStart,
      error: err instanceof Error ? err.message : 'Unknown Redis error',
    };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
    environment: env.NODE_ENV,
    coelsa_mode: env.COELSA_MODE,
    uptime_seconds: Math.floor(process.uptime()),
    checks,
  };
}

// ── COELSA Status ──

export async function coelsaStatus() {
  const result: Record<string, unknown> = {
    mode: env.COELSA_MODE,
    timestamp: new Date().toISOString(),
  };

  if (env.COELSA_MODE === 'sandbox') {
    const sandboxConfig = CoelsaAdapter.sandbox.getConfig();
    result.sandbox = {
      default_scenario: sandboxConfig.default_scenario,
      response_delay_ms: sandboxConfig.response_delay_ms,
    };
    result.status = 'ok';
    return result;
  }

  // Production: try to query COELSA merchants endpoint as connectivity check
  try {
    const response = await CoelsaAdapter.getMerchants();
    result.status = response.respuesta?.codigo === '0000' ? 'ok' : 'error';
    result.response_code = response.respuesta?.codigo;
    result.response_description = response.respuesta?.descripcion;
  } catch (err) {
    result.status = 'error';
    result.error = err instanceof Error ? err.message : 'Unknown COELSA error';
    logger.error({ err }, 'COELSA connectivity check failed');
  }

  return result;
}

// ── Get System Config ──

export async function getConfig() {
  const configs = await prisma.systemConfig.findMany({
    orderBy: { key: 'asc' },
  });

  // Convert to key-value map
  const configMap: Record<string, unknown> = {};
  for (const config of configs) {
    configMap[config.key] = config.value;
  }

  return {
    configs: configMap,
    environment: {
      node_env: env.NODE_ENV,
      coelsa_mode: env.COELSA_MODE,
      psp_cuit: env.PSP_CUIT,
      psp_reverse_domain: env.PSP_REVERSE_DOMAIN,
    },
  };
}

// ── Update System Config ──

export async function updateConfig(key: string, value: unknown) {
  if (!key || key.trim().length === 0) {
    throw new AppError(400, 'Config key is required', 'INVALID_KEY');
  }

  const config = await prisma.systemConfig.upsert({
    where: { key },
    update: { value: value as any },
    create: { key, value: value as any },
  });

  logger.info({ key, value }, 'System config updated');
  return config;
}
