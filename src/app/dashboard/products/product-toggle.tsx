'use client'

import { useAction } from '@/components/dash/use-action'
import { Switch } from '@/components/dash/switch'
import { setProductActive } from './actions'

export function ProductToggle({ id, active }: { id: string; active: boolean }) {
  const { pending, run } = useAction()
  return <Switch checked={active} disabled={pending} onChange={(v) => run(() => setProductActive(id, v))} label={active ? 'Visible in shop' : 'Hidden'} />
}
