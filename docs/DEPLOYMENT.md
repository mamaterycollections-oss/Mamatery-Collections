# Going live — MamaTerryCollections

Steps to put the store online with real payments and notifications. Items marked **(owner)** need an account or a decision from the business.

## 0. Before anything: rotate the shared secrets

The database password and service-role key were pasted into a chat while building. Before launch:

1. Supabase → **Project Settings → Database → Reset database password**. Put the new one in `.env.local` → `DATABASE_URL` (write `@` as `%40`).
2. Supabase → **Project Settings → API** → rotate the JWT secret / create new API keys. Update `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` and Vercel.
3. Use a strong password (the old one was short and guessable).

## 1. Put the code on GitHub

1. Create an empty **private** repository on github.com (no README), e.g. `mamaterry-collections`.
2. In VS Code's terminal inside this folder:
   ```bash
   git remote add origin https://github.com/<your-account>/mamaterry-collections.git
   git push -u origin main
   ```
   `.env.local` and `docs/LOCAL_CREDENTIALS.md` are git-ignored and never uploaded.

## 2. Deploy on Vercel

1. vercel.com → **Add New → Project** → import the repo. Framework: Next.js (defaults are fine).
2. **Environment variables** — copy from `.env.local` (see `.env.example` for the full list):

   | Variable | Notes |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
   | `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | push notifications (already generated in `.env.local`) |
   | `CRON_SECRET` | any long random string (already in `.env.local`) |
   | `MPESA_*`, `PAYSTACK_SECRET_KEY` | see step 4 — **do not** copy `MPESA_ENV=simulate` |
   | `RESEND_API_KEY`, `EMAIL_FROM`, `AFRICASTALKING_*` | see step 5 |

   Leave `NEXT_PUBLIC_SITE_URL` unset (the domain is detected automatically). `DATABASE_URL` is **not** needed on Vercel.
3. Deploy. Region is set to Frankfurt (`fra1`) in `vercel.json`, next to the database.
4. **(owner)** Settings → Domains → add your domain (e.g. `mamaterrycollections.co.ke`).

## 3. Supabase auth settings (sign-up and password-reset emails depend on this)

Supabase → **Authentication → URL Configuration**:
- **Site URL:** your live address, e.g. `https://mamaterrycollections.co.ke`
- **Redirect URLs:** `http://localhost:3000/**` and your Vercel address `https://<project>.vercel.app/**`

Supabase → **Authentication → Emails → SMTP settings** → enable custom SMTP with Resend (Supabase's built-in sender only mails your own team, a few per hour):

| Field | Value |
| --- | --- |
| Host / Port | `smtp.resend.com` / `465` |
| Username | `resend` |
| Password | your Resend API key |
| Sender | `orders@<your-domain>`, name `MamaTerryCollections` |

Test: live site → Sign in → Forgot password → the email link should open "Choose a new password".

## 4. Payments

### M-Pesa (Daraja STK Push) **(owner)**
1. Create an app at [developer.safaricom.co.ke](https://developer.safaricom.co.ke) with **Lipa na M-Pesa Online**. Test with sandbox first:
   `MPESA_ENV=sandbox`, `MPESA_SHORTCODE=174379`, `MPESA_PASSKEY=<sandbox passkey>`, `MPESA_CONSUMER_KEY/SECRET` from your app.
2. `MPESA_CALLBACK_SECRET` = long random string (already generated). The callback URL is built automatically:
   `https://<domain>/api/payments/mpesa/callback?secret=…`
3. Go live: apply for Lipa na M-Pesa Online on your **Till** or **Paybill**, then set `MPESA_ENV=production` plus the production shortcode and passkey.
   For a Till (Buy Goods): `MPESA_TRANSACTION_TYPE=CustomerBuyGoodsOnline` and `MPESA_PARTY_B=<till number>` (shortcode = store number).
4. If a callback is slow, the site asks Safaricom directly for the result, so customers aren't left waiting.

In-store, attendants can also record M-Pesa payments made to the till by typing the confirmation code — no API needed.

### Cards (Paystack) **(owner)**
1. Paystack account with KES enabled → set `PAYSTACK_SECRET_KEY`.
2. Paystack dashboard → Settings → Webhook URL: `https://<domain>/api/payments/paystack/webhook`
3. Dashboard → Settings → Payments → switch **Card** on.

### Cash on delivery
Off by default. Switch on in Dashboard → Settings, **and** per delivery area.

## 5. Notifications

| Channel | Setup |
| --- | --- |
| Email (order updates, staff alerts) | [Resend](https://resend.com): verify your domain, set `RESEND_API_KEY` and `EMAIL_FROM` |
| SMS | [Africa's Talking](https://africastalking.com): set `AFRICASTALKING_USERNAME`, `AFRICASTALKING_API_KEY`; add `AFRICASTALKING_SENDER_ID` once your sender name is approved. Budget ~KES 0.8–1 per SMS. |
| Push (phone/desktop) | works automatically; staff tap "Get alerts on this device" in Dashboard → Notifications |
| In-app | works without any keys |

Until keys are set, messages are skipped safely (logged in development).

## 6. First-day setup **(owner)**

1. Create the real owner login: `npm run create-owner -- you@email.com "Your Name"` → sign in, change the password.
2. Dashboard → **Settings**: phone, WhatsApp, email, pickup address/hours, social links, delivery areas & fees, free-delivery threshold.
3. Remove demo data: `npm run seed -- --clear` (deletes demo products, orders and the `@mamaterry.test` accounts).
4. Add real products (Products → New) with photos; print barcode labels (Barcode labels); stick them on stock.
5. Add staff (Team → Add staff) — managers get category assignments, discount limits and optional margin access.
6. Run the checks: `npm run test:rls` needs the demo accounts, so run it **before** step 3 (or re-seed temporarily).

## 7. Costs (monthly, approx.)

Supabase Pro ~$25 · Vercel Pro ~$20 (Hobby is free for a start) · domain ~$15/yr · SMS per message · M-Pesa/Paystack per-transaction fees.
