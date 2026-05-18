# Railway Operations Agent Guide

## Commands
- `pnpm start` — Angular dev server (http://localhost:4200)
- `pnpm test` — Run Vitest tests (single run, no watch)
- `pnpm build` — Production build → `dist/`
- `pnpm electron:dev` — Concurrent Angular dev server + Electron (requires `pnpm start` running)
- `pnpm electron:build` — Build + package via electron-builder

## Critical: main.js is broken
`initializeDatabase()` is called at `main.js:450` but the function is entirely commented out (`main.js:383-404`). Electron will crash on launch. There is also a duplicate `createWindow()` declaration (`main.js:405` and `main.js:422`); the second one wins but the first should be deleted.

Until fixed, the app always runs in **demo mode** — no SQLite connection is ever established.

## Architecture
- **Angular 21** single-page app with Electron shell
- **Single component**: `src/app/app.ts` (1250+ lines) holds all business logic, forms, and state
- **State**: Angular Signals (`mode()`, `solicitudes()`, `autorizaciones()`, etc.)
- **Routes**: `src/app/app.routes.ts` — all routes guarded by `authGuard` + `roleGuard`; default redirect to `/login`
- **No standalone modules** — everything bootstrapped from `src/main.ts`

## Database
- **Engine**: better-sqlite3 in Electron main process, schema at `database/schema.sql`
- **Tables**: Solicitudes, Autorizaciones, Ejecuciones, Novedades, plus catalogs (Sectores, Oficinas, Personal, Roles, etc.)
- **IPC bridge**: `preload.js` exposes `window.electronAPI` with `executeQuery`, `executeNonQuery`, and auth methods
- **DatabaseService** (`src/app/core/database/database.service.ts`) only works in Electron; returns failure in browser
- **Demo mode fallback**: When DB calls fail, `app.ts` uses hardcoded `DEMO_*` constants

## Auth
- **Service**: `src/app/core/auth/auth.service.ts`
- **Session key**: `localStorage['sioavia.session']`
- **Roles**: `administrador`, `autorizador`, `operador`, `solicitante`
- **Role-based routing**: each role has its own path; admin → `/admin/usuarios`, others → `/role/solicitudes`
- **Password policy**: min 8 chars, requires digit and special char (`main.js:54`)
- **Default passwords**: `Admin@123`, `Autorizador@123`, `Operador@123`, `Solicitante@123`

## Testing
- **Runner**: Vitest via `@angular/build:unit-test`
- **Only spec**: `src/app/app.spec.ts` — 4 tests (component creation, title render, time range validation ×2)
- **No integration or e2e tests** configured

## Tooling
- **Package manager**: pnpm (native deps: better-sqlite3, bcrypt, sqlite3, electron)
- **Formatter**: Prettier — `printWidth: 100`, `singleQuote: true`, Angular HTML parser
- **TypeScript**: strict mode, `module: preserve`, `target: ES2022`, project references
- **Component style**: SCSS (schematic default in angular.json)

## Code generation
- `ng generate component|service|pipe|directive name`
- Components default to SCSS, prefix `app`
