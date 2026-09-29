'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'

type Tone = 'success' | 'error' | 'info'
type Toast = { id: number; tone: Tone; title: string; body?: string }
type Ctx = { toast: (t: Omit<Toast, 'id'>) => void; success: (title: string, body?: string) => void; error: (title: string, body?: string) => void }

const ToastContext = createContext<Ctx | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast outside ToastProvider')
  return ctx
}

const ICON = { success: CheckCircle2, error: AlertCircle, info: Info }
const TONE = { success: 'text-success', error: 'text-danger', info: 'text-info' }

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = Date.now() + Math.random()
      setToasts((list) => [...list.slice(-2), { ...t, id }])
      setTimeout(() => dismiss(id), t.tone === 'error' ? 6000 : 3500)
    },
    [dismiss],
  )
  const value = useMemo<Ctx>(
    () => ({
      toast,
      success: (title, body) => toast({ tone: 'success', title, body }),
      error: (title, body) => toast({ tone: 'error', title, body }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3 sm:top-auto sm:bottom-6 sm:items-end sm:right-6 sm:left-auto">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const Icon = ICON[t.tone]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -16, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.18 } }}
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-line bg-white p-4 shadow-lift"
                role={t.tone === 'error' ? 'alert' : 'status'}
              >
                <Icon className={`mt-0.5 size-5 shrink-0 ${TONE[t.tone]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t.title}</p>
                  {t.body && <p className="mt-0.5 text-sm text-muted">{t.body}</p>}
                </div>
                <button onClick={() => dismiss(t.id)} className="text-muted hover:text-ink" aria-label="Dismiss">
                  <X className="size-4" />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
