// Security test: signs in as each role and checks row-level security.
//   npm run test:rls        (needs demo accounts from `npm run seed`)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

config({ path: '.env.local', quiet: true })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const creds = readFileSync('docs/LOCAL_CREDENTIALS.md', 'utf8').split('\n')
const pw = (email) => creds.find((l) => l.includes(`${email} |`))?.split('`')[1]

const client = async (role) => {
  const c = createClient(URL, ANON, { auth: { persistSession: false } })
  if (role !== 'anon') {
    const { error } = await c.auth.signInWithPassword({ email: `${role}@mamaterry.test`, password: pw(`${role}@mamaterry.test`) })
    if (error) throw new Error(`${role}: ${error.message}`)
  }
  return c
}

let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${ok ? '' : `  ${detail}`}`)
  if (!ok) failed++
}
const rows = async (q) => {
  const { data, error } = await q
  return { n: data?.length ?? 0, data, error }
}

const anon = await client('anon')
const customer = await client('customer')
const attendant = await client('attendant')
const manager = await client('manager') // demo manager has can_view_margins = false
const owner = await client('owner')
const { data: someVariant } = await owner.from('product_variants').select('id, product_id, quantity_on_hand').limit(1).single()

console.log('\nPublic visitor (not signed in)')
check('can browse products', (await rows(anon.from('products').select('id').limit(5))).n > 0)
check('cannot read cost prices', (await rows(anon.from('variant_costs').select('*'))).n === 0)
check('cannot read orders', (await rows(anon.from('orders').select('id'))).n === 0)
check('cannot read customer profiles', (await rows(anon.from('profiles').select('id'))).n === 0)
check('cannot read audit log', (await rows(anon.from('audit_log').select('id'))).n === 0)
check('cannot read payments', (await rows(anon.from('payments').select('id'))).n === 0)
check('cannot insert an order directly', Boolean((await anon.from('orders').insert({ delivery_method: 'courier', payment_method: 'mpesa', subtotal: 1, total: 1 })).error))
check('cannot call place_order (server only)', Boolean((await anon.rpc('place_order', {})).error))
check('cannot change products', Boolean((await anon.from('products').update({ name: 'hacked' }).eq('id', someVariant.product_id).select()).error) || (await rows(anon.from('products').update({ name: 'hacked' }).eq('id', someVariant.product_id).select())).n === 0)

console.log('\nCustomer')
const { data: me } = await customer.auth.getUser()
const custOrders = await rows(customer.from('orders').select('id, customer_id'))
check('sees only their own orders', custOrders.n > 0 && custOrders.data.every((o) => o.customer_id === me.user.id), `saw ${custOrders.n}`)
check('cannot read cost prices', (await rows(customer.from('variant_costs').select('*'))).n === 0)
check('cannot read order item costs', (await rows(customer.from('order_item_costs').select('*'))).n === 0)
check('cannot see other profiles', (await rows(customer.from('profiles').select('id').neq('id', me.user.id))).n === 0)
check('cannot make themselves owner', Boolean((await customer.from('profiles').update({ role: 'owner' }).eq('id', me.user.id)).error))
check('cannot run reports', Boolean((await customer.rpc('report_sales_summary', { p_from: '2020-01-01', p_to: '2030-01-01' })).error))
check('cannot record in-store sales', Boolean((await customer.rpc('record_in_store_sale', { p_items: [], p_payment: 'cash' })).error))
check('cannot set stock directly', Boolean((await customer.from('product_variants').update({ quantity_on_hand: 999 }).eq('id', someVariant.id).select()).error) || (await rows(customer.from('product_variants').update({ quantity_on_hand: 999 }).eq('id', someVariant.id).select())).n === 0)
check('cannot self-approve a review', await (async () => {
  const { data: p } = await customer.from('products').select('id').limit(1).single()
  const { data } = await customer.from('reviews').upsert({ product_id: p.id, user_id: me.user.id, rating: 5, comment: 'rls test', status: 'approved' }, { onConflict: 'product_id,user_id' }).select('status').single()
  const ok = data?.status === 'pending'
  // restore the seeded approved review
  await owner.from('reviews').update({ status: 'approved', comment: 'Great quality and fast delivery to Kilimani. Fits true to size.' }).eq('product_id', p.id).eq('user_id', me.user.id)
  return ok
})())

console.log('\nSales attendant')
check('cannot read cost prices', (await rows(attendant.from('variant_costs').select('*'))).n === 0)
check('cannot read order item costs', (await rows(attendant.from('order_item_costs').select('*'))).n === 0)
const attOrders = await rows(attendant.from('orders').select('id, handled_by, channel'))
const { data: att } = await attendant.auth.getUser()
check('sees only sales they rang up', attOrders.data.every((o) => o.handled_by === att.user.id), `saw ${attOrders.n}`)
check('profit report refused', Boolean((await attendant.rpc('report_profit', { p_from: '2020-01-01', p_to: '2030-01-01' })).error))
const attSummary = await attendant.rpc('report_sales_summary', { p_from: '2020-01-01', p_to: '2030-01-01' })
check('sales summary hides cost/profit', attSummary.data && attSummary.data.cost == null && attSummary.data.profit == null)
check('cannot restock', Boolean((await attendant.rpc('receive_stock', { p_variant: someVariant.id, p_quantity: 5 })).error))
check('cannot edit prices', (await rows(attendant.from('product_variants').update({ selling_price: 1 }).eq('id', someVariant.id).select())).n === 0)
check('cannot read audit log', (await rows(attendant.from('audit_log').select('id'))).n === 0)
check('cannot exceed discount limit (5%)', Boolean((await attendant.rpc('record_in_store_sale', { p_items: [{ variant_id: someVariant.id, quantity: 1 }], p_payment: 'card', p_discount: 100000, p_discount_reason: 'test', p_reference: 'x' })).error))

console.log('\nSales manager without margin access')
check('cannot read cost prices', (await rows(manager.from('variant_costs').select('*'))).n === 0)
check('profit report refused', Boolean((await manager.rpc('report_profit', { p_from: '2020-01-01', p_to: '2030-01-01' })).error))
const val = await manager.rpc('report_stock_valuation')
check('stock valuation hides cost value', !val.error && val.data.every((r) => r.cost_value == null))
check('sees all orders', (await rows(manager.from('orders').select('id'))).n > attOrders.n)
check('cannot read audit log', (await rows(manager.from('audit_log').select('id'))).n === 0)
check('cannot change store settings', (await rows(manager.from('store_settings').update({ store_name: 'x' }).eq('id', 1).select())).n === 0)
check('cannot change staff permissions', (await rows(manager.from('staff').update({ can_view_margins: true }).neq('user_id', '00000000-0000-0000-0000-000000000000').select())).n === 0)

console.log('\nOwner')
check('reads cost prices', (await rows(owner.from('variant_costs').select('*').limit(5))).n > 0)
check('profit report works', !(await owner.rpc('report_profit', { p_from: '2020-01-01', p_to: '2030-01-01' })).error)
check('reads audit log', !(await owner.from('audit_log').select('id').limit(1)).error)

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nAll security checks passed ✓')
process.exit(failed ? 1 : 0)
