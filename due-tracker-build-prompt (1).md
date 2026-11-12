# Build Spec: Baki — Personal Due (Credit) Tracker for My Shop

> Working name: **Baki** (keep it in one constant `APP_NAME` so it's easy to rename).

You are a senior full-stack engineer. Build a clean, reliable, single-shop web application that lets me, a shop owner, track customers who buy on credit ("due"/baki) and pay late. It is for **my own shop only**: one owner account, no multi-tenancy, no billing, no SaaS features. Keep it simple, but build it properly so it's maintainable.

Work strictly in the phases in section 11. After each phase, stop, summarize what you built, list anything I must do manually (env vars, Neon/R2 setup), confirm `lint`, `typecheck` and `test` pass, and wait for my confirmation before continuing. If anything here is ambiguous, wrong, or outdated (library APIs change), tell me and propose a fix instead of guessing. Check the installed package's current docs/types before using an API.

---

## 1. Context

- I run a jewelry shop. Customers take products on credit and often pay very late. I need to know **who owes what, for which product, since when, and what they promised**.
- Every due must have a **product photo**. Customer phone is **required**; customer photo is optional.
- The app should stay generic: product details differ by category, so I create my own **categories with custom fields** (e.g. Gold → Ring with weight and karat) instead of hard-coded columns.
- I use it mostly on my **phone at the counter**, sometimes on a desktop. It must be fast and simple.
- Currency BDT (৳), phone numbers Bangladeshi (+880), timezone `Asia/Dhaka`.
- No automatic reminders or SMS. A one-tap **Call** and **WhatsApp** button is enough.
- The app must be fully usable in **Bangla (default) and English**, switchable any time. My own data (categories, field labels, customer names) can be entered in Bangla, English or both, and it's all stored in Neon.

---

## 2. Tech stack (pin exact versions)

| Concern | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Server Components, Server Actions), TypeScript strict. Next.js 16 uses `proxy.ts` instead of `middleware.ts`. |
| UI | Tailwind CSS + shadcn/ui, lucide-react, `sonner` toasts, Recharts for the few charts |
| Database | **Neon** Postgres (region AWS Singapore `ap-southeast-1`) |
| ORM | Drizzle ORM + drizzle-kit migrations |
| DB driver | `@neondatabase/serverless` **Pool (WebSocket)** via `drizzle-orm/neon-serverless`, because payments need real transactions. Pooled URL at runtime, direct URL for migrations. |
| Auth | Better Auth (email + password, Drizzle adapter), **public signup disabled**; my single account is created by a seed script. Use `nextCookies()` as the last plugin. |
| Photos | Cloudflare R2 (private bucket), browser uploads with presigned PUT URLs, viewed with short-lived presigned GET URLs |
| Image compression | `browser-image-compression` on the client: display version (max 1600px, ~300 KB) + thumbnail (max 320px, ~30 KB) |
| Data fetching | TanStack Query |
| Forms | react-hook-form + zod |
| Dates | `date-fns` + `date-fns-tz` (all "today" logic in Asia/Dhaka), with the `bn` locale for Bangla month/day names |
| Translation | `next-intl` with `bn` and `en` message files; Bangla web font **Hind Siliguri** (via `next/font/google`) with a Noto Sans Bengali / system fallback |
| Testing | Vitest (unit), Playwright (a few e2e flows) |
| Hosting | Vercel (region `sin1`) |

No background jobs, no Redis, no email service. Overdue status, promise status and balances are computed from data at query time.

---

## 3. Architecture (Clean Architecture, lightweight)

Keep the four layers, but don't over-engineer: one use case per real action, few ports.

| Layer | Contains | Must NOT import |
|---|---|---|
| **domain** | Entities, value objects (Money, PhoneNumber, ShopDate), business rules, Result type | React, Next.js, Drizzle, any other layer |
| **application** | Use cases, port interfaces (repositories, FileStorage, Clock, UnitOfWork), DTOs | React, Next.js, Drizzle, infrastructure |
| **infrastructure** | Drizzle schema, repositories, mappers, R2 storage, Better Auth config | presentation |
| **presentation** | Routes, server actions, components, hooks, zod schemas | Drizzle or vendor SDKs directly |

```
src/
  domain/          shared/ catalog/ customer/ sale/ payment/ followup/
  application/     ports/ use-cases/ dto/
  infrastructure/  db/ repositories/ mappers/ storage/ auth/
  composition/     container.ts
  presentation/    components/ features/ actions/ schemas/
app/               thin route files
tests/
```

Rules:
- Money is **integer paisa** (`bigint` in DB, a `Money` value object in code). Never floats.
- Use cases return `Result<Output, DomainError>` for expected failures (duplicate phone, overpayment, etc.).
- Every write that touches money runs in **one transaction** via `UnitOfWork`.
- Server actions are thin: check session → validate with zod → call one use case → return a serializable result.
- Enforce layer boundaries with `dependency-cruiser` in `npm run lint`.
- Unit-test the domain rules and use cases (allocation, balances, installments, overdue) with in-memory fakes.

