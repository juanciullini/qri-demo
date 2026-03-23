import { vi, describe, it, expect, beforeEach } from 'vitest';

// ── Mock dependencies that CoelsaSandbox imports at module level ──

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    child: vi.fn().mockReturnThis(),
  },
}));

vi.mock('../../src/config/env.js', () => ({
  env: {
    SANDBOX_DEFAULT_SCENARIO: 'happy_path',
    SANDBOX_DELAY_MS: 0,
  },
}));

import { CoelsaSandbox } from '../../src/modules/coelsa/coelsa.sandbox.js';
import type {
  QRDebinRequest,
  QRSolicitudContraCargoRequest,
  QROperacionOkRequest,
} from '../../src/modules/coelsa/coelsa.types.js';

// ── Shared fixtures ──

function makeDebinRequest(qrIdTrx?: string): QRDebinRequest {
  return {
    operacion: {
      administrador: { cuit: '30709900043' },
      vendedor: {
        cuit: '30000000001',
        cbu: '0000000000000000000001',
        banco: '000',
        sucursal: '0000',
      },
      comprador: {
        cuenta: { cbu: '0000000000000000000002' },
        cuit: '20300000001',
      },
      detalle: {
        concepto: 'VAR',
        moneda: '032',
        importe: 1500.0,
        tiempo_expiracion: 5,
        qr: 'test-qr-data',
        qr_id_trx: qrIdTrx ?? `TEST-${Date.now()}`,
        id_billetera: 1,
      },
    },
  };
}

function makeRefundRequest(qrIdTrx: string): QRSolicitudContraCargoRequest {
  return {
    operacion_original: {
      detalle: {
        moneda: '032',
        importe: 1500.0,
        motivo: 'Devolucion de prueba',
      },
      vendedor: {
        cuit: '30000000001',
        cbu: '0000000000000000000001',
      },
      tipo: 'contracargo',
      qr_id_trx: qrIdTrx,
    },
  };
}

function makeOperacionOkRequest(qrIdTrx: string): QROperacionOkRequest {
  return {
    operacion_original: {
      vendedor: {
        cuit: '30000000001',
        cbu: '0000000000000000000001',
      },
      id: `SBX-${qrIdTrx}`,
      tipo: 'debinqr',
      qr_id_trx: qrIdTrx,
    },
  };
}

// ── Tests ──

