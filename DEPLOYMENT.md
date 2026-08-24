# Deploying PharmaLIMS to Vercel

Production deployment guide for the PharmaLIMS pharmaceutical LIMS.

---

## 1. Architecture notes for serverless

| Concern | Status | Detail |
|---|---|---|
| Rendering | ✅ | Authenticated pages use `export const dynamic = "force-dynamic"` — nothing prerenders against the DB at build time |
| API routes | ✅ | The app uses React **Server Actions** (`actions/*.ts`) instead of `app/api` routes; both are first-class on Vercel |
| Prisma client | ✅ | Singleton cached on `globalThis` in **all** environments (`lib/prisma.ts`) — one pool per warm lambda, no connection storms |
| Authentication | ✅ | Stateless signed JWT in an httpOnly cookie — no server-side session store needed |
| PDF generation | ✅ | Runs **client-side** via jsPDF in the browser — no headless Chrome or `/tmp` usage |
| File uploads | ✅ | No filesystem writes; attachments are stored as metadata paths in PostgreSQL |
| Middleware | — | Not required: auth is enforced server-side in route-group layouts. Edge middleware is intentionally avoided because `jsonwebtoken` is not Edge-runtime compatible |
| Cron / background jobs | — | Not used |

### ⚠️ SQLite limitation on Vercel

Local development can use SQLite (`npm run db:local` → `prisma/dev.db`), but
**SQLite cannot run on Vercel**: serverless functions have an ephemeral,
read-only filesystem — the database file would be wiped on every deployment and
cannot be shared between lambda instances.

**Migration path to PostgreSQL/Supabase** is built in:

1. `prisma/schema.prisma` is the canonical **PostgreSQL** schema. Models are
   provider-agnostic (no scalar arrays, no native types), so the switch is
   purely a datasource change.
2. The Prisma client is generated at install time from `prisma/schema.prisma`
   via the `postinstall` hook — on Vercel this always yields the PostgreSQL client.
3. Local SQLite development continues to work via the generated
   `prisma/schema.local.prisma` variant (`npm run db:local`).

---

## 2. Required environment variables

Configure in **Vercel → Project → Settings → Environment Variables**
(Production + Preview). See `.env.example` for the full annotated list.

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | ✅ | PostgreSQL connection string. **Use the pooled URL (port 6543, `?pgbouncer=true&connection_limit=1`) on Supabase** |
| `DIRECT_URL` | ⭕ | Direct (non-pooled) connection, used only when running migrations |
| `AUTH_SECRET` | ✅ | Secret for signing session JWTs — generate with `openssl rand -base64 32` |
| `SESSION_TTL_DAYS` | ⭕ | Session lifetime in days (default `7`) |
| `NEXT_PUBLIC_APP_NAME` | ⭕ | Display name (default `PharmaLIMS`) |

> Never commit real secrets. `.env` is git-ignored; only `.env.example` is tracked.

---

## 3. Database setup (Supabase / any PostgreSQL)

### Option A — Supabase (recommended)

1. Create a project at [supabase.com](https://supabase.com).
2. **Project Settings → Database → Connection string → URI**:
   - *Connection pooling* (port `6543`) → `DATABASE_URL` (runtime)
   - *Direct connection* (port `5432`) → `DIRECT_URL` (migrations)
3. Append `?pgbouncer=true&connection_limit=1` to the pooled URL.

### Option B — any PostgreSQL 14+

```
postgresql://<user>:<password>@<host>:5432/<database>?schema=public
```

---

## 4. Prisma migration commands

Run locally against the production database (set `DATABASE_URL` to the
**direct** connection for migrations):

```bash
# First deployment — create the schema
npx prisma db push

# …or, for a versioned migration history (recommended for teams):
npx prisma migrate dev --name init
npx prisma migrate deploy      # applies pending migrations (use in CI/CD)

# Regenerate the client after schema changes
npx prisma generate

# Optional: load the demo dataset (see §6 before seeding production!)
npm run db:seed
```

On Vercel itself no migration step is needed — the build only compiles the app.
Apply schema changes from your machine or a CI step before deploying.

---

## 5. Vercel deployment steps

### Via the dashboard (recommended)

1. Push the repository to GitHub (`main` branch).
2. [vercel.com/new](https://vercel.com/new) → **Import** the repo.
3. **Framework preset**: Next.js (auto-detected). Build command `next build` — leave defaults.
4. **Root directory**: `./` (the repo root *is* the Next.js project).
5. Add environment variables from §2 (Production + Preview).
6. **Deploy**. Vercel runs `npm install` (triggering `postinstall → prisma generate`)
   then `next build`.

### Via the CLI

```bash
npm i -g vercel
vercel login
vercel link                     # associate the local folder
vercel env add DATABASE_URL     # repeat for AUTH_SECRET, SESSION_TTL_DAYS…
vercel --prod                   # deploy to production
```

### Post-deploy checklist

- [ ] `/login` loads and sign-in works
- [ ] Dashboard KPIs render (DB connection OK)
- [ ] Sample registration + worksheet submission work (server actions)
- [ ] Report PDF download works (client-side)
- [ ] Client portal reachable at `/client`

---

## 6. Demo login credentials

Created by `npm run db:seed`. **Change or remove these accounts before any
production use** — they are published here for evaluation only.

| Role | Email | Password |
|---|---|---|
| Laboratory Administrator | `admin@pharmalims.io` | `Admin@123` |
| Lab Manager | `manager@pharmalims.io` | `Manager@123` |
| Quality Assurance Officer | `qa@pharmalims.io` | `Qa@123456` |
| Chemist / Analyst | `analyst@pharmalims.io` | `Analyst@123` |
| Microbiology Analyst | `micro@pharmalims.io` | `Micro@123` |
| Client / Pharma Company | `client@pharmalims.io` | `Client@123` |

The login page also has role quick-fill buttons for the demo.

---

## 7. Local development

```bash
npm install
npm run db:local     # SQLite schema + prisma/dev.db (no Postgres needed)
npm run db:seed      # demo dataset
npm run dev          # http://localhost:3000
```

To run locally against PostgreSQL instead, point `DATABASE_URL` at your
database and run `npx prisma db push && npm run db:seed`.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Build fails with "Prisma Client did not initialize" | `DATABASE_URL` missing at runtime | Add it in Vercel env settings and redeploy |
| `P1001: can't reach database` | Direct URL blocked / wrong region | Use the **pooled** URL (6543) for `DATABASE_URL` |
| Too many connections | Pool not used | Ensure `?pgbouncer=true&connection_limit=1` on Supabase URLs |
| Login always fails | Weak/missing or rotated `AUTH_SECRET` | Set a stable random secret; rotating it signs everyone out |
| 500 on first load after deploy | Migrations not applied | Run `npx prisma db push` / `prisma migrate deploy` |