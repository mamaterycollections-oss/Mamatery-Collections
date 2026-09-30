'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Download, X } from 'lucide-react'
import { LogoMark } from '@/components/brand/logo'

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }
const KEY = 'mt-install-dismissed'

// "Add the app" card for Android/desktop Chrome visitors (not shown inside the installed app).
export function InstallPrompt() {
  const [event, setEvent] = useState<BIPEvent | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    try {
      if (Number(localStorage.getItem(KEY)) > Date.now()) return
    } catch {}
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as BIPEvent)
      setTimeout(() => setShow(true), 20000) // let people browse first
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const dismiss = () => {
    setShow(false)
    try {
      localStorage.setItem(KEY, String(Date.now() + 14 * 86400000))
    } catch {}
  }

  return (
    <AnimatePresence>
      {show && event && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-line bg-white p-3 shadow-lift lg:bottom-6"
          role="dialog"
          aria-label="Install the MamaTerry app"
        >
          <LogoMark className="size-11 rounded-xl" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Get the MamaTerry app</p>
            <p className="text-xs text-muted">Faster shopping, order alerts, works offline.</p>
          </div>
          <button
            onClick={async () => {
              await event.prompt()
              await event.userChoice
              setEvent(null)
              setShow(false)
            }}
            className="btn btn-primary btn-sm"
          >
            <Download className="size-4" /> Install
          </button>
          <button onClick={dismiss} className="text-muted hover:text-ink" aria-label="Not now"><X className="size-4" /></button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
