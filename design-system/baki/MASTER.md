# Baki — Design System (MASTER)

Source of truth for every screen. Produced with the **UI/UX Pro Max** skill
(`.claude/skills/ui-ux-pro-max`, data rows cited below). Page files in
`design-system/baki/pages/` override this file when present.

## Product profile

| Input | Value |
|---|---|
| Product | Shop credit ledger: invoice/billing + collections (single owner, counter use) |
| Matched rows | `products.csv` #105 *Invoice & Billing Tool*, #42 *Banking/Traditional Finance* |
| Audience/context | Jewelry shop owner, phone at the counter, sometimes desktop; Bangla first |
| Stack | Next.js 16 + Tailwind v4 + shadcn/ui (Radix) + lucide icons |

## Style

- **Minimalism & Swiss Style + Flat Design** (`ui-reasoning.csv` #105, #42)
- Trust & authority, with no decoration for its own sake. Flat surfaces with 1px borders; shadows only on overlays and the floating "New sale" button.
- **Effects:** colour-shift hover, **150ms** transitions (200ms for overlays), no 3D, no gradients, no glass.
- **Anti-patterns (must avoid):** playful styling, excessive decoration, complex shadows, purple/pink "AI" gradients, emoji used as icons.

## Colour tokens (refined 2026-11-12: warm stone neutrals + navy + gold)

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#F6F5F2` warm stone | `#0B1220` | page |
| foreground | `#1C1917` | `#EEF1F6` | text |
| card | `#FFFFFF` | `#121B2D` | surfaces (1px border + `shadow-card`) |
| primary | `#142340` trust navy | `#E2B23E` gold | primary buttons, active nav, selected chips |
| brand-gold | `#D9A521` | `#E2B23E` | **fills only**: "New sale" action, current wizard step, hero accents (navy text on it) |
| gold | `#9A6A05` | `#E8BD52` | gold **text/icons** (5:1 on white), links like "See all" |
| hero | `#142340` | `#18264A` | dashboard balance card (white text, gold accents) |
| success | `#047857` | `#3CCF98` | **paid**, kept promise, collected |
| warning | `#B45309` | `#F4B740` | **due today**, partial |
| destructive | `#C62828` | `#F2817B` | **overdue**, void, broken promise |
| muted-foreground | `#57534E` | `#9AA6BB` | secondary text (≥4.5:1 in both modes) |
| border | `#E7E4DE` | `#233049` | dividers |
| chart-1 / chart-2 | `#2563EB` / `#D97706` | `#3B82F6` / `#D97706` | validated pair (CVD ΔE ≥ 30) |

Status is **never colour-only**: every status badge carries text and an icon.

## Typography (`google-fonts.csv`, Bengali subset)

- **Headings and numbers:** *Anek Bangla*, a modern variable Bangla sans with Latin glyphs.
- **Body:** *Hind Siliguri* 400/500/600, with fallback Noto Sans Bengali and the system font.
- Base 16px, body line-height 1.6 (Bangla conjuncts need the room), and `tabular-nums` on money columns.
- Scale: 12 (meta only) / 14 / 16 / 18 / 20 / 24 / 30. Never use body text below 14px.

## Spacing and layout

- 4/8px rhythm. Page gutter 16px on mobile, 24px on desktop. Content max-width 64rem.
- Mobile-first: bottom nav with **≤5** items and a raised centre "New sale" button. On `md+`, a sidebar.
- Touch targets **≥44px** (buttons are 44–48px tall, list rows ≥56px). At least 8px between targets.
- Respect the safe area at the bottom (`pb-safe`). Fixed bars must not cover content (main has bottom padding).
- Verify at **360px** width in both languages. Bangla strings are longer, so let labels wrap and never truncate money.

## Components

- **Shared classes** (`src/presentation/components/chip.ts`): `chipClass` for filter chips, `optionClass` for tappable option tiles, `rowCardClass` for list rows. Use them instead of ad-hoc class strings.
- **Radii:** cards `rounded-2xl`, hero `rounded-3xl`, inputs/buttons `rounded-lg`, chips `rounded-full`. Inputs are 44–48px tall on a white surface.
- **Shell:** brand mark (`BrandMark`) in header/sidebar; gold "New sale" (raised square in the bottom nav, full-width button in the sidebar); active nav item = tinted pill (+ gold bar in the sidebar).
- **Dashboard:** navy hero card (total balance, overdue bar, quick links), then 2×2 stat tiles with tinted icon squares.

- **Money:** right-aligned with tabular numbers, and always formatted through `format.ts` (lakh/crore).
- **Status badge:** icon + text + tinted background (paid / partial / due today / upcoming / overdue Nd).
- **Lists:** 40px thumbnails load before full images, and the whole row is the link. Destructive actions sit in menus or behind confirmation.
- **Forms:** visible labels, error text under the field, numeric keypad (`inputMode="decimal"`/`"tel"`), and labels are never placeholder-only.
- **Empty states:** icon, one sentence, and a primary action. **Loading:** skeletons shaped like the content.
- **Feedback:** sonner toast on success. Errors appear inline and in a toast for server failures.
- **Motion:** 150ms colour/opacity only. `prefers-reduced-motion` disables the rest.

## Pre-delivery checklist (from `references/pro-rules.md`)

SVG icons from one family (lucide), no emoji · ≥44px targets · visible focus ring (gold) ·
4.5:1 text contrast in light **and** dark · status not by colour alone · labels on all fields ·
decorative icons `aria-hidden` · icon-only buttons have `aria-label` · 360px layout without
horizontal scroll · reduced motion respected · both languages checked.
