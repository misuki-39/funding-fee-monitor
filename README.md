# Funding Fee Monitor

React + TypeScript funding-rate monitor for OKX, Binance, and Gate.io with a local Node BFF.

## Commands

- `pnpm run dev`: start the Vite frontend and the local BFF together
- `pnpm run build`: build the React client into `dist/client` and the BFF into `dist/server`
- `pnpm run preview`: run the built BFF and serve the built frontend
- `pnpm run lint`: run ESLint
- `pnpm run typecheck`: run TypeScript checks for the client and server
- `pnpm run test`: run Vitest

## Architecture

- `src/app`: React app entry, router, providers, global styles
- `src/features/overview`: overview page UI and query hook
- `src/features/asset-detail`: asset detail page UI and query hook
- `src/shared`: shared business types, formatting, filtering, symbol helpers, and client API utilities
- `server`: Hono-based BFF, upstream exchange adapters, and local HTTP server

## Runtime Flow

1. The React app only calls local `/api/*` endpoints.
2. The BFF fetches upstream exchange APIs, handles Gate proxy/CORS constraints, and returns normalized JSON.
3. Shared business types and pure helpers are reused between the client and server.
4. Overview and asset detail pages consume normalized data through TanStack Query.
