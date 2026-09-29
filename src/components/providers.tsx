'use client'

import { MotionConfig } from 'motion/react'
import { AuthProvider } from '@/components/auth-provider'
import { CartProvider } from '@/components/cart/cart-provider'
import { WishlistProvider } from '@/components/wishlist-provider'
import { ToastProvider } from '@/components/ui/toast'
import { ServiceWorker } from '@/components/service-worker'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <AuthProvider>
          <WishlistProvider>
            <CartProvider>{children}</CartProvider>
          </WishlistProvider>
        </AuthProvider>
      </ToastProvider>
      <ServiceWorker />
    </MotionConfig>
  )
}
