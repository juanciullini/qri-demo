# Generación y Codificación de QR para Pagos Interoperables

## Resumen Ejecutivo

**El código de Palta NO genera los códigos QR internamente.** Los QR son **generados externamente** por:
- **Comercios/Aceptadores:** Generan QR estáticos o dinámicos para recibir pagos
- **Coelsa:** Puede proveer QR en ciertos flujos
- **Billeteras externas:** Cuando actúan como comercios

El código de Palta **recibe, valida y procesa** estos QR ya codificados.

---

## Formato del QR: Estándar EMVCo

Los QR de pagos interoperables en Argentina siguen el **estándar EMVCo QR Code Specification** en modo **Merchant-Presented Mode (MPM)**.

### Ejemplo Real (del código de test)

```
00020101021143810009app.palta016446d7180b8e4f85fa9dd6a2505f93093d8c1fd8f5891b78c95a0baf095ecc43d850360032bbc5138c322db43ba8ad6848f00d55e35204970053030325802AR5909El Golazo6005M55006304dde7b
```

Este es un **string alfanumérico** que se codifica en un código QR 2D usando cualquier librería estándar de generación de QR (como `qrcode`, `qr-image`, etc.).

---

## Estructura del QR (Formato EMVCo TLV)

El QR utiliza una estructura **Tag-Length-Value (TLV)**:

```
[ID][Longitud][Valor]
```

### Decodificación del Ejemplo

Analicemos el QR del test paso a paso:

```
0002  →  ID: 00, Longitud: 02, Valor: 01
         (Payload Format Indicator, versión 01)

0101  →  ID: 01, Longitud: 01, Valor: 01
         (Point of Initiation Method, 01 = estático)

0214  →  ID: 02, Longitud: 14, Valor: ...
         (Merchant Account Information)

3810  →  ID: 38, Longitud: 10, Valor: ...
         (Merchant Account Information - Extended)

0009  →  Sub-ID: 00, Longitud: 09, Valor: app.palta
         (Globally Unique Identifier)

0164  →  Sub-ID: 01, Longitud: 64, Valor: 46d7180b8e4f85fa9dd6a2505f93093d8c1fd8f5891b78c95a0baf095ecc43d8
         (Payment Network Specific Data)

5036  →  ID: 50, Longitud: 36, Valor: ...
         (Additional Data Field Template)

0032  →  Sub-ID: 00, Longitud: 32, Valor: bbc5138c322db43ba8ad6848f00d55e3
         (Bill Number / Reference ID)

5204  →  ID: 52, Longitud: 04, Valor: 9700
         (Merchant Category Code - MCC)

5303  →  ID: 53, Longitud: 03, Valor: 032
         (Transaction Currency - 032 = Peso Argentino)

5802  →  ID: 58, Longitud: 02, Valor: AR
         (Country Code - Argentina)

5909  →  ID: 59, Longitud: 09, Valor: El Golazo
         (Merchant Name)

6005  →  ID: 60, Longitud: 05, Valor: M5500
         (Merchant City / Postal Code)

6304  →  ID: 63, Longitud: 04, Valor: dde7b
         (CRC - Checksum para validar integridad)
```

### Campos Clave

| Tag | Nombre | Descripción | Ejemplo |
|-----|--------|-------------|---------|
| `00` | Payload Format Indicator | Versión del formato | `01` |
| `01` | Point of Initiation | `01` = estático, `12` = dinámico | `01` |
| `26-51` | Merchant Account Info | Datos del comercio/PSP | `app.palta` + hash |
| `52` | MCC | Merchant Category Code | `9700` |
| `53` | Currency | Código ISO 4217 | `032` (ARS) |
| `54` | Transaction Amount | Monto (solo en QR dinámicos) | - |
| `58` | Country Code | Código ISO 3166-1 | `AR` |
| `59` | Merchant Name | Nombre del comercio | `El Golazo` |
| `60` | Merchant City | Ciudad o código postal | `M5500` |
| `63` | CRC | Checksum CRC-16 | `dde7b` |

---

## Tipos de QR

### 1. QR Estático

