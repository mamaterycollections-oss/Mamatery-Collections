'use client'

import { motion } from 'motion/react'
import { Check } from 'lucide-react'
import type { Enums } from '@/lib/supabase/database.types'
import { cn, formatDateTime, ORDER_STATUS_LABEL } from '@/lib/utils'

type Status = Enums<'order_status'>

export function OrderTimeline({ status, method, history }: { status: Status; method: Enums<'delivery_method'>; history: { status: Status; created_at: string; note: string | null }[] }) {
  const steps: Status[] =
    method === 'pickup' ? ['placed', 'confirmed', 'packed', 'ready_for_pickup', 'collected'] : ['placed', 'confirmed', 'packed', 'out_for_delivery', 'delivered']
  if (status === 'returned') steps.push('returned')
  const current = steps.indexOf(status)
  const when = (s: Status) => history.filter((h) => h.status === s).at(-1)?.created_at

  return (
    <ol className="mt-6">
      {steps.map((s, i) => {
        const done = i <= current
        return (
          <li key={s} className="relative flex gap-4 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span className="absolute top-8 left-[15px] h-[calc(100%-2rem)] w-0.5 bg-stone">
                <motion.span className="block w-full bg-success" initial={{ height: 0 }} animate={{ height: i < current ? '100%' : 0 }} transition={{ duration: 0.5, delay: 0.2 + i * 0.15 }} />
              </span>
            )}
            <motion.span
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.12, type: 'spring', stiffness: 400, damping: 20 }}
              className={cn('relative z-10 grid size-8 shrink-0 place-items-center rounded-full border-2', done ? 'border-success bg-success text-white' : 'border-stone bg-white')}
            >
              {done ? <Check className="size-4" strokeWidth={3} /> : <span className="size-2 rounded-full bg-stone" />}
              {i === current && status !== 'delivered' && status !== 'collected' && (
                <motion.span className="absolute inset-0 rounded-full border-2 border-success" animate={{ scale: [1, 1.5], opacity: [0.7, 0] }} transition={{ duration: 1.6, repeat: Infinity }} />
              )}
            </motion.span>
            <div className="pt-1">
              <p className={cn('text-sm font-bold', !done && 'text-muted')}>{ORDER_STATUS_LABEL[s]}</p>
              {when(s) && <p className="text-xs text-muted">{formatDateTime(when(s))}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
