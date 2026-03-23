# Flujo de Generación de Intención de Pago (Palta como Billetera)

## Resumen

**Como GENERAR intenciones de pago**, actuando como **Billetera/Wallet** que inicia un pago QR hacia Coelsa.

Este flujo es el **opuesto** al flujo de recepción de intenciones de pago (donde Palta actúa como Aceptador/PSP).

---

## Endpoint de Entrada

**`POST /qrPalta/coelsadebinqr`**

Este endpoint permite a Palta iniciar un pago QR escaneado por un usuario de la billetera.

---

## Proceso Detallado

### 1. **Recepción del Request**

**Controller:** [`qr.controller.ts:13-25`](file:///Users/juanciullini/Develop/palta/palta-coelsa-master/src/controller/qr.controller.ts#L13-L25)

```typescript
export const coelsaDebinQRController = async (req: Request) => {
    const bodyDebin = req.body;
    const response = await coelsaDebinQRService(bodyDebin);
    
    if (response?.respuesta.codigo === '7100') {
        return formatSuccessResponse(response)
    } else {
        sendErrorMessage(Messages.INDIVIDUAL_MERCHANT_REGISTER_ERROR, response?.respuesta?.descripcion);
    }
};
```

**Input esperado:** Objeto de tipo `QRDebinCoelsaRequest`

```typescript
{
  operacion: {
    administrador?: { cuit: string },
    vendedor: {
      cuit: string,
      cbu: string,
      banco: string,
      sucursal: string,
      terminal?: string
    },
    comprador: {
      cuenta: { cbu?: string, alias?: string },
      cuit: string
    },
    detalle: {
      concepto: string,
      moneda: string,
      importe: number,
      tiempo_expiracion: number,
      descripcion?: string,
      qr: string,
      qr_hash?: string,
      qr_id_trx: string,
      id_billetera: number
    },
    datos_generador?: { /* ubicación, IP, dispositivo, etc. */ }
  }
}
```

---

### 2. **Validación del Body**

**Service:** [`qr.services.ts:74-93`](file:///Users/juanciullini/Develop/palta/palta-coelsa-master/src/services/qr.services.ts#L74-L93)

```typescript
export const coelsaDebinQRService = async (bodyDebin: QRDebinCoelsaRequest) => {
    // 1. Validar estructura del request
    bodyDebinValidation(bodyDebin);
```

**Helper de validación:** `validations.helper.ts:bodyDebinValidation()`

Valida que todos los campos obligatorios estén presentes y sean del tipo correcto.

---

### 3. **Transformación y Guardado de la Orden de Compra**

```typescript
    // 2. Transformar a formato interno
    const buyOrder = transformToBuyOrder(data);
    
    // 3. Guardar en MongoDB como QROrdenCompra
    await QROrdenCompraServices._save(buyOrder);
```

**Helper de transformación:** [`debin.helper.ts:3-34`](file:///Users/juanciullini/Develop/palta/palta-coelsa-master/src/helpers/debin.helper.ts#L3-L34)

Convierte el formato de Coelsa al modelo interno de Palta:

```typescript
{
  administrador: { cuit: process.env.COELSA_CUIT },
  seller: { cuit, cbu, bank, branch },
  buyer: { account: { cbu, alias }, cuit },
  detail: {
    concept, currency, amount, expireTime,
    description, qr, qr_id_trx, id_wallet
  },
  qr_id_trx: "...",
  status: 'started'  // Estado inicial
}
```

**Modelo:** `QROrdenCompra` (MongoDB)

Este registro permite trackear el estado de la orden de compra a lo largo de todo el flujo.

---

### 4. **Autenticación con Coelsa**

```typescript
    // 4. Obtener token de autenticación
    const config = ConfigManager.getConfiguration()
    const loginResponse = await loginDebin()
    const {access_token} = loginResponse.data
```

**Helper:** `coelsa.helper.ts:loginDebin()`

Realiza login en la API de Coelsa para obtener un `access_token` válido.

---

### 5. **Envío del Request a Coelsa**

```typescript
    // 5. Construir request hacia Coelsa
    const url = `${config.coelsa.debin.API}/apiDebinV1/QR/QRDebin`
    
    const qrDebinRequest: PostRequestBody = {
        url,
        token: access_token,
        body: data  // Body original sin transformar
    }
    
    // 6. Enviar POST a Coelsa
    return postRequest(qrDebinRequest)
}
```

**Endpoint de Coelsa:** `POST /apiDebinV1/QR/QRDebin`

Este es el endpoint de Coelsa que **recibe** la intención de pago desde la Billetera (Palta).

---

### 6. **Respuesta de Coelsa**

**Tipo de respuesta:** `QRDebinCoelsaResponse`

```typescript
{
  respuesta: {
    codigo: string,      // '7100' = éxito
    descripcion: string
  },
  debin: {
    id: string,
    estado: {
      codigo: ESTADO_DEBIN,
      descripcion: string
    },
    addDt: Date,
    fechaExpiracion: Date
  },
  evaluacion: {
    puntaje: number,
    reglas: string
  }
}
```

**Código de éxito:** `'7100'`

Si el código es `'7100'`, la intención de pago fue aceptada por Coelsa y el flujo continúa.

---

## Flujo Completo (Diagrama)

```
┌─────────────────┐
│  Usuario Palta  │
│   (Billetera)   │
└────────┬────────┘
         │ Escanea QR del comercio
         ▼
┌─────────────────────────────────────┐
│ POST /qrPalta/coelsadebinqr         │
│ Body: QRDebinCoelsaRequest          │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ coelsaDebinQRService                │
│ 1. Validar body                     │
│ 2. Transformar a BuyOrder           │
│ 3. Guardar QROrdenCompra (started)  │
│ 4. Login en Coelsa                  │
│ 5. POST a Coelsa /QRDebin           │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Coelsa API                          │
│ POST /apiDebinV1/QR/QRDebin         │
│ Procesa la intención de pago        │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Respuesta de Coelsa                 │
│ - codigo: '7100' (éxito)            │
│ - debin.id                          │
│ - debin.estado                      │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Respuesta al cliente                │
│ formatSuccessResponse(response)     │
└─────────────────────────────────────┘
```

---

## Relación con el Flujo de Recepción

Este flujo es **complementario** al flujo de recepción de intenciones de pago:

| Aspecto | Generación (este flujo) | Recepción (flujo anterior) |
|---------|-------------------------|----------------------------|
| **Rol de Palta** | Billetera/Wallet | Aceptador/PSP |
| **Endpoint** | `POST /coelsadebinqr` | `POST /QRIntencionPago` |
| **Dirección** | Palta → Coelsa | Coelsa → Palta |
| **Modelo guardado** | `QROrdenCompra` | `QRIntencionPago` |
| **Estado inicial** | `started` | `created` |
| **API de Coelsa** | `/apiDebinV1/QR/QRDebin` | N/A (Coelsa llama a Palta) |

---

## Observaciones Importantes

1. **Doble Rol:** Palta puede actuar tanto como:
   - **Billetera** (este flujo): Cuando un usuario de Palta escanea un QR de un comercio externo
   - **Aceptador/PSP** (flujo anterior): Cuando un comercio de Palta recibe un pago de una billetera externa

2. **Tracking de Estado:** La `QROrdenCompra` se crea con estado `started` y luego se actualiza en los flujos posteriores:
   - En `QRIntencionPagoService`: Se busca y actualiza a `pendiente`
   - En `QRConfirmaDebitoService`: Se actualiza a `paid`
   - En `QRReversoService`: Se actualiza a `rejected`

3. **Sincronización:** El `qr_id_trx` es el identificador único que vincula:
   - La `QROrdenCompra` (generada aquí)
   - La `QRIntencionPago` (recibida después desde Coelsa)
   - Todos los mensajes subsiguientes del flujo

---

## Conclusión

**Sí, el código implementa la generación de intenciones de pago**, permitiendo que Palta actúe como una billetera completa que puede:

1. ✅ **Generar** intenciones de pago (este flujo)
2. ✅ **Recibir** intenciones de pago (flujo analizado anteriormente)
3. ✅ **Confirmar** débitos
4. ✅ **Reversar** operaciones

Esto convierte a Palta en una **solución integral** que puede operar en ambos lados del ecosistema QR Interoperable.
