'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Heart, Home, LayoutGrid, ShoppingBag, User } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { useCart } from '@/components/cart/cart-provider'
import { cn } from '@/lib/utils'

// App-style bottom navigation on phones (and in the installed Android app).
export function TabBar() {
  const pathname = usePathname()
  const { count, setOpen } = useCart()
  const { userId } = useAuth()
  const tabs = [
    { href: '/', label: 'Home', Icon: Home, active: pathname === '/' },
    { href: '/shop', label: 'Shop', Icon: LayoutGrid, active: pathname.startsWith('/shop') || pathname.startsWith('/product') },
    { href: '/wishlist', label: 'Saved', Icon: Heart, active: pathname.startsWith('/wishlist') },
    { href: userId ? '/account' : '/login', label: 'Account', Icon: User, active: pathname.startsWith('/account') || pathname === '/login' },
  ]
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/90 pb-safe backdrop-blur-xl lg:hidden" aria-label="App">
      <div className="grid grid-cols-5">
        {tabs.slice(0, 2).map((t) => <Tab key={t.href} {...t} />)}
        <button onClick={() => setOpen(true)} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-bold text-muted" aria-label={`Bag (${count})`}>
          <span className="relative">
            <ShoppingBag className="size-[1.35rem]" />
            {count > 0 && (
              <motion.span key={count} initial={{ scale: 0.5 }} animate={{ scale: 1 }} className="absolute -top-1.5 -right-2 grid min-w-4 place-items-center rounded-full bg-clay px-1 text-[0.6rem] leading-4 text-white">
                {count}
              </motion.span>
            )}
          </span>
          Bag
        </button>
        {tabs.slice(2).map((t) => <Tab key={t.href} {...t} />)}
      </div>
    </nav>
  )
}

function Tab({ href, label, Icon, active }: { href: string; label: string; Icon: typeof Home; active: boolean }) {
  return (
    <Link href={href} className={cn('relative flex flex-col items-center gap-0.5 py-2.5 text-[0.65rem] font-bold', active ? 'text-ink' : 'text-muted')}>
      {active && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-clay" />}
      <Icon className="size-[1.35rem]" strokeWidth={active ? 2.2 : 1.8} />
      {label}
    </Link>
  )
}
