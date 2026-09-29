'use server'

import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { notifyCustomerOrder } from '@/lib/notify'
import { startMpesaPayment } from '@/lib/payments'
import type { Enums } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'

const done = (id: string): ActionResult => {
  revalidatePath(`/dashboard/orders/${id}`)
  revalidatePath('/dashboard/orders')
  return { ok: true }
}

export async function updateOrderStatus(orderId: string, status: Enums<'order_status'>, note = ''): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.rpc('update_order_status', { p_order: orderId, p_status: status, p_note: note })
  if (error) return { error: friendlyError(error) }
  notifyCustomerOrder(orderId, status, status === 'cancelled' || status === 'returned' ? note : undefined)
  return done(orderId)
}

export async function markOrderPaid(orderId: string, method: Enums<'payment_method'>, reference: string): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.rpc('mark_order_paid', { p_order: orderId, p_method: method, p_reference: reference })
  if (error) return { error: friendlyError(error) }
  notifyCustomerOrder(orderId, 'paid')
  return done(orderId)
}

export async function refundOrder(orderId: string, reason: string): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.rpc('refund_order', { p_order: orderId, p_reason: reason })
  if (error) return { error: friendlyError(error) }
  return done(orderId)
}

export async function applyDiscount(orderId: string, amount: number, reason: string): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.rpc('apply_order_discount', { p_order: orderId, p_amount: amount, p_reason: reason })
  if (error) return { error: friendlyError(error) }
  return done(orderId)
}

// Staff can re-send an M-Pesa prompt to the customer's phone (online or in-store).
export async function sendMpesaPrompt(orderId: string, phone: string): Promise<ActionResult> {
  await requireStaff('staff')
  const supabase = await createClient()
  // RLS: staff only see orders they may handle.
  const { data } = await supabase.from('orders').select('id').eq('id', orderId).maybeSingle()
  if (!data) return { error: 'Order not found' }
  try {
    const r = await startMpesaPayment(orderId, phone)
    return { ok: true, message: r.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send the prompt' }
  }
}
