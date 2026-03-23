// ══════════════════════════════════════════════════════════
// COELSA TRX 3.1 - Complete TypeScript types
// Source of truth: Transferencias 3.1 v1.1 + DEBIN-QR 1.0.9
// ══════════════════════════════════════════════════════════

// ── Common structures ──

export interface CoelsaVendedor {
  cuit: string;
  cbu: string;
  banco: string;
  sucursal: string;
  terminal?: string;
}

export interface CoelsaComprador {
  cuenta: {
    cbu: string;
    alias?: string;
  };
  cuit: string;
}

export interface CoelsaDetalle {
  id_debin: string;
  fecha_negocio: string; // ISO 8601
  concepto: string;
  id_usuario?: number;
  id_comprobante?: number;
  moneda: string; // "032" ARS, "840" USD
  importe: number;
  qr: string;
  qr_hash?: string;
  qr_id_trx: string;
  id_billetera: number;
}

export interface CoelsaInterchangeItem {
  importe_bruto: number;
  importe_neto: number;
  comision_comercio: number;
  importe_comision: number;
  comision_administrador: number;
  categoria_comercio: string;
  mcc: string;
}

export interface CoelsaRespuesta {
  codigo: string;
  descripcion: string;
}

export interface CoelsaMotivo {
  codigo: string;
  descripcion: string;
}

// ── QRIntencionPago (COELSA → Nuestro Backend) ──

export interface QRIntencionPagoRequest {
  operacion: {
    vendedor: CoelsaVendedor;
    comprador: CoelsaComprador;
    detalle: CoelsaDetalle;
    interchange: CoelsaInterchangeItem[]; // Array in IntencionPago
  };
}

export interface QRIntencionPagoResponseOk {
  qr_id_trx: string;
  id_debin: string;
  id_billetera: number;
  fecha_negocio: string;
  validation_data: {
    mcc: string; // 4 digit VISA MCC
    codigo_postal: string;
    payment_reference?: string;
  };
  validation_status: {
    status: 'PASS';
    on_error: null;
  };
}

export interface QRIntencionPagoResponseFail {
  qr_id_trx: string;
  id_debin: string;
  id_billetera: number;
  fecha_negocio: string;
  validation_data: null;
  validation_status: {
    status: 'FAIL';
    on_error: {
      code: string;
      description: string;
    };
  };
}

export type QRIntencionPagoResponse = QRIntencionPagoResponseOk | QRIntencionPagoResponseFail;

// ── QRConfirmaDebito (COELSA → Nuestro Backend) ──

export interface QRConfirmaDebitoRequest {
  operacion: {
    vendedor: CoelsaVendedor;
    comprador: CoelsaComprador;
    detalle: CoelsaDetalle;
    interchange: CoelsaInterchangeItem; // OBJECT (not array) in ConfirmaDebito
    respuesta: {
      codigo: string; // "2800" = DEBITO CONFIRMADO CORRECTAMENTE
      descripcion: string;
    };
  };
}

export interface QRConfirmaDebitoResponseOk {
  qr_id_trx: string;
  id_debin: string;
  id_billetera: number;
  fecha_negocio: string;
  payment_reference: string;
  transaction_status: {
    status: 'APPROVED';
    on_error: null;
  };
}

export interface QRConfirmaDebitoResponseReject {
  qr_id_trx: string;
  id_debin: string;
  id_billetera: number;
  fecha_negocio: string;
  payment_reference?: string;
  transaction_status: {
    status: 'REJECTED';
    on_error: {
      code: string;
      description: string;
    };
  };
}

export type QRConfirmaDebitoResponse = QRConfirmaDebitoResponseOk | QRConfirmaDebitoResponseReject;

// ── QRReverso (COELSA → Nuestro Backend) ──

export interface QRReversoRequest {
  operacion: {
    vendedor: CoelsaVendedor;
    comprador: CoelsaComprador;
    detalle: CoelsaDetalle;
    motivo: CoelsaMotivo;
    // Codes: 6200 TIMEOUT, 6201 EXPIRADA, 6203 ERROR CREDITO,
    // 6204 ERROR DEBITO, 6205 ERROR COM ADQUIRIENTE, 6206 FALLA VALIDACION
  };
}

// ── QROperacionFinalizada (COELSA → Nuestro Backend, when acting as Billetera) ──

export interface QROperacionFinalizadaRequest {
  operacion_original: {
    id: string;
    tipo: string;
    descripcion?: string;
    qr_id_trx: string;
    importe?: number;
    payment_reference?: string;
  };
  contracargo?: {
    id: string;       // ID para contracargo, MAX 22
    ori_trx_id: string; // ID externo para reversa
  };
  respuesta: CoelsaRespuesta;
  // Codes: 5700 OK, 5705 DEVOLUCION TOTAL, 5708 DEVOLUCION PARCIAL,
  // 5709-5713 errors
}

// ── QROperacionFinalizadaAdquirente (COELSA → Nuestro Backend, when acting as PSP/Adquirente) ──

export interface QROperacionFinalizadaAdquirenteRequest {
  operacion_original: {
    id: string;
    tipo: string;
    descripcion?: string;
    qr_id_trx: string;
    importe?: number;
    payment_reference?: string;
  };
  respuesta: CoelsaRespuesta;
  // Only reports 5700 (success). Errors come via QRReverso (6200s).
}

