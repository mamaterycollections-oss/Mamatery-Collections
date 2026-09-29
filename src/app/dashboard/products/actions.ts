'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, slugify } from '@/lib/utils'

const refreshStore = (id?: string) => {
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard/products')
  if (id) revalidatePath(`/dashboard/products/${id}`)
}

const productSchema = z.object({
  id: z.uuid(),
  name: z.string().trim().min(2, 'Give the product a name').max(120),
  category_id: z.uuid('Choose a category'),
  description: z.string().trim().max(4000).optional().default(''),
  base_price: z.coerce.number().min(0, 'Price can’t be negative'),
  compare_at_price: z.union([z.coerce.number().positive(), z.literal('').transform(() => null), z.null()]).optional(),
  images: z.array(z.url()).max(12),
  tags: z.array(z.string().trim().toLowerCase().max(30)).max(20),
  is_active: z.boolean(),
  is_featured: z.boolean(),
})

const variantSchema = z.object({
  id: z.uuid().optional(),
  size: z.string().trim().max(30).nullable(),
  colour: z.string().trim().max(40).nullable(),
  selling_price: z.coerce.number().min(0),
  cost_price: z.coerce.number().min(0).nullable().optional(),
  quantity_on_hand: z.coerce.number().int().min(0).max(100000).optional(),
  low_stock_threshold: z.coerce.number().int().min(0).max(1000),
  image_url: z.string().url().nullable().optional(),
  is_active: z.boolean(),
  sku: z.string().trim().max(40).optional(),
})

export type ProductInput = z.input<typeof productSchema>
export type VariantInput = z.input<typeof variantSchema>

export async function saveProduct(input: ProductInput, variants: VariantInput[]): Promise<ActionResult<{ id: string }>> {
  const { perms, session } = await requireStaff('manager')
  const p = productSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const vs = z.array(variantSchema).max(200).safeParse(variants)
  if (!vs.success) return { error: `Variant: ${vs.error.issues[0].message}` }
  if (!vs.data.length) return { error: 'Add at least one variant (size / colour)' }
  const keys = vs.data.map((v) => `${v.size ?? ''}|${v.colour ?? ''}`.toLowerCase())
  if (new Set(keys).size !== keys.length) return { error: 'Two variants have the same size and colour' }

  const supabase = await createClient()
  const { data: existing } = await supabase.from('products').select('id, slug').eq('id', p.data.id).maybeSingle()

  let slug = existing?.slug
  if (!slug) {
    const base = slugify(p.data.name) || 'product'
    const { data: taken } = await supabase.from('products').select('slug').like('slug', `${base}%`)
    const used = new Set((taken ?? []).map((t) => t.slug))
    slug = base
    for (let i = 2; used.has(slug); i++) slug = `${base}-${i}`
  }

  const row = {
    id: p.data.id,
    name: p.data.name,
    slug,
    category_id: p.data.category_id,
    description: p.data.description || null,
    base_price: p.data.base_price,
    compare_at_price: p.data.compare_at_price ?? null,
    images: p.data.images,
    tags: p.data.tags,
    is_active: p.data.is_active,
    is_featured: p.data.is_featured,
  }
  const { error } = existing
    ? await supabase.from('products').update(row).eq('id', row.id)
    : await supabase.from('products').insert({ ...row, created_by: session.id })
  if (error) return { error: friendlyError(error, 'Could not save the product. Check you manage this category.') }

  for (const v of vs.data) {
    const fields = {
      size: v.size || null,
      colour: v.colour || null,
      selling_price: v.selling_price,
      low_stock_threshold: v.low_stock_threshold,
      image_url: v.image_url ?? null,
      is_active: v.is_active,
    }
    let variantId = v.id
    if (v.id) {
      const { error: e } = await supabase.from('product_variants').update(fields).eq('id', v.id).eq('product_id', row.id)
      if (e) return { error: friendlyError(e, `Could not update ${[v.size, v.colour].filter(Boolean).join(' / ')}`) }
    } else {
      const { data: created, error: e } = await supabase
        .from('product_variants')
        .insert({ ...fields, product_id: row.id, quantity_on_hand: v.quantity_on_hand ?? 0, sku: v.sku || '', barcode_value: '' })
        .select('id')
        .single()
      if (e) return { error: friendlyError(e, `Could not add ${[v.size, v.colour].filter(Boolean).join(' / ')} (duplicate SKU?)`) }
      variantId = created.id
    }
    if (perms.margins && v.cost_price != null && variantId) {
      const { error: ce } = await supabase.from('variant_costs').upsert({ variant_id: variantId, cost_price: v.cost_price })
      if (ce) return { error: friendlyError(ce, 'Could not save the cost price') }
    }
  }

  refreshStore(row.id)
  return { ok: true, data: { id: row.id }, message: existing ? 'Product saved' : 'Product created' }
}

export async function setProductActive(id: string, active: boolean): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.from('products').update({ is_active: active }).eq('id', id)
  if (error) return { error: friendlyError(error) }
  refreshStore(id)
  return { ok: true, message: active ? 'Product is live' : 'Product hidden from the shop' }
}

export async function deleteProduct(id: string): Promise<ActionResult> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id)
  if (count) return { error: 'This product has sales history, so it can’t be deleted. Hide it instead.' }
  const { error } = await supabase.from('products').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  refreshStore()
  return { ok: true, message: 'Product deleted' }
}

export async function deleteVariant(id: string): Promise<ActionResult> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('variant_id', id)
  if (count) return { error: 'This variant has been sold before — switch it off instead of deleting.' }
  const { error } = await supabase.from('product_variants').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  refreshStore()
  return { ok: true, message: 'Variant deleted' }
}
