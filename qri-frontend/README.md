# QRi Frontend

Panel de administracion y monitoreo para la plataforma QR Interoperable. Construido con React 19, TypeScript, Vite, TailwindCSS y Zustand.

## Requisitos

- Node.js >= 20
- Backend corriendo en `http://localhost:3000` (ver `qri-backend/README.md`)

## Inicio rapido

### 1. Instalar dependencias

```bash
npm install
```

### 2. Levantar el servidor de desarrollo

```bash
npm run dev
```

La app arranca en `http://localhost:5173`.

El proxy de Vite redirige automaticamente `/api` y `/ws` al backend en `http://localhost:3000`, asi que no hace falta configurar nada extra.

## Comandos disponibles

| Comando | Descripcion |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo con HMR (Vite) |
| `npm run build` | Compilar TypeScript + build de produccion |
| `npm run preview` | Preview del build de produccion |
| `npm run lint` | Lint del codigo |

## Estructura del proyecto

```
src/
  main.tsx        # Entry point
  App.tsx         # Router y layout principal
  components/     # Componentes reutilizables
  pages/          # Paginas / vistas
  services/       # Llamadas a la API (axios)
  stores/         # Estado global (Zustand)
  hooks/          # Custom hooks
  lib/            # Utilidades
  types/          # Tipos TypeScript
  assets/         # Recursos estaticos
```

## Stack

- **React 19** + TypeScript
- **Vite 7** (build + dev server)
- **TailwindCSS 4** (estilos)
- **Zustand** (state management)
- **React Query** (server state)
- **React Router 7** (routing)
- **Recharts** (graficos)
- **Socket.IO Client** (WebSocket para notificaciones en tiempo real)
- **Axios** (HTTP client)
