# Análisis de Comisiones — QR Interoperable (Transferencias 3.0)

Análisis técnico completo del modelo de comisiones en el sistema QR Interoperable de Palta, incluyendo flujos INBOUND (Palta como Aceptador/PSP) y OUTBOUND (Palta como Billetera).

**Fecha:** Marzo 2025
**Fuentes utilizadas:**

| ID | Documento | Ubicación |
|----|-----------|-----------|
| **[D1]** | Diccionario COELSA PAYMENTS (Excel) | `qri-backend/docs/Diccionario_COELSA.PAYMENTS.xlsx` |
| **[D2]** | COELSA API Reference (generado del Excel) | `qri-backend/docs/COELSA_API_REFERENCE.md` |
| **[D3]** | Doc oficial Coelsa TRX 3.1 | `doc/coelsa_documentacion_oficial.md` |
| **[D4]** | Flujo completo QR Interoperable | `doc/FLUJO_COMPLETO_QR_INTEROPERABLE.md` |
| **[D5]** | Tipos Coelsa (código fuente) | `qri-backend/src/modules/coelsa/coelsa.types.ts` |
| **[D6]** | Legacy Coelsa MS | `pal-qr-coelsa-ms/src/` |
| **[D7]** | Legacy Backend | `palta-api-ts-master/src/` |

---

## 1. Modelo de comisiones de Coelsa

### 1.1 Estructura del interchange

Coelsa precalcula el interchange por MCC y lo envía en los webhooks al Aceptador/PSP.

**Ref: [D3] Sección "Mensaje QR Intención de Pago" (líneas 208-214)**

> "se enviarán los datos de la intención de pago de la Billetera como así también los datos del interchange a realizar según los códigos MCC que COELSA tiene configurados para el comercio del Aceptador"

**Ref: [D1] Sheet "ConfirmaCredito" (sheet45) — filas 31-36 — Título: "DATOS DE INTERCHANGE (COMISIONES)"**

| Campo | Tipo | Definición oficial (del Excel) |
|-------|------|-------------------------------|
| `importe_bruto` | Decimal | Importe bruto de la operación |
| `importe_neto` | Decimal | Importe neto de la operación |
| `comision_comercio` | Decimal | Comisión que debe abonar el comercio |
| `importe_comision` | Decimal (0.00) | Importe total de comisión por uso del servicio |
| `comision_administrador` | Decimal | Comisión que debe abonar el administrador |
| `categoria_comercio` | String | Categoría del comercio |
| `mcc` | String (4 chars) | Código MCC (VISA) |

### 1.2 Relación matemática

**Ref: [D6] `pal-qr-coelsa-ms/src/helpers/validations.helper.ts` (línea 183)**

```
importe_bruto = importe_neto + importe_comision
```

### 1.3 Ejemplo real del Excel

**Ref: [D1] Sheet "Lista" (sheet46) — filas 32-37**

```json
"interchange": {
  "importe_bruto": 3333.00,
  "importe_neto": 3333.0000,
  "comision_comercio": 0.000,
  "importe_comision": 0.0000,
  "comision_administrador": 0.000
}
```

Nota: En ambiente de prueba las comisiones son 0 (bruto = neto).

---

## 2. Flujo INBOUND — Palta como Aceptador/PSP

### 2.1 Diagrama del flujo

**Ref: [D2] Sección 1 "Flujo INBOUND" (líneas 38-60)**

```
Comprador (billetera externa)      COELSA              Palta (PSP/Adquirente)
         |                            |                        |
         |  Escanea QR del comercio   |                        |
         |  ──────────────────────>   |                        |
         |                            |  QRIntencionPago       |
         |                            |  ────────────────────> |
         |                            |  <──── PASS/FAIL ───── |
         |                            |                        |
         |                            |  QRConfirmaDebito      |
         |                            |  ────────────────────> |
         |                            |  <── APPROVED/REJECTED |
         |                            |                        |
         |                            |  QROperacionFinalizada |
         |                            |  Adquirente            |
         |                            |  ────────────────────> |
```

### 2.2 Datos de comisión recibidos

#### QRIntencionPago (Coelsa → Palta)

**Ref: [D2] Sección 3 (líneas 189-267)**

Interchange viene como **array** (puede tener múltiples MCC candidatos):

```json
"interchange": {
  "importe_bruto": 0.00,
  "importe_neto": 0.00,
  "comision_comercio": 0.00,
  "importe_comision": 0.00,
  "comision_administrador": 0.00,
  "categoria_comercio": "CHICO",
  "mcc": "5411"
}
```

**Ref: [D2] Nota línea 264:**
> "El campo interchange contiene datos de comisiones que Palta debe registrar."

#### QRConfirmaDebito (Coelsa → Palta)

**Ref: [D2] Sección 4 (líneas 270-348)**

Interchange viene como **objeto** (solo el MCC confirmado):

```json
"interchange": {
  "importe_bruto": 0.00,
  "importe_neto": 0.00,
  "comision_comercio": 0.000,
  "importe_comision": 0.0000,
  "comision_administrador": 0.000,
  "categoria_comercio": "CHICO",
  "mcc": "6211"
}
```