---

## 4. Bangla / English translation

Translation works on two levels: **fixed UI text** lives in code, and **my own data plus my wording changes** live in Neon.

### 4.1 UI text (next-intl)
- Message files `messages/bn.json` and `messages/en.json`, with **Bangla as the default locale**. Every label, button, toast, validation error, empty state, receipt heading and report title comes from these files; no hard-coded text in components.
- Keys are namespaced by feature (`customers.form.phone`, `sales.wizard.step2`, `errors.duplicatePhone`). Use typed messages so a missing key is a TypeScript error.
- Domain errors carry a **code** (e.g. `DUPLICATE_PHONE`), never text; presentation translates the code.
- zod validation messages are translated through a custom error map per locale.
- Locale is stored in a cookie and on the user row in Neon (no `/bn` `/en` URL prefix needed for a private app). A language toggle sits in the header and in Settings.
- Why not store all UI text only in the database: it would make every page depend on an extra query, lose type checking, and break the app if a row is missing. The files are the base; Neon holds overrides (4.3).

### 4.2 My data in Neon (bilingual columns)
- **categories**: `name_bn`, `name_en` (at least one required; the UI shows the current language and falls back to the other).
- **field_definitions**: `label_bn`, `label_en`; select options stored as `[{ value, label_bn, label_en }]`; `unit_bn`, `unit_en` (e.g. গ্রাম / g, ভরি / vori).
- **customers**: `name` plus optional `name_bn`; search matches both (trigram index on both columns), so typing "রহিম" or "Rahim" finds the same person.
- **settings**: `shop_name_bn`, `shop_name_en`, `address_bn`, `address_en`, `receipt_footer_bn`, `receipt_footer_en`, `default_locale` (bn), `use_bangla_digits` (default true).
- **users**: `locale` preference.

### 4.3 Wording overrides (editable in the app)
- Table **translation_overrides**: `locale, key, value, updated_at`, unique `(locale, key)`.
- Settings → Language: a searchable list of all message keys showing the default Bangla and English text side by side; I can change any wording (e.g. "বাকি" instead of "বকেয়া") and reset it to default.
- On request, the server merges file messages with overrides from Neon (cached in memory, invalidated when I save an override), so changes appear immediately without a redeploy.

### 4.4 Numbers, money and dates
- Formatting goes through one `format.ts` module using `Intl.NumberFormat('bn-BD')` / `('en-IN')` for **lakh/crore grouping**: ৳ ১,২৫,০০০ in Bangla digits or ৳ 1,25,000 depending on `use_bangla_digits`.
- Dates use the `bn` date-fns locale (১২ নভেম্বর ২০২৬) or English.
- **Inputs accept both Bangla and English digits** (০-৯ and 0-9) for amounts and phone numbers and convert them before validation, since Bangla keyboards type Bangla digits.

### 4.5 Receipts and statements
- Printed in the current language by default, with a per-print toggle for the other language (useful when a customer prefers English).
- Use the Bangla font in print CSS and test conjunct rendering (e.g. ক্ষ, ঙ্গ, স্ত্র) in Chrome on Android and desktop "Save as PDF".

## 5. Data model

All tables: `id uuid` (UUIDv7), `created_at`, `updated_at`. Money columns end in `_minor` (paisa, `bigint`). Business records are archived or voided, never hard-deleted.

