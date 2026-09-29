import type { Enums } from '@/lib/supabase/database.types'

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

const kes = new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 })
export function formatKes(amount: number | string | null | undefined) {
  if (amount == null || amount === '') return '—'
  return kes.format(Number(amount)).replace(/ /g, ' ')
}

export function formatNumber(n: number | null | undefined, digits = 0) {
  if (n == null) return '—'
  return new Intl.NumberFormat('en-KE', { maximumFractionDigits: digits }).format(n)
}

// Only allow same-site relative redirects (prevents open redirects via ?next=).
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = '/') {
  const value = typeof next === 'string' ? next : ''
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70)
}

const TZ = 'Africa/Nairobi'
export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-KE', { timeZone: TZ, ...opts })
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-KE', { timeZone: TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function timeAgo(value: string | Date) {
  const s = Math.round((Date.now() - new Date(value).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return formatDate(value)
}

// Normalises Kenyan numbers to +2547XXXXXXXX / +2541XXXXXXXX. Returns null if invalid.
export function normalizeKePhone(value: string | null | undefined) {
  const v = String(value ?? '').replace(/[\s()-]/g, '')
  const m = v.match(/^(?:\+?254|0)?([17]\d{8})$/)
  return m ? `+254${m[1]}` : null
}

export function variantLabel(size?: string | null, colour?: string | null) {
  return [size, colour].filter(Boolean).join(' / ')
}

export type StockState = 'in' | 'low' | 'out'
export function stockState(qty: number, threshold: number): StockState {
  if (qty <= 0) return 'out'
  if (qty <= threshold) return 'low'
  return 'in'
}
export const STOCK_LABEL: Record<StockState, string> = { in: 'In stock', low: 'Low stock', out: 'Sold out' }

export const ORDER_STATUS_LABEL: Record<Enums<'order_status'>, string> = {
  placed: 'Placed',
  confirmed: 'Confirmed',
  packed: 'Packed',
  out_for_delivery: 'Out for delivery',
  ready_for_pickup: 'Ready for pickup',
  delivered: 'Delivered',
  collected: 'Collected',
  returned: 'Returned',
  cancelled: 'Cancelled',
}

export const PAYMENT_METHOD_LABEL: Record<Enums<'payment_method'>, string> = {
  mpesa: 'M-Pesa',
  card: 'Card',
  cod: 'Cash on delivery',
  cash: 'Cash',
}

export const PAYMENT_STATUS_LABEL: Record<Enums<'payment_status'>, string> = {
  unpaid: 'Unpaid',
  pending: 'Awaiting payment',
  paid: 'Paid',
  failed: 'Payment failed',
  refunded: 'Refunded',
}

export const ROLE_LABEL: Record<Enums<'app_role'>, string> = {
  owner: 'Owner',
  sales_manager: 'Sales manager',
  sales_attendant: 'Sales attendant',
  customer: 'Customer',
}

export const STOCK_REASON_LABEL: Record<Enums<'stock_reason'>, string> = {
  initial: 'Opening stock',
  restock: 'Restock',
  sale: 'Sale',
  return: 'Return',
  void: 'Cancelled order',
  damage: 'Damaged',
  loss: 'Lost / stolen',
  correction: 'Correction',
  stock_take: 'Stock count',
}

// Postgres errors raised by our functions arrive as plain messages; keep them,
// but hide anything that looks like an internal/database error.
export function friendlyError(error: { message?: string } | null | undefined, fallback = 'Something went wrong. Please try again.') {
  const msg = error?.message ?? ''
  if (!msg || /violates|syntax|relation|column|function|permission denied|JWT|duplicate key|PGRST|null value/i.test(msg)) return fallback
  return msg
}

// Date range helpers for reports (Nairobi calendar days).
export function dayStart(date: Date) {
  const d = new Date(date.toLocaleString('en-US', { timeZone: TZ }))
  const offset = date.getTime() - d.getTime()
  d.setHours(0, 0, 0, 0)
  return new Date(d.getTime() + offset)
}

export function rangeFromPreset(preset: string | undefined, from?: string, to?: string) {
  const now = new Date()
  const today = dayStart(now)
  const day = 86400000
  if (from && to) {
    const f = dayStart(new Date(`${from}T12:00:00+03:00`))
    const t = new Date(dayStart(new Date(`${to}T12:00:00+03:00`)).getTime() + day)
    return { from: f, to: t, label: `${formatDate(f)} – ${formatDate(new Date(t.getTime() - day))}`, preset: 'custom' }
  }
  switch (preset) {
    case 'today':
      return { from: today, to: new Date(today.getTime() + day), label: 'Today', preset }
    case '7d':
      return { from: new Date(today.getTime() - 6 * day), to: new Date(today.getTime() + day), label: 'Last 7 days', preset }
    case 'month': {
      const d = new Date(now.toLocaleString('en-US', { timeZone: TZ }))
      const first = dayStart(new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01T12:00:00+03:00`))
      return { from: first, to: new Date(today.getTime() + day), label: 'This month', preset }
    }
    case '90d':
      return { from: new Date(today.getTime() - 89 * day), to: new Date(today.getTime() + day), label: 'Last 90 days', preset }
    case 'year':
      return { from: new Date(today.getTime() - 364 * day), to: new Date(today.getTime() + day), label: 'Last 12 months', preset }
    default:
      return { from: new Date(today.getTime() - 29 * day), to: new Date(today.getTime() + day), label: 'Last 30 days', preset: '30d' }
  }
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return ''
  const headers = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n')
}

// Search text safe to embed in PostgREST filters (strips filter syntax characters).
export const cleanQuery = (q: string) => q.replace(/[%,()*\\{}"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
