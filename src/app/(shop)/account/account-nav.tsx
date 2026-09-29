'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'motion/react'
import { Heart, LayoutDashboard, LogOut, MapPin, Package, Settings, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AccountNav({ staff }: { staff: boolean }) {
  const pathname = usePathname()
  const items = [
    { href: '/account', label: 'Overview', Icon: User },
    { href: '/account/orders', label: 'Orders', Icon: Package },
    { href: '/account/addresses', label: 'Addresses', Icon: MapPin },
    { href: '/wishlist', label: 'Wishlist', Icon: Heart },
    { href: '/account/settings', label: 'Settings', Icon: Settings },
    ...(staff ? [{ href: '/dashboard', label: 'Staff dashboard', Icon: LayoutDashboard }] : []),
  ]
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:flex-col lg:px-0" aria-label="Account">
      {items.map(({ href, label, Icon }) => {
        const active = href === '/account' ? pathname === href : pathname.startsWith(href)
        return (
          <Link key={href} href={href} className={cn('relative flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold transition', active ? 'text-white' : 'text-muted hover:bg-sand hover:text-ink')}>
            {active && <motion.span layoutId="acct-nav" className="absolute inset-0 rounded-xl bg-ink" />}
            <Icon className="relative size-4" /> <span className="relative">{label}</span>
          </Link>
        )
      })}
      <form action="/auth/signout" method="post" className="shrink-0">
        <button className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-muted hover:bg-sand hover:text-ink">
          <LogOut className="size-4" /> Sign out
        </button>
      </form>
    </nav>
  )
}