- **settings** (single row): bilingual shop fields from section 4.2, `phone, logo_key, default_locale, use_bangla_digits, default_credit_days (default 30), sale_prefix ('INV-'), receipt_prefix ('RCP-')`.
- **sequences**: `kind (sale|receipt), next_value` — gap-free numbers incremented inside the transaction.
- **categories**: `parent_id` (nullable, max 2 levels), `name_bn, name_en, sort_order, archived_at`.
- **field_definitions**: `category_id` (nullable = applies to all items), `key` (immutable), `label_bn, label_en, type` (text, number, decimal, money, select, date, boolean), `options jsonb` (bilingual labels), `unit_bn, unit_en, is_required, show_on_receipt, sort_order, archived_at`. Fields on a parent category also apply to its children.
- **customers**: `name, name_bn?, phone (E.164, unique, required), alt_phone, address, photo_key?, nid_number?, guarantor_name?, guarantor_phone?, guarantor_relation?, credit_limit_minor?, is_blocked bool, notes, archived_at`. Trigram index on name, name_bn and phone.
- **sales**: `customer_id, sale_number (unique), sale_date, subtotal_minor, discount_minor, total_minor, status` (open | closed | written_off | cancelled), `notes`.
- **sale_items**: `sale_id, category_id?, name, quantity, unit_price_minor, line_total_minor, custom_fields jsonb, notes`.
- **sale_item_photos**: `sale_item_id, file_key, thumb_key, sort_order`. **At least one photo per item.**
- **installments**: `sale_id, seq, due_date, amount_minor`. Every sale has ≥ 1 installment (a simple due = one installment).
- **payments**: `customer_id, receipt_number, amount_minor, method` (cash, bkash, nagad, rocket, bank, card, other), `reference` (TrxID), `paid_at, note, status` (active | voided), `void_reason, voided_at`.
- **adjustments**: `customer_id, sale_id?, type` (opening_balance, return, discount, write_off, correction), `direction` (debit | credit), `amount_minor, reason (required), created_at`.
- **allocations**: `payment_id? | adjustment_id?` (exactly one), `installment_id, amount_minor`. **Allocations are the single source of truth for what is paid.**
- **follow_ups**: `customer_id, sale_id?, channel` (call, whatsapp, visit, in_shop), `outcome` (reached, no_answer, promised, refused), `note, promised_amount_minor?, promised_date?, created_at`.
- **translation_overrides**: `locale, key, value, updated_at` (section 4.3).
- Better Auth **user** table gets an extra `locale` field.
- **activity_log** (append-only): `action, entity, entity_id, summary, before jsonb, after jsonb, at`.

Postgres views compute balances: `installment_balances` (paid, remaining, days overdue, status), `sale_balances`, `customer_balances` (total balance, overdue amount, max days overdue, last payment date). Promise status (pending / kept / broken) is derived by comparing payments received by the promised date.

DB constraints/triggers must guarantee: an installment is never over-allocated; a payment's allocations never exceed its amount; voiding a payment removes its allocations.

---

## 6. Features

### 6.1 Categories and custom fields
- Settings → Categories: create/rename/reorder/archive categories (2 levels, e.g. Gold → Ring, Necklace, Bangle; Silver → …).
- Field builder per category: add fields with type, unit, options, required, show-on-receipt. Field key can't change after creation; archived fields stay visible on old records.
- On first login, offer an optional **jewelry starter set**, pre-filled in both languages: categories সোনা/Gold, রুপা/Silver, হীরা/Diamond, অন্যান্য/Other, with fields ওজন/weight (decimal, unit গ্রাম/g or ভরি/vori), ক্যারেট/karat (select 18K/21K/22K/24K), মজুরি/making charge (money). Everything editable.
- The sale item form renders the chosen category's fields dynamically, with a zod schema generated at runtime and validated again in the domain.

### 6.2 Customers
- Add/edit with phone required (accept `01XXXXXXXXX`, `8801…`, `+8801…`, normalize to E.164), optional photo (camera or gallery), address, NID, guarantor, credit limit, notes.
- Duplicate phone → "Customer already exists" with a link to them.
- List with instant search (name or phone), filters: has dues / overdue / blocked / archived; shows thumbnail, balance, days overdue badge.
- **Profile:** photo, name, phone with **Call** and **WhatsApp** buttons, balance, overdue amount, credit limit usage. Actions: New sale, Receive payment, Log follow-up, Print statement. Tabs: Open dues (with product photos), Ledger (all sales, payments, adjustments with running balance), Follow-ups & promises.
- Credit limit / blocked customer → warning on new sale, with "continue anyway" confirmation.

### 6.3 Sales on credit
Counter-friendly wizard (target under a minute):
1. Find customer by phone, or create inline.
2. Add items: category, name, qty, price, category fields, **at least one photo** (camera first).
3. Discount and upfront payment (amount + method). Upfront is saved as a real payment.
4. Repayment: **single due date** (quick picks +7 / +15 / +30 / +60 / +90 days) or **installments** (count, monthly/weekly, first date; equal split with remainder on the last; amounts editable; preview).
5. Review and save → print receipt.

Sale detail page: photo gallery with zoom, items with custom fields, installment schedule with status, payments applied, follow-ups. Editing items is allowed only before any later payment; afterwards use adjustments. Cancel only if no payments.

### 6.4 Payments and adjustments
- Receive payment: amount, method, TrxID/reference, date, note. Allocated **oldest due first** by default, or to a chosen sale. Can't exceed the customer's total balance.
- Void payment with a required reason (never delete); receipt shows VOID.
- Adjustments with required reason: **opening balance** (to move my old paper khata in), **return**, **discount/waiver**, **write-off**, **correction**.
- Printable payment receipt with sequential number.

### 6.5 Collections (daily screen)
- **Today:** promises due today, installments due today, overdue list sorted by amount × days overdue, broken promises, due in the next 7 days.
- Each row: customer photo, name, product thumbnail, balance, days overdue, last follow-up, Call / WhatsApp / Log follow-up / Receive payment buttons.
- Log follow-up in two taps; choosing "promised" asks for date and amount.
- Filter by aging bucket: not due, 1–30, 31–60, 61–90, 90+ days.