**Ref: [D3] Sección "Mensaje QR Confirma Debito" (líneas 370-376)**
> "el campo Interchange tiene solamente los datos del MCC que se informó en la Intención de Pago"

**Ref: [D2] Nota línea 347:**
> "interchange contiene los datos definitivos de comisiones para esta transaccion."

#### QROperacionFinalizadaAdquirente (Coelsa → Palta)

**Ref: [D2] Sección 6 (líneas 396-424)**

**NO incluye datos de comisión.** Solo notifica que la operación se completó (código 5700).

### 2.3 Distribución financiera INBOUND

```
Comprador paga $1000 (importe_bruto)
    ↓
Coelsa retiene → importe_comision (ej: $5)
  ├── comision_comercio ($3) → Fee de Coelsa
  └── comision_administrador ($2) → Fee reconocido al PSP (Palta)
    ↓
importe_neto ($995) → Llega al CBU del comercio vía crédito CVU
    ↓
Palta calcula platform_commission ($6) → Fee adicional de Palta al comercio
    ↓
merchant_net_amount ($989) → Lo que el comercio efectivamente retira
```

### 2.4 Estado actual en el código

**Funciona correctamente.** En `transaction.service.ts`:
- Líneas 216: Se guarda el interchange de QRIntencionPago
- Líneas 357-375: En QRConfirmaDebito se extrae `commission_data` y se calcula `platform_commission`
- Campos en DB: `interchange`, `commission_data`, `platform_commission`, `merchant_net_amount`

---

## 3. Flujo OUTBOUND — Palta como Billetera

### 3.1 Diagrama del flujo

**Ref: [D2] Sección 1 "Flujo OUTBOUND" (líneas 62-77)**

```
Usuario Palta (billetera)         COELSA              Comercio externo
     |                               |                       |
     | QRDebin (billetera)           |                       |
     | ──────────────────────────>   |                       |
     | <──── respuesta (7100) ─────  |                       |
     |                               | (flujo interno)       |
     | QROperacionFinalizada         |                       |
     | <──────────────────────────── |                       |
```

### 3.2 Datos de comisión disponibles por mensaje

#### QRDebin — Request/Response

**Ref: [D2] Sección 2 (líneas 96-175)**

La billetera envía datos operativos. La respuesta solo trae:
- `respuesta.codigo` (7100 = éxito)
- `debin.id` (ID de operación Coelsa, 22 chars)
- `evaluacion.puntaje` (scoring de riesgo)

**Sin datos de comisión.**

#### QROperacionFinalizada — Webhook

**Ref: [D2] Sección 5 (líneas 351-393)**
**Ref: [D1] Sheet "QROperacionFinalizada" (sheet35)**

```json
{
  "operacion_original": {
    "id": "string",
    "tipo": "string",
    "qr_id_trx": "string",
    "importe": 0.00,
    "payment_reference": "string"
  },
  "contracargo": { "id": "string", "ori_trx_id": "string" },
  "respuesta": { "codigo": "5700", "descripcion": "OPERACION CORRECTA" }
}
```

**Sin datos de comisión.** Solo importe bruto y estado.

#### Get QRPayment — Consulta

**Ref: [D2] Sección 9 (líneas 487-504)**
**Ref: [D1] Sheet "Get_QRPayment" (sheet66)**

**Sin datos de comisión.** Solo datos básicos (amount, merchant, payer, status).

#### Get Debin — Consulta (FUENTE DE COMISIONES OUTBOUND)

**Ref: [D1] Sheets "Get_Debin" a "Get_Debin5" (sheets 54-58)**

Endpoint: `GET /apiDebinV1/Debin/{id_debin}`

**SÍ incluye campos de comisión:**

| Campo | Tipo | Descripción | Sheet/Fila |
|-------|------|-------------|------------|
| `importeComision` | Numerico (0.00) | Importe de comisión por uso del servicio | sheet54, fila 34 |
| `comision` | Numerico (0.00) | Importe de comisión | sheet54, fila 35 |
| `cbuInterchange` | String | CBU para interchange | sheets 55-58 |
| `cuitInterchange` | String | CUIT para interchange | sheets 55-58 |

**Ref: [D5] `coelsa.types.ts` líneas 280-338** — El tipo `QRDebinQueryResponse` ya contempla estos campos:
```typescript
detalle: {
  importeComision?: number;    // línea 306
  comision?: number;            // línea 307
}
```

### 3.3 Datos de la billetera/wallet en los mensajes

En los webhooks que Palta recibe como Aceptador, el campo `comprador` trae datos de la billetera que está pagando:

**Ref: [D2] Sección 3 — QRIntencionPago (líneas 207-224)**

```json
"comprador": {
  "cuenta": { "cbu": "string" },   // CBU/CVU del comprador
  "cuit": "string"                  // CUIT del comprador
},
"detalle": {
  "id_billetera": 0                 // ID de la billetera en Coelsa
}
```

