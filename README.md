# MamaTerryCollections

Fashion e-commerce website + installable app (PWA / Google Play) for clothes, bags and caps in Kenya, with an owner dashboard for stock, barcodes, in-store sales, profit margins and staff performance.

**Start here:** [`docs/PROJECT_NOTES.md`](docs/PROJECT_NOTES.md) — status, decisions and next steps.
Going live: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) · Google Play: [`docs/PLAY_STORE.md`](docs/PLAY_STORE.md)

## Features

**Customers** — editorial storefront, search, filters (size, colour, price), product gallery with zoom, live stock per size/colour, wishlist, reviews, guest or account checkout, M-Pesa STK Push / card / cash on delivery, delivery zones, discount codes, SMS/email/push order updates, order tracking, receipts, installable app, offline support, self-service data download and account deletion.

**Staff** — dashboard KPIs, order pipeline, product editor with automatic SKUs and EAN-13 barcodes, printable barcode labels, Quick Sale POS (camera or USB scanner, cash drawer, M-Pesa till codes or STK), inventory restock/adjust with full history, stock counts, profit & margin reports with CSV, stock valuation, staff management with per-person discount limits and margin visibility, performance for appraisals, review moderation, real-time notifications, full audit log, owner settings (categories, sizes, colours, zones, payments, coupons).

**Security** — enforced in Postgres with row-level security and checked functions; cost prices live in separate tables only the owner (and managers she authorises) can read. `npm run test:rls` proves it (37 checks).

## Develop

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev                  # http://localhost:3000
```

| Command | |
| --- | --- |
| `npm run db:push` | apply `supabase/migrations` + regenerate types |
| `npm run seed` / `npm run seed -- --clear` | demo catalog, accounts and orders (logins in `docs/LOCAL_CREDENTIALS.md`, git-ignored) |
| `npm run create-owner -- email "Name"` | real owner login |
| `npm run test:rls` | security tests |
| `node scripts/e2e-checkout.mjs` · `node scripts/e2e-pos.mjs <barcode>` | end-to-end purchase / POS tests (dev server running) |
| `npm run icons` · `node scripts/store-screenshots.mjs` | app icons & store graphics · Play screenshots |

Stack: Next.js 16 · TypeScript · Tailwind CSS 4 · Motion · Supabase (Postgres, Auth, Storage, Realtime, pg_cron) · M-Pesa Daraja · Paystack · Africa's Talking · Resend · Web Push.