### 6.6 Dashboard
Total outstanding, total overdue, collected today and this month, new credit this month, customers with dues, promises due today. Aging bar chart, collections vs new credit (last 6 months), top 10 overdue customers, upcoming dues.

### 6.7 Reports and printing
- Reports (date range, CSV export): collections by day and method, new credit sales, aging (customer-wise), outstanding by category, write-offs and adjustments.
- Printable **customer statement** (date range, running balance, schedule) and receipts in A4 and 80mm thermal layouts via print CSS ("Print / Save as PDF" from the browser — reliable with Bangla text).
- **Full data export:** CSV of every table (photos stay in R2).

### 6.8 Settings and security
- Shop info, logo, receipt footer, default credit days, number prefixes, categories and fields.
- Language: default language, Bangla digits on/off, and the wording override editor (section 4.3).
- Change password, sign out, sign out of all sessions, auto-logout after inactivity (configurable, default 30 min).
- Rate-limit the login action (simple in-DB attempt counter is fine).
- Activity log page: who-did-what timeline (it's just me, but it shows every change to money with before/after).

---

## 7. UX requirements

- Mobile-first: bottom navigation (Home, Today, Customers, **+ New sale**, More); sidebar on desktop.
- Large touch targets, numeric keypad for amounts, camera-first photo inputs, thumbnails before full images.
- Amounts and dates formatted per section 4.4.
- Loading skeletons, friendly empty states, clear error messages, success toasts.
- Light and dark mode; works at 360px width.
- Bangla is the default UI language; layouts must not break with longer Bangla text or the taller Bangla font (test both languages on every screen).
- Double-tap safe: create-sale and receive-payment actions use idempotency keys.
- Installable as a PWA (icon + standalone mode). No offline writes.

---

## 8. Data safety

- Neon point-in-time restore enabled; document how to restore.
- A `npm run backup` script that dumps the database (pg_dump via direct URL) to a dated file I can keep.
- Balances are never stored; they always come from views over allocations, so there are no cached totals that can drift out of sync.
- No secrets in client code; R2 bucket private; presigned URLs short-lived; upload size and MIME allow-list checked when presigning.

---

## 9. Testing

- Unit: Bangla-digit input conversion, bn/en money and date formatting, Money, PhoneNumber normalization, installment plan generation, oldest-first allocation, overdue and aging calculation, promise status, custom field validation.
- Use cases: create sale, receive payment (incl. overpayment rejection), void payment, adjustments, with in-memory fakes.
- Integration: DB constraints (no over-allocation) against a Neon branch.
- A script `npm run i18n:check` (run in CI) fails if `bn.json` and `en.json` have different keys or any component uses a hard-coded string literal in JSX.
- E2E (Playwright), run in Bangla: login → create customer → create sale with photo → receive partial payment → see updated balance and overdue list.

---

## 10. Environment variables (document in README)

`DATABASE_URL` (pooled), `DATABASE_URL_UNPOOLED` (direct, migrations), `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `OWNER_EMAIL` and `OWNER_PASSWORD` (seed only).

---

## 11. Build phases (stop after each one)

Build each phase domain → use cases (+tests) → infrastructure → server actions → UI. Before coding, list the files and migrations you'll add.

1. **Foundation.** Project setup, architecture folders, dependency-cruiser, Vitest/Playwright, Neon + Drizzle setup, **next-intl with bn/en, Bangla font, `format.ts`, Bangla-digit input helper, language toggle**, Better Auth with signup disabled + seed script for my account, login/logout, `proxy.ts` route protection, app shell (bottom nav / sidebar), R2 presign endpoint and photo upload component with compression, shared value objects with tests.
2. **Settings and categories.** Shop settings, sequences, category tree, field builder, dynamic field engine, jewelry starter set.
3. **Customers.** CRUD, photo, guarantor, search and filters, duplicate detection, profile page shell.
4. **Sales.** Sale wizard with item photos and category fields, single due or installments, sale detail page, edit/cancel rules.
5. **Payments and ledger.** Receive payment with allocation, void, adjustments (incl. opening balance), customer ledger, printable receipts.
6. **Collections and dashboard.** Today screen, follow-ups and promises, aging, dashboard. **← I start using it in my shop here.**
7. **Reports and polish.** Reports with CSV export, customer statement, full data export, activity log page, backup script, PWA, auto-logout, translation override editor, final review of both languages on every screen, final review against this spec, README.

## 12. Definition of done (every phase)
`lint` (incl. boundaries), `typecheck`, `test` and `i18n:check` pass; every new screen works in Bangla and English; money changes are transactional and logged in activity_log; mobile and desktop layouts checked; loading/empty/error states present; README updated with setup and any manual steps.
