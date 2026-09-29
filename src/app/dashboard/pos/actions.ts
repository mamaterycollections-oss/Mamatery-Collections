'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { refreshMpesaStatus, startMpesaPayment } from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, normalizeKePhone } from '@/lib/utils'

const saleSchema = z.object({
  items: z.array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(99) })).min(1, 'Scan at least one item'),
  payment: z.enum(['cash', 'mpesa', 'card']),
  discount: z.number().min(0),
  discountReason: z.string().trim().max(200),
  reference: z.string().trim().max(60),
  tendered: z.number().min(0).nullable(),
  customerName: z.string().trim().max(120),
  customerPhone: z.string().trim().max(20),
  stk: z.boolean(),
})
export type SaleInput = z.input<typeof saleSchema>
type SaleResult = { id: string; order_number: string; total: number; change: number | null; payment_status: string; stkMessage?: string }

export async function recordSale(input: SaleInput): Promise<ActionResult<SaleResult>> {
  await requireStaff('staff')
  const p = saleSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const v = p.data
  const phone = v.customerPhone ? normalizeKePhone(v.customerPhone) : null
  if (v.customerPhone && !phone) return { error: 'Customer phone number looks wrong' }
  if (v.stk && !phone) return { error: 'Enter the customer’s M-Pesa number to send a prompt' }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('record_in_store_sale', {
    p_items: v.items,
    p_payment: v.payment,
    p_discount: v.discount,
    p_discount_reason: v.discountReason,
    p_reference: v.reference,
    p_amount_tendered: v.tendered ?? (null as unknown as number),
    p_customer_name: v.customerName,
    p_customer_phone: phone ?? '',
    p_await_stk: v.stk,
  })
  if (error) return { error: friendlyError(error) }
  const sale = data as unknown as SaleResult
  revalidatePath('/dashboard/pos')
  if (v.stk && phone) {
    try {
      const r = await startMpesaPayment(sale.id, phone)
      return { ok: true, data: { ...sale, stkMessage: r.message } }
    } catch (e) {
      return { ok: true, data: { ...sale, stkMessage: e instanceof Error ? e.message : 'Prompt failed' } }
    }
  }
  return { ok: true, data: sale }
}

export async function checkSalePayment(orderId: string): Promise<ActionResult<{ payment_status: string }>> {
  await requireStaff('staff')
  const supabase = await createClient()
  const { data: order } = await supabase.from('orders').select('id, payment_status').eq('id', orderId).maybeSingle()
  if (!order) return { error: 'Sale not found' }
  if (order.payment_status !== 'paid') await refreshMpesaStatus(orderId).catch(() => undefined)
  const { data } = await supabase.from('orders').select('payment_status').eq('id', orderId).single()
  return { ok: true, data: { payment_status: data?.payment_status ?? order.payment_status } }
}

export async function openDrawer(float: number): Promise<ActionResult> {
  await requireStaff('staff')
  const supabase = await createClient()
  const { error } = await supabase.rpc('open_cash_session', { p_float: float })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/pos')
  revalidatePath('/dashboard/cash')
  return { ok: true, message: 'Cash drawer opened' }
}

export async function closeDrawer(sessionId: string, counted: number, notes: string): Promise<ActionResult<{ expected: number; counted: number; discrepancy: number }>> {
  await requireStaff('staff')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('close_cash_session', { p_session: sessionId, p_counted: counted, p_notes: notes })
  if (error) return { error: friendlyError(error) }
  revalidatePath('/dashboard/cash')
  revalidatePath('/dashboard/pos')
  return { ok: true, data: data as { expected: number; counted: number; discrepancy: number } }
}
