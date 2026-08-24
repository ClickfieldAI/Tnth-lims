# PharmaLIMS — Pharmaceutical Laboratory Information Management System

An enterprise-grade LIMS for GMP-compliant pharmaceutical testing laboratories:
sample lifecycle management, drug assay, dissolution, stability, impurity,
HPLC/GC and microbiology testing, batch release with CoA generation, QA
(deviations, CAPA, change control), controlled documents, audit trail, analytics
and an external client portal.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| UI | Custom shadcn-style component library (`components/ui`), lucide-react icons |
| Charts | Recharts |
| Backend | Next.js server components + server actions (`actions/`) |
| Database | PostgreSQL (canonical) with Prisma ORM — SQLite for zero-setup local dev |
| Auth | JWT sessions (httpOnly cookies) + bcrypt password hashing + RBAC |

## Quick start (local demo, no external database required)

```bash
npm install
npm run db:local     # generates a SQLite schema variant, creates prisma/dev.db
npm run db:seed      # seeds roles, users, clients, samples, tests, QA records…
npm run dev          # http://localhost:3000
```

The seed creates six demo accounts. On the login page, click a role button to
fill credentials, then sign in:

| Role | Email | Password |
|---|---|---|
| Laboratory Administrator | admin@pharmalims.io | Admin@123 |
| Lab Manager | manager@pharmalims.io | Manager@123 |
| Quality Assurance Officer | qa@pharmalims.io | Qa@123456 |
| Chemist / Analyst | analyst@pharmalims.io | Analyst@123 |
| Microbiology Analyst | micro@pharmalims.io | Micro@123 |
| Client / Pharma Company | client@pharmalims.io | Client@123 |

## Production (PostgreSQL)

1. Point `DATABASE_URL` in `.env` to your PostgreSQL instance.
2. `npx prisma generate && npx prisma db push`
3. `npm run db:seed && npm run build && npm start`

`prisma/schema.prisma` is the canonical PostgreSQL schema; the schema is written
provider-agnostically (no scalar arrays / native types) so the same models work
on both engines.

## Architecture

```
prisma/schema.prisma        Canonical relational model (25+ tables)
lib/roles.ts                Role & permission matrix, status metadata
lib/nav.ts                  Role-aware navigation tree
lib/session.ts              JWT session issue/verify + getCurrentUser()
lib/data.ts                 Dashboard aggregations (KPIs, charts)
lib/testing.ts              Test/stability queries
lib/prisma.ts               Prisma client singleton
lib/ids.ts                  Human-readable code generators (SPL-, TST-, RPT-…)
lib/audit.ts                Audit-trail writer
actions/*.ts                Server actions: auth, samples, tests, quality, portal
app/(auth)/login            Login screen
app/(dashboard)/            Back-office shell: dashboard, samples, testing/*,
                            quality/*, reports, documents, instruments,
                            clients, batch-release, audit-trail, admin
app/(client)/client         External client portal
components/ui               Design system (button, card, badge, table, forms…)
components/charts           Recharts visualisations
components/layout           Sidebar / topbar / shell
```

### Data model highlights

- **Samples** carry barcode identifiers, storage conditions, chain-of-custody
  records and storage events across their lifecycle
  (`RECEIVED → LOGGED → ASSIGNED → TESTING → REVIEW → APPROVED → RELEASED → ARCHIVED`).
- **Tests** link to typed result tables (`AssayResult`, `DissolutionResult`,
  `ImpurityResult`, `MicrobiologyResult`) plus worksheet JSON and attachments.
- **StabilityStudy / StabilityTimepoint** model ICH protocols with scheduled
  pulls, due/overdue alerting.
- **Quality** modules cover `Deviation`, `Capa`, `ChangeControl` and generic
  `Approval` decisions.
- **AuditLog** records actor, action, entity, old/new values for every mutation.

### Workflow enforcement

- Analysts submit results on a locked worksheet; OOS assay results automatically
  raise a deviation.
- QA approves from the review queue; approval generates a controlled report.
- Batch release requires every linked test to be approved before disposition.

## Scripts

| Command | Purpose |
|---|---|
| `npm run db:local` | Create/update the local SQLite dev database |
| `npm run db:seed` | Seed the demo dataset |
| `npm run db:generate` | Regenerate Prisma client (PostgreSQL) |
| `npm run db:push` | Push schema to PostgreSQL |
| `npm run build` | Production build |

## Security notes

- Sessions are signed JWTs in httpOnly, SameSite=Lax cookies with a TTL from
  `SESSION_TTL_DAYS`.
- Passwords hashed with bcrypt (cost 10).
- Every route group checks the session in its layout; role-gated navigation and
  permission checks are centralised in `lib/roles.ts`.
- Set a strong `AUTH_SECRET` in production.
