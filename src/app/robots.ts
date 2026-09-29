import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/account', '/checkout', '/orders', '/receipt', '/api'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
