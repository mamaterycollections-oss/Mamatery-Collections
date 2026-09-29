'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { motion } from 'motion/react'
import { CheckCheck, Loader2, ScanBarcode } from 'lucide-react'
import { beep, CameraScanner } from '@/components/dash/scanner'
import { useAction } from '@/components/dash/use-action'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { cancelCount, completeCount, countScan } from '../actions'

type Line = { variantId: string; expected: number; counted: number | null; name: string; label: string; sku: string; barcode: string }

export function CountSheet({ id, open, lines: initial }: { id: string; open: boolean; lines: Line[] }) {
  const router = useRouter()
  const toast = useToast()
  const { pending, run } = useAction()
  const [lines, setLines] = useState(initial)
  const [code, setCode] = useState('')
  const [scanning, start] = useTransition()
  const [flash, setFlash] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'diff' | 'todo'>('all')
  const [zero, setZero] = useState(false)

  const scan = (value: string, quantity = 1, increment = true) =>
    start(async () => {
      const r = await countScan(id, value, quantity, increment)
      if (!('ok' in r) || !r.ok) {
        beep(false)
        toast.error('error' in r ? r.error : 'Not found')
        return
      }
      beep(true)
      const { variantId, counted, name } = r.data!
      setFlash(variantId)
      setLines((ls) => (ls.some((l) => l.variantId === variantId) ? ls.map((l) => (l.variantId === variantId ? { ...l, counted } : l)) : [...ls, { variantId, counted, expected: 0, name, label: '', sku: value, barcode: value }]))
      setCode('')
    })

  const stats = useMemo(() => {
    const counted = lines.filter((l) => l.counted != null)
    return { counted: counted.length, total: lines.length, diffs: counted.filter((l) => l.counted !== l.expected).length }
  }, [lines])
  const shown = lines.filter((l) => (filter === 'diff' ? l.counted != null && l.counted !== l.expected : filter === 'todo' ? l.counted == null : true))

  return (
    <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
      {open && (
        <div className="space-y-4">
          <CameraScanner onScan={(c) => scan(c)} className="aspect-[4/3]" />
          <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) scan(code) }} className="relative">
            <ScanBarcode className="absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
            <input autoFocus value={code} onChange={(e) => setCode(e.target.value)} placeholder="Scan or type barcode / SKU" className="field h-14 rounded-2xl pl-12 text-base" aria-label="Scan item" />
            {scanning && <Loader2 className="absolute top-1/2 right-4 size-5 -translate-y-1/2 animate-spin text-muted" />}
          </form>
          <p className="text-xs text-muted">Each scan adds 1. Tap a number in the list to type a count instead.</p>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="h-2 overflow-hidden rounded-full bg-sand"><div className="h-full rounded-full bg-clay transition-all" style={{ width: `${(stats.counted / Math.max(1, stats.total)) * 100}%` }} /></div>
            <p className="mt-2 text-sm"><b>{stats.counted}</b> of {stats.total} counted · <b className="text-warning">{stats.diffs}</b> differences</p>
            <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 size-4 accent-ink" checked={zero} onChange={(e) => setZero(e.target.checked)} /> Items I didn&apos;t scan are missing (set them to 0)</label>
            <button disabled={pending} onClick={() => confirm('Apply this count? Stock levels will be corrected to what you counted.') && run(() => completeCount(id, zero), { onSuccess: () => router.push('/dashboard/stock-take') })} className="btn btn-primary mt-4 w-full">
              <CheckCheck className="size-4" /> Finish &amp; apply
            </button>
            <button disabled={pending} onClick={() => confirm('Cancel this count? Nothing will change.') && run(() => cancelCount(id), { onSuccess: () => router.push('/dashboard/stock-take') })} className="btn btn-ghost mt-1 w-full text-muted">Cancel count</button>
          </div>
        </div>
      )}
      <div className={cn('overflow-hidden rounded-2xl border border-line bg-white', !open && 'xl:col-span-2')}>
        <div className="flex gap-1 border-b border-line p-2 text-xs font-bold">
          {([['all', 'All'], ['todo', 'Not counted'], ['diff', 'Differences']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={cn('rounded-full px-3 py-1.5', filter === k ? 'bg-ink text-white' : 'text-muted')}>{l}</button>
          ))}
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="table">
            <thead><tr><th>Item</th><th>SKU</th><th className="text-right">System</th><th className="text-right">Counted</th><th className="text-right">Diff</th></tr></thead>
            <tbody>
              {shown.map((l) => {
                const diff = l.counted == null ? null : l.counted - l.expected
                return (
                  <motion.tr key={l.variantId} animate={flash === l.variantId ? { backgroundColor: ['#e3f0e6', '#ffffff'] } : {}} transition={{ duration: 1 }}>
                    <td><p className="font-semibold">{l.name}</p><p className="text-xs text-muted">{l.label}</p></td>
                    <td className="font-mono text-xs">{l.sku}</td>
                    <td className="text-right">{l.expected}</td>
                    <td className="text-right">
                      {open ? (
                        <input
                          type="number"
                          min={0}
                          defaultValue={l.counted ?? ''}
                          key={`${l.variantId}-${l.counted}`}
                          onBlur={(e) => e.target.value !== '' && Number(e.target.value) !== l.counted && scan(l.barcode, Number(e.target.value), false)}
                          className="field field-sm ml-auto w-20 text-right"
                          aria-label={`Counted for ${l.name} ${l.label}`}
                        />
                      ) : (l.counted ?? '—')}
                    </td>
                    <td className={cn('text-right font-bold', diff == null ? 'text-muted' : diff === 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-warning')}>{diff == null ? '—' : diff > 0 ? `+${diff}` : diff}</td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
