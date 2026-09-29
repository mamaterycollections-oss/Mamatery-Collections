// Seeds a demo catalog (illustrated images → Supabase Storage), demo staff/customer
// accounts and a month of demo orders that run through the real database functions.
//   npm run seed            create everything (safe to re-run: skips what exists)
//   npm run seed -- --clear remove demo products, orders and accounts
// Demo accounts use the reserved .test domain, so no email ever goes out.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { productSvg } from './product-art.mjs'

config({ path: '.env.local', quiet: true })
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const asUser = async (email, password) => {
  const c = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`sign in ${email}: ${error.message}`)
  return c
}
const must = ({ data, error }, what) => {
  if (error) throw new Error(`${what}: ${error.message}`)
  return data
}

const DEMO_TAG = 'demo'
const DEMO_DOMAIN = 'mamaterry.test'
const CREDS_FILE = 'docs/LOCAL_CREDENTIALS.md'

// ---------------------------------------------------------------------------
if (process.argv.includes('--clear')) {
  const { data: orders } = await admin.from('orders').select('id').or(`contact_email.ilike.%@${DEMO_DOMAIN},contact_name.eq.Walk-in (demo)`)
  if (orders?.length) must(await admin.from('orders').delete().in('id', orders.map((o) => o.id)), 'delete orders')
  const { data: prods } = await admin.from('products').select('id').contains('tags', [DEMO_TAG])
  if (prods?.length) must(await admin.from('products').delete().in('id', prods.map((p) => p.id)), 'delete products')
  const { data: files } = await admin.storage.from('product-images').list('demo', { limit: 1000 })
  if (files?.length) await admin.storage.from('product-images').remove(files.map((f) => `demo/${f.name}`))
  const { data: users } = await admin.auth.admin.listUsers({ perPage: 1000 })
  for (const u of users.users.filter((u) => u.email?.endsWith(`@${DEMO_DOMAIN}`))) {
    await admin.from('cash_sessions').delete().eq('staff_id', u.id)
    await admin.auth.admin.deleteUser(u.id)
  }
  console.log(`cleared ${orders?.length ?? 0} orders, ${prods?.length ?? 0} products and demo accounts`)
  process.exit(0)
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
const creds = existsSync(CREDS_FILE) ? readFileSync(CREDS_FILE, 'utf8') : ''
const pw = (email) => creds.match(new RegExp(`${email.replace('.', '\\.')}\\s*\\|\\s*\`([^\`]+)\``))?.[1] ?? `Mt-${randomBytes(6).toString('base64url')}9`

const ACCOUNTS = [
  { email: `owner@${DEMO_DOMAIN}`, name: 'Terry (Demo Owner)', role: 'owner' },
  { email: `manager@${DEMO_DOMAIN}`, name: 'Wanjiku Manager', role: 'sales_manager', staff: { can_view_margins: false, discount_limit_pct: 10 } },
  { email: `attendant@${DEMO_DOMAIN}`, name: 'Brian Attendant', role: 'sales_attendant', staff: { discount_limit_pct: 5 } },
  { email: `customer@${DEMO_DOMAIN}`, name: 'Achieng Customer', role: 'customer', phone: '+254712345678' },
]
const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 1000 })
const ids = {}
for (const a of ACCOUNTS) {
  a.password = pw(a.email)
  let user = existingUsers.users.find((u) => u.email === a.email)
  if (!user) {
    user = must(
      await admin.auth.admin.createUser({ email: a.email, password: a.password, email_confirm: true, user_metadata: { full_name: a.name, phone: a.phone } }),
      `create ${a.email}`,
    ).user
  }
  ids[a.role] = user.id
  must(await admin.from('profiles').update({ role: a.role, full_name: a.name, phone: a.phone ?? null }).eq('id', user.id), 'set role')
  if (a.staff) must(await admin.from('staff').upsert({ user_id: user.id, ...a.staff, created_by: ids.owner }), 'staff row')
}
writeFileSync(
  CREDS_FILE,
  `# Demo accounts (LOCAL ONLY — git-ignored, never share)\n\nCreated by \`npm run seed\`. Remove with \`npm run seed -- --clear\`.\n\n| Role | Email | Password |\n| --- | --- | --- |\n${ACCOUNTS.map((a) => `| ${a.role} | ${a.email} | \`${a.password}\` |`).join('\n')}\n`,
)
console.log('accounts ready →', CREDS_FILE)

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------
const { data: cats } = await admin.from('categories').select('id, slug')
const cat = Object.fromEntries(cats.map((c) => [c.slug, c.id]))
const { data: opts } = await admin.from('attribute_options').select('value, hex').eq('kind', 'colour')
const hex = Object.fromEntries(opts.map((o) => [o.value, o.hex]))
const CLOTHES = ['S', 'M', 'L', 'XL']

const PRODUCTS = [
  ['clothes', 'Amani Wrap Midi Dress', 'dress', ['Maroon', 'Black', 'Mustard'], CLOTHES, 3200, 1450, 3800, true,
    'A flattering wrap silhouette that moves with you — from Sunday brunch to evening plans. Soft, breathable fabric with a self-tie waist you can adjust to fit.'],
  ['clothes', 'Zawadi Slip Dress', 'dress', ['Beige', 'Olive', 'Navy'], ['S', 'M', 'L'], 2800, 1200, null, false,
    'Fluid satin-finish slip dress with adjustable straps. Layer it over a tee by day or wear it alone at night.'],
  ['clothes', 'Essential Oversized Tee', 'tee', ['White', 'Black', 'Beige', 'Olive'], ['S', 'M', 'L', 'XL', 'XXL'], 1200, 430, null, false,
    'The tee you will reach for every day. Heavyweight cotton, dropped shoulders and a relaxed boxy fit.'],
  ['clothes', 'Nairobi Nights Hoodie', 'hoodie', ['Grey', 'Black', 'Maroon'], CLOTHES, 2500, 1100, 2900, true,
    'Brushed-fleece hoodie with a roomy hood and kangaroo pocket. Made for cool Nairobi evenings.'],
  ['clothes', 'Wide-Leg Linen Trousers', 'trousers', ['Beige', 'Black', 'Olive'], CLOTHES, 2600, 1080, null, false,
    'High-waisted, wide-leg trousers in a breathable linen blend. Pressed crease for a polished finish.'],
  ['clothes', 'Pleated Midi Skirt', 'skirt', ['Pink', 'Mustard', 'Black'], ['S', 'M', 'L'], 2200, 880, null, false,
    'Knife pleats that swish with every step. Elastic back waistband for all-day comfort.'],
  ['clothes', 'Tailored Linen Blazer', 'blazer', ['Beige', 'Navy', 'Brown'], CLOTHES, 4500, 2150, null, true,
    'Softly structured single-breasted blazer. Throw it over a dress or pair it with the matching trousers.'],
  ['bags', 'Malaika Structured Handbag', 'handbag', ['Brown', 'Black', 'Beige'], ['One Size'], 4200, 1850, 4900, true,
    'A timeless top-handle bag with a gold-tone clasp and a roomy interior that fits your essentials — phone, wallet, make-up and more.'],
  ['bags', 'Everyday Canvas Tote', 'tote', ['Beige', 'Black', 'Olive'], ['One Size'], 1800, 640, null, false,
    'Sturdy canvas tote with an inner pocket. Big enough for a laptop, market run or beach day.'],
  ['bags', 'Mini Crossbody Bag', 'crossbody', ['Red', 'Black', 'Pink'], ['One Size'], 2400, 980, null, false,
    'Hands-free and chic. Adjustable strap, turn-lock closure and just enough room for the essentials.'],
  ['bags', 'Evening Envelope Clutch', 'clutch', ['Maroon', 'Mustard', 'Black'], ['One Size'], 1900, 720, null, false,
    'Sleek envelope clutch with a gold bar detail. Your finishing touch for weddings and nights out.'],
  ['caps', 'Classic Baseball Cap', 'cap', ['Black', 'White', 'Navy', 'Olive'], ['One Size'], 900, 290, null, false,
    'Six-panel cotton cap with an adjustable back strap and embroidered MT monogram.'],
  ['caps', 'Terry Bucket Hat', 'bucket', ['Beige', 'Black', 'Pink'], ['One Size'], 1100, 390, null, true,
    'Soft cotton bucket hat with stitched brim. Sun-ready and effortlessly cool.'],
  ['caps', 'Logo Dad Cap', 'cap', ['Maroon', 'Beige'], ['One Size'], 950, 320, 1200, false,
    'Unstructured, low-profile cap with a curved brim. Washed for that lived-in feel.'],
  ['other', 'Cat-Eye Sunglasses', 'sunglasses', ['Black', 'Brown'], ['One Size'], 1200, 340, null, false,
    'UV400 lenses in a lightweight frame. The easiest way to finish a look.'],
  ['other', 'Silk Square Scarf', 'scarf', ['Mustard', 'Blue', 'Pink'], ['One Size'], 1500, 480, null, false,
    'Printed square scarf — wear it on your hair, neck or knotted on your bag handle.'],
]
const BG = { clothes: '#EDE4D8', bags: '#E7DED2', caps: '#E6E2DA', other: '#EAE3DA' }
const BG_ALT = { clothes: '#DCCBB8', bags: '#D8CCBD', caps: '#D5CEC2', other: '#DCD0C0' }

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
async function upload(path, svg) {
  const webp = await sharp(Buffer.from(svg)).resize(900, 1125).webp({ quality: 82 }).toBuffer()
  must(await admin.storage.from('product-images').upload(path, webp, { contentType: 'image/webp', upsert: true }), `upload ${path}`)
  return admin.storage.from('product-images').getPublicUrl(path).data.publicUrl
}

let seed = 7
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
const allVariants = []
for (const [catSlug, name, type, colours, sizes, price, cost, compare, featured, description] of PRODUCTS) {
  const slug = slugify(name)
  let { data: product } = await admin.from('products').select('id').eq('slug', slug).maybeSingle()
  if (!product) {
    const images = []
    for (const [i, c] of colours.entries()) {
      images.push(await upload(`demo/${slug}-${slugify(c)}.webp`, productSvg(type, hex[c] ?? '#8B8B8B', { bg: BG[catSlug] })))
      if (i === 0) images.push(await upload(`demo/${slug}-detail.webp`, productSvg(type, hex[c] ?? '#8B8B8B', { alt: true, bg: BG_ALT[catSlug] })))
    }
    product = must(
      await admin.from('products').insert({
        category_id: cat[catSlug], name, slug, description, base_price: price, compare_at_price: compare,
        images, tags: [DEMO_TAG, type], is_featured: featured, created_by: ids.owner,
        created_at: new Date(Date.now() - Math.floor(rand() * 40) * 86400000).toISOString(),
      }).select('id').single(),
      `product ${name}`,
    )
    const colourImage = Object.fromEntries(colours.map((c, i) => [c, images[i === 0 ? 0 : i + 1]]))
    for (const c of colours) {
      for (const s of sizes) {
        const r = rand()
        const qty = r < 0.08 ? 0 : r < 0.2 ? 1 + Math.floor(rand() * 2) : 4 + Math.floor(rand() * 14)
        const v = must(
          await admin.from('product_variants').insert({
            product_id: product.id, size: s, colour: c, selling_price: price, quantity_on_hand: qty,
            low_stock_threshold: 3, image_url: colourImage[c],
          }).select('id').single(),
          `variant ${name} ${s} ${c}`,
        )
        must(await admin.from('variant_costs').insert({ variant_id: v.id, cost_price: cost }), 'cost')
      }
    }
    console.log('product', name)
  }
  const { data: vs } = await admin.from('product_variants').select('id, quantity_on_hand').eq('product_id', product.id)
  allVariants.push(...vs)
}

// ---------------------------------------------------------------------------
// Demo orders across the last 30 days (only when none exist yet)
// ---------------------------------------------------------------------------
const { count } = await admin.from('orders').select('id', { count: 'exact', head: true })
if (!count) {
  const { data: zones } = await admin.from('delivery_zones').select('id, name').order('sort_order')
  const manager = await asUser(`manager@${DEMO_DOMAIN}`, ACCOUNTS[1].password)
  const attendant = await asUser(`attendant@${DEMO_DOMAIN}`, ACCOUNTS[2].password)
  const pick = (n) => {
    const { data } = { data: allVariants.filter((v) => v.quantity_on_hand > 3) }
    return Array.from({ length: n }, () => data[Math.floor(rand() * data.length)]).map((v) => ({ variant_id: v.id, quantity: 1 }))
  }
  const names = ['Achieng Otieno', 'Mary Wambui', 'Faith Chebet', 'Grace Njeri', 'Joy Mutua', 'Aisha Hassan', 'Linda Atieno', 'Ruth Kamau']
  const flows = [
    ['confirmed', 'packed', 'out_for_delivery', 'delivered'],
    ['confirmed', 'packed', 'out_for_delivery', 'delivered'],
    ['confirmed', 'packed'],
    ['confirmed'],
    [],
  ]
  for (let i = 0; i < 22; i++) {
    const daysAgo = Math.floor(rand() * 29)
    const when = new Date(Date.now() - daysAgo * 86400000 - Math.floor(rand() * 8) * 3600000).toISOString()
    const nm = names[i % names.length]
    const own = i % 5 === 0
    const order = must(
      await admin.rpc('place_order', {
        p_customer: own ? ids.customer : null,
        p_items: pick(1 + Math.floor(rand() * 3)),
        p_contact_name: own ? 'Achieng Customer' : nm,
        p_contact_phone: `+2547${String(10000000 + Math.floor(rand() * 89999999))}`,
        p_contact_email: own ? `customer@${DEMO_DOMAIN}` : `${slugify(nm)}@${DEMO_DOMAIN}`,
        p_delivery_method: 'courier',
        p_zone: zones[i % zones.length].id,
        p_address: 'Demo address, Nairobi',
        p_notes: '',
        p_payment: 'mpesa',
        p_coupon: '',
      }),
      'place_order',
    )
    const pay = must(
      await admin.from('payments').insert({ order_id: order.id, amount: order.total, method: 'mpesa', status: 'pending', mpesa_checkout_request_id: `ws_CO_DEMO_${order.id}` }).select('id').single(),
      'payment',
    )
    const receipt = `SDM${Math.floor(rand() * 1e7).toString(36).toUpperCase()}`
    must(await admin.rpc('settle_payment', { p_payment: pay.id, p_receipt: receipt, p_raw: { demo: true } }), 'settle')
    for (const s of flows[i % flows.length]) {
      must(await manager.rpc('update_order_status', { p_order: order.id, p_status: s, p_note: '' }), `status ${s}`)
    }
    await admin.from('orders').update({ placed_at: when }).eq('id', order.id)
    await admin.from('order_status_history').update({ created_at: when }).eq('order_id', order.id)
  }

  // In-store sales by the attendant (cash drawer + M-Pesa till code)
  const session = must(await attendant.rpc('open_cash_session', { p_float: 2000 }), 'open drawer')
  for (let i = 0; i < 14; i++) {
    const cash = i % 2 === 0
    const sale = must(
      await attendant.rpc('record_in_store_sale', {
        p_items: pick(1 + Math.floor(rand() * 2)),
        p_payment: cash ? 'cash' : 'mpesa',
        p_discount: 0,
        p_discount_reason: '',
        p_reference: cash ? '' : `SIS${Math.floor(rand() * 1e7).toString(36).toUpperCase()}`,
        p_customer_name: 'Walk-in (demo)',
        p_customer_phone: '',
        p_await_stk: false,
      }),
      'in-store sale',
    )
    const when = new Date(Date.now() - Math.floor(rand() * 29) * 86400000).toISOString()
    await admin.from('orders').update({ placed_at: when }).eq('id', sale.id)
  }
  const closed = must(await attendant.rpc('close_cash_session', { p_session: session, p_counted: 0, p_notes: 'demo close' }), 'close drawer')
  // Record a realistic count 200 short so the cash-discrepancy alert shows up.
  await admin.from('cash_sessions').update({ counted_cash: closed.expected - 200, discrepancy: -200 }).eq('id', session)

  console.log('demo orders created')
}

// One cancelled order (stock returns to shelf)
if (!(await admin.from('orders').select('id').eq('status', 'cancelled').limit(1)).data?.length) {
  const { data: zones } = await admin.from('delivery_zones').select('id').order('sort_order')
  const manager = await asUser(`manager@${DEMO_DOMAIN}`, ACCOUNTS[1].password)
  const pick = (n) => allVariants.filter((v) => v.quantity_on_hand > 3).slice(0, n).map((v) => ({ variant_id: v.id, quantity: 1 }))
  const cancelled = must(
    await admin.rpc('place_order', {
      p_customer: ids.customer, p_items: pick(1), p_contact_name: 'Achieng Customer', p_contact_phone: '+254712345678',
      p_contact_email: `customer@${DEMO_DOMAIN}`, p_delivery_method: 'courier', p_zone: zones[0].id,
      p_address: 'Demo address, Nairobi', p_notes: '', p_payment: 'mpesa', p_coupon: '',
    }),
    'cod order',
  )
  must(await manager.rpc('update_order_status', { p_order: cancelled.id, p_status: 'cancelled', p_note: 'Customer changed their mind (demo)' }), 'cancel')
  console.log('cancelled demo order created')
}

await admin.from('coupons').upsert({ code: 'KARIBU10', description: '10% off your first order (demo)', type: 'percent', value: 10, min_subtotal: 1500, created_by: ids.owner }, { onConflict: 'code' })

// A couple of approved reviews so product pages show ratings
const { data: firstProducts } = await admin.from('products').select('id').contains('tags', [DEMO_TAG]).eq('is_featured', true).limit(3)
for (const p of firstProducts ?? []) {
  await admin.from('reviews').upsert(
    { product_id: p.id, user_id: ids.customer, rating: 5, title: 'Absolutely love it', comment: 'Great quality and fast delivery to Kilimani. Fits true to size.', status: 'approved', author_name: 'Achieng' },
    { onConflict: 'product_id,user_id' },
  )
}
console.log('done')
