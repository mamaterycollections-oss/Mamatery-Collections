import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight, Package } from 'lucide-react'
import type { Enums } from '@/lib/supabase/database.types'
import { cn, formatDate, formatKes, ORDER_STATUS_LABEL } from '@/lib/utils'

type Order = {
  id: string
  order_number: string
  status: Enums<'order_status'>
  payment_status: Enums<'payment_status'>
  total: number
  placed_at: string
  tracking_token: string
  order_items: { image_url: string | null; quantity: number }[]
}

export function OrderList({ orders }: { orders: Order[] }) {
  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-dashed border-stone p-10 text-center">
        <Package className="mx-auto size-8 text-muted" />
        <p className="mt-3 font-bold">No orders yet</p>
        <Link href="/shop" className="btn btn-primary mt-5">Start shopping</Link>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => {
        const done = ['delivered', 'collected'].includes(o.status)
        return (
          <li key={o.id}>
            <Link href={`/orders/${o.id}?t=${o.tracking_token}`} className="flex items-center gap-4 rounded-2xl border border-line bg-white p-4 transition hover:border-stone hover:shadow-soft">
              <div className="flex -space-x-3">
                {o.order_items.slice(0, 3).map((it, i) => (
                  <div key={i} className="relative size-12 overflow-hidden rounded-xl border-2 border-white bg-sand">{it.image_url && <Image src={it.image_url} alt="" fill sizes="48px" className="object-cover" />}</div>
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{o.order_number}</p>
                <p className="text-xs text-muted">{formatDate(o.placed_at)} · {o.order_items.reduce((s, i) => s + i.quantity, 0)} item(s) · {formatKes(o.total)}</p>
              </div>
              <span className={cn('chip', o.status === 'cancelled' ? 'bg-danger-soft text-danger' : done ? 'bg-success-soft text-success' : o.payment_status !== 'paid' && o.status === 'placed' ? 'bg-warning-soft text-warning' : 'bg-info-soft text-info')}>
                {o.status === 'placed' && o.payment_status !== 'paid' && o.payment_status !== 'unpaid' ? 'Awaiting payment' : ORDER_STATUS_LABEL[o.status]}
              </span>
              <ChevronRight className="size-4 text-muted" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
