---
marp: true
theme: default
paginate: true
backgroundColor: #ffffff
style: |
  section {
    font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  }
  section.lead {
    text-align: center;
    background: linear-gradient(135deg, #1e3a5f 0%, #0f172a 100%);
    color: white;
  }
  section.lead h1 {
    color: white;
    font-size: 2.5em;
  }
  section.lead h2 {
    color: #94a3b8;
    font-weight: 400;
  }
  section.lead p {
    color: #cbd5e1;
  }
  h1 {
    color: #1e3a5f;
    border-bottom: 3px solid #3b82f6;
    padding-bottom: 8px;
  }
  h2 {
    color: #334155;
  }
  table {
    font-size: 0.8em;
  }
  img {
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .columns {
    display: flex;
    gap: 20px;
  }
  .col {
    flex: 1;
  }
  code {
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.85em;
  }
  footer {
    color: #94a3b8;
    font-size: 0.7em;
  }
  section.section-divider {
    text-align: center;
    background: linear-gradient(135deg, #1e40af 0%, #1e3a5f 100%);
    color: white;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  section.section-divider h1 {
    color: white;
    border: none;
    font-size: 2.2em;
  }
---

<!-- _class: lead -->

# QRi

## Sistema de QR Interoperable
### Transferencias 3.0 — Red Coelsa

**Palta Fintech**

---

# Agenda

1. **Contexto** — QR Interoperable y Transferencias 3.0
2. **Funcionalidades del sistema** — Demo de cada módulo
3. **Arquitectura técnica** — Stack y decisiones de diseño
4. **Seguridad** — Autenticación, cifrado y mTLS
5. **Próximos pasos**

---

# Contexto: Transferencias 3.0

- **Regulación BCRA** para pagos con QR interoperables en Argentina
- Los QR siguen el formato **EMVCo TLV** (estándar internacional)
- Interoperabilidad entre billeteras digitales y comercios a través de la **red Coelsa**
- Palta actúa como **PSP (Payment Service Provider)** y billetera digital

**Flujo de pago:**
```
Billetera → Escaneo QR → PSP Origen → Coelsa → PSP Destino → Comercio
```

---

# Ciclo de vida de una transacción

```
CREADO → INTENCION_ENVIADA → INTENCION_ACEPTADA → DEBITO_PENDIENTE →
DEBITO_CONFIRMADO → CREDITO_ENVIADO → EN_CURSO → ACREDITADO
```

- Cada estado es una **operación DEBIN/CVU** contra Coelsa
- Timeout sincrónico de **2 segundos** (Coelsa exige respuesta en 3s)
- Timeout total de transacción: **15 segundos**
- Posibilidad de **reversión** y **devolución** desde estados aplicables

---

<!-- _class: section-divider -->

# Funcionalidades del Sistema

---

# Dashboard

Panel principal con métricas en **tiempo real** vía WebSocket.

<!-- Captura: screenshot del dashboard completo -->
![Dashboard](screenshots/dashboard.png)

- Volumen de transacciones por día (gráfico de barras)
- Distribución de estados (gráfico circular)
- Estadísticas de comisiones (últimos 30 días)
- Últimas 5 transacciones y alertas del sistema

---

# Gestión de Comercios

Alta, edición y administración de comercios registrados en la red.

<!-- Captura: listado de comercios -->
![Listado de comercios](screenshots/comercios-listado.png)

- Datos del comercio: **CUIT**, **CBU**, **MCC** (código de actividad)
- Estados: Pendiente → Registrando → **Activo** → Suspendido
- Filtros por nombre, CUIT y estado
- Asociación automática con códigos QR

---

# Alta de Comercio

<!-- Captura: formulario de alta de comercio -->
![Formulario de comercio](screenshots/comercio-formulario.png)

- Datos legales: Razón social, CUIT (11 dígitos), CBU (22 dígitos)
- Contacto: Email, teléfono, dirección
- Configuración: MCC, porcentaje de split
- Validación client-side en tiempo real

---

# Detalle de Comercio

<!-- Captura: detalle de un comercio -->
![Detalle de comercio](screenshots/comercio-detalle.png)

- Resumen con estadísticas: transacciones, volumen, ticket promedio
- QR activos asociados al comercio
- Acciones: editar, activar/suspender, eliminar

---

# Generación de Códigos QR

Dos tipos de QR según el caso de uso del comercio.

<!-- Captura: pantalla de generación de QR -->
![Generación de QR](screenshots/qr-generacion.png)

| QR Estático | QR Dinámico |
|-------------|-------------|
| Monto abierto | Monto fijo |
| Sin vencimiento | Expiración configurable |
| Ideal para comercios físicos | Ideal para e-commerce / facturación |

- Formato **EMVCo TLV** cumpliendo normativa BCRA
- Descarga en **PNG** y **SVG**

---

# Listado de QR

<!-- Captura: grilla de QR codes -->
![Listado de QR](screenshots/qr-listado.png)

- Vista en grilla responsive con cards
- Filtros por tipo (Estático/Dinámico) y estado (Activo/Expirado)
- Búsqueda por alias o nombre de comercio
- Indicador visual de estado con badges de color

---

# Billetera: Flujo de Pago

Simulación completa del flujo de pago desde la billetera digital.

<!-- Captura: los 3 pasos del flujo de pago -->
![Flujo de pago - Escaneo](screenshots/billetera-escaneo.png)

**3 pasos:**
1. **Escanear** — Pegar datos del QR
2. **Confirmar** — Verificar comercio, ingresar monto (QR estático), CBU y CUIT del pagador
3. **Resultado** — Confirmación exitosa con ID de transacción o error

---

# Billetera: Confirmación y Resultado

<!-- Captura: paso de confirmación y/o resultado -->
![Flujo de pago - Confirmación](screenshots/billetera-confirmacion.png)

- Muestra datos del comercio destino (nombre, CUIT, MCC)
- Validación de CBU (22 dígitos) y CUIT (11 dígitos)
- Historial de pagos recientes del wallet

---

# Transacciones

Monitoreo en **tiempo real** de todas las transacciones del sistema.

<!-- Captura: listado de transacciones -->
![Transacciones](screenshots/transacciones-listado.png)

- Tabs: **Todos** / **Cobros** (inbound) / **Pagos** (outbound)
- Indicador de conexión WebSocket en vivo
- Filtros: ID, estado, comercio, rango de fechas
- Actualización automática sin refresh

---

# Detalle de Transacción

<!-- Captura: detalle de una transacción con timeline -->
![Detalle de transacción](screenshots/transaccion-detalle.png)

- **Timeline visual** del ciclo de estados con timestamps
- Detalle de comisiones aplicadas
- **Mensajes Coelsa**: payloads JSON enviados/recibidos
- Botón de **devolución** para transacciones acreditadas (ADMIN/OPERATOR)

---

# Liquidaciones

Consolidación de transacciones por período para cada comercio.

<!-- Captura: listado y/o detalle de liquidación -->
![Liquidaciones](screenshots/liquidaciones.png)

- Períodos configurables con estados: Pendiente → En proceso → Completada
- Desglose financiero: **Bruto** → Comisión → **Neto**
- Detalle por MCC (código de actividad)
- Listado de transacciones incluidas en cada liquidación

---

# Comisiones

Dashboard de análisis y configuración de comisiones.

<!-- Captura: dashboard de comisiones -->
![Comisiones](screenshots/comisiones-dashboard.png)

- Evolución temporal: monto bruto vs. comisión (gráfico de líneas)
- Desglose por **comercio** y por **MCC**
- Filtros por granularidad: diario / semanal / mensual

---

# Perfiles de Comisión

<!-- Captura: perfiles de comisión -->
![Perfiles de comisión](screenshots/comisiones-perfiles.png)

- Perfiles configurables con tasa base por defecto
- **Tasas diferenciadas por MCC** (código de actividad)
- Dirección configurable: Cobros / Pagos / Ambos
- Asignación de perfiles a comercios

---

# Gestión de Usuarios

Control de acceso basado en roles (**RBAC**).

<!-- Captura: listado de usuarios -->
![Usuarios](screenshots/usuarios.png)

| Rol | Acceso |
|-----|--------|
| **Admin** | Acceso total + gestión de usuarios y sistema |
| **Operator** | Comercios, QR, transacciones, liquidaciones |
| **Merchant** | Solo datos de su propio comercio |
| **Viewer** | Solo lectura de transacciones |

---

# Panel de Sistema

Monitoreo de salud del sistema y configuración.

<!-- Captura: panel de sistema -->
![Sistema](screenshots/sistema.png)

- **Health check**: estado, uptime, versión, latencia Coelsa
- Indicador de conexión Coelsa en tiempo real (auto-refresh 15s)
- Configuración editable en línea
- **Modo Sandbox**: simular escenarios (happy path, timeout, reversión, fondos insuficientes)

---

<!-- _class: section-divider -->

# Arquitectura Técnica

---

# Stack Tecnológico

<div class="columns">
<div class="col">

### Backend
- **Fastify 5** — HTTP framework
- **Prisma ORM** — PostgreSQL
- **Redis** (ioredis) — Cache y tokens
- **Socket.IO** — Tiempo real
- **Zod** — Validación de schemas
- **Pino** — Logging estructurado
- **TypeScript** (ESM, strict)

</div>
<div class="col">

### Frontend
- **React 19** + TypeScript
- **Vite 7** — Build tool
- **Tailwind CSS 4** — Estilos
- **Zustand** — Estado global
- **TanStack React Query** — Server state
- **Recharts** — Visualizaciones
- **Socket.IO Client** — Tiempo real

</div>
</div>

---

# Arquitectura del Backend

Patrón modular con separación clara de responsabilidades:

```
Request → Route → Controller → Service → Prisma (DB)
                      ↑
               Zod Schema (validación)
```

**10 módulos:** `auth` · `users` · `merchants` · `qr` · `transactions` · `coelsa` · `wallet` · `settlements` · `sandbox` · `system`

Cada módulo: `routes.ts` → `controller.ts` → `service.ts` + `schemas.ts`

---

# Integración con Coelsa

```
QRi Backend ←→ Coelsa (Red de pagos)
   ↕ mTLS          ↕ DEBIN + CVU
Webhooks         Operaciones
```

- Comunicación bidireccional via **webhooks** con autenticación **mTLS**
- Operaciones **DEBIN** (débito inmediato) y **CVU** (clave virtual uniforme)
- Timeout de respuesta: **2 segundos** (Coelsa exige 3s)
- **Modo sandbox** para desarrollo y testing sin impacto productivo
- Adaptador dedicado que traduce formatos Coelsa ↔ QRi

---

# Seguridad

| Capa | Implementación |
|------|---------------|
| **Autenticación** | JWT con access token (15min) + refresh token (7 días) |
| **Refresh tokens** | Almacenados en Redis, rotación en cada uso |
| **Autorización** | RBAC con middleware `requireRole()` |
| **Comunicación Coelsa** | mTLS (certificados mutuos) |
| **Datos sensibles** | Cifrado AES-256 |
| **Validación** | Zod en cada endpoint (runtime) |
| **Rate limiting** | Limitación por IP en endpoints públicos |
| **Modo Sandbox** | Aislado, sin conexión a Coelsa real |

---

# Base de Datos

- **PostgreSQL** como base principal (Prisma ORM)
- **Redis** para:
  - Refresh tokens (con TTL de 7 días)
  - Cache de sesiones
  - Revocación de tokens
- **Máquina de estados** para transacciones (`state-machine.ts`)
  - Garantiza transiciones válidas
  - Previene estados inconsistentes

---

<!-- _class: section-divider -->

# Próximos Pasos

---

# Roadmap

- Integración con más redes de pago
- App mobile nativa para comercios
- Reportes avanzados y exportación
- Notificaciones push en tiempo real
- Onboarding digital de comercios
- Métricas de fraude y prevención

---

<!-- _class: lead -->

# Gracias

### QRi — QR Interoperable by Palta

Transferencias 3.0 · Red Coelsa · EMVCo TLV