// ── QRDebin (Nuestro Backend → COELSA, when acting as Billetera) ──

export interface QRDebinRequest {
  operacion: {
    administrador: {
      cuit: string; // PSP CUIT
    };
    vendedor: CoelsaVendedor;
    comprador: CoelsaComprador;
    detalle: {
      concepto: string;
      id_usuario?: number;
      id_comprobante?: number;
      moneda: string;
      importe: number;
      tiempo_expiracion: number; // minutes, 1-4320 (72h max)
      descripcion?: string;
      qr: string;
      qr_hash?: string;
      qr_id_trx: string;
      id_billetera: number;
    };
    datos_generador?: {
      ubicacion?: { lat: number; lng: number; precision?: number };
      ip_cliente?: string;
      tipo_dispositivo?: string;
      plataforma?: string;
      imsi?: string;
      imei?: string;
    };
  };
}

export interface QRDebinResponse {
  respuesta: CoelsaRespuesta;
  debin?: {
    id: string;
    estado: { codigo: string; descripcion: string };
    addDt: string;
    fechaExpiracion: string;
  };
  evaluacion?: { puntaje: number; reglas: string };
}

// ── QRSolicitudContraCargo (Nuestro Backend → COELSA) ──

export interface QRSolicitudContraCargoRequest {
  operacion_original: {
    detalle: {
      moneda: string;
      importe: number;
      motivo: string;
    };
    vendedor: {
      cuit: string;
      cbu: string;
    };
    tipo: 'contracargo';
    qr_id_trx: string;
  };
}

export interface QRSolicitudContraCargoResponse {
  respuesta: CoelsaRespuesta;
  id?: string;
  tipo?: string;
  fecha_negocio?: string;
}

// ── QROperacionOk (Nuestro Backend → COELSA, triggers SPLIT) ──

export interface QROperacionOkRequest {
  operacion_original: {
    vendedor: {
      cuit: string;
      cbu: string;
    };
    id: string;
    tipo: 'debinqr';
    descripcion?: string;
    qr_id_trx: string;
  };
}

// ── Consulta de transacción ──

export interface QRDebinQueryResponse {
  operacion: {
    id: string;
    comprador: {
      codigo: string;
      titular: string;
      cuit: string;
      cuenta: {
        banco: string;
        sucursal: string;
        terminal?: string;
        alias?: string;
        cbu: string;
        esTitular: number;
        moneda: string;
        tipo: string;
      };
    };
    detalle: {
      concepto: string;
      idUsuario: number;
      idComprobante: number;
      moneda: string;
      importe: number;
      devolucion: boolean;
      devolucionParcial?: boolean;
      importeComision?: number;
      comision?: number;
      descripcion?: string;
      paymentReference?: string;
      codigoPostal?: string;
      mcc?: string;
      fecha: string;
      fechaExpiracion: string;
    };
    vendedor: {
      codigo: string;
      titular: string;
      cuit: string;
      cuenta: {
        banco: string;
        sucursal: string;
        terminal?: string;
        alias?: string;
        cbu: string;
        esTitular: number;
        moneda: string;
        tipo: string;
      };
    };
    estado: { codigo: string; descripcion: string };
    garantiaOk: boolean;
    tipo: string;
    fechaNegocio: string;
  };
  evaluacion?: { puntaje: number; reglas: string };
  preautorizado?: boolean;
  respuesta: CoelsaRespuesta;
}

// ── ABM: Merchant (Comercio) ──

export interface CoelsaMerchantCreate {
  comercio: {
    com_cvu: string;
    com_cuit: string;
    com_cbu: string;
    com_porcentaje: number; // 0 to 0.999
    com_habilitado: boolean;
  };
}

export interface CoelsaMerchantResponse {
  respuesta: CoelsaRespuesta;
  comercio?: {
    com_cvu: string;
    com_cuit: string;
    com_cbu: string;
    com_porcentaje: number;
    com_habilitado: boolean;
  };
}

export interface CoelsaMerchantListResponse {
  respuesta: CoelsaRespuesta;
  banco?: {
    listacomercios: Array<{
      com_cvu: string;
      com_cuit: string;
      com_cbu: string;
      com_porcentaje: number;
      com_habilitado: boolean;
    }>;
  };
}

export interface CoelsaMerchantUpdate {
  com_cbu?: string;
  com_porcentaje?: number;
}

// ── ABM: Vendedor ──

export interface CoelsaVendorAdhesion {
  vendedor: {
    cuit: string;
    banco?: string;
    sucursal?: string;
    nombre_fantasia: string;
    rubro: string;
    endpoint: string;
    cuenta: { cbu: string };
    contacto: { email: string };
  };
}

// ── ABM: PSP ──

export interface CoelsaPSPCreate {
  psp: {
    cuit: string;
    razon_social: string;
    tipo: string;
    nombre_fantasia: string;
    url_psp: string;
  };
}

// ── ABM: Billetera ──

export interface CoelsaWalletCreate {
  billetera: {
    id: number;
    nombre: string;
    url: string;
  };
}

export interface CoelsaWalletResponse {
  respuesta: CoelsaRespuesta;
}

// ── Base response ──

export interface CoelsaBaseResponse {
  respuesta: CoelsaRespuesta;
}
