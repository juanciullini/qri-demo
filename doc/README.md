# Documentación QR Interoperable - Palta (Versión Gemini)

Esta carpeta contiene toda la documentación consolidada del sistema de **QR Interoperable (Transferencias 3.0)** de Palta, generada por Gemini.

## 📚 Documentos Principales

### 🎯 Flujo Completo

**[FLUJO_COMPLETO_QR_INTEROPERABLE.md](./FLUJO_COMPLETO_QR_INTEROPERABLE.md)**

Documento maestro que consolida toda la información de los tres proyectos (frontend, backend, core Coelsa). Incluye:

- Arquitectura general del sistema
- Flujos end-to-end completos con diagramas de secuencia
- Componentes detallados por capa
- Estructura del QR (formato EMVCo)
- Mensajería Coelsa
- Casos de uso prácticos
- Manejo de errores
- Referencias y configuración

**📖 Recomendación:** Comenzar por este documento para entender el sistema completo.

---

## 📂 Documentación por Proyecto

### Frontend (palta-web-administrator)

**[frontend_qr_documentation.md](./frontend_qr_documentation.md)**

Documentación técnica de la implementación en el frontend web:

- Componentes React para generación de QR (estático y dinámico)
- Componente de escaneo de QR
- Flujo de pagos DEBIN
- Helpers y utilidades
- Endpoints utilizados

**Proyecto original:** `palta-web-administrator-fix-adapt-qr-reader-to-qr3/docs`

---

### Backend API (palta-api-ts)

**[backend_qr_flow.md](./backend_qr_flow.md)**

Documentación del flujo de QR en la API principal:

- Endpoints de QR3
- Controladores y servicios
- Generación de strings EMVCo
- Validación y parseo de QR
- Resolución de QR para billeteras externas
- Encriptación AES y CRC-16

**Proyecto original:** `palta-api-ts-master/docs`

---

### Core Coelsa (palta-coelsa)

#### 📄 Documentación Oficial de Coelsa

**[coelsa_documentacion_oficial.md](./coelsa_documentacion_oficial.md)**

Documentación oficial del flujo TRX 3.1 de Coelsa:

- Especificación del protocolo PCT (Pagos con Transferencia)
- Mensajería completa (Intención de Pago, Confirma Débito, Reverso)
- Tiempos de respuesta (3 segundos)
- Diagramas de flujo oficiales
- Estructuras de request/response

**Proyecto original:** `palta-coelsa-master/docs`

#### 📄 Flujo de Generación de Intención de Pago

**[coelsa_flujo_generacion_intencion.md](./coelsa_flujo_generacion_intencion.md)**

Análisis del flujo cuando Palta actúa como **Billetera**:

- Endpoint `/qrPalta/coelsadebinqr`
- Proceso de generación de intención de pago
- Transformación de datos
- Guardado de `QROrdenCompra`
- Integración con API de Coelsa

**Proyecto original:** `palta-coelsa-master/docs`

#### 📄 Generación y Codificación de QR

**[coelsa_generacion_codificacion_qr.md](./coelsa_generacion_codificacion_qr.md)**

Guía técnica sobre el formato EMVCo:

- Estructura TLV (Tag-Length-Value)
- Decodificación de QR reales
- Tipos de QR (estático vs dinámico)
- Campos obligatorios y opcionales
- Ejemplos de código para generar QR
- Librerías recomendadas

**Proyecto original:** `palta-coelsa-master/docs`

#### 📄 Reporte de Análisis

**[coelsa_reporte_analisis.md](./coelsa_reporte_analisis.md)**

Reporte de cumplimiento del código con la documentación de Coelsa:

- Análisis de QR Intención de Pago
- Análisis de QR Confirma Débito
- Análisis de QR Reverso
- Validaciones y estructuras de datos
- Observaciones y recomendaciones

**Proyecto original:** `palta-coelsa-master/docs`

---

## 🖼️ Diagramas

La carpeta también contiene los diagramas PNG de la documentación oficial de Coelsa.

---

## 🚀 Guía Rápida

### Para Desarrolladores Nuevos

1. **Leer primero:** [FLUJO_COMPLETO_QR_INTEROPERABLE.md](./FLUJO_COMPLETO_QR_INTEROPERABLE.md)
2. **Entender la arquitectura:** Sección "Arquitectura General"
3. **Revisar casos de uso:** Sección "Casos de Uso"
4. **Profundizar por capa:**
   - Frontend → [frontend_qr_documentation.md](./frontend_qr_documentation.md)
   - Backend → [backend_qr_flow.md](./backend_qr_flow.md)
   - Coelsa → Documentos `coelsa_*.md`

---

**Generado por:** Gemini  
**Fecha:** 2025-11-27
