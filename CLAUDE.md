# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QRi is a **QR Interoperable (Transferencias 3.0)** payment system implementing Argentine BCRA-compliant QR payment processing via the Coelsa network. Palta acts as both a digital wallet and payment service provider (PSP). QR codes follow the **EMVCo TLV format**. Documentation and business logic are in **Spanish**.

## Repository Structure (Monorepo)

| Directory | Type | Stack | Purpose |
|-----------|------|-------|---------|
| `qri-backend/` | Fastify API | TypeScript, Prisma, PostgreSQL, Redis | **New backend** — active development |
| `qri-frontend/` | React SPA | TypeScript, Vite, Tailwind v4, Zustand | **New frontend** — active development |
| `qri-bruno/` | API collection | Bruno | API testing collection for qri-backend |
| `palta-api-ts-master/` | Express API | TypeScript, MongoDB | Legacy backend (being replaced by qri-backend) |
| `pal-qr-coelsa-ms/` | Express API | TypeScript | Stateless Coelsa wrapper microservice (no DB) |
| `palta-coelsa-master/` | Express API | TypeScript | Original Coelsa integration (deprecated) |
| `palta-web-administrator-fix-adapt-qr-reader-to-qr3/` | React SPA | JavaScript | Legacy admin panel + QR reader |
| `doc/` | Markdown | — | Documentation (start with `FLUJO_COMPLETO_QR_INTEROPERABLE.md`) |

## Development Commands

### qri-backend (New Backend — Active)
```bash
cd qri-backend
npm install
docker compose up -d db redis      # PostgreSQL + Redis
npx prisma generate                # Generate Prisma client
npx prisma migrate dev             # Run migrations
npm run db:seed                    # Seed data (admin@qri.app / Admin2026$)
npm run dev                        # Dev server with hot reload (tsx watch, port 3000)
npm run build                      # Compile TypeScript (tsc)
npm run lint                       # ESLint
npm test                           # Vitest (run once)
npm run test:watch                 # Vitest in watch mode
npm run test:coverage              # Vitest with v8 coverage
npm run db:studio                  # Prisma Studio (DB GUI)
```
Requires Node >= 20. Tests are in `tests/` with subdirectories: `unit/`, `integration/`, `coelsa/`.

### qri-frontend (New Frontend — Active)
```bash
cd qri-frontend
npm install
npm run dev        # Vite dev server (port 5173)
npm run build      # tsc + vite build
npm run lint       # ESLint
```

### Legacy Projects
```bash
# palta-api-ts-master (requires mongod running)
cd palta-api-ts-master && npm start    # nodemon + ts-node
npm run build && npm run lint

# pal-qr-coelsa-ms (requires Coelsa mTLS certs)
cd pal-qr-coelsa-ms && npm run dev     # nodemon + ts-node

# palta-web-administrator (requires Node 16.2.0)
cd palta-web-administrator-fix-adapt-qr-reader-to-qr3 && npm start
```

## Architecture

### qri-backend (New)

**Stack:** Fastify 5, Prisma ORM (PostgreSQL), Redis (ioredis), Socket.IO, Zod, Pino logger.

**Module pattern** — each module in `src/modules/` follows:
```
routes.ts → controller.ts → service.ts → Prisma (DB)
          + schemas.ts (Zod validation)
```
No repository layer; services use Prisma client directly.

**Modules:** `auth`, `users`, `merchants`, `qr`, `transactions`, `coelsa`, `wallet`, `settlements`, `sandbox`, `system`.

**Key patterns:**
- **Auth:** JWT with access (15m) + refresh (7d) tokens. Refresh tokens stored in Redis for revocation with rotation on refresh.
- **RBAC:** `requireRole(Role.ADMIN, Role.OPERATOR)` middleware via Fastify preHandler. MERCHANT role users are auto-scoped to their merchant data.
- **Validation:** Zod schemas in `*.schemas.ts`, parsed in controllers with `schema.parse(request.body)`.
- **Errors:** Custom `AppError(statusCode, message, errorCode)` class.
- **Transaction state machine:** `transaction.state-machine.ts` enforces valid state transitions (CREADO → INTENCION_ENVIADA → ... → ACREDITADO).
- **Coelsa module:** Receives webhooks (mTLS, no JWT). Must respond within 2s (Coelsa has 3s timeout). Has `adapter.ts` + `sandbox.ts` instead of standard service/controller.
- **QR module:** `qr.generator.ts` handles EMVCo TLV encoding.
- **Path alias:** `@/*` maps to `src/*` in tsconfig.
- **ESM:** Uses NodeNext module resolution with `.js` extensions in imports.

