import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

// Best-effort client IP (Vercel / proxies put the real one first in x-forwarded-for).
export async function clientIp() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || '0.0.0.0'
}

// Fixed-window limiter backed by Postgres, so it holds across serverless instances.
// Returns true when the request is allowed. Fails open if the DB call errors.
export async function rateLimit(bucket: string, limit: number, windowSeconds: number, id?: string) {
  const key = `${bucket}:${id ?? (await clientIp())}`
  const { data, error } = await createAdminClient().rpc('hit_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  })
  if (error) {
    console.error('rate limit check failed', error.message)
    return true
  }
  return data === true
}
