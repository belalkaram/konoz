# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Customers Page

The Customers page shows: Name, Phone, Status, Passport No., PNR, Booking Date, Net Profit (KWD).
- PNR, booking date, cost price, and selling price come from the customer's most recent ticket (subquery JOIN in GET /api/customers).
- Net Profit = selling price − cost price (both stored in KWD on the tickets table).
- `tickets.costPrice` was added as a new column (`cost_price NUMERIC(12,2)`).
- Currency default changed to KWD.
- Excel import: button on Customers page parses `.xlsx/.xls` client-side via SheetJS (`xlsx` package); rows sent to `POST /api/customers/import`; creates customers (deduped by phone) + tickets.
- Customer form no longer has Source or Assigned Agent fields.

## Authentication

Simple PIN-based auth for the Flight Booking app. No JWT/sessions — employees are stored in DB and authenticated via SHA-256 hashed PIN. Session persists in `localStorage` under key `aeroops_employee`.

- **Employees table**: `lib/db/src/schema/employees.ts`
- **API routes**: `POST /api/auth/login`, `GET /api/auth/employees`
- **Frontend context**: `artifacts/flight-booking/src/contexts/employee-context.tsx`
- **Login page**: `artifacts/flight-booking/src/pages/login.tsx`
- **Default credentials**: james/1234, sara/2345, mohamed/3456, nadia/4567
- **Seeding**: Auto-seeds employees on server startup if table is empty (`artifacts/api-server/src/lib/seed-employees.ts`)
