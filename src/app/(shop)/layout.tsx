import { CartDrawer } from '@/components/cart/cart-drawer'
import { Footer } from '@/components/shop/footer'
import { Header } from '@/components/shop/header'
import { TabBar } from '@/components/shop/tab-bar'
import { getCategories, getSettings } from '@/lib/store'

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const [settings, categories] = await Promise.all([getSettings(), getCategories()])
  const top = categories.filter((c) => !c.parent_id)
  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-white">
        Skip to content
      </a>
      <Header categories={top.map((c) => ({ name: c.name, slug: c.slug }))} announcement={settings.announcement} />
      <main id="main" className="min-h-[60vh]">{children}</main>
      <Footer settings={settings} categories={top} />
      <CartDrawer freeDeliveryThreshold={settings.free_delivery_threshold != null ? Number(settings.free_delivery_threshold) : null} />
      <TabBar />
    </>
  )
}
