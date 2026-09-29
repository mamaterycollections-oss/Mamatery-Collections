import 'server-only'
import type { Permissions } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function loadEditorData(perms: Permissions, productId?: string) {
  const supabase = await createClient()
  const [{ data: categories }, { data: options }, product] = await Promise.all([
    supabase.from('categories').select('id, name, parent_id').order('sort_order'),
    supabase.from('attribute_options').select('kind, value, hex').order('sort_order'),
    productId
      ? supabase.from('products').select('*, product_variants(*)').eq('id', productId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  const variants = product.data?.product_variants ?? []
  const { data: costs } = perms.margins && variants.length
    ? await supabase.from('variant_costs').select('variant_id, cost_price').in('variant_id', variants.map((v) => v.id))
    : { data: [] }
  return {
    categories: (categories ?? []).filter((c) => perms.owner || !perms.categories.length || perms.categories.includes(c.id)),
    sizes: (options ?? []).filter((o) => o.kind === 'size').map((o) => o.value),
    colours: (options ?? []).filter((o) => o.kind === 'colour').map((o) => ({ value: o.value, hex: o.hex })),
    product: product.data,
    costs: Object.fromEntries((costs ?? []).map((c) => [c.variant_id, Number(c.cost_price)])),
  }
}
