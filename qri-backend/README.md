# QRi Backend

API backend para la plataforma QR Interoperable. Construido con Fastify, Prisma (PostgreSQL), Redis y Socket.IO.

## Requisitos

- Node.js >= 20
- Docker y Docker Compose (para PostgreSQL y Redis)

## Inicio rapido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Editar `.env` con tus valores. Para desarrollo local los defaults funcionan tal cual, solo asegurate de cambiar los secrets:

| Variable | Descripcion |
|----------|-------------|
| `DATABASE_URL` | Connection string de PostgreSQL (default: `postgresql://qri:qri@localhost:5432/qri`) |
| `REDIS_URL` | Connection string de Redis (default: `redis://localhost:6379`) |
| `JWT_SECRET` | Secret para tokens JWT (min 32 chars) |
| `JWT_REFRESH_SECRET` | Secret para refresh tokens (min 32 chars) |
| `COELSA_MODE` | `sandbox` para desarrollo, `production` para produccion |
| `ENCRYPTION_KEY` | Clave AES-256 de 32 caracteres |

### 3. Levantar PostgreSQL y Redis

**Opcion A: Docker Compose (recomendado)**

```bash
docker compose up -d db redis
```

Esto levanta PostgreSQL en el puerto 5432 y Redis en el puerto 6379.

**Opcion B: Servicios locales**

Si ya tenes PostgreSQL y Redis instalados localmente, asegurate de que esten corriendo y que las credenciales en `.env` coincidan.

### 4. Generar cliente Prisma y correr migraciones

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Seed de datos iniciales (opcional)

```bash
npm run db:seed
```

Crea un usuario admin: `admin@qri.app` / `Admin2026$`

### 6. Levantar el servidor

```bash
npm run dev
```

El servidor arranca en `http://localhost:3000`.

## Comandos disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con hot reload (tsx watch) |
| `npm run build` | Compilar TypeScript |
| `npm start` | Correr build de produccion |
| `npm test` | Correr tests (vitest) |
| `npm run test:watch` | Tests en modo watch |
| `npm run test:coverage` | Tests con reporte de coverage |
| `npm run lint` | Lint del codigo |
| `npm run db:migrate` | Correr migraciones de Prisma |
| `npm run db:generate` | Regenerar cliente Prisma |
| `npm run db:seed` | Seed de datos iniciales |
| `npm run db:studio` | Abrir Prisma Studio (UI para la DB) |

## Docker Compose completo

Para levantar todo el stack (API + DB + Redis):

```bash
docker compose up -d
```

La API queda disponible en `http://localhost:3000`.

## Estructura del proyecto

```
src/
  app.ts          # Entry point (Fastify server)
  config/         # Configuracion y variables de entorno
  middleware/      # Middlewares (auth, rate-limit, etc.)
  modules/        # Modulos de negocio (QR, pagos, usuarios, etc.)
  utils/          # Utilidades compartidas
  websocket/      # Handlers de Socket.IO
prisma/
  schema.prisma   # Schema de la base de datos
  seed.ts         # Datos iniciales
tests/            # Tests con Vitest
```
