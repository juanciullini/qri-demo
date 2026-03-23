# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QRi Backend is the API for the **QR Interoperable (Transferencias 3.0)** payment platform. Implements Argentine BCRA-compliant QR payment processing via the Coelsa network. Palta is the PSP (Payment Service Provider). QR codes use **EMVCo TLV format**. Domain logic and Coelsa responses are in **Spanish**.

## Development Commands

```bash
# Prerequisites: Node >= 20, Docker (for PostgreSQL + Redis)
docker compose up -d db redis         # Start PostgreSQL (5432) + Redis (6379)
npm install
npx prisma generate                   # Generate Prisma client (run after schema changes)
npx prisma migrate dev                # Run/create migrations
npm run db:seed                       # Seed admin user (admin@qri.app / Admin2026$)

npm run dev                           # Dev server with hot reload (tsx watch, port 3000)
npm run build                         # Compile TypeScript (tsc)
npm run lint                          # ESLint

npm test                              # Vitest run (single pass)
npm run test:watch                    # Vitest watch mode
npm run test:coverage                 # Vitest with v8 coverage

npm run db:studio                     # Prisma Studio (DB browser GUI)
```

## Stack

Fastify 5, TypeScript (strict, ES2022, NodeNext), Prisma ORM (PostgreSQL), Redis (ioredis), Socket.IO, Zod, Pino logger, Vitest.

## Architecture

**Module pattern** — each module in `src/modules/<name>/` follows:

```
<name>.routes.ts      → Fastify route registration + preHandler middleware
<name>.controller.ts  → Parse request, validate with Zod, call service
<name>.service.ts     → Business logic, Prisma queries
<name>.schemas.ts     → Zod schemas for request validation
```

No repository layer — services call Prisma directly via the shared `prisma` instance from `src/utils/prisma.ts`.

**Modules:** `auth`, `users`, `merchants`, `qr`, `transactions`, `coelsa`, `wallet`, `settlements`, `sandbox`, `system`.

**Special modules:**
- `coelsa` — has `adapter.ts`, `sandbox.ts`, `types.ts` instead of standard service/controller. Receives webhooks via mTLS (no JWT). Must respond within 2s.
- `qr` — has `qr.generator.ts` for EMVCo TLV encoding.
- `transactions` — has `transaction.state-machine.ts` for valid state transitions. Largest service file — handles full payment orchestration.

### Route Prefixes

| Prefix | Auth | Notes |
|--------|------|-------|
| `/api/auth` | Public (login/register) | JWT-protected for logout/refresh |
| `/api/users` | JWT + RBAC | |
| `/api/merchants` | JWT + RBAC | |
| `/api/qr` | JWT + RBAC | |
| `/api/transactions` | JWT + RBAC | |
| `/api/settlements` | JWT + RBAC | |
| `/api/system` | JWT + RBAC | |
| `/api/wallet` | JWT + RBAC | |
| `/api/sandbox` | JWT | Only when `COELSA_MODE=sandbox` |
| `/coelsa` | mTLS (no JWT) | Webhooks from Coelsa, excluded from rate limiting |

### Key Patterns

- **Auth:** JWT access token (15m) + refresh token (7d). Refresh tokens stored in Redis for revocation with rotation on refresh.
- **RBAC:** `requireRole(Role.ADMIN, Role.OPERATOR)` as Fastify preHandler. MERCHANT users are auto-scoped to their own merchant data in controllers.
- **Validation:** Zod schemas parsed in controllers via `schema.parse(request.body)`. ZodError caught by error handler → 400 with field-level details.
- **Errors:** `AppError(statusCode, message, errorCode)` from `src/middleware/error-handler.ts`. Error handler also catches `ZodError` and Fastify errors.
- **JwtPayload:** `{ userId, email, role, merchantId? }` — set on `request.user` by `authMiddleware`.
- **Path alias:** `@/*` maps to `src/*` (tsconfig paths).
- **ESM:** NodeNext module resolution — imports use `.js` extensions.

### Transaction State Machine

```
CREADO → INTENCION_ENVIADA → INTENCION_ACEPTADA → DEBITO_PENDIENTE →
DEBITO_CONFIRMADO → CREDITO_ENVIADO → EN_CURSO → ACREDITADO
```
Terminal states: `REVERSADO` (can happen from most states), `DEVUELTO` (only from ACREDITADO).

Valid transitions defined in `src/config/constants.ts` (`TX_TRANSITIONS`).

### Coelsa Integration

- **Sync timeout:** 2s internal limit (Coelsa has 3s timeout) — `COELSA_SYNC_TIMEOUT_MS`.
- **Total transaction timeout:** 15s — `TRANSACTION_TOTAL_TIMEOUT_MS`.
- **Response code families:** Reversal (6200s), OperacionFinalizada (5700s), ContraCargo (5600s), DEBIN (7100s), ConfirmaDebito (2800s) — all defined in `src/config/constants.ts`.
- **Sandbox mode:** `COELSA_MODE=sandbox` enables `/api/sandbox` routes and uses `coelsa.sandbox.ts` to simulate Coelsa responses.

## Database

**Prisma + PostgreSQL.** Schema at `prisma/schema.prisma`. Fields use `snake_case`.

**Models:** `User`, `Merchant`, `QrCode`, `Transaction`, `Settlement`, `AuditLog`, `SystemConfig`.

**Key relationships:**
- `User` belongs to `Merchant` (optional, via `merchant_id`)
- `Merchant` has many `QrCode`, `Transaction`, `Settlement`, `User`
- `QrCode` has many `Transaction`
- `Transaction` has `qr_id_trx` (unique, links to Coelsa operations)

**Migrations:** `npx prisma migrate dev` to create/apply. `npx prisma generate` after schema changes.

## Testing

Vitest with `tests/` directory structure:
- `tests/unit/` — `qr-generator.test.ts`, `state-machine.test.ts`, `validators.test.ts`
- `tests/integration/` — `auth.test.ts`
- `tests/coelsa/` — `coelsa-flow.test.ts`

Config in `vitest.config.ts`: globals enabled, node environment, coverage excludes `src/app.ts`.

## Environment Variables

Validated with Zod at startup (`src/config/env.ts`). App exits with details on missing/invalid vars.

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `DATABASE_URL` | Yes | — | PostgreSQL connection string |
| `REDIS_URL` | Yes | — | Redis connection string |
| `JWT_SECRET` | Yes | — | Min 32 chars |
| `JWT_REFRESH_SECRET` | Yes | — | Min 32 chars |
| `ENCRYPTION_KEY` | Yes | — | AES-256 key, min 32 chars |
| `PSP_CUIT` | Yes | — | Exactly 11 chars |
| `PORT` | No | `3000` | |
| `NODE_ENV` | No | `development` | development / production / test |
| `COELSA_MODE` | No | `sandbox` | sandbox / production |
| `FRONTEND_URL` | No | `http://localhost:5173` | CORS origin |
| `PSP_REVERSE_DOMAIN` | No | `app.qri` | |
| `SANDBOX_DEFAULT_SCENARIO` | No | `happy_path` | |
| `SANDBOX_DELAY_MS` | No | `0` | Simulated latency |

Production mode additionally requires: `COELSA_BASE_URL`, `COELSA_AUTH_URL`, `COELSA_CERT_PATH`, `COELSA_KEY_PATH`, `COELSA_CA_PATH`, plus DEBIN and CVU credentials.

## Docker

```bash
docker compose up -d          # Full stack: API + PostgreSQL + Redis
docker compose up -d db redis # Just infrastructure
```

Multi-stage Dockerfile: builds with `node:20-alpine`, production image omits dev dependencies.
