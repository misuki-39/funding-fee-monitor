# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Funding Rate Monitor — a React + TypeScript web app that displays and compares perpetual futures funding rates across six venues: OKX, Binance, Gate.io, Bitget, Bybit, and GRVT (a DEX). It has a Hono-based BFF (backend-for-frontend) that proxies upstream exchange APIs.

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
- **`src/features/overview/`** — overview page: tabbed per-market funding rate tables. Selected market persists to `localStorage` via `lib/marketPreference.ts`.
- **`src/features/asset-detail/`** — asset detail page: cross-exchange comparison for a single asset, funding history chart. Per-base + global default selected history markets persist via `lib/historyPreferences.ts`.
- **`src/shared/`** — shared types (`types/`), config (`config/markets.ts`, `config/assetAliases.ts`), API client (`api/`), formatting/filtering helpers (`lib/`)

### Server (`server/`)
- **`server/app.ts`** — Portable Hono app (API route definitions, DI via `AppDependencies`). Used by both deployment entries below.
- **`server/node.ts`** — Node adapter: wraps `createApiApp()` with `@hono/node-server` and serves the client build. Used by `pnpm run dev:server` and `pnpm run preview`.
- **`server/vercel.ts`** — Vercel Node.js adapter: hand-rolled `IncomingMessage`→`Request`→`app.fetch`→`ServerResponse` bridge. Holds the single Hono app instance re-exported by every `api/*.ts` file. Do **not** replace this with `export default handle(app)` from `hono/vercel` — that returns a fetch handler, and Vercel's Node.js runtime expects `(req, res) => void` as the default export, so requests would hang 300s.
- **`server/exchanges/`** — per-venue adapters (`binance.ts`, `okx.ts`, `gate.ts`, `bitget.ts`, `bybit.ts`, `grvt.ts`) that call upstream APIs and normalize responses, plus the cross-exchange orchestrators `assetDetail.ts` (fans out across all markets) and `assetHistory.ts` (single-market dispatch)
- **`server/services/`** — thin wrappers around the orchestrators for the Hono routes (`fundingRates.ts`, `assetDetails.ts`, `assetHistory.ts`)
- **`server/lib/`** — shared helpers: `upstream.ts` (HTTP fetch with proxy/timeout, GET via `fetchUpstreamJson`, POST via `postUpstreamJson`), `cache.ts` (in-process TTL cache with in-flight promise dedup; `getOrFetch` and `peekCache`), `concurrency.ts` (`mapWithConcurrency`), `timeSeries.ts` (`dedupeByTime`)

### Adapter conventions
- Every adapter exports `fetch<Venue>Rows`, `fetch<Venue>AssetDetail`, `fetch<Venue>AssetHistory`, plus pure `normalize<Venue>*` helpers used by `adapters.test.ts`.
- Bitget/OKX/Gate fold cycle hours into their funding-rate response. Binance and Bybit join a separate `/fundingInfo` or `/instruments-info` endpoint; both wrap that metadata fetch in `getOrFetch` with a 4h TTL. GRVT additionally caches `/all_instruments` and per-symbol `/instrument`; asset-detail flows for GRVT and Bybit `peekCache` the bulk metadata first to skip the per-symbol metadata call when the bulk cache is warm.
- GRVT has no bulk-snapshot REST endpoint, so `fetchGrvtRows` fans out a per-symbol `/ticker` POST per perpetual via `mapWithConcurrency` (currently 20 concurrent). All other adapters return everything in one or two bulk calls.
- GRVT-specific gotchas: timestamps are unix nanoseconds (string); `funding_rate` is in percentage points (divide by 100 for fractional); mark prices and kline open/close are human-readable USD.

### Vercel entry (`api/`)
One thin file per deployed route; each is a one-line re-export of `vercelNodeHandler` from `server/vercel.ts`:
- `api/health.ts` → `/api/health`
- `api/markets/[market]/funding-rates.ts` → `/api/markets/:market/funding-rates`
- `api/assets/[base]/index.ts` → `/api/assets/:base`
- `api/assets/[base]/history.ts` → `/api/assets/:base/history`

Rules for this directory:
- Never combine `api/[param].ts` with `api/[param]/*.ts` — use `[param]/index.ts` for the base route.
- `vercel.json` pins `"regions": ["hkg1"]`; the default US region (`iad1`) is geo-blocked by Binance, OKX, Gate.io, Bitget, and Bybit. GRVT is CDN-fronted from SG/HK and works from HKG1.

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
