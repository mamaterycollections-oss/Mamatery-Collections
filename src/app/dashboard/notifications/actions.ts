'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function markAllRead(): Promise<ActionResult> {
  const { session } = await requireStaff('staff')
  const supabase = await createClient()
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', session.id).is('read_at', null)
  revalidatePath('/dashboard', 'layout')
  return { ok: true }
}
