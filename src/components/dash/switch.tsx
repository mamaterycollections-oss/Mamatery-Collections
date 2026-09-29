'use client'

import { motion } from 'motion/react'
import { cn } from '@/lib/utils'

export function Switch({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors disabled:opacity-50', checked ? 'justify-end bg-success' : 'justify-start bg-stone')}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 700, damping: 35 }} className="size-5 rounded-full bg-white shadow" />
    </button>
  )
}
