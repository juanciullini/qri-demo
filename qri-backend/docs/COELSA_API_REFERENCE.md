# Diccionario API COELSA Payments — Referencia para QRi

Documentacion generada a partir de `Diccionario_COELSA.PAYMENTS.xlsx`. Solo se incluyen los endpoints relevantes para el flujo QR Interoperable (Transferencias 3.0) que implementa QRi.

> **Convenciones:** `[EPPSP]` = endpoint expuesto por el PSP (Palta/QRi) que recibe webhooks de Coelsa. `[EP]` = endpoint de la entidad bancaria. `[BILL]` = endpoint de la billetera. R = Requerido, O = Opcional.

---

## Indice

1. [Flujo completo de pago QR (happy path)](#1-flujo-completo-de-pago-qr)
2. [QRDebin — Crear operacion DEBIN QR](#2-qrdebin--crear-operacion-debin-qr)
3. [QRIntencionPago — Webhook intencion de pago](#3-qrintencionpago--webhook-intencion-de-pago)
4. [QRConfirmaDebito — Webhook confirma debito](#4-qrconfirmadebito--webhook-confirma-debito)
5. [QROperacionFinalizada — Webhook operacion finalizada (billetera)](#5-qroperacionfinalizada--webhook-operacion-finalizada-billetera)
6. [QROperacionFinalizadaAdquirente — Webhook operacion finalizada (adquirente/PSP)](#6-qroperacionfinalizadaadquirente--webhook-operacion-finalizada-adquirentepsp)
7. [QRSolicitudContraCargo — Contracargo QR](#7-qrsolicitudcontracargo--contracargo-qr)
8. [QRDebinBilletera — Crear DEBIN QR (modo billetera)](#8-qrdebinbilletera--crear-debin-qr-modo-billetera)
9. [Get QRPayment — Consulta de pago QR](#9-get-qrpayment--consulta-de-pago-qr)
10. [Payments API (Aceptador)](#10-payments-api-aceptador)
11. [Payment Validations API (Aceptador)](#11-payment-validations-api-aceptador)
12. [Refunds API (Aceptador)](#12-refunds-api-aceptador)
13. [Refunds Validations API (Aceptador)](#13-refunds-validations-api-aceptador)
14. [Codigos de respuesta — QRDebin (7100s)](#14-codigos-de-respuesta--qrdebin-7100s)
15. [Codigos de respuesta — ConfirmaDebito](#15-codigos-de-respuesta--confirmadebito)
16. [Codigos de respuesta — QROperacionFinalizada (5700s)](#16-codigos-de-respuesta--qroperacionfinalizada-5700s)
17. [Codigos de respuesta — QRReverso (6200s)](#17-codigos-de-respuesta--qrreverso-6200s)
18. [Codigos de respuesta — QRSolicitudContraCargo (5600s)](#18-codigos-de-respuesta--qrsolicitudcontracargo-5600s)
19. [Codigos de respuesta — Payments Aceptador (8400s)](#19-codigos-de-respuesta--payments-aceptador-8400s)
20. [Codigos de respuesta — QRIntencionPago y QRConfirmaDebito (respuesta PSP)](#20-codigos-de-respuesta--qrintencionpago-y-qrconfirmadebito-respuesta-psp)
21. [Timeouts y limites](#21-timeouts-y-limites)
22. [Roles de Palta en el ecosistema](#22-roles-de-palta-en-el-ecosistema)

---

## 1. Flujo completo de pago QR

### Flujo INBOUND (comercio Palta recibe pago)

```
Comprador (billetera externa)          COELSA              Palta (PSP/Adquirente)
         |                                |                        |
         |  Escanea QR del comercio       |                        |
         |  ──────────────────────────>   |                        |
         |                                |  QRIntencionPago       |
         |                                |  ────────────────────> |
         |                                |  <──── PASS/FAIL ───── |
         |                                |                        |
         |                                |  QRConfirmaDebito      |
         |                                |  ────────────────────> |
         |                                |  <── APPROVED/REJECTED |
         |                                |                        |
         |                                |  Debito + Credito CVU  |
         |                                |  (interno COELSA)      |
         |                                |                        |
         |                                |  QROperacionFinalizada |
         |                                |  Adquirente            |
         |                                |  ────────────────────> |
         |                                |  <──── HTTP 200 ────── |
```

### Flujo OUTBOUND (usuario Palta paga QR externo)

```
Usuario Palta (billetera)              COELSA              Comercio externo
         |                                |                        |
         |  Escanea QR externo            |                        |
         |  QRDebin (billetera)           |                        |
         |  ──────────────────────────>   |                        |
         |  <──── respuesta (7100) ─────  |                        |
         |                                |                        |
         |                                |  (flujo interno)       |
         |                                |                        |
         |  QROperacionFinalizada         |                        |
         |  <──────────────────────────   |                        |
         |  ──── HTTP 200 ──────────────> |                        |
```

### Mapeo de estados de transaccion QRi vs flujo COELSA

| Estado QRi | Evento COELSA | Descripcion |
|------------|---------------|-------------|
| `CREADO` | — | Transaccion creada internamente, QR generado |
| `INTENCION_ENVIADA` | Se recibe `QRIntencionPago` | Coelsa notifica que un comprador quiere pagar |
| `INTENCION_ACEPTADA` | Respondemos `PASS` a `QRIntencionPago` | Validamos y aceptamos la intencion |
| `DEBITO_PENDIENTE` | Se recibe `QRConfirmaDebito` | Coelsa confirma que el debito fue procesado |
| `DEBITO_CONFIRMADO` | Respondemos `APPROVED` a `QRConfirmaDebito` | Aceptamos el debito confirmado |
| `CREDITO_ENVIADO` | — | Coelsa procesa el credito CVU internamente |
| `EN_CURSO` | — | Operacion en procesamiento final |
| `ACREDITADO` | Se recibe `QROperacionFinalizada` con `5700` | Operacion completada exitosamente |
| `REVERSADO` | Se recibe `QRReverso` (6200-6206) | Operacion reversada por error/timeout |
| `DEVUELTO` | Se ejecuta `QRSolicitudContraCargo` con `5600` | Contracargo realizado post-acreditacion |

---

## 2. QRDebin — Crear operacion DEBIN QR

**Endpoint:** `POST /apiDebinV1/QR/QRDebin`
**Direccion:** Palta envia a Coelsa
**Uso:** Crear un DEBIN asociado a un pago QR. Se usa cuando un usuario de billetera Palta escanea un QR externo (flujo OUTBOUND).

### Request

```json
{
  "operacion": {
    "administrador": {
      "cuit": "string"                    // O, 11 chars, CUIT del administrador
    },
    "vendedor": {
      "cuit": "string",                   // R, 11 chars
      "cbu": "string",                    // R, 22 chars (CBU o CVU)
      "banco": "string",                  // R, 3 chars, codigo entidad bancaria
      "sucursal": "string",               // R, 4 chars
      "terminal": "string"                // O, MAX 50
    },
    "comprador": {
      "cuenta": {
        "cbu": "string",                  // R, 22 chars (CBU o CVU)
        "alias": "string"                 // O, MAX 50
      },
      "cuit": "string"                    // R, 11 chars
    },
    "detalle": {
      "concepto": "string",              // R, MAX 100, conceptos BCRA (ALQ, FAC, PCT, etc.)
      "id_usuario": 0,                   // O, bigint
      "id_comprobante": 0,               // O, bigint
      "moneda": "string",                // R, 3 chars ("032" = ARS, "840" = USD)
      "importe": 0.00,                   // R, decimal, min 0.01, max 9999999999999.99
      "tiempo_expiracion": 0,            // R, int, minutos (1 a 4320 = 72hs max)
      "descripcion": "string",           // O, MAX 100
      "qr": "string",                    // R, MAX 7089, QR RAW EMVCo TLV
      "qr_hash": "string",              // O, varchar
      "qr_id_trx": "string",            // R, MAX 99, ID unico de la operacion QR
      "id_billetera": 0                  // R, int, ID billetera en Coelsa
    },
    "datos_generador": {
      "ip_cliente": "string",            // O, 15 chars (acepta vacio, NO null)
      "tipo_dispositivo": "string",      // O, 2 chars (01:pc, 02:celular, 03:tablet, 04:otros)
      "plataforma": "string",            // O, 2 chars (01:windows, 02:android, 03:linux, 04:mac, 05:ios)
      "imsi": "string",                  // O, 15 chars
      "imei": "string",                  // O, 15 chars
      "ubicacion": {
        "lat": 0.000000,                 // O, decimal(18,6)
        "lng": 0.000000,                 // O, decimal(18,6)
        "precision": 0.000000            // O, decimal(18,6), metros
      }
    }
  }
}
```

### Response

```json
{
  "respuesta": {
    "codigo": "7100",                     // 4 chars
    "descripcion": "CREACION CORRECTA"    // MAX 150
  },
  "debin": {
    "id": "WORD6LEN8P60814NMXXXXX",      // 22 chars, ID operacion Coelsa
    "addDt": "2025-08-26T11:06:18.318Z",  // fecha inicio
    "fechaExpiracion": "2025-08-26T11:16:18.318Z", // fecha expiracion UTC
    "estado": {
      "codigo": "7100",
      "descripcion": "INICIADO"
    }
  },
  "evaluacion": {
    "puntaje": 0,                         // 0-99, scoring de riesgo
    "reglas": ""                          // reglas separadas por coma
  }
}
```

### Ejemplo caso feliz

Request: vendedor CUIT `11111111111`, comprador CUIT `22222222222`, importe `27.00` ARS, concepto `PCT`, expiracion 10 min.
Response: codigo `7100` "CREACION CORRECTA", debin ID `WORD6LEN8P60814NMXXXXX`.

### Ejemplo caso error (moneda incorrecta)

Request: mismos datos pero `"moneda": "03"` (deberia ser `"032"`).
Response: codigo `7109` "MONEDA DEL VENDEDOR DIFERENTE A LA REQUERIDA".

---

## 3. QRIntencionPago — Webhook intencion de pago

**Endpoint:** `POST /QRIntencionPago` (expuesto por Palta)
**Direccion:** Coelsa envia a Palta
**Uso:** Coelsa notifica que un comprador escaneo el QR del comercio y quiere pagar. Palta debe validar y responder PASS/FAIL.

### Request (lo que Coelsa nos envia)

```json
{
  "operacion": {
    "vendedor": {
      "cuit": "string",                   // R, 11
      "cbu": "string",                    // R, 22
      "banco": "string",                  // R, 3
      "sucursal": "string",               // R, 4
      "terminal": "string"                // R, MAX 50
    },
    "comprador": {
      "cuenta": {
        "cbu": "string"                   // R, 22
      },
      "cuit": "string"                    // R, 11
    },
    "detalle": {
      "id_debin": "string",              // R, MAX 22, ID operacion DEBIN
      "fecha_negocio": "string",         // R, formato ISO 8601
      "concepto": "string",              // R, MAX 100, conceptos BCRA
      "id_usuario": 0,                   // R, long
      "id_comprobante": 0,               // R, long
      "moneda": "string",                // R, 3 chars
      "importe": 0.00,                   // R, decimal
      "qr": "string",                    // R, MAX 7089
      "qr_hash": "string",              // R, MAX 22
      "qr_id_trx": "string",            // R, MAX 99
      "id_billetera": 0                  // R, int
    },
    "interchange": {
      "importe_bruto": 0.00,             // R, decimal
      "importe_neto": 0.00,              // R, decimal
      "comision_comercio": 0.00,         // R, decimal
      "importe_comision": 0.00,          // R, decimal
      "comision_administrador": 0.00,    // R, decimal
      "categoria_comercio": "string",    // R, ej: "CHICO"
      "mcc": "string"                    // R, 4 chars
    }
  }
}
```

### Response (lo que Palta responde)

```json
{
  "validation_data": {
    "mcc": "string",                     // R, 4 chars, codigo actividad comercial
    "codigo_postal": "string",           // R, 4 chars
    "payment_reference": "string"        // R, MAX 99, referencia unica PCT
  },
  "validation_status": {
    "status": "PASS",                    // R, MAX 50 — "PASS" o "FAIL"
    "on_error": {
      "code": "string",                 // R, 4 chars
      "description": "string"           // R, MAX 150
    }
  },
  "qr_id_trx": "string",               // R, MAX 99
  "id_debin": "string",                 // R, MAX 22
  "id_billetera": 1000,                 // R, int
  "fecha_negocio": "string"             // R, ISO 8601
}
```

**Notas importantes:**
- Palta debe responder `PASS` si acepta la intencion, `FAIL` si la rechaza.
- El campo `interchange` contiene datos de comisiones que Palta debe registrar.
- El `payment_reference` generado por Palta se usa para rastrear la transaccion en todo el flujo posterior.
- **Timeout:** Coelsa espera respuesta en < 3 segundos. QRi usa 2s como limite interno.

---

## 4. QRConfirmaDebito — Webhook confirma debito

**Endpoint:** `POST /QRConfirmaDebito` (expuesto por Palta)
**Direccion:** Coelsa envia a Palta
**Uso:** Coelsa notifica que el debito al comprador fue procesado. Palta debe confirmar (APPROVED) o rechazar (REJECTED).

### Request (lo que Coelsa nos envia)

```json
{
  "operacion": {
    "vendedor": {
      "cuit": "string",                   // 11
      "cbu": "string",                    // 22
      "banco": "string",                  // 3
      "sucursal": "string",               // 4
      "terminal": "string"                // MAX 50
    },
    "comprador": {
      "cuit": "string",                   // 11
      "cuenta": {
        "cbu": "string",                  // 22
        "alias": ""                       // MAX 50
      }
    },
    "detalle": {
      "id_debin": "string",              // MAX 22
      "fecha_negocio": "string",         // YYYY-MM-DD
      "concepto": "PCT",                 // MAX 100
      "id_usuario": 0,                   // long
      "id_comprobante": 0,               // long
      "moneda": "string",                // 3 chars
      "importe": 0.00,                   // decimal
      "qr": "string",                    // MAX 7089
      "qr_hash": "string",              // MAX 22
      "qr_id_trx": "string",            // MAX 99
      "id_billetera": 0                  // int
    },
    "interchange": {
      "importe_bruto": 0.00,
      "importe_neto": 0.00,
      "comision_comercio": 0.000,
      "importe_comision": 0.0000,
      "comision_administrador": 0.000,
      "categoria_comercio": "string",     // ej: "CHICO"
      "mcc": "string"                     // ej: "6211"
    },
    "respuesta": {
      "codigo": "2800",                   // "2800" = confirmado, "2899" = error
      "descripcion": "string"
    }
  }
}
```

### Response (lo que Palta responde)

```json
{
  "transaction_status": {
    "status": "APPROVED",                // "APPROVED" o "REJECTED"
    "on_error": {
      "code": "string",
      "description": "string"
    }
  },
  "qr_id_trx": "string",               // MAX 99
  "id_debin": "string",                 // MAX 22
  "id_billetera": 0,                    // int
  "fecha_negocio": "string",            // ISO 8601
  "payment_reference": "string"         // MAX 99
}
```

**Notas importantes:**
- Codigo `2800` en `respuesta.codigo` = debito confirmado correctamente por el banco del comprador.
- Codigo `2899` = error general en la confirmacion del debito.
- `interchange` contiene los datos definitivos de comisiones para esta transaccion.

---

## 5. QROperacionFinalizada — Webhook operacion finalizada (billetera)

**Endpoint:** `POST /QROperacionFinalizada` (expuesto por Palta como billetera)
**Direccion:** Coelsa envia a Palta
**Uso:** Notificacion final del resultado de la operacion para el rol billetera (flujo OUTBOUND).

### Request (lo que Coelsa nos envia)

```json
{
  "operacion_original": {
    "id": "string",                       // R, 22 chars, ID operacion Coelsa
    "tipo": "string",                     // R, MAX 13
    "descripcion": "string",              // R, MAX 150
    "qr_id_trx": "string",               // R, MAX 99
    "importe": 0.00,                      // R, decimal
    "payment_reference": "string"         // R, MAX 99
  },
  "contracargo": {
    "id": "string",                       // R, MAX 22, ID para contracargo
    "ori_trx_id": "string"               // R, bigint, ID externo para reversa
  },
  "respuesta": {
    "codigo": "5700",                     // R, 4 chars
    "descripcion": "OPERACION CORRECTA"  // R, MAX 150
  }
}
```

**Response:** Se espera HTTP 200 sin body especifico.

**Codigos de respuesta posibles:**
- `5700` — Operacion correcta (ACREDITADO)
- `5706` — Error en el debito
- `5707` — Error en el credito
- `5709` — Error comunicacion con adquirente
- `5710` — Adquirente deniega operacion
- `5711` — Falla validacion contra adquirente
- `5712` — Reversar operacion (timeout)
- `5713` — Operacion expirada
- `5714` — Error payment red (reversar) [solo billetera]
- `5799` — Error general

---

## 6. QROperacionFinalizadaAdquirente — Webhook operacion finalizada (adquirente/PSP)

**Endpoint:** `POST /QRAvisoOperacionFinalizadaAdquiriente` (expuesto por Palta como PSP)
**Direccion:** Coelsa envia a Palta
**Uso:** Notificacion final del resultado de la operacion para el rol PSP/adquirente (flujo INBOUND). Confirma que la acreditacion se completo.

### Request (lo que Coelsa nos envia)

```json
{
  "operacion_original": {
    "id": "string",                       // R, 22 chars (ID HASH)
    "tipo": "string",                     // R, MAX 13
    "descripcion": "string",              // R, MAX 150
    "qr_id_trx": "string",               // R, MAX 99
    "importe": 0.00,                      // R, decimal
    "payment_reference": "string"         // R, MAX 99
  },
  "respuesta": {
    "codigo": "5700",                     // R, 4 chars
    "descripcion": "OPERACION CORRECTA"  // R, MAX 150
  }
}
```

**Response:** Se espera HTTP 200.

**Nota:** Este webhook solo reporta `5700` (operacion correcta). Los errores se reportan via `QRReverso` (6200s).

---

## 7. QRSolicitudContraCargo — Contracargo QR

**Endpoint:** `POST /apiDebinV1/QR/QRSolicitudContraCargo`
**Direccion:** Palta envia a Coelsa (o Coelsa envia a Palta como webhook)
**Uso:** Solicitar un contracargo (devolucion) de una operacion ya acreditada.

### Request

```json
{
  "operacion_original": {
    "detalle": {
      "moneda": "string",                // R, 3 chars
      "importe": 0.00,                   // R, decimal
      "motivo": "string"                 // O, 22 chars
    },
    "vendedor": {
      "cuit": "string",                  // R, 11 chars
      "cbu": "string"                    // R, 22 chars
    },
    "tipo": "string",                    // R, MAX 13
    "qr_id_trx": "string"               // R, MAX 99
  },
  "objeto": {
    "ori_trx_id": 0                      // R, bigint, ID externo para reversa
  }
}
```

### Response

```json
{
  "tipo": "string",                       // R, MAX 13
  "respuesta": {
    "codigo": "5600",                     // R, 4 chars
    "descripcion": "CONTRA-CARGO REALIZADO CORRECTAMENTE"
  },
  "id": "string",                         // R, 22 chars, ID operacion contracargo
  "fecha_negocio": "2024-10-03T18:47:13.741Z"
}
```

---

## 8. QRDebinBilletera — Crear DEBIN QR (modo billetera)

**Endpoint:** `POST /apiDebinV1/QR/QRDebin` (misma URL, diferente payload)
**Uso:** Variante del QRDebin para cuando Palta actua como billetera. Los campos `datos_generador` son todos **Required** (a diferencia del modo estandar donde son opcionales). Acepta strings vacios pero NO null.

Misma estructura que [QRDebin](#2-qrdebin--crear-operacion-debin-qr) con estas diferencias:
- `vendedor.terminal` es **R** (requerido)
- `datos_generador.ip_cliente` es **R** (acepta string vacio)
- `datos_generador.tipo_dispositivo` es **R** (acepta string vacio)
- `datos_generador.plataforma` es **R** (acepta string vacio)
- `datos_generador.imsi` es **R** (acepta string vacio)
- `datos_generador.imei` es **R** (acepta string vacio)

---

## 9. Get QRPayment — Consulta de pago QR

**Endpoint:** `GET /apiDebinV1/QR/QRPayment/{qr_id_trx}/{adquirer_cuit}`
**Direccion:** Palta consulta a Coelsa
**Uso:** Consultar el estado de un pago QR existente.

### Response

```json
{
  "qr_id": "string",                     // R, 99 chars, ID QR
  "amount": {
    "currency": "string",                // R, 3 chars
    "value": 0.00                        // R, decimal
  },
  // ... datos adicionales de la operacion
}
```

---

## 10. Payments API (Aceptador)

**Endpoint:** `POST /administrators/payments`
**Direccion:** Palta envia a Coelsa (o Coelsa invoca en Palta)
**Uso:** Crear/procesar un pago QR en modo aceptador.

### Request

```json
{
  "authorizationCode": "string",          // R, ID univoco del Payment
  "qrId": "string",                       // R, 99 chars, ID univoco del QR
  // ... campos de pago
}
```

### Codigos de respuesta especificos (8400s)

| Codigo | Descripcion |
|--------|-------------|
| `8400` | PAYMENT CREACION CORRECTA |
| `8401` | QR_ID_NO_ENCONTRADO |
| `8407` | ACEPTADOR_NO_VINCULADO |
| `8408` | ACEPTADOR_INHABILITADO |
| `8414` | TIME_OUT_ACEPTADOR |
| `8415` | PAYMENT CREADO CORRECTAMENTE |
| `8416` | CUENTA CBU ADQUIRIENTE INVALIDA |
| `8417` | CUENTA CBU BILLETERA INVALIDA |
| `8421` | COMERCIO_NO_VINCULADO |
| `8422` | COMERCIO_INHABILITADO_PARA_OPERAR |
| `8425` | OPERACION_NO_PERMITIDA |
| `8426` | DATOS_INCONSISTENTES |
| `8427` | BILLETERA_INHABILITADA |
| `8429` | REVERSO POR NOTIFICACION DE LA RED - ERROR AL REVERSAR GARANTIAS |
| `8430` | REVERSO POR NOTIFICACION DE LA RED - GARANTIAS REVERSADAS |
| `8431` | ERROR_ADQUIRIENTE |
| `8499` | ERROR_PROCESAMIENTO |

---

## 11. Payment Validations API (Aceptador)

**Endpoint:** `POST /administrators/payments/validations`
**Direccion:** Coelsa invoca en Palta
**Uso:** Coelsa envia una validacion de pago para que el aceptador apruebe o rechace.

### Response status

| Codigo | Descripcion |
|--------|-------------|
| `7900` | PAYMENT VALIDATIONS PASS |
| `7901` | PAYMENT VALIDATIONS FAIL |
| `7914` | TIEMPO DE ESPERA AGOTADO PARA RESPUESTA DEL ACEPTADOR |

---

## 12. Refunds API (Aceptador)

**Endpoint:** `POST /administrators/refunds`
**Direccion:** Palta envia a Coelsa
**Uso:** Solicitar reembolso de una transaccion original.

### Request

```json
{
  "originalTransaction": {
    "authorizationCode": "string",        // R, ID univoco del Payment original
    // ...
  }
}
```

---

## 13. Refunds Validations API (Aceptador)

**Endpoint:** `POST /administrators/refunds/validations`
**Direccion:** Coelsa invoca en Palta
**Uso:** Validacion de reembolso.

### Request

```json
{
  "payer": {
    "name": "string",                     // R, 100 chars
    // ...
  }
}
```

---

## 14. Codigos de respuesta — QRDebin (7100s)

Codigos para `POST /apiDebinV1/QR/QRDebin`:

| Codigo | Descripcion | Tipo |
|--------|-------------|------|
| `7100` | CREACION CORRECTA | Exito |
| `7101` | ERROR DATOS OPERACION | Error |
| `7102` | NO EXISTE EL CBU VENDEDOR | Error |
| `7103` | NO EXISTE EL CBU/CVU COMPRADOR | Error |
| `7105` | MONTO SUPERA VALOR MAXIMO/MINIMO PERMITIDO | Error |
| `7106` | EXPIRACION INCORRECTA | Error |
| `7107` | NO ADHERIDO COMO VENDEDOR | Error |
| `7109` | MONEDA DEL VENDEDOR DIFERENTE A LA REQUERIDA | Error |
| `7110` | MONEDA DEL COMPRADOR DIFERENTE A LA REQUERIDA | Error |
| `7111` | ERROR TIPO DE CUENTA DEL VENDEDOR | Error |
| `7112` | ERROR TIPO DE CUENTA DEL COMPRADOR | Error |
| `7114` | ALIAS MAL FORMULADO DEL COMPRADOR | Error |
| `7116` | CBU MAL FORMULADO DEL VENDEDOR | Error |
| `7117` | CBU MAL FORMULADO DEL COMPRADOR | Error |
| `7118` | CUIT MAL FORMULADO DEL VENDEDOR | Error |
| `7119` | CUIT MAL FORMULADO DEL COMPRADOR | Error |
| `7120` | MONEDA INEXISTENTE | Error |
| `7122` | DESCRIPCION INVALIDA | Error |
| `7123` | NO COINCIDEN LOS BANCOS | Error |
| `7125` | CBU DESTINO Y ORIGEN IDENTICOS | Error |
| `7128` | CONCEPTO INVALIDO (NOMENCLATURA INEXISTENTE) | Error |
| `7129` | BANCO VENDEDOR NO HABILITADO PARA TRANSACCIONES | Error |
| `7130` | BANCO COMPRADOR NO HABILITADO PARA TRANSACCIONES | Error |
| `7131` | IP INCORRECTO | Error |
| `7132` | DISPOSITIVO INCORRECTO | Error |
| `7133` | PLATAFORMA INCORRECTA | Error |
| `7134` | IMSI INCORRECTO | Error |
| `7135` | IMEI INCORRECTO | Error |
| `7136` | LATITUD(-90/90) O LONGITUD(-180/180) INCORRECTO | Error |
| `7137` | PRECISION INCORRECTA | Error |
| `7142` | ERROR GENERAL VALIDA - UPDATE | Error |
| `7143` | BILLETERA INEXISTENTE | Error (solo billetera) |
| `7144` | ERROR AL VERIFICAR VIRTUALES | Error |
| `7145` | ID COMPROBANTE INVALIDO | Error |
| `7146` | ID USUARIO INVALIDO | Error |
| `7147` | BANCO CREDITO INCORRECTO | Error |
| `7148` | SUCURSAL CREDITO INCORRECTO | Error |
| `7149` | TERMINAL CREDITO INCORRECTO | Error |
| `7150` | INICIADO | Estado |
| `7151` | QR INCORRECTO | Error |
| `7152` | ID DE OPERACION QR_ID_TRX EXISTENTE | Error |
| `7153` | BILLETERA NO HABILITADA | Error |
| `7154` | CVU VENDEDOR NO HABILITADO | Error |
| `7155` | CVU COMPRADOR NO HABILITADO | Error |
| `7156` | COMERCIO INEXISTENTE | Error |
| `7157` | BILLETERA SIN CUIT CONFIGURADO | Error (solo billetera) |
| `7158` | BILLETERA SIN CBU CONFIGURADO | Error (solo billetera) |
| `7159` | PSP SIN CBU CONFIGURADO | Error |
| `7160` | PSP SIN CUIT CONFIGURADO | Error |
| `7164` | DATOS INVALIDOS RED (INTEROPERABLE) | Error (solo billetera) |
| `7165` | RED INVALIDA | Error |
| `7166` | ERROR ENVIO A RED (INTEROPERABLE) | Error (solo billetera) |
| `7167` | CUIT ADMINISTRADOR MAL FORMULADO | Error |
| `7168` | EL CUIT ADMINISTRADOR NO PERTENECE A LA RED INFORMADA | Error |
| `7169` | ID BCRA INCORRECTO | Error |
| `7174` | LONGITUD EXCEDIDA EN INICIADOR | Error (solo billetera) |
| `7175` | INICIADOR INEXISTENTE | Error (solo billetera) |
| `7176` | LONGITUD EXCEDIDA EN SUBTIPO | Error |
| `7177` | SUBTIPO INEXISTENTE | Error |
| `7178` | COMBINACION SUBTIPO Y OPERACION INCORRECTA | Error |
| `7198` | JSON INCORRECTO | Error |
| `7199` | ERROR GENERAL | Error |
| `99` | ERROR ID DE DEBIN EXISTENTE | Error (externo) |
| `562` | COMERCIO INACTIVO | Error |

---

## 15. Codigos de respuesta — ConfirmaDebito

Codigos para `POST /apiDebinV1/Debin/ConfirmaDebito` (flujo QR):

### Codigos de mensajeria (enviados por la entidad bancaria)

| Codigo | Descripcion |
|--------|-------------|
| `0` | Aceptado por el cliente y debitado por el banco |
| `1` | Aceptado por el cliente y pendiente de debito |
| `2` | Aceptado por el cliente y pendiente debito |
| `10` | Rechazado por el cliente |
| `11` | Rechazado por el cliente por no saber origen |
| `20` | Sin saldo en la cuenta |
| `30` | Otros problemas con la cuenta de debito |
| `35` | No existe la cuenta / Fue dada de baja |
| `40` | Otros problemas |
| `45` | Rechazo por scoring alto |

### Codigos de respuesta (externos)

| Codigo | Descripcion |
|--------|-------------|
| `0` | GARANTIA CORRECTA |
| `3` | DEBIN ELIMINADO |
| `8` | IMPORTE SUPERIOR AL SALDO PARA CONTRACARGAR |
| `9` | ENTIDAD NO HABILITADA PARA OPERAR EN GARANTIAS |
| `10` | EL BANCO DEBITO NO POSEE GARANTIAS SUFICIENTES |
| `23` | NO COINCIDEN EL CBU ENVIADO |
| `25` | NO COINCIDEN EL CUIT ENVIADO |
| `27` | NO COINCIDEN LOS TIPO DE MONEDA ENVIADAS |
| `29` | NO COINCIDEN LOS IMPORTES ENVIADOS |
| `44` | ERROR DATOS DE GENERADOR INICIAL |
| `46` | EXPIRADO |
| `75` | SIN SALDO |
| `77` | RECHAZO CLIENTE / OTROS PROBLEMAS DEBITO |
| `80` | NO COINCIDEN LOS BANCOS |
| `83` | DEBIN INEXISTENTE |
| `87` | DEBIN EN ESTADO NO MODIFICABLE |

### Codigos QR-especificos

| Codigo | Descripcion |
|--------|-------------|
| `2800` | DEBITO CONFIRMADO CORRECTAMENTE |
| `2899` | ERROR GENERAL |
| `7156` | COMERCIO INEXISTENTE |
| `7161` | CUENTA CBU ADQUIRIENTE INVALIDA |
| `7162` | CUENTA CBU BILLETERA INVALIDA |
| `7163` | CUENTA CBU COELSA INVALIDA |

---

## 16. Codigos de respuesta — QROperacionFinalizada (5700s)

| Codigo | Descripcion | Accion sugerida |
|--------|-------------|-----------------|
| `5700` | OPERACION CORRECTA | Marcar como ACREDITADO |
| `5701` | OPERACION INEXISTENTE | Loguear error |
| `5702` | VENDEDOR VIRTUAL INVALIDO | Loguear error |
| `5703` | CUIT VENDEDOR INCORRECTO | Loguear error |
| `5704` | CVU VENDEDOR INCORRECTO | Loguear error |
| `5705` | DEVOLUCION TOTAL | Marcar como DEVUELTO |
| `5706` | ERROR EN EL DEBITO | Marcar como REVERSADO |
| `5707` | ERROR EN EL CREDITO | Marcar como REVERSADO |
| `5708` | DEVOLUCION PARCIAL | Registrar devolucion parcial |
| `5709` | ERROR COMUNICACION CON ADQUIRIENTE | Marcar como REVERSADO |
| `5710` | ADQUIRIENTE DENIEGA OPERACION | Marcar como REVERSADO |
| `5711` | FALLA VALIDACION CONTRA ADQUIRIENTE | Marcar como REVERSADO |
| `5712` | REVERSAR OPERACION (TIMEOUT) | Marcar como REVERSADO |
| `5713` | OPERACION EXPIRADA | Marcar como REVERSADO |
| `5714` | ERROR PAYMENT RED (REVERSAR) | Marcar como REVERSADO (solo billetera) |
| `5798` | JSON INCORRECTO | Error de formato |
| `5799` | ERROR GENERAL | Marcar como REVERSADO |

---

## 17. Codigos de respuesta — QRReverso (6200s)

Webhook `POST [EPPSP]/QRReverso` enviado por Coelsa al PSP:

| Codigo | Descripcion | Causa |
|--------|-------------|-------|
| `6200` | REVERSAR OPERACION (TIMEOUT) | La operacion excedio el tiempo limite |
| `6201` | OPERACION EXPIRADA | El DEBIN expiro antes de completarse |
| `6203` | ERROR CREDITO | Fallo la acreditacion al vendedor |
| `6204` | ERROR DEBITO | Fallo el debito al comprador |
| `6205` | ERROR COMUNICACION CON ADQUIRIENTE | No se pudo contactar al adquirente |
| `6206` | FALLA VALIDACION CONTRA ADQUIRIENTE | El adquirente rechazo la validacion |

---

## 18. Codigos de respuesta — QRSolicitudContraCargo (5600s)

| Codigo | Descripcion |
|--------|-------------|
| `5600` | CONTRA-CARGO REALIZADO CORRECTAMENTE |
| `5601` | CREACION PENDIENTE |
| `5602` | CONTRA-CARGO INICIADO |
| `5603` | MONEDA INCORRECTA |
| `5604` | DESCRIPCION INCORRECTA |
| `5605` | TIPO ERRONEO |
| `5606` | ID ERRONEO O INEXISTENTE |
| `5607` | ID ERRONEO |
| `5608` | IMPORTE INCORRECTO |
| `5609` | IMPORTE DISTINTO AL ORIGINAL |
| `5610` | CUIT DISTINTO AL ORIGINANTE |
| `5611` | CUENTA DISTINTA AL ORIGINANTE |
| `5612` | ESTADO INCORRECTO PARA GENERAR CONTRACARGO |
| `5613` | ESTADO VENDEDOR VIRTUAL INCORRECTO |
| `5614` | SIN GARANTIA |
| `5615` | ERROR GENERAL - GARANTIA CREDITO |
| `5616` | ERROR GENERAL - GARANTIA DEBITO |
| `5617` | SIN GARANTIA DEBITO |
| `5618` | SIN GARANTIA CREDITO |
| `5619` | YA EXISTE UN CONTRA-CARGO REALIZADO |
| `5620` | PLAZO SUPERADO PARA REALIZAR LA OPERACION |
| `5623` | IMPORTE SUPERA EL MAXIMO PERMITIDO |
| `5624` | ORI_TRX_ID EXISTENTE |
| `5625` | BANCO NO HABILITADO PARA REALIZAR OPERACIONES |
| `5640` | GARANTIA CORRECTA |
| `5645` | ENVIO DE AVISO A CREDITO |
| `5649` | ACREDITADO CON ERROR GARANTIA |
| `5650` | ACREDITADO CON GARANTIA |
| `5697` | ERROR GENERAL - GARANTIA |
| `5698` | JSON INCORRECTO |
| `5699` | ERROR GENERAL |

---

## 19. Codigos de respuesta — Payments Aceptador (8400s)

| Codigo | Descripcion |
|--------|-------------|
| `8400` | PAYMENT CREACION CORRECTA |
| `8401` | QR_ID_NO_ENCONTRADO |
| `8407` | ACEPTADOR_NO_VINCULADO |
| `8408` | ACEPTADOR_INHABILITADO |
| `8414` | TIME_OUT_ACEPTADOR |
| `8415` | PAYMENT CREADO CORRECTAMENTE |
| `8416` | CUENTA CBU ADQUIRIENTE INVALIDA |
| `8417` | CUENTA CBU BILLETERA INVALIDA |
| `8421` | COMERCIO_NO_VINCULADO |
| `8422` | COMERCIO_INHABILITADO_PARA_OPERAR |
| `8425` | OPERACION_NO_PERMITIDA |
| `8426` | DATOS_INCONSISTENTES |
| `8427` | BILLETERA_INHABILITADA |
| `8429` | REVERSO POR NOTIFICACION DE LA RED - ERROR AL REVERSAR GARANTIAS |
| `8430` | REVERSO POR NOTIFICACION DE LA RED - GARANTIAS REVERSADAS |
| `8431` | ERROR_ADQUIRIENTE |
| `8499` | ERROR_PROCESAMIENTO |

---

## 20. Codigos de respuesta — QRIntencionPago y QRConfirmaDebito (respuesta PSP)

### QRIntencionPago — Respuesta que da el PSP

| Status | Descripcion |
|--------|-------------|
| `PASS` | La validacion fue exitosa, se acepta la intencion de pago |
| `FAIL` | La validacion fallo, se rechaza la intencion de pago |

### QRConfirmaDebito — Respuesta que da el PSP

| Status | Descripcion |
|--------|-------------|
| `APPROVED` | Se aprueba la confirmacion del debito |
| `REJECTED` | Se rechaza la confirmacion del debito |

### Codigos internos de QRConfirmaDebito

| Codigo | Descripcion |
|--------|-------------|
| `2800` | DEBITO CONFIRMADO CORRECTAMENTE |
| `2899` | ERROR GENERAL |

---

## 21. Timeouts y limites

| Parametro | Valor | Notas |
|-----------|-------|-------|
| Timeout sincronico COELSA | 3 segundos | Tiempo maximo que Coelsa espera respuesta del PSP |
| Timeout interno QRi | 2 segundos | `COELSA_SYNC_TIMEOUT_MS` — margen de seguridad |
| Timeout total transaccion | 15 segundos | `TRANSACTION_TOTAL_TIMEOUT_MS` |
| Expiracion QR (min) | 1 minuto | Minimo para `tiempo_expiracion` |
| Expiracion QR (max) | 4320 minutos (72hs) | Maximo para `tiempo_expiracion` |
| Importe minimo | 0.01 | |
| Importe maximo | 9999999999999.99 | |
| Moneda ARS | "032" | Codigo ISO |
| Moneda USD | "840" | Codigo ISO |
| Longitud CUIT | 11 chars | |
| Longitud CBU/CVU | 22 chars | |
| Longitud ID DEBIN | 22 chars | |
| Longitud QR RAW max | 7089 chars | |

---

## 22. Roles de Palta en el ecosistema

Palta actua en **dos roles** simultaneamente:

### Rol PSP/Adquirente (flujo INBOUND)
- Recibe webhooks: `QRIntencionPago`, `QRConfirmaDebito`, `QROperacionFinalizadaAdquirente`, `QRReverso`
- Endpoints expuestos en `[EPPSP]`
- Procesa pagos de compradores externos hacia comercios Palta

### Rol Billetera (flujo OUTBOUND)
- Invoca: `QRDebin` (billetera), consulta `Get QRPayment`
- Recibe webhook: `QROperacionFinalizada`
- Endpoints expuestos en `[BILL]`
- Permite a usuarios Palta pagar QRs de comercios externos

### Conceptos BCRA relevantes para QR

Los conceptos de pago deben usar codigos BCRA. Los mas comunes para QR:
- `PCT` — Pago con transferencia (el mas usado en QR)
- `FAC` — Factura
- `ALQ` — Alquiler
- `CUO` — Cuota
- `HAB` — Haberes
- `HON` — Honorarios
- `SEG` — Seguros
- `VAR` — Varios
