# Baki — personal due (credit) tracker

A single-shop web app for tracking customers who buy on credit (বাকি): who owes what, for which product, since when, and what they promised. Bangla is the default language and English is available. Built with Next.js 16, Neon Postgres, Drizzle, Better Auth, and Neon Object Storage for photos.

> The working name is set in one constant: `APP_NAME` in [src/domain/shared/app.ts](src/domain/shared/app.ts). The Bangla and English display names are `app.name` in `messages/*.json`.

## Status

| Phase | Scope | State |
|---|---|---|
| 1 | Foundation: auth, i18n, shell, photo upload, value objects | ✅ done |
| 2 | Settings and categories | next |
| 3–7 | Customers, sales, payments, collections, reports | — |

## Setup

Requires Node ≥ 22.

```bash
npm install
cp .env.example .env.local     # then fill in the values (see below)
npm run db:migrate             # create tables (uses DATABASE_URL_UNPOOLED)
npm run seed                   # create your owner account from OWNER_EMAIL / OWNER_PASSWORD
npm run dev                    # http://localhost:3000
```

### Environment variables

| Variable | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | app runtime | Neon **pooled** string (host contains `-pooler`) |
| `DATABASE_URL_UNPOOLED` | migrations, backup | Neon **direct** string |
| `BETTER_AUTH_SECRET` | auth | at least 32 chars: `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | auth | public app URL, e.g. `https://baki.example.com` |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_ENDPOINT_URL_S3`, `AWS_REGION` | photos (local) | written by `neon deploy`; see Photo storage |
| `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_ENDPOINT`, `STORAGE_REGION`, `STORAGE_BUCKET` | photos (Vercel) | same values under non-reserved names |
| `R2_*` | photos (optional) | only if you switch to Cloudflare R2 |
| `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME` | `npm run seed` only | not needed on Vercel |

### Manual setup: Neon

1. Create a project in region **AWS Asia Pacific (Singapore) `ap-southeast-1`**.
2. Copy the **pooled** connection string into `DATABASE_URL` and the **direct** one into `DATABASE_URL_UNPOOLED`.
3. Point-in-time restore is on by default. Under *Settings → Storage / History retention*, set the longest window your plan allows (restore steps arrive with the backup script in phase 7).
4. For e2e and integration tests, create a **branch** (for example `dev`) and use its URLs, never the production branch.

### Photo storage (Neon Object Storage)

Photos live in a private bucket in the same Neon project, so you don't need another provider or a payment card. The bucket is declared in [neon.ts](neon.ts), and the project link is stored in `.neon`.

```bash
npx neonctl auth                 # once: log in to Neon
neon link                        # once: choose the project (already done; see .neon)
neon deploy                      # creates the baki-photos bucket and writes AWS_* into .env.local
npm run storage:setup            # sets CORS for BETTER_AUTH_URL + localhost and tests a presigned upload
npm run storage:setup -- https://baki.example.com   # add more allowed origins, e.g. your live domain
```

Then try it in the app at **More → Photo upload check**.

**Switching to Cloudflare R2 later:** create a private bucket and an Object Read & Write token, set the `R2_*` variables (setting `R2_ACCOUNT_ID` selects R2), and run `npm run storage:setup`. No code changes are needed, because storage goes through one S3-compatible adapter.

### Deploying on Vercel

- `vercel.json` pins the function region to `sin1` (Singapore, next to Neon).
- Add every variable except the `OWNER_*` ones in *Project → Settings → Environment Variables*.
- Run `npm run db:migrate` against production from your machine before deploying a version that has new migrations.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint plus **dependency-cruiser** layer boundaries |
| `npm run typecheck` | `next typegen` + `tsc --noEmit` |
| `npm test` | Vitest unit tests (domain, use cases with in-memory fakes, formatting, validation) |
| `npm run test:e2e` | Playwright, run in Bangla. Needs a seeded Neon branch and `OWNER_EMAIL`/`OWNER_PASSWORD` set |
| `npm run i18n:check` | Fails if `bn.json` and `en.json` have different keys, or if any `.tsx` contains hard-coded UI text |
| `npm run check` | lint + typecheck + test + i18n:check |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply migrations (direct URL) |
| `npm run seed` | Create the owner account (safe to re-run) |

## Architecture

```
src/
  domain/          pure business rules and value objects (Money, PhoneNumber, ShopDate, Result)
  application/     use cases + port interfaces (Clock, FileStorage, Authenticator, …)
  infrastructure/  Drizzle schema/repositories, Better Auth, S3-compatible photo storage, env
  composition/     container.ts: the only place that wires infrastructure into use cases
  presentation/    server actions, components, features, zod schemas, i18n, format.ts
app/               thin route files (call presentation only)
messages/          bn.json (default) and en.json
tests/             unit/, e2e/, fakes/
```

Boundaries are enforced by [.dependency-cruiser.cjs](.dependency-cruiser.cjs) in `npm run lint`:

- domain imports nothing else.
- application imports domain only.
- infrastructure never imports presentation.
- presentation reaches infrastructure only through `composition`, and never imports Drizzle, Neon, AWS, or Better Auth directly.
- `app/` imports presentation only.

Conventions:

- **Money** is integer paisa: a `Money` value object in code and `bigint` `*_minor` columns in the database. Floats are never used.
- **Phones** are normalized to E.164 (`+8801XXXXXXXXX`). Input may be `01…`, `880…`, or `+880…`, written with Bangla or English digits.
- **Dates**: "today", due dates, and overdue checks are calendar days in `Asia/Dhaka` (`ShopDate`), independent of the server's time zone.
- **Errors**: use cases return `Result` with a `code` such as `INVALID_PHONE`. The UI translates `errors.<code>`.
- **Validation**: zod schemas contain no text. Custom checks name a `validation.*` key, and a per-locale error map turns it into words.
- **Formatting**: everything goes through [src/presentation/lib/format.ts](src/presentation/lib/format.ts), which uses lakh/crore grouping (৳ ১,২৫,০০০ or ৳ 1,25,000).

## Decisions and deviations

- **Cache Components is off.** Next 16.4 enables `cacheComponents` by default. Every page here is private and per-request (session cookie plus locale cookie), so there is no static shell to gain from it, and it would force every cookie read behind `<Suspense>`.
- **There is no `/api/auth/*` route.** All auth calls go through server actions (`auth.api.*` with `nextCookies()`). Leaving the Better Auth HTTP handler unmounted means the login rate limit can't be bypassed by posting to `/api/auth/sign-in/email`. Sign-up is disabled regardless.
- **Login rate limit**: after 5 failed attempts for an email within 15 minutes, further attempts are refused until the window passes. The counter lives in the `login_attempts` table. One trade-off: someone who knows the owner email can trigger that 15-minute lockout.
- **Phone validation** accepts Bangladeshi *mobile* numbers (013–019). Landlines are rejected for now.
- **`proxy.ts`** only checks that a session cookie exists. The real session check runs in the `(app)` layout and in every server action.
- **Photo storage** uses Neon Object Storage instead of Cloudflare R2, to avoid adding a card. R2 still works by setting env vars only.
- **Photos**: the browser compresses each photo to a JPEG display image (≤1600px, ~300 KB) and thumbnail (≤320px, ~30 KB). It then uploads both straight to the private bucket with presigned PUT URLs that sign the exact type and size and expire in 5 minutes. Views use presigned GET URLs that expire in 10 minutes.
- **Bangla digits** are applied when the UI language is Bangla. Until the settings table lands in phase 2, `use_bangla_digits` is fixed to on.
