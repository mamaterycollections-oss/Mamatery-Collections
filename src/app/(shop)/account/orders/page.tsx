import { OrderList } from '@/components/shop/order-list'
import { requireUser } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function MyOrdersPage() {
  const session = await requireUser('/account/orders')
  const supabase = await createClient()
  const { data } = await supabase
    .from('orders')
    .select('id, order_number, status, payment_status, total, placed_at, tracking_token, order_items(image_url, quantity)')
    .eq('customer_id', session.id)
    .order('placed_at', { ascending: false })
    .limit(100)
  return (
    <>
      <h2 className="mb-4 font-display text-2xl">Your orders</h2>
      <OrderList orders={(data ?? []).map((o) => ({ ...o, total: Number(o.total) }))} />
    </>
  )
}