describe('CoelsaSandbox', () => {
  let sandbox: CoelsaSandbox;

  beforeEach(() => {
    sandbox = new CoelsaSandbox();
  });

  // ────────────────────────────────────────────────
  // sendQRDebin
  // ────────────────────────────────────────────────

  describe('sendQRDebin', () => {
    it('should return a successful DEBIN creation response', async () => {
      const request = makeDebinRequest();
      const response = await sandbox.sendQRDebin(request);

      expect(response.respuesta.codigo).toBe('7100');
      expect(response.respuesta.descripcion).toBe('CREACION CORRECTA');
      expect(response.debin).toBeDefined();
      expect(response.debin!.id).toMatch(/^SBX-/);
      expect(response.debin!.estado.codigo).toBe('INICIADO');
      expect(response.debin!.addDt).toBeDefined();
      expect(response.debin!.fechaExpiracion).toBeDefined();
      expect(response.evaluacion).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────
  // queryTransaction
  // ────────────────────────────────────────────────

  describe('queryTransaction', () => {
    it('should return an ACREDITADO transaction', async () => {
      const response = await sandbox.queryTransaction('test-qr-id', 'psp-1');

      expect(response.respuesta.codigo).toBe('0000');
      expect(response.operacion.estado.codigo).toBe('ACREDITADO');
      expect(response.operacion.id).toBe('SBX-test-qr-id');
      expect(response.operacion.comprador.cuit).toBe('20300000001');
      expect(response.operacion.vendedor.cuit).toBe('30000000001');
      expect(response.operacion.tipo).toBe('debinqr');
      expect(response.operacion.garantiaOk).toBe(true);
    });
  });

  // ────────────────────────────────────────────────
  // sendOperacionOk
  // ────────────────────────────────────────────────

  describe('sendOperacionOk', () => {
    it('should return success response code 0000', async () => {
      const request = makeOperacionOkRequest('test-trx-1');
      const response = await sandbox.sendOperacionOk(request);

      expect(response.respuesta.codigo).toBe('0000');
      expect(response.respuesta.descripcion).toContain('OK');
    });
  });

  // ────────────────────────────────────────────────
  // requestRefund
  // ────────────────────────────────────────────────

  describe('requestRefund', () => {
    it('should return response code 5600 for successful refund', async () => {
      const request = makeRefundRequest('test-trx-refund');
      const response = await sandbox.requestRefund(request);

      expect(response.respuesta.codigo).toBe('5600');
      expect(response.respuesta.descripcion).toContain('CONTRA-CARGO');
      expect(response.id).toMatch(/^CC-SBX-/);
      expect(response.tipo).toBe('contraCargo');
      expect(response.fecha_negocio).toBeDefined();
    });
  });

  // ────────────────────────────────────────────────
  // simulateIntencionPago
  // ────────────────────────────────────────────────

  describe('simulateIntencionPago', () => {
    const qrIdTrx = 'intention-test';
    const merchantCuit = '30000000001';

    it('happy_path: shouldPass=true, delayMs=0', () => {
      const result = sandbox.simulateIntencionPago('happy_path', qrIdTrx, merchantCuit);

      expect(result.shouldPass).toBe(true);
      expect(result.delayMs).toBe(0);
      expect(result.failCode).toBeUndefined();
      expect(result.reversalCode).toBeUndefined();
    });

    it('timeout_intention: shouldPass=false, reversalCode=6200', () => {
      const result = sandbox.simulateIntencionPago('timeout_intention', qrIdTrx, merchantCuit);

      expect(result.shouldPass).toBe(false);
      expect(result.delayMs).toBe(3500);
      expect(result.reversalCode).toBe('6200');
    });

    it('fail_intention: shouldPass=false, failCode=7101', () => {
      const result = sandbox.simulateIntencionPago('fail_intention', qrIdTrx, merchantCuit);

      expect(result.shouldPass).toBe(false);
      expect(result.delayMs).toBe(0);
      expect(result.failCode).toBe('7101');
      expect(result.failDescription).toBe('ERROR DATOS OPERACION');
    });

    it('expired: shouldPass=false, reversalCode=6201', () => {
      const result = sandbox.simulateIntencionPago('expired', qrIdTrx, merchantCuit);

      expect(result.shouldPass).toBe(false);
      expect(result.delayMs).toBe(0);
      expect(result.reversalCode).toBe('6201');
    });
  });

  // ────────────────────────────────────────────────
  // simulateConfirmaDebito
  // ────────────────────────────────────────────────

  describe('simulateConfirmaDebito', () => {
    it('happy_path: shouldApprove=true', () => {
      const result = sandbox.simulateConfirmaDebito('happy_path');

      expect(result.shouldApprove).toBe(true);
      expect(result.delayMs).toBe(0);
      expect(result.reversalCode).toBeUndefined();
    });

    it('reject_confirm: shouldApprove=false, no reversalCode', () => {
      const result = sandbox.simulateConfirmaDebito('reject_confirm');

      expect(result.shouldApprove).toBe(false);
      expect(result.delayMs).toBe(0);
      expect(result.reversalCode).toBeUndefined();
    });

    it('timeout_confirm: shouldApprove=false, reversalCode=6200', () => {
      const result = sandbox.simulateConfirmaDebito('timeout_confirm');

      expect(result.shouldApprove).toBe(false);
      expect(result.delayMs).toBe(3500);
      expect(result.reversalCode).toBe('6200');
    });

    it('error_debit: shouldApprove=false, reversalCode=6204', () => {
      const result = sandbox.simulateConfirmaDebito('error_debit');

      expect(result.shouldApprove).toBe(false);
      expect(result.delayMs).toBe(0);
      expect(result.reversalCode).toBe('6204');
    });

    it('error_credit: shouldApprove=false, reversalCode=6203', () => {
      const result = sandbox.simulateConfirmaDebito('error_credit');

      expect(result.shouldApprove).toBe(false);
      expect(result.delayMs).toBe(0);
      expect(result.reversalCode).toBe('6203');
    });
  });

  // ────────────────────────────────────────────────
  // Scenario config (getConfig / setConfig)
  // ────────────────────────────────────────────────

  describe('Scenario config', () => {
    it('should return default config', () => {
      const config = sandbox.getConfig();

      expect(config.default_scenario).toBe('happy_path');
      expect(config.response_delay_ms).toBe(0);
    });

    it('should update config via setConfig', () => {
      sandbox.setConfig({ default_scenario: 'timeout_intention', response_delay_ms: 2000 });

      const config = sandbox.getConfig();
      expect(config.default_scenario).toBe('timeout_intention');
      expect(config.response_delay_ms).toBe(2000);
    });

    it('should allow partial config updates', () => {
      sandbox.setConfig({ response_delay_ms: 500 });

      const config = sandbox.getConfig();
      expect(config.default_scenario).toBe('happy_path');
      expect(config.response_delay_ms).toBe(500);
    });
  });

  // ────────────────────────────────────────────────
  // Per-transaction scenario override
  // ────────────────────────────────────────────────

  describe('Per-transaction scenario override', () => {
    it('should return the overridden scenario for a specific transaction', () => {
      sandbox.setTransactionScenario('trx-override-1', 'fail_intention');

      const scenario = sandbox.getScenarioFor('trx-override-1');
      expect(scenario).toBe('fail_intention');
    });

    it('should consume the override (second call returns default)', () => {
      sandbox.setTransactionScenario('trx-consume-test', 'error_debit');

      // First call: returns the override
      const first = sandbox.getScenarioFor('trx-consume-test');
      expect(first).toBe('error_debit');

      // Second call: override consumed, returns default
      const second = sandbox.getScenarioFor('trx-consume-test');
      expect(second).toBe('happy_path');
    });

    it('should return default scenario when no override is set', () => {
      const scenario = sandbox.getScenarioFor('trx-no-override');
      expect(scenario).toBe('happy_path');
    });

    it('should return default scenario when qrIdTrx is undefined', () => {
      const scenario = sandbox.getScenarioFor(undefined);
      expect(scenario).toBe('happy_path');
    });
  });

  // ────────────────────────────────────────────────
  // Merchant ABM sandbox
  // ────────────────────────────────────────────────

  describe('Merchant ABM sandbox', () => {
    it('registerMerchant should return respuesta.codigo 0000', async () => {
      const response = await sandbox.registerMerchant({
        comercio: {
          com_cvu: '0000000000000000000099',
          com_cuit: '30111111111',
          com_cbu: '0720000000000000000099',
          com_porcentaje: 0.85,
          com_habilitado: true,
        },
      });

      expect(response.respuesta.codigo).toBe('0000');
      expect(response.comercio).toBeDefined();
      expect(response.comercio!.com_cuit).toBe('30111111111');
      expect(response.comercio!.com_cvu).toBe('0000000000000000000099');
    });

    it('getMerchants should return an empty list', async () => {
      const response = await sandbox.getMerchants();

      expect(response.respuesta.codigo).toBe('0000');
      expect(response.banco).toBeDefined();
      expect(response.banco!.listacomercios).toEqual([]);
    });

    it('getMerchant should return merchant data for given CVU and CUIT', async () => {
      const cvu = '0000000000000000000099';
      const cuit = '30111111111';
      const response = await sandbox.getMerchant(cvu, cuit);

      expect(response.respuesta.codigo).toBe('0000');
      expect(response.comercio).toBeDefined();
      expect(response.comercio!.com_cvu).toBe(cvu);
      expect(response.comercio!.com_cuit).toBe(cuit);
      expect(response.comercio!.com_habilitado).toBe(true);
      expect(typeof response.comercio!.com_porcentaje).toBe('number');
    });

    it('deleteMerchant should return respuesta.codigo 0000', async () => {
      const response = await sandbox.deleteMerchant(
        '0000000000000000000099',
        '30111111111',
      );

      expect(response.respuesta.codigo).toBe('0000');
    });
  });

  // ────────────────────────────────────────────────
  // getScenarios
  // ────────────────────────────────────────────────

  describe('getScenarios', () => {
    it('should return all available sandbox scenarios', () => {
      const scenarios = sandbox.getScenarios();

      expect(scenarios).toHaveProperty('happy_path');
      expect(scenarios).toHaveProperty('timeout_intention');
      expect(scenarios).toHaveProperty('fail_intention');
      expect(scenarios).toHaveProperty('reject_confirm');
      expect(scenarios).toHaveProperty('timeout_confirm');
      expect(scenarios).toHaveProperty('error_debit');
      expect(scenarios).toHaveProperty('error_credit');
      expect(scenarios).toHaveProperty('expired');
      expect(scenarios).toHaveProperty('refund_total');
      expect(scenarios).toHaveProperty('refund_partial');
      expect(scenarios).toHaveProperty('custom_delay');
    });
  });
});
