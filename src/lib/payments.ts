import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { alertStaff, notifyCustomerOrder } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { formatKes, normalizeKePhone } from '@/lib/utils'

// ===========================================================================
// M-Pesa Daraja — STK Push ("Lipa na M-Pesa Online")
//   MPESA_ENV = sandbox | production | simulate (simulate: local dev only)
// ===========================================================================
type MpesaMode = 'sandbox' | 'production' | 'simulate' | null

export function mpesaMode(): MpesaMode {
  const env = process.env.MPESA_ENV
  if (env === 'simulate') return process.env.NODE_ENV === 'production' && process.env.VERCEL_ENV === 'production' ? null : 'simulate'
  if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_SHORTCODE || !process.env.MPESA_PASSKEY) return null
  return env === 'production' ? 'production' : 'sandbox'
}

const darajaBase = () => (mpesaMode() === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke')

async function darajaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`)
  return ((await res.json()) as { access_token: string }).access_token
}

// Daraja wants East Africa Time as YYYYMMDDHHmmss.
function darajaTimestamp() {
  const eat = new Date(Date.now() + 3 * 3600 * 1000)
  return eat.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function darajaPassword(ts: string) {
  return Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64')
}

export function mpesaCallbackUrl() {
  const base = process.env.MPESA_CALLBACK_BASE_URL ?? siteUrl()
  return `${base}/api/payments/mpesa/callback?secret=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET ?? '')}`
}

async function stkPush(input: { phone: string; amount: number; reference: string; description: string }) {
  const mode = mpesaMode()
  if (!mode) throw new Error('M-Pesa is not set up yet. Please choose another payment method.')
  if (mode === 'simulate') return { checkoutRequestId: `ws_CO_SIM_${crypto.randomUUID()}`, message: 'Simulated prompt sent (test mode)' }

  const ts = darajaTimestamp()
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await darajaToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: darajaPassword(ts),
      Timestamp: ts,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE ?? 'CustomerPayBillOnline',
      Amount: Math.ceil(input.amount),
      PartyA: input.phone.replace(/^\+/, ''),
      PartyB: process.env.MPESA_PARTY_B ?? process.env.MPESA_SHORTCODE,
      PhoneNumber: input.phone.replace(/^\+/, ''),
      CallBackURL: mpesaCallbackUrl(),
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as { CheckoutRequestID?: string; CustomerMessage?: string; errorMessage?: string; ResponseCode?: string }
  if (!res.ok || body.ResponseCode !== '0' || !body.CheckoutRequestID) {
    throw new Error(body.errorMessage ?? body.CustomerMessage ?? `M-Pesa request failed (${res.status})`)
  }
  return { checkoutRequestId: body.CheckoutRequestID, message: body.CustomerMessage ?? 'Check your phone to complete payment' }
}

// Asks Safaricom for the result when the callback is slow or never arrives.
async function queryStk(checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string } | null> {
  const mode = mpesaMode()
  if (!mode || mode === 'simulate') return null
  const ts = darajaTimestamp()
  const res = await fetch(`${darajaBase()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await darajaToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: process.env.MPESA_SHORTCODE, Password: darajaPassword(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as { ResultCode?: string; ResultDesc?: string }
  if (body.ResultCode == null) return null // still processing
  return { resultCode: Number(body.ResultCode), resultDesc: body.ResultDesc ?? '' }
}

export async function startMpesaPayment(orderId: string, rawPhone: string) {
  const phone = normalizeKePhone(rawPhone)
  if (!phone) throw new Error('Enter a valid Safaricom number, e.g. 0712 345 678')
  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select('id, order_number, total, status, payment_status').eq('id', orderId).single()
  if (!order) throw new Error('Order not found')
  if (order.payment_status === 'paid') throw new Error('This order is already paid')
  if (order.status === 'cancelled') throw new Error('This order has expired. Please place it again.')

  // Don't fire a second prompt while one is still waiting on the phone.
  const { data: waiting } = await admin
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .eq('method', 'mpesa')
    .gte('created_at', new Date(Date.now() - 60_000).toISOString())
    .limit(1)
  if (waiting?.length) throw new Error('A payment prompt was just sent. Check your phone, or try again in a minute.')

  const push = await stkPush({ phone, amount: Number(order.total), reference: order.order_number, description: 'MamaTerry' })
  const { error } = await admin.from('payments').insert({
    order_id: orderId,
    amount: Math.ceil(Number(order.total)),
    method: 'mpesa',
    status: 'pending',
    payer_phone: phone,
    mpesa_checkout_request_id: push.checkoutRequestId,
  })
  if (error) throw new Error('Could not start the payment. Please try again.')
  await admin.from('orders').update({ payment_status: 'pending' }).eq('id', orderId).neq('payment_status', 'paid')
  return { message: push.message, simulated: mpesaMode() === 'simulate' }
}

// Applies an M-Pesa result (callback, STK query or simulation). Idempotent.
export async function settleMpesa(input: { checkoutRequestId: string; resultCode: number; resultDesc?: string; receipt?: string | null; amount?: number | null; raw?: Json }) {
  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('payments')
    .select('id, order_id, amount, status')
    .eq('mpesa_checkout_request_id', input.checkoutRequestId)
    .maybeSingle()
  if (!payment) return { ok: false, reason: 'unknown checkout request' }
  if (payment.status === 'paid' || payment.status === 'failed') return { ok: true, reason: 'already settled' }

  if (input.resultCode === 0) {
    if (input.amount != null && Math.round(input.amount) < Math.round(Number(payment.amount))) {
      await admin.rpc('fail_payment', { p_payment: payment.id, p_raw: (input.raw ?? { reason: 'amount mismatch' }) as Json })
      return { ok: false, reason: 'amount mismatch' }
    }
    await afterPaid(payment.id, input.receipt ?? null, input.raw ?? null)
  } else {
    await admin.rpc('fail_payment', { p_payment: payment.id, p_raw: (input.raw ?? { ResultDesc: input.resultDesc ?? '' }) as Json })
  }
  return { ok: true }
}

// Called while the customer watches the "check your phone" screen.
export async function refreshMpesaStatus(orderId: string) {
  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('payments')
    .select('id, mpesa_checkout_request_id, created_at')
    .eq('order_id', orderId)
    .eq('status', 'pending')
    .eq('method', 'mpesa')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!pending?.mpesa_checkout_request_id) return
  const age = Date.now() - new Date(pending.created_at).getTime()

  if (pending.mpesa_checkout_request_id.startsWith('ws_CO_SIM_')) {
    if (mpesaMode() === 'simulate' && age > 6000) {
      await settleMpesa({ checkoutRequestId: pending.mpesa_checkout_request_id, resultCode: 0, receipt: `SIM${Date.now().toString(36).toUpperCase()}` })
    }
    return
  }
  // Give the callback a head start before asking Safaricom directly.
  if (age < 20_000) return
  const result = await queryStk(pending.mpesa_checkout_request_id).catch(() => null)
  if (result) await settleMpesa({ checkoutRequestId: pending.mpesa_checkout_request_id, resultCode: result.resultCode, resultDesc: result.resultDesc })
}

