# Railway Operations Agent Guide

## Essential Commands
- `pnpm start` or `ng serve` - Start development server (http://localhost:4200)
- `pnpm test` or `ng test --watch=false` - Run unit tests with Vitest
- `pnpm build` or `ng build` - Build production artifacts to dist/
- `pnpm electron:dev` - Start Electron app with concurrent Angular dev server
- `pnpm electron:build` - Build Electron application

## Database Modes
Application operates in two modes:
1. **Demo mode** (default): Uses hardcoded data in src/app/app.ts
2. **SQLite mode**: When database connection succeeds, loads from local SQLite DB
Toggle via reloadData() in App component; check mode() signal

## Electron & Database Integration
- **Main process**: main.js handles Electron window creation and database operations
- **Preload script**: preload.js exposes IPC methods via `window.electronAPI`
- **Database service**: src/app/core/database/database.service.ts checks for Electron environment and routes calls through IPC
- **Auth service**: src/app/core/auth/auth.service.ts uses Electron IPC for authentication operations
- **Database initialization**: main.js seeds demo data if tables are empty (see seedDatabase() function)
- **IPC methods**: db-executeQuery, db-executeNonQuery, auth-get-state, auth-login, auth-list-roles, auth-list-users, auth-create-user, auth-update-user-roles exposed through preload

## Project Structure
- **Main entry**: src/main.ts (Angular bootstrap)
- **App component**: src/app/app.ts (contains core logic, forms, data handling)
- **Styles**: src/styles.scss, src/app/app.scss
- **Database service**: src/app/core/database/database.service.ts
- **Auth service**: src/app/core/auth/auth.service.ts
- **Routes**: src/app/app.routes.ts

## Development Notes
- Uses Angular Signals (v21) for state management
- Forms with reactive validation and custom time range validator
- Electron integration via main.js (preload script in preload.js)
- TypeScript configured via tsconfig.json (extends Angular CLI defaults)
- Testing: Vitest configured through Angular CLI (ng test)
- Session persistence: Uses localStorage with key 'sioavia.session'

## Code Generation
- Angular CLI: `ng generate component|service|pipe|directive name`
- Refer to README for full schematic list: `ng generate --help`