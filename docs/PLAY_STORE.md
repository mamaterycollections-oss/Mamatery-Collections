# Publishing the MamaTerry app on Google Play

The Android app is a **Trusted Web Activity (TWA)**: a real Play Store app that opens the live website full-screen (no browser bar), with its own icon, splash screen and push notifications. Every website update reaches the app instantly — no app update needed. This is Google's recommended way to ship a PWA to Play.

Do this **after** the website is live on its final domain (see `DEPLOYMENT.md`).

## What's already done in the code

| Play requirement | Where |
| --- | --- |
| Installable PWA (manifest, service worker, offline page) | `src/app/manifest.ts`, `public/sw.js`, `/offline` |
| 512×512 icon, maskable icons, notification badge | `store/play-icon-512.png`, `public/icons/*` (`npm run icons`) |
| Feature graphic 1024×500 | `store/feature-graphic-1024x500.png` |
| Privacy policy URL | `https://<domain>/privacy` |
| Account deletion — in app **and** a public web page | Account → Settings → Delete account; `https://<domain>/delete-account` |
| Digital Asset Links (proves app ↔ site ownership) | `https://<domain>/.well-known/assetlinks.json` (from `ANDROID_*` env vars) |
| Physical goods → M-Pesa/cards allowed (Google Play Billing not required) | — |
| Notifications permission prompt only after a user tap | Dashboard/Account → "Get alerts on this device" |

## 1. Google Play developer account **(owner)**
- play.google.com/console → pay the one-time US$25 fee → verify identity.
- **New personal accounts must run a closed test with at least 12 testers for 14 continuous days** before they can publish to production. Line up 12 people (staff, family, loyal customers) with Android phones and Gmail addresses early. An **organisation** account (needs a D-U-N-S number for the business) skips this rule.

## 2. Build the app bundle (on your computer, once)
Needs Node.js (installed) and Java/Android SDK — Bubblewrap offers to download both on first run.
```bash
npm i -g @bubblewrap/cli
cd android
# 1. Replace REPLACE-WITH-YOUR-DOMAIN.co.ke in twa-manifest.json with your real domain
bubblewrap init --manifest https://<your-domain>/manifest.webmanifest   # or: bubblewrap update (uses twa-manifest.json)
bubblewrap build
```
- It creates a signing key `android/android.keystore`. **Back it up and keep the passwords safe** — it's git-ignored and can't be recovered.
- Output: `app-release-bundle.aab` (upload this to Play).

## 3. Link the app to the website
1. Play Console → your app → **Test and release → App integrity → App signing** → copy the **SHA-256 certificate fingerprint** (Play re-signs the app, so use Play's key, and also the upload key from `bubblewrap fingerprint` if you like).
2. Vercel → Environment variables:
   - `ANDROID_PACKAGE_NAME=ke.co.mamaterrycollections.app`
   - `ANDROID_SHA256_FINGERPRINTS=AA:BB:…` (comma-separate multiple)
3. Redeploy, then check `https://<domain>/.well-known/assetlinks.json` shows them. Without this the app shows a browser address bar.

## 4. Store listing **(owner)**
- **App name:** MamaTerryCollections · **Short description (80):** "Clothes, bags & caps — pay with M-Pesa, delivered across Kenya."
- **Category:** Shopping · **Contact email & phone:** the store's.
- **Graphics:** icon `store/play-icon-512.png`, feature graphic `store/feature-graphic-1024x500.png`, **2–8 phone screenshots** (`public/screenshots/*.png` — retake with real products before launch).
- **Privacy policy:** `https://<domain>/privacy`

## 5. App content forms (Play Console → Policy → App content)
| Form | Answer |
| --- | --- |
| Ads | No ads |
| Target audience | 18+ (or 13+) — not designed for children |
| Content rating (IARC) | Shopping app, no violence/sexual content, users can't chat publicly → rated Everyone/3+ |
| Data safety — collected | Name, email, phone, address (App functionality, Account management); Purchase history (App functionality); App interactions/diagnostics (optional: none) |
| Data safety — shared | Payment and delivery partners process data on our behalf (counts as *service providers*, not "sharing") |
| Security | Encrypted in transit: **Yes**. Users can request deletion: **Yes** (link `https://<domain>/delete-account`) |
| Financial features | Not a financial app (payments go through M-Pesa/Paystack for physical goods) |
| Government app / News | No |

## 6. Release
1. **Testing → Closed testing** → create track → upload the `.aab` → add your 12+ testers' emails → share the opt-in link.
2. After 14 days, **Apply for production** → answer the questionnaire → roll out.
3. Updates: website changes appear automatically. Only rebuild (`bubblewrap update && bubblewrap build`, bump `appVersionCode`) if the icon, name, colours or domain change.

## Demo login for Google's reviewers
Play asks for credentials if features are behind a login. Create a **customer** account for reviewers (e.g. `playreview@<domain>`), and mention that staff features are internal-only.
