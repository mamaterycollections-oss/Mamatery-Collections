'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  BarChart3, Bell, Boxes, ClipboardCheck, ExternalLink, LayoutDashboard, LogOut, Menu, Package, ScanBarcode, ScrollText,
  Settings, ShoppingBag, Star, Tags, Users, UserRound, Wallet, X,
} from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'
import { useToast } from '@/components/ui/toast'
import type { Permissions } from '@/lib/auth'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type Item = { href: string; label: string; Icon: typeof Bell; show: boolean; badge?: number; exact?: boolean }

export function DashShell({
  user, perms, unread: initialUnread, badges, children,
}: {
  user: { id: string; name: string; role: string }
  perms: Permissions
  unread: number
  badges: { orders: number; reviews: number; inventory: number }
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [unread, setUnread] = useState(initialUnread)

  useEffect(() => setUnread(initialUnread), [initialUnread])
  useEffect(() => setOpen(false), [pathname])

  // Live notifications: bump the bell and show a toast as they arrive.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notif-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, (payload) => {
        const n = payload.new as { title: string; message: string }
        setUnread((u) => u + 1)
        toast.toast({ tone: 'info', title: n.title, body: n.message })
        router.refresh()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user.id, toast, router])

  const groups: { title: string; items: Item[] }[] = [
    { title: '', items: [{ href: '/dashboard', label: 'Overview', Icon: LayoutDashboard, show: true, exact: true }] },
    {
      title: 'Sell',
      items: [
        { href: '/dashboard/pos', label: 'Quick sale', Icon: ScanBarcode, show: perms.staff },
        { href: '/dashboard/orders', label: 'Orders', Icon: ShoppingBag, show: perms.staff, badge: badges.orders },
        { href: '/dashboard/customers', label: 'Customers', Icon: UserRound, show: perms.manager },
        { href: '/dashboard/cash', label: 'Cash drawer', Icon: Wallet, show: perms.staff },
      ],
    },
    {
      title: 'Catalog',
      items: [
        { href: '/dashboard/products', label: 'Products', Icon: Package, show: perms.manager },
        { href: '/dashboard/inventory', label: 'Inventory', Icon: Boxes, show: perms.manager, badge: badges.inventory },
        { href: '/dashboard/labels', label: 'Barcode labels', Icon: Tags, show: perms.manager },
        { href: '/dashboard/stock-take', label: 'Stock count', Icon: ClipboardCheck, show: perms.manager },
        { href: '/dashboard/reviews', label: 'Reviews', Icon: Star, show: perms.manager, badge: badges.reviews },
      ],
    },
    {
      title: 'Business',
      items: [
        { href: '/dashboard/reports', label: 'Reports', Icon: BarChart3, show: perms.manager },
        { href: '/dashboard/team', label: 'Team', Icon: Users, show: perms.staff },
        { href: '/dashboard/audit', label: 'Audit log', Icon: ScrollText, show: perms.owner },
        { href: '/dashboard/settings', label: 'Settings', Icon: Settings, show: perms.owner },
      ],
    },
  ]

  const nav = (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Dashboard">
      {groups.map((g) => {
        const items = g.items.filter((i) => i.show)
        if (!items.length) return null
        return (
          <div key={g.title || 'main'}>
            {g.title && <p className="mb-1.5 px-3 text-[0.65rem] font-bold tracking-[0.16em] text-paper/40 uppercase">{g.title}</p>}
            <ul className="space-y-0.5">
              {items.map(({ href, label, Icon, badge, exact }) => {
                const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
                return (
                  <li key={href}>
                    <Link href={href} className={cn('relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition', active ? 'text-ink' : 'text-paper/70 hover:bg-white/5 hover:text-white')}>
                      {active && <motion.span layoutId="dash-active" className="absolute inset-0 rounded-xl bg-paper" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
                      <Icon className="relative size-4.5" />
                      <span className="relative flex-1">{label}</span>
                      {badge ? <span className={cn('relative rounded-full px-1.5 py-0.5 text-[0.65rem] font-bold', active ? 'bg-clay text-white' : 'bg-clay/90 text-white')}>{badge}</span> : null}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </nav>
  )

  const sidebar = (
    <div className="flex h-full flex-col bg-ink text-paper">
      <Link href="/dashboard" className="flex items-center gap-3 px-6 py-5">
        <LogoMark className="size-9" />
        <span className="leading-tight">
          <span className="block font-display text-lg">MamaTerry</span>
          <span className="block text-[0.6rem] font-bold tracking-[0.3em] text-gold">DASHBOARD</span>
        </span>
      </Link>
      {nav}
      <div className="border-t border-white/10 p-3">
        <Link href="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-paper/70 hover:bg-white/5 hover:text-white">
          <ExternalLink className="size-4" /> View store
        </Link>
        <div className="mt-2 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-clay text-xs font-bold">{user.name.slice(0, 1).toUpperCase()}</span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{user.name}</span>
            <span className="block text-xs text-paper/50">{user.role}</span>
          </span>
          <form action="/auth/signout" method="post">
            <button className="grid size-8 place-items-center rounded-lg text-paper/60 hover:bg-white/10 hover:text-white" aria-label="Sign out" title="Sign out">
              <LogOut className="size-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh bg-[#f7f4ef] lg:grid lg:grid-cols-[16rem_1fr] print:block print:bg-white">
      <aside className="no-print sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <button className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} aria-label="Close menu" />
            <motion.aside initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ type: 'spring', stiffness: 400, damping: 40 }} className="absolute inset-y-0 left-0 w-72">
              {sidebar}
              <button onClick={() => setOpen(false)} className="absolute top-5 right-3 grid size-9 place-items-center rounded-lg text-paper/70" aria-label="Close menu"><X className="size-5" /></button>
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-w-0">
        <header className="no-print sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-line bg-[#f7f4ef]/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-2">
            <button onClick={() => setOpen(true)} className="btn-icon btn-ghost -ml-2 lg:hidden" aria-label="Open menu"><Menu className="size-5" /></button>
            <LogoMark className="size-7 lg:hidden" />
          </div>
          <div className="flex items-center gap-1">
            {perms.staff && (
              <Link href="/dashboard/pos" className="btn btn-accent btn-sm">
                <ScanBarcode className="size-4" /> <span className="hidden sm:inline">Quick sale</span>
              </Link>
            )}
            <Link href="/dashboard/notifications" className="btn-icon btn-ghost relative" aria-label={`Notifications (${unread} unread)`}>
              <Bell className="size-5" />
              <AnimatePresence>
                {unread > 0 && (
                  <motion.span key={unread} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} className="absolute top-0.5 right-0.5 grid min-w-4 place-items-center rounded-full bg-clay px-1 text-[0.6rem] leading-4 font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:py-8 print:p-0">{children}</main>
      </div>
    </div>
  )
}
