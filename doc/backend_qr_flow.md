# Documentación Técnica: Flujo de QR Interoperable

Este documento describe el flujo técnico de la funcionalidad de QR Interoperable (QR3) en la API de Palta (`palta-api-ts`).

## Visión General

El sistema soporta tanto el rol de **Billetera** (escanear QRs de terceros) como el de **Administrador de QR** (generar QRs para comercios de Palta que pueden ser escaneados por otras billeteras). La interoperabilidad se logra a través de estándares compatibles con Coelsa y el uso de DEBIN para la ejecución de pagos.

## Actores

1.  **Palta App (Billetera)**: La aplicación móvil que escanea códigos QR.
2.  **Palta Commerce (Comercio)**: El comercio que genera un QR para cobrar.
3.  **Billetera Externa**: Una aplicación de terceros que escanea un QR de Palta.
4.  **Coelsa**: Cámara compensadora utilizada para la ejecución de pagos (DEBIN).

## Flujos Principales

### 1. Generación de QR (Rol: Administrador)

Palta genera códigos QR para sus comercios. Estos QRs contienen información encriptada y siguen una estructura TLV (Tag-Length-Value).

*   **Endpoint**: `POST /api/qr3/createqrtres`
*   **Controlador**: `createQR3CommerceController`
*   **Servicio**: `createQR30CommerceService`
*   **Helper**: `src/helpers/qrHelpers/qr3Creator.helper.ts`

**Proceso:**
1.  Se obtienen los datos del comercio (CUIT, Nombre de Fantasía, Código Postal) usando el `id` del usuario.
2.  Se encriptan datos sensibles con AES:
    *   `Commerce ID` (Tag 43, Subtag 01)
    *   `CUIT` (Tag 50, Subtag 00)
3.  Se construye el string del QR siguiendo el estándar EMVCo modificado.
4.  Se calcula y anexa el CRC16 (Tag 63).

**Estructura del QR (Tags Principales):**
*   `00`: Payload Format Indicator
*   `01`: Point of Initiation Method (11: Estático, 12: Dinámico)
*   `26`: Merchant Account Information (Incluye fecha de expiración en subtag 00)
*   `43`: Merchant Account Information (Incluye "Reverse Domain" en subtag 00 y Commerce ID encriptado en subtag 01)
*   `50`: Merchant Account Information (Incluye CUIT encriptado en subtag 00)
*   `52`: Merchant Category Code
*   `53`: Transaction Currency (032: ARS)
*   `54`: Transaction Amount (Opcional)
*   `58`: Country Code (AR)
*   `59`: Merchant Name
*   `60`: Merchant City (Postal Code)
*   `62`: Additional Data Field (Bill Number en subtag 01)
*   `63`: CRC

### 2. Escaneo de QR (Rol: Billetera)

Cuando un usuario de Palta escanea un QR (propio o de terceros).

*   **Endpoint**: `POST /api/qr3/`
*   **Controlador**: `getQR3DataController`
*   **Servicio**: `getQR3DataService`

**Proceso:**
1.  Se parsea el string del QR (`parseQR`).
2.  Se busca un "Reverse Domain" en los tags 26-49 (subtag 00).
    *   Si se encuentra, se asume que es un QR interoperable.
    *   Se busca la URL del IEP (Interoperable Entity Provider) asociada a ese dominio en la base de datos (`AccessIEP`).
3.  Se realiza una petición `GET` a la URL del IEP para resolver los datos del QR.
4.  Se devuelve la información resuelta (monto, comercio, etc.) al frontend.

### 3. Resolución de QR (Rol: IEP)

Cuando una Billetera Externa escanea un QR de Palta. La billetera externa lee el "Reverse Domain" (`app.palta`) y consulta el endpoint de resolución de Palta.

*   **Endpoint**: `GET /api/qr3/instore/external/resolve`
*   **Controlador**: `getQR30InvolveResolveDataController`
*   **Servicio**: `getQR30InvolveResolveDataService`

**Proceso:**
1.  Recibe el string del QR en el parámetro `data`.
2.  Valida el CRC y la fecha de expiración.
3.  Parsea el QR y desencripta el `Commerce ID` y el `CUIT`.
4.  Busca el comercio en la base de datos.
5.  Genera una orden de pago (`QRPayOrder`) con estado `started`.
6.  Devuelve un objeto JSON con la información necesaria para que la billetera externa muestre el pago (Collector, Order, Status).

### 4. Ejecución del Pago (DEBIN)

Una vez que el usuario confirma el pago en la app.

*   **Endpoint**: `POST /api/qr3/QRDebin`
*   **Controlador**: `QRDebinPaltaCoelsa`
*   **Helper**: `src/helpers/qrHelpers/qrDebin.helper.ts`

**Proceso:**
1.  Recibe los datos de la operación (comprador, vendedor, detalle, etc.).
2.  Valida el cuerpo de la petición (`bodyDebinValidation`).
3.  Reenvía la petición al microservicio de integración con Coelsa (`palta-coelsa`) a través de la URL definida en `PALTA_COELSA_URL`.
    *   Ruta destino: `/api/qrPalta/coelsadebinqr`
4.  El microservicio `palta-coelsa` se encarga de la comunicación final con Coelsa para generar el DEBIN.

## Detalles Técnicos

### Encriptación
Se utiliza AES (Advanced Encryption Standard) para proteger el ID del comercio y el CUIT dentro del QR.
*   **Algoritmo**: AES
*   **Modo**: ECB
*   **Padding**: Pkcs7
*   **Claves**: Definidas en variables de entorno (`PASSWORDHASH`, `IVVAR`).

### CRC
El CRC (Cyclic Redundancy Check) se calcula utilizando el algoritmo CRC-16 (CCITT-FALSE).
*   Polinomio: `0x1021`
*   Valor inicial: `0xFFFF`

### Estructuras de Datos (Types)
Las estructuras de datos para la comunicación con Coelsa y el manejo interno se encuentran en:
*   `src/types/qrDebin.types.ts`
*   `src/services/utils/qr3.utils.ts`

## Archivos Clave

*   `src/api/qr3/qr3.routes.ts`: Definición de rutas.
*   `src/controller/qr3.controller.ts`: Controladores.
*   `src/services/qr3.services.ts`: Lógica de negocio principal.
*   `src/helpers/qrHelpers/qr3Creator.helper.ts`: Generación de strings QR.
*   `src/services/utils/qr3.utils.ts`: Utilidades de parseo, encriptación y CRC.
*   `src/helpers/qrHelpers/qrDebin.helper.ts`: Cliente para el microservicio de Coelsa.
