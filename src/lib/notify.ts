import 'server-only'
import { after } from 'next/server'
import webpush from 'web-push'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/lib/supabase/database.types'
import { formatKes, ORDER_STATUS_LABEL } from '@/lib/utils'

const BRAND = 'MamaTerryCollections'
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// ---------------------------------------------------------------------------
// Channels. Each is a logged no-op until its keys are configured.
// ---------------------------------------------------------------------------
export async function sendEmail(to: string | null | undefined, subject: string, text: string, link?: string | null, cta = 'View order') {
  const key = process.env.RESEND_API_KEY
  if (!to) return
  if (!key) {
    if (process.env.NODE_ENV !== 'production') console.info(`[email skipped: no RESEND_API_KEY] ${to}: ${subject}`)
    return
  }
  const url = link ? (link.startsWith('http') ? link : `${siteUrl()}${link}`) : null
  const html = `<div style="background:#FBF8F3;padding:32px 16px;font-family:Arial,Helvetica,sans-serif">
    <div style="max-width:560px;margin:auto;background:#fff;border-radius:16px;padding:32px;color:#17130F">
      <p style="font-family:Georgia,serif;font-size:24px;margin:0 0 4px">MamaTerry<span style="color:#B4532A">Collections</span></p>
      <p style="font-size:11px;letter-spacing:3px;color:#7A6F63;margin:0 0 24px">STYLE THAT SPEAKS FOR YOU</p>
      <p style="font-size:15px;line-height:1.65;margin:0 0 20px">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
      ${url ? `<p style="margin:0 0 8px"><a href="${url}" style="display:inline-block;background:#17130F;color:#fff;padding:13px 24px;border-radius:999px;text-decoration:none;font-weight:bold;font-size:14px">${escapeHtml(cta)}</a></p>` : ''}
    </div>
    <p style="text-align:center;font-size:12px;color:#7A6F63;margin-top:16px">${BRAND} · Kenya</p></div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`,
        to: [to],
        subject,
        text: url ? `${text}\n\n${url}` : text,
        html,
      }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text())
  } catch (e) {
    console.error('resend error', e)
  }
}

export async function sendSms(to: string | null | undefined, message: string) {
  const username = process.env.AFRICASTALKING_USERNAME
  const apiKey = process.env.AFRICASTALKING_API_KEY
  if (!to) return
  if (!username || !apiKey) {
    if (process.env.NODE_ENV !== 'production') console.info(`[sms skipped: no Africa's Talking keys] ${to}: ${message}`)
    return
  }
  const sandbox = username === 'sandbox'
  const body = new URLSearchParams({ username, to, message })
  if (process.env.AFRICASTALKING_SENDER_ID) body.set('from', process.env.AFRICASTALKING_SENDER_ID)
  try {
    const res = await fetch(`https://api.${sandbox ? 'sandbox.' : ''}africastalking.com/version1/messaging`, {
      method: 'POST',
      headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) console.error('africastalking failed', res.status, await res.text())
  } catch (e) {
    console.error('africastalking error', e)
  }
}

let vapidReady = false
function vapid() {
  if (vapidReady) return true
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:hello@example.com', pub, priv)
  vapidReady = true
  return true
}

// Web push to the PWA / Android app. Expired subscriptions are pruned.
export async function sendPush(userIds: string[], title: string, body: string, link?: string | null) {
  if (!userIds.length || !vapid()) return
  const admin = createAdminClient()
  const { data: subs } = await admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').in('user_id', userIds)
  const payload = JSON.stringify({ title, body, url: link ?? '/' })
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: 60 * 60 * 12 })
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) await admin.from('push_subscriptions').delete().eq('id', s.id)
        else console.error('web push error', status)
      }
    }),
  )
}

// ---------------------------------------------------------------------------
// Staff alerts: in-app rows are created by the database; this adds push + email.
// ---------------------------------------------------------------------------
export function alertStaff(roles: Enums<'app_role'>[], title: string, body: string, link: string, email = false) {
  after(async () => {
    const admin = createAdminClient()
    const { data: people } = await admin.from('profiles').select('id, email, role, staff(is_active)').in('role', roles)
    const active = (people ?? []).filter((p) => {
      const s = Array.isArray(p.staff) ? p.staff[0] : p.staff
      return p.role === 'owner' || s?.is_active
    })
    await sendPush(active.map((p) => p.id), title, body, link)
    if (email) await Promise.all(active.map((p) => sendEmail(p.email, title, body, link, 'Open dashboard')))
  })
}

// ---------------------------------------------------------------------------
// Customer order updates: in-app (if they have an account) + SMS + email + push.
// ---------------------------------------------------------------------------
const CUSTOMER_MESSAGE: Partial<Record<Enums<'order_status'>, string>> = {
  placed: 'We have received your order {n}. Total {t}. We will let you know when it is confirmed.',
  confirmed: 'Your order {n} is confirmed and being prepared.',
  packed: 'Your order {n} is packed.',
  out_for_delivery: 'Your order {n} is on its way! Keep your phone nearby for the rider.',
  ready_for_pickup: 'Your order {n} is ready for pickup.',
  delivered: 'Your order {n} has been delivered. Enjoy — and tell us what you think!',
  collected: 'Thank you for collecting your order {n}!',
  returned: 'Your return for order {n} has been received.',
  cancelled: 'Your order {n} has been cancelled.',
}

export function notifyCustomerOrder(orderId: string, status: Enums<'order_status'> | 'paid', extra?: string) {
  after(async () => {
    const admin = createAdminClient()
    const { data: o } = await admin
      .from('orders')
      .select('id, order_number, total, contact_phone, contact_email, customer_id, tracking_token, channel')
      .eq('id', orderId)
      .single()
    if (!o || o.channel === 'in_store') return
    const template =
      status === 'paid' ? 'Payment received for order {n} ({t}). Thank you!' : (CUSTOMER_MESSAGE[status] ?? 'Your order {n} was updated.')
    const message = template.replace('{n}', o.order_number).replace('{t}', formatKes(o.total)) + (extra ? ` ${extra}` : '')
    const link = `/orders/${o.id}?t=${o.tracking_token}`
    const title = status === 'paid' ? 'Payment received' : `Order ${ORDER_STATUS_LABEL[status]}`

    if (o.customer_id) {
      await admin.from('notifications').insert({ user_id: o.customer_id, type: 'order_update', title, message, link })
      await sendPush([o.customer_id], title, message, link)
    }
    await Promise.all([
      sendSms(o.contact_phone, `${BRAND}: ${message} Track: ${siteUrl()}/track`),
      sendEmail(o.contact_email, `${title} · ${o.order_number}`, message, link),
    ])
  })
}
