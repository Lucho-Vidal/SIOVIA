# Railway Operations Agent Guide

## Commands
- `pnpm start` — Angular dev server (http://localhost:4200)
- `pnpm test` — Run Vitest tests (single run, no watch)
- `pnpm build` — Production build → `dist/`
- `pnpm electron:dev` — Concurrent Angular dev server + Electron (auto-waits for Angular to compile)
- `pnpm electron:build` — Build + package via electron-builder

## Node.js Requirement
- **Minimum**: Node.js v20.19+ or v22.12+ (Angular 21 requirement)
- **Current**: v18.19.1 in system — use nvm: `source ~/.nvm/nvm.sh && nvm use 22`

## Architecture
- **Angular 21** single-page app with Electron shell
- **Workspace component**: `src/app/workspace/workspace.component.ts` — main UI for role-based views (refactored from monolithic `app.ts`)
- **Legacy component**: `src/app/app.ts` (1250+ lines) — kept for backward compatibility, tests still reference it
- **State**: Angular Signals (`mode()`, `solicitudes()`, `autorizaciones()`, etc.)
- **Routes**: `src/app/app.routes.ts` — all routes guarded by `authGuard` + `roleGuard`; default redirect to `/login`
- **Services layer**: `src/app/core/services/` — `SharedDataService`, `SolicitudesService`, `AutorizacionesService`
- **ES modules**: `package.json` has `"type": "module"`; `main.js` and `preload.js` use `import` syntax

## Database
- **Engine**: better-sqlite3 in Electron main process, schema at `database/schema.sql`
- **Tables**: Solicitudes, Autorizaciones, Ejecuciones, Novedades, plus catalogs (Sectores, Oficinas, Personal, Roles, etc.)
- **IPC bridge**: `preload.js` exposes `window.electronAPI` with `executeQuery`, `executeNonQuery`, and auth methods
- **DatabaseService** (`src/app/core/database/database.service.ts`) only works in Electron; returns failure in browser
- **Configurable path**: Create `%APPDATA%/SIOVIA/railway-operations/database-config.json` (Windows) or `~/.config/SIOVIA/railway-operations/database-config.json` (Linux/macOS) with `{"databasePath": "D:/compartida/basedatos.sqlite"}` to override default location
- **Default location**: `~/.config/Electron/database.sqlite` (Linux) or `%APPDATA%/Electron/database.sqlite` (Windows)
- **Demo mode fallback**: When DB calls fail, `workspace.component.ts` shows empty state (no hardcoded data)

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

## Known Issues & Fixes Applied
- **main.js fixes applied**: Uncommented `initializeDatabase()`, removed duplicate `createWindow()`, added `waitForDevServer()` retry logic to prevent blank screen on Electron launch
- **ES modules migrated**: `main.js` and `preload.js` now use `import` syntax; `package.json` has `"type": "module"`
- **Database path configurable**: Create `%APPDATA%/SIOVIA/railway-operations/database-config.json` (Windows) or `~/.config/SIOVIA/railway-operations/database-config.json` (Linux/macOS) with `{"databasePath": "D:/compartida/basedatos.sqlite"}` to override default location
- **Service layer created**: `SharedDataService`, `SolicitudesService`, `AutorizacionesService` in `src/app/core/services/` — used by `WorkspaceComponent`
- **Component refactored**: `WorkspaceComponent` replaces monolithic `App` for role-based routes; uses services instead of hardcoded data
- **Legacy app.ts**: Still exists for backward compatibility and tests; contains `DEMO_*` constants but is no longer used in routes
- **Hardcoded demo data**: `app.ts` contains extensive `DEMO_*` constants — `WorkspaceComponent` uses DB-only with empty state fallback