- **Uso:** Mismo QR para múltiples transacciones
- **Características:**
  - No incluye monto (Tag `54`)
  - Point of Initiation = `01`
  - El usuario ingresa el monto manualmente
- **Ejemplo de uso:** QR impreso en un mostrador

### 2. QR Dinámico

- **Uso:** QR único por transacción
- **Características:**
  - Incluye monto específico (Tag `54`)
  - Point of Initiation = `12`
  - Puede incluir datos adicionales como `qr_id_trx`
- **Ejemplo de uso:** QR generado en una app de punto de venta

---

## Flujo en el Código de Palta

### 1. Recepción del QR (Como Billetera)

Cuando un usuario de Palta **escanea un QR** de un comercio:

```typescript
// El QR ya viene decodificado por la app móvil
const qrString = "00020101021143810009app.palta...";

// Se envía en el request
POST /qrPalta/coelsadebinqr
{
  operacion: {
    detalle: {
      qr: "00020101021143810009app.palta...",  // QR completo
      qr_hash: "sha256_hash_del_qr",           // Hash opcional
      qr_id_trx: "uuid-de-transaccion",
      // ... otros campos
    }
  }
}
```

**El código NO decodifica el QR**, simplemente lo pasa a Coelsa tal cual.

### 2. Generación del QR (Como Comercio)

**Palta NO genera QR en este repositorio.** La generación se haría en:
- **Frontend/App móvil del comercio:** Genera el QR usando una librería
- **Backend de gestión de comercios:** Crea QR estáticos para cada comercio
- **Sistema externo:** Provee QR pre-generados

---

## Cómo Generar un QR (Guía Práctica)

Si necesitás generar QR para comercios de Palta, seguí estos pasos:

### Paso 1: Construir el String EMVCo

```javascript
// Ejemplo simplificado
function buildEMVCoQR(merchantData) {
  let qr = '';
  
  // Payload Format Indicator
  qr += '000201';  // ID=00, Len=02, Val=01
  
  // Point of Initiation (01=estático, 12=dinámico)
  qr += '010101';  // ID=01, Len=01, Val=01
  
  // Merchant Account Information (ID 26-51)
  const merchantInfo = buildMerchantInfo(merchantData);
  qr += `38${merchantInfo.length.toString().padStart(2, '0')}${merchantInfo}`;
  
  // MCC (Merchant Category Code)
  const mcc = merchantData.mcc || '9700';
  qr += `52${mcc.length.toString().padStart(2, '0')}${mcc}`;
  
  // Currency (032 = ARS)
  qr += '5303032';
  
  // Amount (solo para QR dinámicos)
  if (merchantData.amount) {
    const amount = merchantData.amount.toFixed(2);
    qr += `54${amount.length.toString().padStart(2, '0')}${amount}`;
  }
  
  // Country Code
  qr += '5802AR';
  
  // Merchant Name
  const name = merchantData.name;
  qr += `59${name.length.toString().padStart(2, '0')}${name}`;
  
  // Merchant City/Postal Code
  const city = merchantData.postalCode || 'M5500';
  qr += `60${city.length.toString().padStart(2, '0')}${city}`;
  
  // CRC (se calcula al final)
  qr += '6304';  // Placeholder
  const crc = calculateCRC16(qr);
  qr += crc;
  
  return qr;
}

function buildMerchantInfo(merchantData) {
  let info = '';
  
  // GUI (Globally Unique Identifier)
  const gui = 'app.palta';
  info += `00${gui.length.toString().padStart(2, '0')}${gui}`;
  
  // Payment Network Specific (puede ser el CVU, ID de comercio, etc.)
  const networkData = merchantData.cvu || merchantData.merchantId;
  info += `01${networkData.length.toString().padStart(2, '0')}${networkData}`;
  
  return info;
}

function calculateCRC16(data) {
  // Implementación de CRC-16/CCITT-FALSE
  // Ver: https://www.npmjs.com/package/crc
  const crc = require('crc');
  return crc.crc16ccitt(data).toString(16).toLowerCase();
}
```

