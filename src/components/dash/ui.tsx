import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import type { Enums } from '@/lib/supabase/database.types'
import { cn, ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from '@/lib/utils'

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-block text-xs font-bold text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="font-display text-3xl tracking-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({ label, value, sub, Icon, tone = 'default', href }: { label: string; value: React.ReactNode; sub?: React.ReactNode; Icon?: LucideIcon; tone?: 'default' | 'warning' | 'danger' | 'success'; href?: string }) {
  const body = (
    <div className={cn('h-full rounded-2xl border bg-white p-5 transition', href && 'hover:border-stone hover:shadow-soft', tone === 'warning' ? 'border-warning/30' : tone === 'danger' ? 'border-danger/30' : 'border-line')}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold tracking-wide text-muted uppercase">{label}</p>
        {Icon && (
          <span className={cn('grid size-8 place-items-center rounded-xl', tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'danger' ? 'bg-danger-soft text-danger' : tone === 'success' ? 'bg-success-soft text-success' : 'bg-sand text-ink')}>
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <p className="mt-2 text-xl font-extrabold tracking-tight whitespace-nowrap tabular-nums sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  )
  return href ? <Link href={href} className="block h-full">{body}</Link> : body
}

const STATUS_TONE: Record<Enums<'order_status'>, string> = {
  placed: 'bg-info-soft text-info',
  confirmed: 'bg-clay-soft text-clay-dark',
  packed: 'bg-warning-soft text-warning',
  out_for_delivery: 'bg-[#efe6fb] text-[#5b3796]',
  ready_for_pickup: 'bg-[#efe6fb] text-[#5b3796]',
  delivered: 'bg-success-soft text-success',
  collected: 'bg-success-soft text-success',
  returned: 'bg-sand text-muted',
  cancelled: 'bg-danger-soft text-danger',
}
export function StatusBadge({ status }: { status: Enums<'order_status'> }) {
  return <span className={cn('chip', STATUS_TONE[status])}>{ORDER_STATUS_LABEL[status]}</span>
}
const PAY_TONE: Record<Enums<'payment_status'>, string> = {
  unpaid: 'bg-sand text-muted',
  pending: 'bg-warning-soft text-warning',
  paid: 'bg-success-soft text-success',
  failed: 'bg-danger-soft text-danger',
  refunded: 'bg-sand text-muted',
}
export function PaymentBadge({ status }: { status: Enums<'payment_status'> }) {
  return <span className={cn('chip', PAY_TONE[status])}>{PAYMENT_STATUS_LABEL[status]}</span>
}

export function StockBadge({ qty, threshold }: { qty: number; threshold: number }) {
  if (qty <= 0) return <span className="chip bg-danger-soft text-danger">Sold out</span>
  if (qty <= threshold) return <span className="chip bg-warning-soft text-warning">Low · {qty}</span>
  return <span className="chip bg-success-soft text-success">{qty} in stock</span>
}

export function Panel({ title, action, children, className, padded = true }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; padded?: boolean }) {
  return (
    <section className={cn('overflow-hidden rounded-2xl border border-line bg-white', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          {title && <h2 className="font-bold">{title}</h2>}
          {action}
        </div>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function EmptyState({ Icon, title, body, action }: { Icon: LucideIcon; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-sand"><Icon className="size-6 text-muted" /></span>
      <p className="mt-4 font-bold">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: string; href: string; count?: number | null }[]; active: string }) {
  return (
    <div className="-mx-4 mb-5 flex gap-1 overflow-x-auto border-b border-line px-4 no-scrollbar sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          scroll={false}
          className={cn('relative flex shrink-0 items-center gap-2 px-3 py-2.5 text-sm font-bold transition', active === t.key ? 'text-ink' : 'text-muted hover:text-ink')}
        >
          {t.label}
          {t.count != null && t.count > 0 && <span className={cn('rounded-full px-1.5 text-[0.65rem]', active === t.key ? 'bg-ink text-white' : 'bg-sand')}>{t.count}</span>}
          {active === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-clay" />}
        </Link>
      ))}
    </div>
  )
}

export function RangePicker({ basePath, active, extra = {} }: { basePath: string; active: string; extra?: Record<string, string> }) {
  const presets = [
    ['today', 'Today'],
    ['7d', '7 days'],
    ['30d', '30 days'],
    ['month', 'This month'],
    ['90d', '90 days'],
    ['year', '12 months'],
  ]
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-full border border-line bg-white p-1">
      {presets.map(([key, label]) => {
        const q = new URLSearchParams({ ...extra, range: key })
        return (
          <Link key={key} href={`${basePath}?${q}`} scroll={false} className={cn('rounded-full px-3 py-1.5 text-xs font-bold transition', active === key ? 'bg-ink text-white' : 'text-muted hover:text-ink')}>
            {label}
          </Link>
        )
      })}
    </div>
  )
}

export function Money({ value, className }: { value: number | string | null | undefined; className?: string }) {
  const n = value == null ? null : Number(value)
  return <span className={cn('tabular-nums', className)}>{n == null ? '—' : `KSh ${Math.round(n).toLocaleString('en-KE')}`}</span>
}
