import Link from 'next/link'
import { AlertTriangle, Bell, CreditCard, PackageX, ShoppingBag, Star, Wallet } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, timeAgo } from '@/lib/utils'
import { MarkAllRead, PushToggle } from './notification-controls'

export const metadata = { title: 'Notifications' }

const ICON = { new_order: ShoppingBag, payment_received: CreditCard, low_stock: PackageX, order_needs_action: AlertTriangle, new_review: Star, cash_discrepancy: Wallet, order_update: ShoppingBag, system: Bell }

export default async function NotificationsPage() {
  const { session } = await requireStaff('staff')
  const supabase = await createClient()
  const { data } = await supabase.from('notifications').select('*').eq('user_id', session.id).order('created_at', { ascending: false }).limit(100)
  const unread = (data ?? []).filter((n) => !n.read_at).length
  return (
    <>
      <PageHeader title="Notifications" description={`${unread} unread`} actions={<><PushToggle />{unread > 0 && <MarkAllRead />}</>} />
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {!data?.length ? (
          <EmptyState Icon={Bell} title="You’re all caught up" />
        ) : (
          <ul className="divide-y divide-line">
            {data.map((n) => {
              const Icon = ICON[n.type] ?? Bell
              const body = (
                <div className={cn('flex gap-4 px-5 py-4 transition hover:bg-paper', !n.read_at && 'bg-clay-soft/40')}>
                  <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', n.type === 'cash_discrepancy' || n.type === 'low_stock' ? 'bg-warning-soft text-warning' : 'bg-sand')}><Icon className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.title}{!n.read_at && <span className="ml-2 inline-block size-2 rounded-full bg-clay align-middle" />}</p>
                    <p className="text-sm text-muted">{n.message}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(n.created_at)}</span>
                </div>
              )
              return <li key={n.id}>{n.link ? <Link href={`/dashboard/notifications/${n.id}`}>{body}</Link> : body}</li>
            })}
          </ul>
        )}
      </div>
    </>
  )
}
