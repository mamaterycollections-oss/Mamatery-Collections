'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { alertStaff, notifyCustomerOrder } from '@/lib/notify'
import { startCardPayment, startMpesaPayment } from '@/lib/payments'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { TablesUpdate } from '@/lib/supabase/database.types'
import { friendlyError, normalizeKePhone } from '@/lib/utils'

// Current price/stock for the bag (the bag in the browser is only a hint).
export async function refreshCart(variantIds: string[]) {
  const ids = z.array(z.uuid()).max(60).safeParse(variantIds)
  if (!ids.success || !ids.data.length) return []
  const { data } = await createAdminClient()
    .from('product_variants')
    .select('id, selling_price, quantity_on_hand, is_active, products(is_active)')
    .in('id', ids.data)
  return (data ?? []).map((v) => ({
    id: v.id,
    price: Number(v.selling_price),
    available: v.is_active && Boolean(v.products?.is_active) ? v.quantity_on_hand : 0,
  }))
}

export async function previewCoupon(code: string, subtotal: number) {
  const clean = code.trim().toUpperCase().slice(0, 40)
  if (!clean) return { error: 'Enter a code' }
  if (!(await rateLimit('coupon', 20, 600))) return { error: 'Too many attempts. Try again shortly.' }
  const { data, error } = await createAdminClient().rpc('coupon_discount', { p_code: clean, p_subtotal: Math.max(0, subtotal) })
  if (error) return { error: friendlyError(error, 'That code isn’t valid') }
  return { code: clean, discount: Number(data) }
}

const orderSchema = z
  .object({
    items: z.array(z.object({ variant_id: z.uuid(), quantity: z.number().int().min(1).max(99) })).min(1, 'Your bag is empty').max(60),
    name: z.string().trim().min(2, 'Enter your name').max(120),
    phone: z.string().trim(),
    email: z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email or leave it blank')]),
    method: z.enum(['courier', 'pickup']),
    zone: z.string().optional(),
    address: z.string().trim().max(300).optional(),
    notes: z.string().trim().max(500).optional(),
    payment: z.enum(['mpesa', 'card', 'cod']),
    mpesaPhone: z.string().trim().optional(),
    coupon: z.string().trim().max(40).optional(),
    saveAddress: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (!normalizeKePhone(v.phone)) ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' })
    if (v.method === 'courier' && !v.zone) ctx.addIssue({ code: 'custom', path: ['zone'], message: 'Choose your delivery area' })
    if (v.method === 'courier' && (v.address ?? '').length < 5) ctx.addIssue({ code: 'custom', path: ['address'], message: 'Enter your delivery address' })
    if (v.payment === 'mpesa' && !normalizeKePhone(v.mpesaPhone || v.phone)) ctx.addIssue({ code: 'custom', path: ['mpesaPhone'], message: 'Enter the M-Pesa number to charge' })
    if (v.payment === 'card' && !v.email) ctx.addIssue({ code: 'custom', path: ['email'], message: 'Card payments need an email address for the receipt' })
  })

export type PlaceOrderInput = z.input<typeof orderSchema>
export type PlaceOrderResult =
  | { error: string; field?: string }
  | { orderId: string; token: string; redirectUrl?: string; paymentError?: string }

export async function placeOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const parsed = orderSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { error: issue.message, field: String(issue.path[0] ?? '') }
  }
  const v = parsed.data
  if (!(await rateLimit('checkout', 8, 600))) return { error: 'Too many orders from this network. Please wait a few minutes.' }

  const session = await getSession()
  const phone = normalizeKePhone(v.phone)!
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('place_order', {
    p_customer: session?.id ?? (null as unknown as string),
    p_items: v.items,
    p_contact_name: v.name,
    p_contact_phone: phone,
    p_contact_email: v.email ?? '',
    p_delivery_method: v.method,
    p_zone: v.method === 'courier' ? v.zone! : (null as unknown as string),
    p_address: v.address ?? '',
    p_notes: v.notes ?? '',
    p_payment: v.payment,
    p_coupon: v.coupon ?? '',
  })
  if (error) return { error: friendlyError(error, 'We couldn’t place your order. Please try again.') }
  const order = data as { id: string; tracking_token: string }

  // Remember details for next time (signed-in customers).
  if (session) {
    const supabase = await createClient()
    const updates: TablesUpdate<'profiles'> = { preferred_payment: v.payment }
    if (!session.phone) updates.phone = phone
    if (!session.full_name) updates.full_name = v.name
    await supabase.from('profiles').update(updates).eq('id', session.id)
    if (v.saveAddress && v.method === 'courier') {
      const { count } = await supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('user_id', session.id)
      await supabase.from('customer_addresses').insert({
        user_id: session.id, recipient_name: v.name, phone, zone_id: v.zone, address_line: v.address!, landmark: v.notes || null, is_default: !count,
      })
    }
  }

  const result = { orderId: order.id, token: order.tracking_token }
  if (v.payment === 'cod') {
    notifyCustomerOrder(order.id, 'placed')
    alertStaff(['owner', 'sales_manager'], 'New cash-on-delivery order', `${v.name} · ${v.method === 'courier' ? 'delivery' : 'pickup'} — confirm by phone`, `/dashboard/orders/${order.id}`, true)
    return result
  }
  try {
    if (v.payment === 'mpesa') {
      await startMpesaPayment(order.id, v.mpesaPhone || phone)
      return result
    }
    const url = await startCardPayment(order.id, v.email!)
    return { ...result, redirectUrl: url }
  } catch (e) {
    return { ...result, paymentError: e instanceof Error ? e.message : 'Payment could not be started' }
  }
}
