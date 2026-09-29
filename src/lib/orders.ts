import 'server-only'
import { getSession, permissionsFor } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const ORDER_DETAIL =
  '*, order_items(id, product_name, variant_label, sku, image_url, quantity, unit_price, line_total, product_id), order_status_history(status, note, created_at), payments(id, method, status, amount, mpesa_receipt, reference, paid_at, created_at)'

// Loads an order for the customer view. Allowed with the secret tracking token
// (guest links from SMS/email), for the customer who owns it, or for staff.
export async function loadOrderForViewer(id: string, token?: string | null) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const admin = createAdminClient()
  const { data: order } = await admin.from('orders').select(ORDER_DETAIL).eq('id', id).maybeSingle()
  if (!order) return null
  if (token && token === order.tracking_token) return order
  const session = await getSession()
  if (session && (order.customer_id === session.id || permissionsFor(session).staff)) return order
  return null
}

export async function verifyOrderToken(id: string, token: string | null) {
  if (!token || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await createAdminClient().from('orders').select('id, status, payment_status, payment_method, tracking_token').eq('id', id).maybeSingle()
  return data && data.tracking_token === token ? data : null
}
