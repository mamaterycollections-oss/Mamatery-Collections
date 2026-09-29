'use client'

import { useEffect, useState } from 'react'
import { BellRing, CheckCheck } from 'lucide-react'
import { enablePush, pushSupported } from '@/components/service-worker'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { markAllRead } from './actions'

export function MarkAllRead() {
  const { pending, run } = useAction()
  return <button disabled={pending} onClick={() => run(() => markAllRead())} className="btn btn-light btn-sm"><CheckCheck className="size-4" /> Mark all read</button>
}

// Phone/desktop alerts for new orders, payments and low stock (PWA / Android app).
export function PushToggle() {
  const toast = useToast()
  const [state, setState] = useState<'unknown' | 'on' | 'off' | 'unsupported'>('unknown')
  useEffect(() => {
    if (!pushSupported()) return setState('unsupported')
    setState(Notification.permission === 'granted' ? 'on' : 'off')
  }, [])
  if (state === 'unsupported' || state === 'unknown') return null
  return (
    <button
      onClick={async () => {
        const r = await enablePush()
        if (r === 'enabled') { setState('on'); toast.success('Alerts enabled on this device') }
        else if (r === 'denied') toast.error('Notifications are blocked', 'Allow them in your browser/app settings.')
        else toast.error('Could not enable alerts on this device')
      }}
      className="btn btn-light btn-sm"
    >
      <BellRing className="size-4" /> {state === 'on' ? 'Alerts on (re-sync)' : 'Get alerts on this device'}
    </button>
  )
}
