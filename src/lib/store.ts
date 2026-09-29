import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import type { Tables } from '@/lib/supabase/database.types'

// Public storefront data (anon role — RLS returns only active/public rows).
// Pages using only these helpers can be statically cached and revalidated.

export type Settings = Tables<'store_settings'>
export type Category = Tables<'categories'>
export type Zone = Tables<'delivery_zones'>

export const PRODUCT_CARD_FIELDS =
  'id, name, slug, images, price_min, price_max, base_price, compare_at_price, total_stock, rating_avg, rating_count, created_at, is_featured, category_id, sizes, colours'

export type ProductCard = Pick<
  Tables<'products'>,
  | 'id' | 'name' | 'slug' | 'images' | 'price_min' | 'price_max' | 'base_price' | 'compare_at_price' | 'total_stock'
  | 'rating_avg' | 'rating_count' | 'created_at' | 'is_featured' | 'category_id' | 'sizes' | 'colours'
>

export const getSettings = cache(async (): Promise<Settings> => {
  const { data } = await createPublicClient().from('store_settings').select('*').eq('id', 1).single()
  return (
    data ?? {
      id: 1, store_name: 'MamaTerryCollections', tagline: null, phone: null, whatsapp: null, email: null,
      pickup_enabled: false, pickup_address: null, pickup_hours: null, mpesa_enabled: true, card_enabled: false,
      cod_enabled: false, free_delivery_threshold: null, low_stock_default: 3, return_window_days: 7,
      announcement: null, instagram_url: null, facebook_url: null, tiktok_url: null, receipt_footer: null,
      updated_at: new Date().toISOString(),
    }
  )
})

export const getCategories = cache(async (): Promise<Category[]> => {
  const { data } = await createPublicClient().from('categories').select('*').eq('is_active', true).order('sort_order').order('name')
  return data ?? []
})

export const getZones = cache(async (): Promise<Zone[]> => {
  const { data } = await createPublicClient().from('delivery_zones').select('*').eq('is_active', true).order('sort_order')
  return data ?? []
})

export const getOptions = cache(async () => {
  const { data } = await createPublicClient().from('attribute_options').select('*').order('sort_order')
  return {
    sizes: (data ?? []).filter((o) => o.kind === 'size'),
    colours: (data ?? []).filter((o) => o.kind === 'colour'),
  }
})

export function colourHex(colours: { value: string; hex: string | null }[], name: string) {
  return colours.find((c) => c.value.toLowerCase() === name.toLowerCase())?.hex ?? null
}

export function whatsappLink(number: string | null | undefined, text?: string) {
  const digits = String(number ?? '').replace(/\D/g, '').replace(/^0/, '254')
  if (!digits) return null
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ''}`
}
