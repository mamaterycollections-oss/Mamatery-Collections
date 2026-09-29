# MamaTerryCollections — project notes (read this first)

This file is the hand-off between work sessions. If the chat is lost, open this folder in VS Code,
start Claude Code and say: **"Read docs/PROJECT_NOTES.md and continue."**

- Original brief: [`docs/BUILD_BRIEF.html`](BUILD_BRIEF.html)
- Going live (Vercel, M-Pesa, SMS, email): [`docs/DEPLOYMENT.md`](DEPLOYMENT.md)
- Google Play (Android app): [`docs/PLAY_STORE.md`](PLAY_STORE.md)
- Demo logins (local only, git-ignored): `docs/LOCAL_CREDENTIALS.md`

## Where things are

| What | Where |
| --- | --- |
| Project folder | `C:\Users\TECNO BROTHERS\Desktop\mamaterry-collections` |
| Supabase project | ref `dscveoemqbvjtnccorxl` (region eu-central-1, Frankfurt) |
| Secrets | `.env.local` only (git-ignored). Never commit it; copy values into Vercel's env settings. |
| Database changes | `supabase/migrations/*.sql` → `npm run db:push` (also regenerates TypeScript types) |
| Run locally | `npm run dev` → http://localhost:3000 |

## Stack

Next.js 16 (App Router, `src/proxy.ts` instead of middleware) · TypeScript · Tailwind CSS 4 · Motion (Framer Motion) ·
Supabase (Postgres + RLS, Auth, Storage, Realtime, pg_cron) · M-Pesa Daraja STK Push · Paystack (cards) ·
Africa's Talking (SMS) · Resend (email) · Web Push (VAPID) · installable PWA → Google Play via Trusted Web Activity.

## Key design decisions

1. **Security lives in the database.** Every table has RLS. This Supabase project auto-grants new tables to the
   public `anon` role, so each migration must enable RLS (and revoke where needed).
2. **Cost prices are in separate tables** (`variant_costs`, `order_item_costs`) readable only by the owner and managers
   with `staff.can_view_margins = true`. Attendants/customers can never see them, even via the API.
3. **Money and stock only move through database functions** (`place_order`, `record_in_store_sale`,
   `update_order_status`, `receive_stock`, `adjust_stock`, stock counts, cash drawer). They lock rows, re-read prices,
   enforce discount limits and write the stock ledger + audit log. Direct edits of `quantity_on_hand` are blocked.
4. **Orders are never deleted** — cancelled/voided with a reason, refunds recorded separately.
5. **Unpaid M-Pesa/card orders release their stock after 45 minutes** (pg_cron every 10 min + daily Vercel cron).
6. **Barcodes** are EAN-13 in the in-store range (prefix 20), auto-generated per variant; SKUs auto-generated too.
7. **Categories, sizes, colours, delivery zones, payment options** are all owner-editable data — nothing hardcoded.
8. Internal SQL helpers live in schema `private` (not exposed by the API) so triggers can call them but browsers can't.
9. Storefront pages are cached (revalidate 60 s, refreshed immediately on catalog edits); product stock updates live via Realtime.
10. Guest checkout is allowed; guests view their order through a secret tracking link (`/orders/<id>?t=<token>`) and `/track`.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | local dev server |
| `npm run db:push` | apply new migrations to Supabase + regenerate types |
| `npm run db:sql -- "select 1"` | run ad-hoc SQL |
| `npm run seed` / `npm run seed -- --clear` | create / remove demo catalog, demo accounts, demo orders |
| `npm run create-owner -- email "Full Name"` | create the real owner login (prints a temporary password) |
| `npm run icons` | regenerate app icons + Play Store graphics |
| `npm run test:rls` | security test: checks each role only sees what it should |
| `node scripts/e2e-checkout.mjs` | end-to-end purchase test against the dev server |

## Status log

### 2026-09-29/30 — Session 1
- ✅ Database: 5 migrations applied (schema, RLS, commerce functions, storage/realtime/seed config, pg_cron jobs).
- ✅ Demo data: 16 products / ~150 variants with generated images, 4 demo accounts, 36 demo orders, coupon `KARIBU10`.
- ✅ Storefront: home, shop + filters, product page (gallery/zoom, live stock, fly-to-bag), cart drawer, wishlist sync,
  search, auth (sign in/up/reset), checkout (M-Pesa/card/COD, zones, coupons), order tracking + receipt.
- ✅ Verified end-to-end: guest checkout → simulated M-Pesa → paid order (MT1038).
- ✅ Staff dashboard: overview, orders (+ detail actions), products editor (photos, variant matrix), barcode labels,
  Quick Sale POS (camera + USB scanner, cash drawer), inventory (restock/adjust/history), stock counts, cash drawer,
  reports (profit/sales/stock + CSV), team (perf + permissions), customers, reviews, notifications, audit, settings.
- ✅ Customer account (orders, addresses, settings, data export, self-service account deletion), wishlist,
  legal/help pages (privacy, terms, delete-account, delivery-returns, FAQ, contact, about), offline + 404 pages, sitemap/robots.
- ✅ Verified: `npm run test:rls` (37/37 pass), `node scripts/e2e-checkout.mjs`, `node scripts/e2e-pos.mjs <barcode>`,
  `npx next build` succeeds. 3 commits on branch `main` (local only — not pushed yet).

### NEXT STEPS (resume here)
1. Write `docs/DEPLOYMENT.md` (Vercel env vars, Supabase Auth URL config + Resend SMTP, Daraja sandbox→production,
   Paystack webhook, Africa's Talking) — adapt from ../alicia-staffing-agency/docs/DEPLOYMENT.md.
2. Write `docs/PLAY_STORE.md` + `android/twa-manifest.json` (Bubblewrap TWA, package `ke.co.mamaterrycollections.app`,
   assetlinks via ANDROID_* env vars, data-safety answers, content rating, 12-tester closed test rule, screenshots).
3. Capture store screenshots into `public/screenshots/{home,product,checkout}.png` (1080×1920) — manifest already references them.
4. Visual QA pass on phone widths for dashboard pages (inventory, settings, team) and fix anything cramped.
5. Connect GitHub (user creates repo, then `git remote add origin … && git push -u origin main`) and deploy to Vercel.
6. Owner to confirm: store contact details, delivery fees, return exclusions in /terms (final sale/underwear/earrings were my suggestion).

## Open items / decisions for the owner
- Real store details: phone, WhatsApp, email, pickup address/hours, social links (Dashboard → Settings).
- Delivery zones & fees are placeholders (Nairobi 250, environs 400, other counties 550) — confirm.
- Cash on delivery is OFF by default (brief's return-rate warning); switch on per zone if wanted.
- M-Pesa: Daraja sandbox keys → production Till/Paybill. Until then `MPESA_ENV=simulate` (local only).
- **Security:** the Supabase DB password and service-role key were shared in chat. Rotate both before launch
  (Supabase → Settings → Database → reset password; Settings → API → rotate keys) and update `.env.local`/Vercel.
