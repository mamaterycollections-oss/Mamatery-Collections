import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'

const schema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }),
})

// Stores a browser/app push subscription for the signed-in user (RLS: own rows only).
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid subscription' }, { status: 400 })
  // An endpoint belongs to one device; re-assign it if another account used this phone before.
  await supabase.from('push_subscriptions').delete().eq('endpoint', parsed.data.endpoint)
  const { error } = await supabase.from('push_subscriptions').insert({
    user_id: userId,
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
  })
  if (error) return NextResponse.json({ error: 'could not save' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
