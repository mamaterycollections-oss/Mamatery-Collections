import Link from 'next/link'
import { ArrowRight, Heart, MapPin, Package } from 'lucide-react'
import { OrderList } from '@/components/shop/order-list'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const session = await requireUser('/account')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: orders, count }, { count: addresses }] = await Promise.all([
    supabase.from('orders').select('id, order_number, status, payment_status, total, placed_at, tracking_token, order_items(image_url, quantity)', { count: 'exact' }).eq('customer_id', session.id).order('placed_at', { ascending: false }).limit(3),
    supabase.from('customer_addresses').select('id', { count: 'exact', head: true }).eq('user_id', session.id),
  ])
  return (
    <div className="space-y-8">
      {sp.password === 'updated' && <p className="rounded-2xl bg-success-soft p-4 text-sm font-semibold text-success">Your password has been updated.</p>}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { href: '/account/orders', Icon: Package, label: 'Orders', value: count ?? 0 },
          { href: '/account/addresses', Icon: MapPin, label: 'Saved addresses', value: addresses ?? 0 },
          { href: '/wishlist', Icon: Heart, label: 'Wishlist', value: '♡' },
        ].map(({ href, Icon, label, value }) => (
          <Link key={href} href={href} className="group rounded-2xl border border-line bg-white p-5 transition hover:shadow-soft">
            <Icon className="size-5 text-clay" />
            <p className="mt-3 text-2xl font-extrabold">{value}</p>
            <p className="flex items-center justify-between text-sm text-muted">{label} <ArrowRight className="size-4 transition group-hover:translate-x-1" /></p>
          </Link>
        ))}
      </div>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl">Recent orders</h2>
          {(count ?? 0) > 3 && <Link href="/account/orders" className="text-sm font-bold underline">See all</Link>}
        </div>
        <OrderList orders={(orders ?? []).map((o) => ({ ...o, total: Number(o.total) }))} />
      </section>
      <section className="rounded-3xl bg-sand p-6">
        <h2 className="font-bold">Your details</h2>
        <p className="mt-2 text-sm text-muted">{session.full_name} · {session.email}{session.phone ? ` · ${session.phone}` : ''}</p>
        <Link href="/account/settings" className="btn btn-light btn-sm mt-4">Edit details</Link>
      </section>
    </div>
  )
}
