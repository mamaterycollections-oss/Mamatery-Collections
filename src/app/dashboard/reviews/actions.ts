'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'

export async function moderateReview(id: string, status: 'approved' | 'rejected'): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/reviews')
  revalidatePath('/', 'layout')
  return { ok: true }
}

export async function deleteReview(id: string): Promise<ActionResult> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { error } = await supabase.from('reviews').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/reviews')
  revalidatePath('/', 'layout')
  return { ok: true }
}
