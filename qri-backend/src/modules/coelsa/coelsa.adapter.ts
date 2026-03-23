import https from 'node:https';
import fs from 'node:fs';
import { env } from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { COELSA_SYNC_TIMEOUT_MS } from '../../config/constants.js';
import type {
  CoelsaBaseResponse,
  CoelsaMerchantCreate,
  CoelsaMerchantListResponse,
  CoelsaMerchantResponse,
  CoelsaMerchantUpdate,
  CoelsaPSPCreate,
  CoelsaVendorAdhesion,
  CoelsaWalletCreate,
  CoelsaWalletResponse,
  QRDebinQueryResponse,
  QRDebinRequest,
  QRDebinResponse,
  QROperacionOkRequest,
  QRSolicitudContraCargoRequest,
  QRSolicitudContraCargoResponse,
} from './coelsa.types.js';
import { CoelsaSandbox } from './coelsa.sandbox.js';

// ── mTLS Agent (production only) ──

function createHttpsAgent(): https.Agent | undefined {
  if (env.COELSA_MODE !== 'production') return undefined;
  try {
    return new https.Agent({
      cert: fs.readFileSync(env.COELSA_CERT_PATH!),
      key: fs.readFileSync(env.COELSA_KEY_PATH!),
      ca: fs.readFileSync(env.COELSA_CA_PATH!),
      rejectUnauthorized: true,
    });
  } catch (err) {
    logger.error(err, 'Failed to load COELSA certificates');
    throw err;
  }
}

let httpsAgent: https.Agent | undefined;

function getAgent(): https.Agent | undefined {
  if (env.COELSA_MODE !== 'production') return undefined;
  if (!httpsAgent) httpsAgent = createHttpsAgent();
  return httpsAgent;
}

// ── Auth tokens cache ──

interface AuthToken {
  token: string;
  expiresAt: number;
}

const tokenCache: Record<string, AuthToken> = {};

async function getAuthToken(type: 'debin' | 'cvu'): Promise<string> {
  const cacheKey = `coelsa_${type}`;
  const cached = tokenCache[cacheKey];
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const credentials =
    type === 'debin'
      ? {
          username: env.COELSA_DEBIN_USERNAME!,
          password: env.COELSA_DEBIN_PASSWORD!,
          authUser: env.COELSA_DEBIN_ID!,
          authPass: env.COELSA_DEBIN_SECRET!,
        }
      : {
          username: env.COELSA_CVU_USERNAME!,
          password: env.COELSA_CVU_PASSWORD!,
          authUser: env.COELSA_CVU_ID!,
          authPass: env.COELSA_CVU_SECRET!,
        };

  const basicAuth = Buffer.from(`${credentials.authUser}:${credentials.authPass}`).toString('base64');

  const response = await fetch(`${env.COELSA_AUTH_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${basicAuth}`,
    },
    body: JSON.stringify({ username: credentials.username, password: credentials.password }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) throw new Error(`COELSA auth failed: ${response.status}`);
  const data = (await response.json()) as { access_token: string; expires_in: number };

  tokenCache[cacheKey] = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // Refresh 60s before expiry
  };

  return data.access_token;
}

// ── HTTP helper ──

async function coelsaFetch<T>(
  url: string,
  method: string,
  body?: unknown,
  authType: 'debin' | 'cvu' = 'debin',
  timeoutMs: number = COELSA_SYNC_TIMEOUT_MS,
): Promise<T> {
  const token = await getAuthToken(authType);
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  return (await response.json()) as T;
}

// ── Sandbox instance ──

const sandbox = new CoelsaSandbox();

// ── Public Adapter Interface ──

export const CoelsaAdapter = {
  // ═══ Transactional (we call COELSA) ═══

  async sendQRDebin(request: QRDebinRequest): Promise<QRDebinResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.sendQRDebin(request);
    return coelsaFetch<QRDebinResponse>(`${env.COELSA_BASE_URL}/apiDebinV1/QR/QRDebin`, 'POST', request);
  },

  async queryTransaction(qrIdTrx: string, idPsp: string): Promise<QRDebinQueryResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.queryTransaction(qrIdTrx, idPsp);
    return coelsaFetch<QRDebinQueryResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/QRDebin/${qrIdTrx}/${idPsp}`,
      'GET',
    );
  },

  async sendOperacionOk(request: QROperacionOkRequest): Promise<CoelsaBaseResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.sendOperacionOk(request);
    return coelsaFetch<CoelsaBaseResponse>(`${env.COELSA_BASE_URL}/apiDebinV1/QR/QROperacionOk`, 'POST', request);
  },

  // ═══ Refund (we call COELSA) ═══

  async requestRefund(request: QRSolicitudContraCargoRequest): Promise<QRSolicitudContraCargoResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.requestRefund(request);
    return coelsaFetch<QRSolicitudContraCargoResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/QRSolicitudContraCargo`,
      'POST',
      request,
    );
  },

  // ═══ Merchant ABM ═══

  async registerMerchant(data: CoelsaMerchantCreate): Promise<CoelsaMerchantResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.registerMerchant(data);
    return coelsaFetch<CoelsaMerchantResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/Comercio`,
      'POST',
      data,
    );
  },

  async getMerchants(): Promise<CoelsaMerchantListResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.getMerchants();
    return coelsaFetch<CoelsaMerchantListResponse>(`${env.COELSA_BASE_URL}/apiDebinV1/QR/Comercio`, 'GET');
  },

  async getMerchant(cvu: string, cuit: string): Promise<CoelsaMerchantResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.getMerchant(cvu, cuit);
    return coelsaFetch<CoelsaMerchantResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/Comercio/${cvu}/${cuit}`,
      'GET',
    );
  },

  async updateMerchant(cvu: string, cuit: string, data: CoelsaMerchantUpdate): Promise<CoelsaMerchantResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.updateMerchant(cvu, cuit, data);
    return coelsaFetch<CoelsaMerchantResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/Comercio/${cvu}/${cuit}`,
      'PUT',
      data,
    );
  },

  async deleteMerchant(cvu: string, cuit: string): Promise<CoelsaBaseResponse> {
    if (env.COELSA_MODE === 'sandbox') return sandbox.deleteMerchant(cvu, cuit);
    return coelsaFetch<CoelsaBaseResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/Comercio/${cvu}/${cuit}`,
      'DELETE',
    );
  },

  // ═══ Setup (one-time) ═══

  async registerPSP(data: CoelsaPSPCreate): Promise<CoelsaBaseResponse> {
    if (env.COELSA_MODE === 'sandbox') return { respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' } };
    return coelsaFetch<CoelsaBaseResponse>(`${env.COELSA_CVU_URL}/apiCVU/PSP/AltaPSP`, 'POST', data, 'cvu');
  },

  async registerVendor(data: CoelsaVendorAdhesion): Promise<CoelsaBaseResponse> {
    if (env.COELSA_MODE === 'sandbox') return { respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' } };
    return coelsaFetch<CoelsaBaseResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/Vendedor/Adhesion`,
      'POST',
      data,
    );
  },

  async registerWallet(data: CoelsaWalletCreate): Promise<CoelsaWalletResponse> {
    if (env.COELSA_MODE === 'sandbox')
      return { respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' } };
    return coelsaFetch<CoelsaWalletResponse>(
      `${env.COELSA_BASE_URL}/apiDebinV1/QR/Billetera`,
      'POST',
      data,
    );
  },

  // ═══ Sandbox control ═══
  sandbox,
};
