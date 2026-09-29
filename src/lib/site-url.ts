// The public base URL used in auth email links, notification emails, payment
// callbacks and social-share metadata.
//
// NEXT_PUBLIC_SITE_URL wins when it holds a real address. On Vercel, a missing or
// leftover "http://localhost:3000" value falls back to the project's production
// domain (Vercel switches this to the custom domain once one is added), so
// production links can never point at a developer's machine.
const LOCALHOST = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/

export function siteUrl() {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, '')
  const onVercel = Boolean(process.env.VERCEL)

  if (explicit && !(onVercel && LOCALHOST.test(explicit))) return explicit
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}
