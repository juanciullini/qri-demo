# Plan de Deploy — Demo QRi (Costo $0)

## Resumen

Deploy del sistema QRi (frontend + backend) como demo pública con costo cero usando servicios free-tier.

## Arquitectura de Deploy

```
┌─────────────────────────────────────────────────┐
│              Render (Free Web Service)           │
│                                                  │
│   https://qri-demo.onrender.com/                │
│                                                  │
│   /          → Frontend (archivos estáticos)     │
│   /api/*     → Backend API (Fastify)             │
│   /ws        → WebSocket (Socket.IO)             │
│   /coelsa/*  → Webhooks (sandbox)                │
│                                                  │
└──────────┬──────────────────┬────────────────────┘
           │                  │
    ┌──────▼──────┐    ┌──────▼──────┐
    │   Neon      │    │  Upstash    │
    │ PostgreSQL  │    │   Redis     │
    │  (free)     │    │   (free)    │
    └─────────────┘    └─────────────┘
```

**Estrategia:** El backend sirve los archivos estáticos del frontend build. Todo en una sola URL → sin CORS, WebSocket nativo.

## Servicios y Costos

| Servicio | Plataforma | Plan | Costo | Límites |
|---------|-----------|------|-------|---------|
| Backend + Frontend | **Render** Web Service | Free | $0 | Sleep tras 15min inactividad, cold start ~50s |
| PostgreSQL | **Neon** | Free Tier | $0 forever | 0.5 GB storage, auto-suspend 5min inactividad |
| Redis | **Upstash** | Free Tier | $0 forever | 10K commands/día, 256 MB |

**Costo total: $0/mes**

## Pasos de Implementación

### 1. Crear cuentas (si no existen)

- [ ] **Render**: https://render.com (login con GitHub)
- [ ] **Neon**: https://neon.tech (login con GitHub)
- [ ] **Upstash**: https://upstash.com (login con GitHub)

### 2. Crear bases de datos

#### Neon (PostgreSQL)
1. Crear proyecto "qri-demo"
2. Copiar connection string: `postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/qri?sslmode=require`
3. Nota: Neon auto-suspende tras 5 min, primer query tarda ~1s extra

#### Upstash (Redis)
1. Crear database "qri-demo" en la región más cercana
2. Copiar Redis URL: `rediss://default:xxx@xxx.upstash.io:6379`
3. Nota: Upstash usa `rediss://` (con SSL)

### 3. Cambios en el código

#### 3a. Backend: Servir archivos estáticos del frontend

Agregar en `qri-backend/src/app.ts` (después de registrar rutas):

```typescript
import fastifyStatic from '@fastify/static';
import path from 'path';

// Servir frontend estático en producción
if (process.env.NODE_ENV === 'production') {
  await app.register(fastifyStatic, {
    root: path.join(__dirname, '..', 'public'),
    prefix: '/',
    wildcard: false,
  });

  // SPA fallback: todas las rutas no-API devuelven index.html
  app.setNotFoundHandler((request, reply) => {
    if (!request.url.startsWith('/api') && !request.url.startsWith('/coelsa') && !request.url.startsWith('/ws')) {
      return reply.sendFile('index.html');
    }
    reply.status(404).send({ error: 'Not found' });
  });
}
```

Instalar dependencia:
```bash
cd qri-backend
npm install @fastify/static
```

#### 3b. Dockerfile unificado (multi-stage)

Reemplazar `qri-backend/Dockerfile`:

```dockerfile
# Stage 1: Build frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY qri-frontend/package*.json ./
RUN npm ci
COPY qri-frontend/ ./
RUN npm run build

# Stage 2: Build backend
FROM node:20-alpine AS backend-builder
WORKDIR /app
COPY qri-backend/package*.json ./
RUN npm ci
COPY qri-backend/ ./
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine
WORKDIR /app
COPY --from=backend-builder /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/dist ./dist
COPY --from=backend-builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=backend-builder /app/prisma ./prisma
COPY --from=frontend-builder /app/frontend/dist ./public

EXPOSE 3000
CMD ["node", "dist/app.js"]
```

**Nota:** Este Dockerfile debe estar en la **raíz del monorepo** (o configurar el root path en Render).

#### 3c. Script de seed para demo

Crear `qri-backend/scripts/deploy-seed.sh`:

```bash
#!/bin/sh
npx prisma migrate deploy
npx tsx prisma/seed.ts
node dist/app.js
```

Usar como CMD en Dockerfile o como start command en Render.

### 4. Configurar Render

1. Crear **Web Service** → conectar repositorio GitHub
2. Configurar:
   - **Build Command:** (se usa Dockerfile)
   - **Docker:** Sí, usar Dockerfile
   - **Dockerfile Path:** `Dockerfile` (el unificado en la raíz)
   - **Instance Type:** Free

3. **Variables de entorno en Render:**

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@ep-xxx.neon.tech/qri?sslmode=require
REDIS_URL=rediss://default:xxx@xxx.upstash.io:6379
JWT_SECRET=<generar-string-aleatorio-32-chars-min>
JWT_REFRESH_SECRET=<generar-string-aleatorio-32-chars-min>
ENCRYPTION_KEY=<generar-string-aleatorio-32-chars-min>
PSP_CUIT=30123456789
COELSA_MODE=sandbox
FRONTEND_URL=https://qri-demo.onrender.com
```

Para generar secrets:
```bash
openssl rand -base64 48
```

### 5. Deploy

1. Push a GitHub
2. Render detecta el push y hace build + deploy automático
3. Primera vez: el seed crea el usuario admin y datos de demo
4. URL final: `https://qri-demo.onrender.com`

## Limitaciones (aceptables para demo)

| Limitación | Impacto | Mitigación |
|-----------|---------|-----------|
| Cold start ~50s | Primera visita tras 15min tarda | Aviso en la landing o cron gratuito para keepalive |
| Neon auto-suspend | Primer query tarda ~1s extra | Transparente para el usuario |
| 10K Redis commands/día | Suficiente para demo | ~700 logins/día posibles |
| 0.5 GB PostgreSQL | Más que suficiente para demo | Seed con datos representativos |
| Sin Coelsa real | Modo sandbox simula todo | Suficiente para mostrar flujos |

## Keepalive (opcional, evitar cold starts)

Usar https://cron-job.org (gratis) para hacer ping cada 14 minutos:
- URL: `https://qri-demo.onrender.com/api/system/health`
- Intervalo: 14 minutos
- Esto mantiene el servicio siempre activo

## Alternativas evaluadas

### Opción B: Frontend separado (Vercel) + Backend (Render)
- **Pro:** Build más rápido, Vercel CDN global
- **Contra:** Requiere cambiar frontend para usar URL del backend (VITE_API_URL), configurar CORS, WebSocket necesita conexión directa al backend
- **Veredicto:** Más complejo, no recomendado para demo simple

### Opción C: Railway
- $5/mes crédito gratis
- Puede correr todo (backend + PostgreSQL + Redis)
- Los $5 podrían no alcanzar si los 3 servicios corren 24/7
- **Veredicto:** Buena alternativa si Render tiene problemas

### Opción D: Fly.io
- Free tier con VMs pequeñas
- Buen soporte para containers
- Más complejo de configurar
- **Veredicto:** Buena opción pero más setup inicial
