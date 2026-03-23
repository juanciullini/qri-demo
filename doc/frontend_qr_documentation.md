# Documentación Técnica: Implementación de QR Interoperable (Transferencias 3.0)

## 1. Introducción
Este documento detalla la implementación técnica del soporte para **QR Interoperable (Transferencias 3.0)** en la aplicación web. La solución permite tanto la generación de códigos QR (estáticos y dinámicos) compatibles con el estándar EMVCo, como el escaneo y pago de QRs de otras billeteras.

## 2. Arquitectura
La arquitectura sigue un modelo donde la lógica de negocio pesada y la generación de strings EMVCo residen en el **Backend**, mientras que el **Frontend** se encarga de la captura de datos, renderizado y orquestación de flujos.

*   **Frontend**: Responsable de solicitar la generación de QRs, renderizar el string recibido usando librerías de QR (`qrcode.react`), escanear QRs mediante la cámara, y recolectar datos para el pago.
*   **Backend**: Responsable de construir el string EMVCo válido (con CRC, IDs de merchant, etc.), validar QRs escaneados (IEP - Interoperable Electronic Payments), y procesar los pagos vía DEBIN.

## 3. Flujos Principales

### 3.1. Generación de QR Estático (Monto Abierto)
*   **Componente**: `src/views/qr-generator/index.jsx`
*   **Flujo**:
    1.  Al cargar la vista, se llama a `getDataQR(userData._id)`.
    2.  Se realiza un POST a `/qrtres/createqrtres` enviando solo el ID del usuario.
    3.  El backend retorna un string QR (EMVCo) estático asociado a la cuenta.
    4.  El frontend renderiza el código QR utilizando el componente `<QRCode />`.

### 3.2. Generación de QR Dinámico (Monto Cerrado)
*   **Componente**: `src/views/qr-generator-close-amount/index.jsx`
*   **Flujo**:
    1.  El usuario ingresa Monto, N° de Factura y Tiempo de Expiración en un modal (`Swal`).
    2.  Se llama a `getDataQR` con estos parámetros adicionales.
    3.  Se realiza un POST a `/qrtres/createqrtres` con `{ id, amount, billNumber, expiringTime }`.
    4.  El backend genera un QR dinámico que incluye el monto y la transacción.
    5.  El frontend muestra el QR y un temporizador de expiración (`TimerExpiry`).

### 3.3. Escaneo de QR
*   **Componente**: `src/views/qr-reader/index.jsx`
*   **Helpers**: `src/helpers/qrHelpers/qrReader.js`
*   **Flujo**:
    1.  El componente `QRScanComponent` captura el string del QR.
    2.  Se invoca `getIEP(data, token, setError)`.
    3.  Se hace un POST a `/qrtres` (o endpoint configurado) para validar y parsear el QR.
    4.  El backend devuelve la información del QR (IEP - Interoperable Electronic Payment), incluyendo si es un QR propio de Palta o externo.
    5.  Si es externo, se extraen datos como `cuit`, `cvu`, `name` del objeto `resolveInStoreExternal`.

### 3.4. Pagos (DEBIN)
*   **Componente**: `src/views/Payments/select-wallet-by-qr3.0/SelectWalletByQR30.jsx`
*   **Helpers**: `src/helpers/qrHelpers/qrDebin.js`
*   **Flujo**:
    1.  Tras escanear, el usuario selecciona la billetera/cuenta de origen.
    2.  Se confirman los datos de la transacción.
    3.  Se llama a `postDebinQR`.
    4.  Se transforma la data para el formato DEBIN (`transformQRDataHelper`).
    5.  Se envía un POST a `/qrtres/QRDebin` con la estructura `{ operacion: { vendedor, comprador, detalle } }`.

## 4. Componentes Clave

| Archivo | Descripción |
| :--- | :--- |
| `src/views/qr-generator/index.jsx` | Vista principal para ver el QR propio (estático). |
| `src/views/qr-generator-close-amount/index.jsx` | Vista para generar QRs de cobro específicos (dinámicos). |
| `src/views/MassiveQr/MassiveQr.jsx` | Carga masiva de QRs (probablemente para municipios/impuestos). |
| `src/views/qr-reader/index.jsx` | Escáner de QRs. |
| `src/helpers/qrHelpers/qrReader.js` | Lógica de parsing y validación de QRs escaneados. |
| `src/helpers/qrHelpers/qrDebin.js` | Armado de payload para pagos DEBIN. |

## 5. Endpoints Relevantes

*   `POST /qrtres/createqrtres`: Generación de strings QR (estáticos y dinámicos).
*   `POST /qrtres`: Validación/Resolución de QRs escaneados.
*   `POST /qrtres/QRDebin`: Ejecución de pagos interoperables.
*   `GET /qrtres/getAllQRCsv/:id`: Obtención de historial de QRs masivos.
