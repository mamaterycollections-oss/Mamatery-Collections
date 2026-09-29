'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { ActionResult } from '@/components/dash/use-action'
import { requireStaff } from '@/lib/auth'
import type { TablesUpdate } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { friendlyError, slugify } from '@/lib/utils'

const refresh = () => {
  revalidatePath('/', 'layout')
  revalidatePath('/dashboard/settings')
}
const nullable = z.string().trim().max(300).transform((v) => v || null)
const optionalUrl = z.union([z.literal('').transform(() => null), z.url('Enter a full link starting with https://')])

const settingsSchema = z.object({
  store_name: z.string().trim().min(2).max(80),
  tagline: nullable,
  phone: nullable,
  whatsapp: nullable,
  email: z.union([z.literal('').transform(() => null), z.string().trim().email()]),
  announcement: nullable,
  instagram_url: optionalUrl,
  facebook_url: optionalUrl,
  tiktok_url: optionalUrl,
  receipt_footer: nullable,
  return_window_days: z.coerce.number().int().min(0).max(90),
  low_stock_default: z.coerce.number().int().min(0).max(1000),
  mpesa_enabled: z.boolean(),
  card_enabled: z.boolean(),
  cod_enabled: z.boolean(),
  pickup_enabled: z.boolean(),
  pickup_address: nullable,
  pickup_hours: nullable,
  free_delivery_threshold: z.union([z.literal('').transform(() => null), z.coerce.number().min(0)]),
})

export async function saveSettings(input: z.input<typeof settingsSchema>): Promise<ActionResult> {
  await requireStaff('owner')
  const p = settingsSchema.safeParse(input)
  if (!p.success) return { error: `${String(p.error.issues[0].path[0] ?? "").replace(/_/g, " ")}: ${p.error.issues[0].message}` }
  if (p.data.pickup_enabled && !p.data.pickup_address) return { error: 'Add the pickup address, or switch pickup off' }
  if (!p.data.mpesa_enabled && !p.data.card_enabled && !p.data.cod_enabled) return { error: 'Keep at least one payment method on' }
  const supabase = await createClient()
  const { error } = await supabase.from('store_settings').update(p.data as TablesUpdate<'store_settings'>).eq('id', 1)
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true, message: 'Settings saved' }
}

const zoneSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(80),
  description: nullable,
  fee: z.coerce.number().min(0),
  eta: nullable,
  cod_allowed: z.boolean(),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int(),
})
export async function saveZone(input: z.input<typeof zoneSchema>): Promise<ActionResult> {
  await requireStaff('owner')
  const p = zoneSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const supabase = await createClient()
  const { id, ...row } = p.data
  const { error } = id ? await supabase.from('delivery_zones').update(row).eq('id', id) : await supabase.from('delivery_zones').insert(row)
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true, message: 'Delivery area saved' }
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(60),
  parent_id: z.union([z.literal('').transform(() => null), z.uuid()]),
  description: nullable,
  image_url: z.union([z.literal('').transform(() => null), z.url()]).nullable(),
  sort_order: z.coerce.number().int(),
  is_active: z.boolean(),
})
export async function saveCategory(input: z.input<typeof categorySchema>): Promise<ActionResult> {
  await requireStaff('owner')
  const p = categorySchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  const supabase = await createClient()
  const { id, ...row } = p.data
  if (id && row.parent_id === id) return { error: 'A category can’t be its own parent' }
  const { error } = id
    ? await supabase.from('categories').update(row).eq('id', id)
    : await supabase.from('categories').insert({ ...row, slug: slugify(row.name) || `category-${Date.now()}` })
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'A category with that name already exists' : friendlyError(error) }
  refresh()
  return { ok: true, message: 'Category saved' }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  await requireStaff('owner')
  const supabase = await createClient()
  const { count } = await supabase.from('products').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (count) return { error: `${count} product(s) are in this category. Move them first, or hide the category instead.` }
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true, message: 'Category deleted' }
}

export async function saveOption(kind: 'size' | 'colour', value: string, hex: string | null): Promise<ActionResult> {
  await requireStaff('manager')
  const v = value.trim()
  if (!v || v.length > 40) return { error: 'Enter a name' }
  if (hex && !/^#[0-9a-f]{6}$/i.test(hex)) return { error: 'Colour must look like #B4532A' }
  const supabase = await createClient()
  const { data: last } = await supabase.from('attribute_options').select('sort_order').eq('kind', kind).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const { error } = await supabase.from('attribute_options').insert({ kind, value: v, hex, sort_order: (last?.sort_order ?? 0) + 1 })
  if (error) return { error: /duplicate|unique/i.test(error.message) ? `${v} already exists` : friendlyError(error) }
  refresh()
  return { ok: true }
}

export async function deleteOption(id: string): Promise<ActionResult> {
  await requireStaff('manager')
  const supabase = await createClient()
  const { error } = await supabase.from('attribute_options').delete().eq('id', id)
  if (error) return { error: friendlyError(error) }
  refresh()
  return { ok: true }
}

const couponSchema = z.object({
  id: z.uuid().optional(),
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,30}$/, 'Codes use letters, numbers and dashes (3–30)'),
  description: nullable,
  type: z.enum(['percent', 'fixed']),
  value: z.coerce.number().positive(),
  min_subtotal: z.coerce.number().min(0),
  max_uses: z.union([z.literal('').transform(() => null), z.coerce.number().int().positive()]),
  ends_at: z.union([z.literal('').transform(() => null), z.string()]),
  is_active: z.boolean(),
})
export async function saveCoupon(input: z.input<typeof couponSchema>): Promise<ActionResult> {
  const { session } = await requireStaff('manager')
  const p = couponSchema.safeParse(input)
  if (!p.success) return { error: p.error.issues[0].message }
  if (p.data.type === 'percent' && p.data.value > 90) return { error: 'Percentage discounts can’t exceed 90%' }
  const supabase = await createClient()
  const { id, ...row } = p.data
  const ends = row.ends_at ? new Date(`${row.ends_at}T23:59:59+03:00`).toISOString() : null
  const { error } = id
    ? await supabase.from('coupons').update({ ...row, ends_at: ends }).eq('id', id)
    : await supabase.from('coupons').insert({ ...row, ends_at: ends, created_by: session.id })
  if (error) return { error: /duplicate|unique/i.test(error.message) ? 'That code already exists' : friendlyError(error) }
  revalidatePath('/dashboard/settings')
  return { ok: true, message: 'Discount code saved' }
}
