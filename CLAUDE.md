# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Funding Rate Monitor — a React + TypeScript web app that displays and compares perpetual futures funding rates across OKX, Binance, and Gate.io. It has a Hono-based BFF (backend-for-frontend) that proxies upstream exchange APIs.

## Commands

- `pnpm run dev` — start Vite dev server + BFF concurrently (frontend on :5173, BFF on :8000)
- `pnpm run build` — build client to `dist/client` and server to `dist/server`
- `pnpm run preview` — serve built app via the BFF
- `pnpm run lint` — ESLint (flat config, type-checked rules)
- `pnpm run typecheck` — type-check both `tsconfig.app.json` and `tsconfig.server.json`
- `pnpm run test` — run Vitest (jsdom environment, `vitest.setup.ts` stub for ResizeObserver)
- Single test file: `pnpm vitest run path/to/file.test.ts`

## Architecture

### Client (`src/`)
- **`src/app/`** — React entry, router (react-router-dom), providers, global styles
- **`src/features/overview/`** — overview page: tabbed per-market funding rate tables
- **`src/features/asset-detail/`** — asset detail page: cross-exchange comparison for a single asset, funding history chart
- **`src/shared/`** — shared types (`types/`), config (`config/markets.ts`), API client (`api/`), formatting/filtering helpers (`lib/`)

### Server (`server/`)
- **`server/app.ts`** — Portable Hono app (API route definitions, DI via `AppDependencies`). Used by both deployment entries below.
- **`server/node.ts`** — Node adapter: wraps `createApiApp()` with `@hono/node-server` and serves the client build. Used by `pnpm run dev:server` and `pnpm run preview`.
- **`server/exchanges/`** — per-exchange adapters (`binance.ts`, `okx.ts`, `gate.ts`) that call upstream APIs and normalize responses
- **`server/services/`** — service layer (`fundingRates.ts`, `assetDetails.ts`, `assetHistory.ts`) that orchestrate exchange adapters

### Vercel entry (`api/`)
- **`api/[...path].ts`** — Vercel Serverless Function adapter (catch-all file route). Wraps `createApiApp()` with `hono/vercel` so the same BFF code ships on Vercel. All `/api/*` requests route here via Vercel's native file-based routing — no rewrite needed.

### Shared code
Types in `src/shared/types/` and config in `src/shared/config/` are imported by both client and server. The server imports these with `.js` extensions (ESM resolution).

### Data flow
1. React client calls `/api/*` endpoints only (never upstream exchanges directly)
2. BFF fetches from exchange APIs, normalizes data into shared types (`FundingRow`, `AssetDetailRow`, etc.)
3. Client consumes data via TanStack Query hooks

## Code Style

- Pragmatic, no defensive programming or fallbacks. If something can fail, throw an exception with a comment explaining the risk
- Use abstractions where they earn their keep; keep code straightforward
- In dev mode, Vite proxies `/api` to `localhost:8000`
- Tests use `@testing-library/react` + `vitest`; server tests use dependency injection on `createApiApp()`
