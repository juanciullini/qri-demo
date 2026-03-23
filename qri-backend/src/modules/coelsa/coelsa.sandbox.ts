import { logger } from '../../utils/logger.js';
import { env } from '../../config/env.js';
import type {
  CoelsaBaseResponse,
  CoelsaMerchantCreate,
  CoelsaMerchantListResponse,
  CoelsaMerchantResponse,
  CoelsaMerchantUpdate,
  QRDebinQueryResponse,
  QRDebinRequest,
  QRDebinResponse,
  QROperacionOkRequest,
  QRSolicitudContraCargoRequest,
  QRSolicitudContraCargoResponse,
} from './coelsa.types.js';

export type SandboxScenario =
  | 'happy_path'
  | 'timeout_intention'
  | 'fail_intention'
  | 'reject_confirm'
  | 'timeout_confirm'
  | 'error_debit'
  | 'error_credit'
  | 'expired'
  | 'refund_total'
  | 'refund_partial'
  | 'custom_delay';

export const SANDBOX_SCENARIOS: Record<SandboxScenario, string> = {
  happy_path: 'IntencionPago: PASS. ConfirmaDebito: APPROVED. OperacionFinalizada: 5700 OK',
  timeout_intention: 'IntencionPago: simula delay >3s, luego QRReverso con codigo 6200 TIMEOUT',
  fail_intention: 'IntencionPago: responde FAIL con code 7101 ERROR DATOS OPERACION',
  reject_confirm: 'IntencionPago: PASS. ConfirmaDebito: REJECTED con error generico',
  timeout_confirm: 'IntencionPago: PASS. ConfirmaDebito: simula delay >3s, luego QRReverso 6200',
  error_debit: 'IntencionPago: PASS. Simula error en AvisoDebinPendiente. QRReverso 6204',
  error_credit: 'IntencionPago: PASS. Simula error en Credito Forzado. QRReverso 6203',
  expired: 'Simula expiracion de operacion >15s. QRReverso 6201',
  refund_total: 'Happy path completo + luego QROperacionFinalizada 5705 DEVOLUCION TOTAL',
  refund_partial: 'Happy path completo + luego QROperacionFinalizada 5708 DEVOLUCION PARCIAL',
  custom_delay: 'Happy path pero con delay configurable (usa SANDBOX_DELAY_MS env var)',
};

export class CoelsaSandbox {
  private defaultScenario: SandboxScenario = (env.SANDBOX_DEFAULT_SCENARIO as SandboxScenario) || 'happy_path';
  private delayMs: number = env.SANDBOX_DELAY_MS || 0;

  // Per-transaction scenario override (set via header X-Sandbox-Scenario)
  private transactionScenarios: Map<string, SandboxScenario> = new Map();

  getScenarios(): Record<SandboxScenario, string> {
    return SANDBOX_SCENARIOS;
  }

  getConfig(): { default_scenario: SandboxScenario; response_delay_ms: number } {
    return { default_scenario: this.defaultScenario, response_delay_ms: this.delayMs };
  }

  setConfig(config: { default_scenario?: SandboxScenario; response_delay_ms?: number }): void {
    if (config.default_scenario) this.defaultScenario = config.default_scenario;
    if (config.response_delay_ms !== undefined) this.delayMs = config.response_delay_ms;
  }

  setTransactionScenario(qrIdTrx: string, scenario: SandboxScenario): void {
    this.transactionScenarios.set(qrIdTrx, scenario);
  }

  getScenarioFor(qrIdTrx?: string): SandboxScenario {
    if (qrIdTrx) {
      const override = this.transactionScenarios.get(qrIdTrx);
      if (override) {
        this.transactionScenarios.delete(qrIdTrx);
        return override;
      }
    }
    return this.defaultScenario;
  }

  private async delay(ms?: number): Promise<void> {
    const wait = ms ?? this.delayMs;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  }

  // ═══ Transactional simulations ═══

  async sendQRDebin(request: QRDebinRequest): Promise<QRDebinResponse> {
    const scenario = this.getScenarioFor(request.operacion.detalle.qr_id_trx);
    logger.info({ scenario, qr_id_trx: request.operacion.detalle.qr_id_trx }, 'Sandbox: sendQRDebin');

    await this.delay();

    const debinId = `SBX-${Date.now()}`;
    return {
      respuesta: { codigo: '7100', descripcion: 'CREACION CORRECTA' },
      debin: {
        id: debinId,
        estado: { codigo: 'INICIADO', descripcion: 'Operación iniciada' },
        addDt: new Date().toISOString(),
        fechaExpiracion: new Date(Date.now() + 600000).toISOString(),
      },
      evaluacion: { puntaje: 0, reglas: '' },
    };
  }

