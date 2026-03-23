import api from '@/services/api';
import type { CoelsaStatus, HealthStatus, SystemConfig } from '@/types';

// ── Mappers ──

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapHealthStatus(raw: any): HealthStatus {
  return {
    status: raw.status ?? 'unknown',
    uptime: raw.uptime_seconds ?? raw.uptime ?? 0,
    version: raw.version ?? '',
    timestamp: raw.timestamp ?? '',
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCoelsaStatus(raw: any): CoelsaStatus {
  return {
    connected: raw.connected ?? false,
    lastPing: raw.last_sync ?? raw.last_ping ?? raw.lastPing ?? '',
    latencyMs: raw.latency_ms ?? raw.latencyMs ?? 0,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapSystemConfig(raw: any): SystemConfig {
  return {
    key: raw.key ?? '',
    value: raw.value ?? '',
    description: raw.description,
  };
}

// ── API calls ──

export async function healthCheck(): Promise<HealthStatus> {
  const { data } = await api.get('/system/health');
  return mapHealthStatus(data.data ?? data);
}

export async function coelsaStatus(): Promise<CoelsaStatus> {
  const { data } = await api.get('/system/coelsa-status');
  return mapCoelsaStatus(data.data ?? data);
}

export async function getConfig(): Promise<SystemConfig[]> {
  const { data } = await api.get('/system/config');
  const items = data.data ?? data;
  return Array.isArray(items) ? items.map(mapSystemConfig) : [];
}

export async function updateConfig(
  key: string,
  value: string,
): Promise<SystemConfig> {
  const { data } = await api.post('/system/config', { key, value });
  return mapSystemConfig(data.data ?? data);
}
