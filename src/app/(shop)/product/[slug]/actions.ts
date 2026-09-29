'use server'

import { z } from 'zod'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'

const schema = z.object({
  product_id: z.uuid(),
  rating: z.coerce.number().int().min(1, 'Choose a star rating').max(5),
  title: z.string().trim().max(80).optional(),
  comment: z.string().trim().min(3, 'Tell us a little more').max(1200),
})

export async function submitReview(_: unknown, form: FormData) {
  const parsed = schema.safeParse(Object.fromEntries(form))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return { error: 'Please sign in to leave a review' }
  if (!(await rateLimit('review', 5, 3600, userId))) return { error: 'Too many reviews. Try again later.' }

  // RLS: customers can only write their own review; the database forces it to "pending".
  const { error } = await supabase.from('reviews').upsert(
    { product_id: parsed.data.product_id, user_id: userId, rating: parsed.data.rating, title: parsed.data.title || null, comment: parsed.data.comment },
    { onConflict: 'product_id,user_id' },
  )
  if (error) return { error: friendlyError(error) }
  return { ok: true }
}
