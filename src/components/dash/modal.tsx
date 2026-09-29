'use client'

import { useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Modal({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] grid place-items-end sm:place-items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
          <motion.div
            role="dialog"
            aria-label={title}
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36 }}
            className={cn('relative max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 pb-safe shadow-lift sm:rounded-3xl', wide ? 'sm:max-w-2xl' : 'sm:max-w-md')}
          >
            <div className="mb-5 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl">{title}</h2>
              <button onClick={onClose} className="btn-icon btn-ghost" aria-label="Close"><X className="size-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