  async queryTransaction(qrIdTrx: string, _idPsp: string): Promise<QRDebinQueryResponse> {
    logger.info({ qr_id_trx: qrIdTrx }, 'Sandbox: queryTransaction');
    return {
      operacion: {
        id: `SBX-${qrIdTrx}`,
        comprador: {
          codigo: '000',
          titular: 'Comprador Sandbox',
          cuit: '20300000001',
          cuenta: { banco: '000', sucursal: '0000', cbu: '0000000000000000000000', esTitular: 1, moneda: '032', tipo: 'CVU' },
        },
        detalle: {
          concepto: 'VAR',
          idUsuario: 0,
          idComprobante: 0,
          moneda: '032',
          importe: 1000,
          devolucion: false,
          paymentReference: `PR-SBX-${qrIdTrx}`,
          codigoPostal: '1000',
          mcc: '5411',
          fecha: new Date().toISOString(),
          fechaExpiracion: new Date(Date.now() + 600000).toISOString(),
        },
        vendedor: {
          codigo: '000',
          titular: 'Vendedor Sandbox',
          cuit: '30000000001',
          cuenta: { banco: '000', sucursal: '0000', cbu: '0000000000000000000001', esTitular: 1, moneda: '032', tipo: 'CVU' },
        },
        estado: { codigo: 'ACREDITADO', descripcion: 'Operación acreditada' },
        garantiaOk: true,
        tipo: 'debinqr',
        fechaNegocio: new Date().toISOString(),
      },
      respuesta: { codigo: '0000', descripcion: 'OK' },
    };
  }

  async sendOperacionOk(_request: QROperacionOkRequest): Promise<CoelsaBaseResponse> {
    logger.info('Sandbox: sendOperacionOk');
    return { respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' } };
  }

  async requestRefund(request: QRSolicitudContraCargoRequest): Promise<QRSolicitudContraCargoResponse> {
    logger.info({ qr_id_trx: request.operacion_original.qr_id_trx }, 'Sandbox: requestRefund');
    await this.delay();
    return {
      respuesta: { codigo: '5600', descripcion: 'CONTRA-CARGO REALIZADO CORRECTAMENTE' },
      id: `CC-SBX-${Date.now()}`,
      tipo: 'contraCargo',
      fecha_negocio: new Date().toISOString(),
    };
  }

  // ═══ IntencionPago simulation (COELSA calls us) ═══

  simulateIntencionPago(
    scenario: SandboxScenario,
    qrIdTrx: string,
    merchantCuit: string,
  ): {
    shouldPass: boolean;
    delayMs: number;
    failCode?: string;
    failDescription?: string;
    reversalCode?: string;
  } {
    switch (scenario) {
      case 'timeout_intention':
        return { shouldPass: false, delayMs: 3500, reversalCode: '6200' };
      case 'fail_intention':
        return { shouldPass: false, delayMs: 0, failCode: '7101', failDescription: 'ERROR DATOS OPERACION' };
      case 'expired':
        return { shouldPass: false, delayMs: 0, reversalCode: '6201' };
      default:
        return { shouldPass: true, delayMs: scenario === 'custom_delay' ? this.delayMs : 0 };
    }
  }

  simulateConfirmaDebito(scenario: SandboxScenario): {
    shouldApprove: boolean;
    delayMs: number;
    reversalCode?: string;
  } {
    switch (scenario) {
      case 'reject_confirm':
        return { shouldApprove: false, delayMs: 0 };
      case 'timeout_confirm':
        return { shouldApprove: false, delayMs: 3500, reversalCode: '6200' };
      case 'error_debit':
        return { shouldApprove: false, delayMs: 0, reversalCode: '6204' };
      case 'error_credit':
        return { shouldApprove: false, delayMs: 0, reversalCode: '6203' };
      default:
        return { shouldApprove: true, delayMs: scenario === 'custom_delay' ? this.delayMs : 0 };
    }
  }

  // ═══ Merchant ABM simulations ═══

  async registerMerchant(data: CoelsaMerchantCreate): Promise<CoelsaMerchantResponse> {
    logger.info({ cuit: data.comercio.com_cuit }, 'Sandbox: registerMerchant');
    return {
      respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' },
      comercio: { ...data.comercio },
    };
  }

  async getMerchants(): Promise<CoelsaMerchantListResponse> {
    return {
      respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' },
      banco: { listacomercios: [] },
    };
  }

  async getMerchant(cvu: string, cuit: string): Promise<CoelsaMerchantResponse> {
    return {
      respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' },
      comercio: { com_cvu: cvu, com_cuit: cuit, com_cbu: '0'.repeat(22), com_porcentaje: 0.85, com_habilitado: true },
    };
  }

  async updateMerchant(cvu: string, cuit: string, data: CoelsaMerchantUpdate): Promise<CoelsaMerchantResponse> {
    return {
      respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' },
      comercio: { com_cvu: cvu, com_cuit: cuit, com_cbu: data.com_cbu ?? '0'.repeat(22), com_porcentaje: data.com_porcentaje ?? 0.85, com_habilitado: true },
    };
  }

  async deleteMerchant(_cvu: string, _cuit: string): Promise<CoelsaBaseResponse> {
    return { respuesta: { codigo: '0000', descripcion: 'OK (sandbox)' } };
  }
}
