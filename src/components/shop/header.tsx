'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Heart, LayoutDashboard, Menu, Search, ShoppingBag, User, X } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { useAuth } from '@/components/auth-provider'
import { useCart } from '@/components/cart/cart-provider'
import { useWishlist } from '@/components/wishlist-provider'
import { SearchOverlay } from '@/components/shop/search-overlay'
import { cn } from '@/lib/utils'

type NavCategory = { name: string; slug: string }

export function Header({ categories, announcement }: { categories: NavCategory[]; announcement: string | null }) {
  const pathname = usePathname()
  const { count, setOpen } = useCart()
  const wishlist = useWishlist()
  const { userId, role } = useAuth()
  const [scrolled, setScrolled] = useState(false)
  const [menu, setMenu] = useState(false)
  const [search, setSearch] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    setMenu(false)
    setSearch(false)
  }, [pathname])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.key === 'k' && (e.metaKey || e.ctrlKey))) && !(e.target as HTMLElement).closest('input,textarea')) {
        e.preventDefault()
        setSearch(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const staff = role && role !== 'customer'
  const nav = [{ name: 'New in', href: '/shop?sort=new' }, ...categories.map((c) => ({ name: c.name, href: `/shop/${c.slug}` }))]

  return (
    <>
      {announcement && (
        <div className="bg-ink text-paper">
          <p className="container-page truncate py-2 text-center text-[0.7rem] font-semibold tracking-[0.14em] uppercase">{announcement}</p>
        </div>
      )}
      <header
        className={cn(
          'sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300',
          scrolled ? 'border-b border-line bg-paper/85 shadow-[0_8px_30px_-20px_rgb(23_19_15/0.35)] backdrop-blur-xl' : 'border-b border-transparent bg-paper',
        )}
      >
        <div className="container-page grid h-16 grid-cols-[1fr_auto_1fr] items-center sm:h-[4.5rem]">
          <div className="flex items-center gap-1">
            <button className="btn-icon btn-ghost -ml-2 lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <nav className="hidden items-center gap-7 lg:flex" aria-label="Main">
              {nav.slice(0, 6).map((item) => (
                <Link key={item.href} href={item.href} className="link-underline text-[0.8rem] font-bold tracking-wide uppercase">
                  {item.name}
                </Link>
              ))}
            </nav>
          </div>

          <Link href="/" aria-label="MamaTerryCollections home" className="justify-self-center">
            <Logo />
          </Link>

          <div className="flex items-center justify-end gap-0.5 sm:gap-1">
            <button className="btn-icon btn-ghost" onClick={() => setSearch(true)} aria-label="Search">
              <Search className="size-5" />
            </button>
            {staff && (
              <Link href="/dashboard" className="btn-icon btn-ghost hidden sm:inline-flex" aria-label="Dashboard" title="Dashboard">
                <LayoutDashboard className="size-5" />
              </Link>
            )}
            <Link href={userId ? '/account' : '/login'} className="btn-icon btn-ghost hidden sm:inline-flex" aria-label="Account">
              <User className="size-5" />
            </Link>
            <Link href="/wishlist" className="btn-icon btn-ghost relative hidden sm:inline-flex" aria-label={`Wishlist (${wishlist.count})`}>
              <Heart className="size-5" />
              {wishlist.count > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-clay" />}
            </Link>
            <button className="btn-icon btn-ghost relative" onClick={() => setOpen(true)} aria-label={`Bag (${count} items)`}>
              <ShoppingBag className="size-5" />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    key={count}
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 600, damping: 18 }}
                    className="absolute -top-0.5 -right-0.5 grid min-w-[1.15rem] place-items-center rounded-full bg-clay px-1 text-[0.65rem] leading-[1.15rem] font-bold text-white"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menu && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMenu(false)} aria-label="Close menu" />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 380, damping: 38 }}
              className="absolute inset-y-0 left-0 flex w-[86%] max-w-sm flex-col bg-paper pb-safe"
            >
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <Logo compact />
                <button className="btn-icon btn-ghost" onClick={() => setMenu(false)} aria-label="Close menu">
                  <X className="size-5" />
                </button>
              </div>
              <nav className="flex-1 overflow-y-auto px-5 py-4" aria-label="Mobile">
                <p className="eyebrow mb-2">Shop</p>
                <ul>
                  <li>
                    <Link href="/shop" className="flex items-center justify-between py-3 font-display text-2xl">All products</Link>
                  </li>
                  {nav.map((item, i) => (
                    <motion.li key={item.href} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0, transition: { delay: 0.05 + i * 0.04 } }}>
                      <Link href={item.href} className="flex items-center justify-between py-3 font-display text-2xl">
                        {item.name}
                      </Link>
                    </motion.li>
                  ))}
                </ul>
                <div className="mt-6 space-y-1 border-t border-line pt-5 text-sm font-semibold">
                  {staff && <Link href="/dashboard" className="block py-2">Dashboard</Link>}
                  <Link href={userId ? '/account' : '/login'} className="block py-2">{userId ? 'My account' : 'Sign in / Create account'}</Link>
                  <Link href="/account/orders" className="block py-2">My orders</Link>
                  <Link href="/track" className="block py-2">Track an order</Link>
                  <Link href="/wishlist" className="block py-2">Wishlist</Link>
                  <Link href="/help" className="block py-2">Help &amp; FAQs</Link>
                  <Link href="/contact" className="block py-2">Contact us</Link>
                </div>
              </nav>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <SearchOverlay open={search} onClose={() => setSearch(false)} />
    </>
  )
}
