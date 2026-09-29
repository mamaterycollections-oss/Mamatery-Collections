'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'

export async function startCount(title: string, categoryId: string | null): Promise<ActionResult<string>> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('start_stock_count', { p_title: title, ...(categoryId && { p_category: categoryId }) })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/stock-take')
  return { ok: true, data: data as string }
}

// Scan: find the variant by barcode/SKU and add one to its count.
export async function countScan(countId: string, code: string, quantity = 1, increment = true): Promise<ActionResult<{ variantId: string; counted: number; name: string }>> {
  await requireStaff('manager')
  const supabase = await createClient()
  const clean = code.trim().replace(/[^0-9A-Za-z-]/g, '')
  const { data: v } = await supabase.from('product_variants').select('id, size, colour, products(name)').or(`barcode_value.eq.${clean},sku.ilike.${clean},id.eq.${/^[0-9a-f-]{36}$/.test(clean) ? clean : '00000000-0000-0000-0000-000000000000'}`).limit(1).maybeSingle()
  if (!v) return { error: `No item with code ${code}` }
  const { data, error } = await supabase.rpc('record_stock_count', { p_count: countId, p_variant: v.id, p_quantity: quantity, p_increment: increment })
  if (error) return { error: friendlyError(error) }
  return { ok: true, data: { variantId: v.id, counted: data as number, name: `${v.products?.name ?? ''} ${[v.size, v.colour].filter(Boolean).join(' / ')}` } }
}

export async function completeCount(countId: string, zeroUncounted: boolean): Promise<ActionResult<number>> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('complete_stock_count', { p_count: countId, p_zero_uncounted: zeroUncounted })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/stock-take')
  revalidatePath('/dashboard/inventory')
  revalidatePath('/', 'layout')
  return { ok: true, data: data as number, message: `Stock count applied — ${data} item(s) corrected` }
}

export async function cancelCount(countId: string): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_stock_count', { p_count: countId })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/stock-take')
  return { ok: true, message: 'Stock count cancelled' }
}
