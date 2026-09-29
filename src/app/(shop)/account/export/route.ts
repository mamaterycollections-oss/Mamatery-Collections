import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// "Download my data" (Kenya Data Protection Act right of access).
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'sign in first' }, { status: 401 })
  const supabase = await createClient()
  const [profile, addresses, orders, reviews, wishlist] = await Promise.all([
    supabase.from('profiles').select('full_name, email, phone, marketing_opt_in, created_at').eq('id', session.id).single(),
    supabase.from('customer_addresses').select('label, recipient_name, phone, address_line, landmark, created_at').eq('user_id', session.id),
    supabase.from('orders').select('order_number, status, payment_method, payment_status, total, placed_at, delivery_address, order_items(product_name, variant_label, quantity, unit_price)').eq('customer_id', session.id),
    supabase.from('reviews').select('rating, title, comment, status, created_at, products(name)').eq('user_id', session.id),
    supabase.from('wishlist_items').select('created_at, products(name)').eq('user_id', session.id),
  ])
  const body = JSON.stringify({ exported_at: new Date().toISOString(), profile: profile.data, addresses: addresses.data, orders: orders.data, reviews: reviews.data, wishlist: wishlist.data }, null, 2)
  return new NextResponse(body, {
    headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="mamaterry-my-data.json"' },
  })
}
