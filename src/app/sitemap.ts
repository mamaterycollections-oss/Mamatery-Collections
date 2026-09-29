import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const supabase = createPublicClient()
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products').select('slug, updated_at').eq('is_active', true),
    supabase.from('categories').select('slug').eq('is_active', true),
  ])
  const pages = ['', '/shop', '/about', '/contact', '/help', '/delivery-returns', '/privacy', '/terms', '/track']
  return [
    ...pages.map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const, priority: p === '' ? 1 : 0.6 })),
    ...(categories ?? []).map((c) => ({ url: `${base}/shop/${c.slug}`, changeFrequency: 'daily' as const, priority: 0.8 })),
    ...(products ?? []).map((p) => ({ url: `${base}/product/${p.slug}`, lastModified: p.updated_at, changeFrequency: 'weekly' as const, priority: 0.7 })),
  ]
}
