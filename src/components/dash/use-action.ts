'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { useToast } from '@/components/ui/toast'

export type ActionResult<T = unknown> = { ok: true; data?: T; message?: string } | { ok?: false; error: string }

// Runs a server action with a pending state, toasts the result and refreshes the page data.
export function useAction() {
  const router = useRouter()
  const toast = useToast()
  const [pending, start] = useTransition()
  const run = <T,>(fn: () => Promise<ActionResult<T>>, opts: { success?: string; onSuccess?: (data?: T) => void; refresh?: boolean } = {}) =>
    start(async () => {
      const r = await fn()
      if (!r || !('ok' in r) || !r.ok) {
        toast.error('error' in r ? r.error : 'Something went wrong')
        return
      }
      if (opts.success || r.message) toast.success(r.message ?? opts.success!)
      opts.onSuccess?.(r.data)
      if (opts.refresh !== false) router.refresh()
    })
  return { pending, run }
}
