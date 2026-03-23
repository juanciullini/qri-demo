# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

QRi Frontend is an admin/monitoring panel for the QR Interoperable (Transferencias 3.0) payment platform. It's a React 19 SPA built with TypeScript, Vite 7, TailwindCSS 4, and Zustand. All UI text is in Spanish and uses Argentine formats (ARS currency, CUIT, CBU, es-AR locale).

## Development Commands

```bash
npm run dev      # Vite dev server on http://localhost:5173 (HMR)
npm run build    # tsc -b && vite build
npm run lint     # eslint .
npm run preview  # Preview production build
```

Requires Node.js >= 20 and the backend running on `http://localhost:3000`. Vite proxies `/api` and `/ws` to the backend automatically.

## Architecture

**Stack:** React 19 + TypeScript (strict) + Vite 7 + TailwindCSS 4 + Zustand + React Query (TanStack) + React Router 7 + Axios + Socket.IO Client + Recharts + lucide-react icons

**Path alias:** `@/*` maps to `./src/*` (configured in both `vite.config.ts` and `tsconfig.app.json`)

### Layer Separation

```
Pages → Hooks (React Query) → Services (Axios) → Backend API (/api)
                                                → WebSocket (/ws)
Pages → Stores (Zustand) → only for auth state
```

- **`services/`** — Axios HTTP layer. Each service file has mapper functions that transform API responses (snake_case) to frontend types (camelCase). `api.ts` configures the base axios instance with Bearer token interceptor and automatic 401 token refresh with request queueing.
- **`hooks/`** — React Query hooks wrapping services. Follow a query key factory pattern (e.g., `transactionKeys.list(filters)`). Mutations auto-invalidate related queries on success.
- **`stores/`** — Single Zustand store (`auth.store.ts`) for auth state. Tokens persisted in localStorage. All other server state managed via React Query.
- **`types/index.ts`** — All TypeScript interfaces in one file.
- **`lib/utils.ts`** — `cn()` (clsx + twMerge), date/money/CUIT formatters, status-to-color mappers.
- **`components/`** — Reusable UI (`DataTable<T>`, `StatusBadge`, `StatsCard`, `LoadingSpinner`) + layout (`AppLayout`, `Sidebar`, `Header`) + `PrivateRoute` for role-based access.
- **`pages/`** — Route components. Each page handles its own local state (forms, filters, modals) via `useState`.

### Routing & Auth

Routes defined in `App.tsx`. All routes except `/login` are wrapped in `PrivateRoute` which checks auth state and optionally validates user roles. Roles: `ADMIN`, `OPERATOR`, `MERCHANT`, `VIEWER`.

### Real-time Updates

`useSocket` hook connects to `/ws` with socket.io-client (websocket transport). `useTransactionSocket` subscribes to live transaction events and updates React Query cache directly.

### React Query Config

`staleTime: 30_000`, `retry: 1`, `refetchOnWindowFocus: false`.

## Code Conventions

- **TypeScript strict mode** with `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`
- **ESLint:** flat config with `@eslint/js` recommended + `typescript-eslint` recommended + `react-hooks` + `react-refresh`
- **Styling:** TailwindCSS utility classes. Theme colors defined as CSS variables in `index.css` (primary, destructive, success, warning). Use `cn()` from `lib/utils.ts` for conditional class merging.
- **Component pattern:** All components accept `className?: string`. No CSS modules or styled-components.
- **Form pattern:** Individual `useState` per field, validation on submit, errors in a separate state object.
- **Service pattern:** Each service exports async functions returning typed data. Mappers handle API response transformation.
- **Hook pattern:** Query key factories per domain. Mutations invalidate related query keys on success.

## Testing

No test suite is currently configured.