En el Get Debin, la respuesta incluye datos más completos del comprador y vendedor con información de banco, sucursal, titular, etc.

**Ref: [D5] `coelsa.types.ts` líneas 280-338 — QRDebinQueryResponse:**
```typescript
comprador: {
  codigo: string;
  titular: string;       // Nombre del titular
  cuit: string;
  cuenta: {
    banco: string;       // Código banco
    sucursal: string;
    alias?: string;
    cbu: string;
    moneda: string;
    tipo: string;
  };
};
vendedor: {
  codigo: string;
  titular: string;       // Nombre del comercio
  cuit: string;
  cuenta: { /* misma estructura */ };
};
```

### 3.4 Estado actual del código — GAPs identificados

1. **`queryTransaction` definido pero nunca invocado** — `coelsa.adapter.ts` línea 140 define el método pero ningún servicio lo llama.

2. **QROperacionFinalizada no obtiene comisiones** — `transaction.service.ts` líneas 525-536 calcula `platform_commission` usando `calculateCommission()` que devuelve 0 porque `merchant_id` es null en transacciones OUTBOUND.

3. **No se hace consulta post-acreditación** — Después de recibir OperacionFinalizada con 5700, no se consulta el DEBIN para obtener `importeComision` y `comision`.

4. **Sandbox no mockea comisiones en query** — `coelsa.sandbox.ts` líneas 105-142 no incluye `importeComision` ni `comision` en la respuesta mock.

---

## 4. Tabla resumen: datos de comisión por mensaje y rol

| Rol Palta | Mensaje | Tiene comisiones | Campo clave | Referencia |
|-----------|---------|-----------------|-------------|------------|
| Aceptador | QRIntencionPago | **SÍ** — interchange array | `interchange[].importe_comision` | [D2] L226-234, [D3] L329-337 |
| Aceptador | QRConfirmaDebito | **SÍ** — interchange objeto | `interchange.importe_comision` | [D2] L308-316, [D3] L469-483 |
| Aceptador | QROperacionFinalizadaAdquirente | **NO** | — | [D2] L396-424 |
| Billetera | QRDebin (req/res) | **NO** | — | [D2] L96-175 |
| Billetera | QROperacionFinalizada | **NO** | — | [D2] L351-393, [D1] sheet35 |
| Billetera | Get QRPayment | **NO** | — | [D2] L487-504, [D1] sheet66 |
| Billetera | **Get Debin** | **SÍ** | `detalle.importeComision`, `detalle.comision` | [D1] sheets 54-58 |

---

## 5. Modelo de comisiones dual (Coelsa + Palta)

### 5.1 Comisión de Coelsa

Coelsa calcula y retiene su comisión automáticamente basándose en el MCC del comercio. Esta información llega:
- **INBOUND:** En el interchange del QRConfirmaDebito (datos definitivos)
- **OUTBOUND:** En la consulta Get Debin (`importeComision`, `comision`)

### 5.2 Comisión de Palta (platform_commission)

Palta puede cobrar una comisión adicional calculada internamente usando CommissionProfile + MCC rates:
- **INBOUND:** Ya funciona — se calcula en QRConfirmaDebito usando el CommissionProfile del merchant
- **OUTBOUND:** No funciona — `merchant_id` es null, no hay perfil asociado

### 5.3 Para implementar

**OUTBOUND necesita:**
1. Consultar Get Debin post-acreditación para obtener datos de comisión de Coelsa
2. Definir un mecanismo de comisión de Palta para transacciones sin merchant (ej: perfil default del sistema, tasa fija, o rate por dirección OUTBOUND)
3. Guardar ambas comisiones discriminadas en la transacción

---

## 6. Legacy: cómo se manejaban las comisiones

### 6.1 pal-qr-coelsa-ms (microservicio stateless)

**Ref: [D6] `services/qr.services.ts` líneas 67-68**

El legacy era stateless — validaba interchange pero no lo persistía localmente. Delegaba a Context API.

**Ref: [D6] `helpers/validations.helper.ts` líneas 141-227**

Validaciones de interchange:
- Todos los campos numéricos deben ser >= 0
- `importe_bruto === importe_neto + importe_comision`

### 6.2 palta-api-ts-master (backend legacy)

**Ref: [D7] `helpers/qrHelpers/qr3.helper.ts` líneas 102-128**

Usaba un sistema de comisiones propio basado en config del wallet:

```typescript
commissionPercentage(user) {
  // 1. Buscar fee específico del wallet
  // 2. Fallback a config default
  // 3. Sacar IVA (÷ 1.21)
  // 4. Capear al 0.8% máximo
}
```

No usaba datos de interchange de Coelsa para calcular comisiones.

**Ref: [D7] `api/wallet/makeComission.ts`**

Creaba transacciones de tipo "commission" como movimientos wallet separados:
```typescript
{
  commission: true,
  commissionPercentage: 0,
  type: "commission",
  commissionOrigin: "palta",
  description: "Cargo por administración CF"
}
```