// ===========================================================================
// Paystack — card payments (KES)
// ===========================================================================
export const paystackEnabled = () => Boolean(process.env.PAYSTACK_SECRET_KEY)

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  const body = (await res.json()) as { status: boolean; message: string; data: T }
  if (!res.ok || !body.status) throw new Error(body.message || `Paystack error ${res.status}`)
  return body.data
}

export function verifyPaystackSignature(raw: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false
  const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function startCardPayment(orderId: string, email: string) {
  if (!paystackEnabled()) throw new Error('Card payments are not set up yet. Please pay with M-Pesa.')
  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select('id, total, status, payment_status, tracking_token').eq('id', orderId).single()
  if (!order) throw new Error('Order not found')
  if (order.payment_status === 'paid') throw new Error('This order is already paid')
  if (order.status === 'cancelled') throw new Error('This order has expired. Please place it again.')

  const reference = `mt_${orderId.slice(0, 8)}_${Date.now().toString(36)}`
  const { error } = await admin.from('payments').insert({
    order_id: orderId,
    amount: Math.ceil(Number(order.total)),
    method: 'card',
    status: 'pending',
    card_ref: reference,
  })
  if (error) throw new Error('Could not start the payment. Please try again.')

  const data = await paystack<{ authorization_url: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: Math.ceil(Number(order.total)) * 100, // lowest currency unit
      currency: 'KES',
      reference,
      callback_url: `${siteUrl()}/api/payments/paystack/return`,
      metadata: { order_id: orderId },
    }),
  })
  return data.authorization_url
}

// Verifies with Paystack (never trusts the redirect alone). Idempotent.
export async function settleCard(reference: string) {
  const admin = createAdminClient()
  const { data: payment } = await admin.from('payments').select('id, order_id, amount, status').eq('card_ref', reference).maybeSingle()
  if (!payment) return { ok: false as const, orderId: null }
  if (payment.status === 'paid') return { ok: true as const, orderId: payment.order_id }

  const tx = await paystack<{ status: string; amount: number; currency: string }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  if (tx.status === 'success' && tx.currency === 'KES' && tx.amount >= Math.round(Number(payment.amount) * 100)) {
    await afterPaid(payment.id, reference, tx as unknown as Json)
    return { ok: true as const, orderId: payment.order_id }
  }
  if (tx.status === 'failed' || tx.status === 'abandoned') {
    await admin.rpc('fail_payment', { p_payment: payment.id, p_raw: tx as unknown as Json })
  }
  return { ok: false as const, orderId: payment.order_id }
}

async function afterPaid(paymentId: string, receipt: string | null, raw: Json | null) {
  const admin = createAdminClient()
  const { data, error } = await admin.rpc('settle_payment', { p_payment: paymentId, p_receipt: receipt ?? '', p_raw: raw ?? {} })
  if (error) throw new Error(error.message)
  const result = data as { order_id: string; already: boolean }
  if (result.already) return
  const { data: o } = await admin.from('orders').select('id, order_number, total, channel').eq('id', result.order_id).single()
  if (!o) return
  notifyCustomerOrder(o.id, 'paid')
  if (o.channel === 'online') {
    alertStaff(['owner', 'sales_manager'], `New order ${o.order_number}`, `Paid ${formatKes(o.total)} — ready to confirm`, `/dashboard/orders/${o.id}`, true)
  }
}
