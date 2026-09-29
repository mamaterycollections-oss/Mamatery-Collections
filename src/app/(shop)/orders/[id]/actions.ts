'use server'

import { verifyOrderToken } from '@/lib/orders'
import { startCardPayment, startMpesaPayment } from '@/lib/payments'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { friendlyError } from '@/lib/utils'
import { revalidatePath } from 'next/cache'

export async function resendMpesa(orderId: string, token: string, phone: string) {
  if (!(await rateLimit('mpesa-retry', 6, 600))) return { error: 'Too many attempts. Please wait a few minutes.' }
  const order = await verifyOrderToken(orderId, token)
  if (!order) return { error: 'Order not found' }
  try {
    const r = await startMpesaPayment(orderId, phone)
    return { ok: true, message: r.message }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not send the prompt' }
  }
}

export async function payByCard(orderId: string, token: string, email: string) {
  const order = await verifyOrderToken(orderId, token)
  if (!order) return { error: 'Order not found' }
  try {
    return { url: await startCardPayment(orderId, email) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start card payment' }
  }
}

export async function cancelMyOrder(orderId: string) {
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_my_order', { p_order: orderId })
  if (error) return { error: friendlyError(error) }
  revalidatePath(`/orders/${orderId}`)
  return { ok: true }
}
