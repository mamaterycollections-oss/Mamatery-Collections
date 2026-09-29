'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import type { Enums } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'

const refresh = () => {
  revalidatePath('/dashboard/inventory')
  revalidatePath('/', 'layout')
}

export async function receiveStock(variantId: string, quantity: number, newCost: number | null, note: string): Promise<ActionResult<number>> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('receive_stock', {
    p_variant: variantId,
    p_quantity: Math.round(quantity),
    ...(newCost != null && { p_new_cost: newCost }),
    p_note: note,
  })
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true, data: data as number, message: `Stock updated — now ${data}` }
}

export async function adjustStock(variantId: string, delta: number, reason: Enums<'stock_reason'>, note: string): Promise<ActionResult<number>> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('adjust_stock', { p_variant: variantId, p_delta: Math.round(delta), p_reason: reason, p_note: note })
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true, data: data as number, message: `Adjusted — now ${data}` }
}

export async function stockHistory(variantId: string) {
  await requireStaff('manager')
  const supabase = await createClient()
  const { data } = await supabase
    .from('stock_adjustments')
    .select('id, quantity_delta, quantity_after, reason, note, new_cost_price, created_at, order_id, orders(order_number), profiles:adjusted_by(full_name)')
    .eq('variant_id', variantId)
    .order('created_at', { ascending: false })
    .limit(100)
  return data ?? []
}