### Paso 2: Generar la Imagen QR

```javascript
const QRCode = require('qrcode');

async function generateQRImage(emvcoString) {
  // Generar como imagen PNG
  await QRCode.toFile('qr-comercio.png', emvcoString, {
    errorCorrectionLevel: 'M',
    type: 'png',
    width: 300
  });
  
  // O como Data URL para web
  const dataUrl = await QRCode.toDataURL(emvcoString);
  return dataUrl;
}
```

### Paso 3: Ejemplo Completo

```javascript
const merchantData = {
  name: 'El Golazo',
  mcc: '9700',
  cvu: '0000220400000000008158',
  postalCode: 'M5500',
  amount: null  // null = QR estático
};

const emvcoString = buildEMVCoQR(merchantData);
console.log('QR String:', emvcoString);

const qrImage = await generateQRImage(emvcoString);
console.log('QR generado exitosamente');
```

---

## Validación del QR en Palta

El código de Palta valida el QR recibido en:

**Archivo:** [`validations.helper.ts`](file:///Users/juanciullini/Develop/palta/palta-coelsa-master/src/helpers/validations.helper.ts)

```typescript
export const bodyDebinValidation = (bodyDebin: QRDebinCoelsaRequest) => {
  const details = bodyDebin.operacion.detalle;
  
  // Validar que el QR exista
  if (!details.qr) {
    throw new Error('QR code is required');
  }
  
  // Validar que el qr_id_trx exista
  if (!details.qr_id_trx) {
    throw new Error('QR transaction ID is required');
  }
  
  // Opcional: validar qr_hash
  const qrHash = details.qr_hash;
  if (qrHash) {
    // Validar integridad del hash
    // ...
  }
}
```

---

## Campos Importantes en el Flujo

### `qr` (string)

El string completo del QR en formato EMVCo.

**Ejemplo:**
```
00020101021143810009app.palta016446d7180b8e4f85fa9dd6a2505f93093d8c1fd8f5891b78c95a0baf095ecc43d850360032bbc5138c322db43ba8ad6848f00d55e35204970053030325802AR5909El Golazo6005M55006304dde7b
```

### `qr_hash` (string, opcional)

Hash SHA-256 del QR para validar integridad.

**Ejemplo:**
```javascript
const crypto = require('crypto');
const qrHash = crypto.createHash('sha256').update(qrString).digest('hex');
```

### `qr_id_trx` (string, UUID)

Identificador único de la transacción QR. Se usa para trackear toda la operación.

**Ejemplo:**
```
ae271e0e-3e2f-4377-b9fa-f752dcc2980d
```

---

## Librerías Recomendadas

### Para Node.js

```bash
npm install qrcode crc uuid
```

```javascript
const QRCode = require('qrcode');
const crc = require('crc');
const { v4: uuidv4 } = require('uuid');
```

### Para Frontend (React/Vue/Angular)

```bash
npm install qrcode.react
# o
npm install vue-qrcode
# o
npm install angularx-qrcode
```

---

## Recursos Adicionales

- **Especificación EMVCo:** [EMVCo QR Code Specification](https://www.emvco.com/emv-technologies/qrcodes/)
- **Normativa BCRA:** Comunicaciones A7153, A7462, A7463
- **Calculadora CRC-16:** [CRC Calculator](https://www.lammertbies.nl/comm/info/crc-calculation)

---

## Conclusión

**Palta NO genera QR internamente.** Para implementar generación de QR:

1. ✅ **Usar el formato EMVCo estándar** (TLV)
2. ✅ **Incluir campos obligatorios:** GUI (`app.palta`), MCC, Currency, Country, Merchant Name, CRC
3. ✅ **Generar el QR con una librería estándar** (`qrcode`, `qr-image`, etc.)
4. ✅ **Enviar el string QR completo** en el campo `qr` del request
5. ✅ **Generar un `qr_id_trx` único** (UUID v4)
6. ✅ **Opcionalmente calcular `qr_hash`** para validación adicional

El código de Palta se encarga de **recibir, validar y procesar** estos QR en el flujo de pagos interoperables.