**Route prefixes:**
- `/api/auth`, `/api/users`, `/api/merchants`, `/api/qr`, `/api/transactions`, `/api/settlements`, `/api/system`, `/api/wallet`
- `/api/sandbox` (only when `COELSA_MODE=sandbox`)
- `/coelsa` (webhooks — mTLS, no JWT, excluded from rate limiting)

### qri-frontend (New)

**Stack:** React 19, Vite 7, TypeScript, Tailwind CSS v4, Zustand (state), TanStack React Query (server state), React Router v7, Recharts, Socket.IO client, Axios.

**Structure:** `src/pages/`, `src/components/`, `src/hooks/`, `src/services/`, `src/stores/`, `src/types/`, `src/lib/`.

### Legacy Architecture
**Request flow:** Frontend → palta-api-ts (Express + MongoDB) → pal-qr-coelsa-ms (stateless proxy) → Coelsa

- **palta-api-ts-master**: 3 API versions (`api/`, `apiV2/`, `apiV3/`), 73 MongoDB models, 52 migrations. Repository pattern + service layer.
- **pal-qr-coelsa-ms**: Stateless wrapper — no DB, context via Context API calls. Handles mTLS with Coelsa.

## Code Style & Conventions

### qri-backend (TypeScript, ESM)
- TypeScript strict mode, ES2022 target, NodeNext modules
- Zod for runtime validation (no class-validator)
- Prisma schema uses `snake_case` for fields

### Legacy Backend (TypeScript)
- ESLint: AirBnB base + TypeScript + Prettier
- Prettier: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 120`
- Strict complexity limits: max-depth (3), max-nested-callbacks (4), max-params (4), max-statements (12), complexity (8)
- Explicit function return types required
- `@ts-ignore` banned

### Frontend (qri-frontend)
- ESLint flat config with TypeScript + React Hooks + React Refresh

## Key Domain Concepts

**Transaction lifecycle (COELSA flow):**
```
CREADO → INTENCION_ENVIADA → INTENCION_ACEPTADA → DEBITO_PENDIENTE →
DEBITO_CONFIRMADO → CREDITO_ENVIADO → EN_CURSO → ACREDITADO
```
Can revert to REVERSADO or DEVUELTO from applicable states.

**COELSA timeouts:** Sync timeout 2s (internal), total transaction timeout 15s.

**Merchant Coelsa registration states:** PENDING → REGISTERING → ACTIVE → SUSPENDED.

## Environment Setup

### qri-backend
Key env vars (validated with Zod at startup):
- `DATABASE_URL` — PostgreSQL (default: `postgresql://qri:qri@localhost:5432/qri`)
- `REDIS_URL` — Redis (default: `redis://localhost:6379`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` — min 32 chars each
- `ENCRYPTION_KEY` — AES-256 key, 32 chars
- `COELSA_MODE` — `sandbox` or `production`
- `PSP_CUIT` — 11 char CUIT for the PSP
- `FRONTEND_URL` — CORS origin (default: `http://localhost:5173`)
- Production mode requires: `COELSA_BASE_URL`, `COELSA_AUTH_URL`, cert paths, DEBIN/CVU credentials

### Legacy projects
- **palta-api-ts**: MongoDB connection, QR_LINK, XNET_API_KEY
- **pal-qr-coelsa-ms**: JWT_SECRET, Coelsa mTLS certificates, CONTEXT_API_URL/KEY

## External Integrations

- **Coelsa**: QR payment processing via mTLS (DEBIN + CVU operations)
- **Firebase**: Auth and messaging (legacy projects)
- **AWS**: SES (email), SNS (notifications) — legacy
- **Google Vision**: Document processing — legacy
- **WebAuthn/FIDO2**: Biometric authentication — legacy
