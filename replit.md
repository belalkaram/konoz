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

## Authentication & Security (Hardened)

PIN-based auth with HttpOnly cookie sessions. PINs are hashed with bcrypt (cost 12). Existing SHA-256 hashes are auto-migrated to bcrypt on first successful login.

- **Session cookie**: `aeroops_sid` — HttpOnly, SameSite=Lax, Secure in production, 8h TTL
- **No localStorage**: Tokens/employee data no longer stored in localStorage (XSS-safe)
- **Session store**: In-memory Map in `artifacts/api-server/src/lib/sessions.ts`
- **Auth endpoints**: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- **Auth middleware**: `artifacts/api-server/src/middlewares/auth.ts` — reads from cookie, populates `req.employee`
- **Employees table**: `lib/db/src/schema/employees.ts`
- **Frontend context**: `artifacts/flight-booking/src/contexts/employee-context.tsx`
- **Login page**: `artifacts/flight-booking/src/pages/login.tsx`
- **Default credentials**: james/1234, sara/2345, mohamed/3456, nadia/4567
- **Seeding**: Auto-seeds employees on server startup if table is empty (`artifacts/api-server/src/lib/seed-employees.ts`)

## Security Hardening (Task 30)

Applied full pentest remediation:
- **bcrypt**: PIN hashing upgraded from SHA-256 to bcrypt (cost 12); SHA-256 hashes auto-migrated on first login
- **Cookie sessions**: HttpOnly cookie replaces Bearer token + localStorage
- **Rate limiting**: Strict (5/15min) on login, general (200/15min) + write (30/15min) limiters via `express-rate-limit`
- **Security headers**: `helmet` with custom CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy
- **Centralized middleware**: All routes use shared `requireAuth`/`requireAdmin` from `middlewares/auth.ts`
- **Error handler**: Global centralized error handler — no stack traces or raw errors leak to client
- **Audit logging**: Structured security events logged via Pino (login, logout, forbidden access, employee mutations)
- **Input sanitization**: Protected fields (pinHash, createdBy) stripped from request bodies in employee routes
- **Dependency audit**: PostCSS updated to patched version; lodash in recharts (moderate, unexploitable in our context) documented
- **Trust proxy**: `app.set("trust proxy", 1)` for accurate IPs behind Replit's reverse proxy
