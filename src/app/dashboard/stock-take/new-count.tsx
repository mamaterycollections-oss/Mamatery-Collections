'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Loader2, Plus } from 'lucide-react'
import { Modal } from '@/components/dash/modal'
import { useAction } from '@/components/dash/use-action'
import { startCount } from './actions'

export function NewCount({ categories }: { categories: { id: string; name: string }[] }) {
  const router = useRouter()
  const { pending, run } = useAction()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [cat, setCat] = useState('')
  return (
    <>
      <button onClick={() => setOpen(true)} className="btn btn-primary"><Plus className="size-4" /> New count</button>
      <Modal open={open} onClose={() => setOpen(false)} title="Start a stock count">
        <label className="label" htmlFor="ct">Name</label>
        <input id="ct" className="field" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`Stock count ${new Date().toLocaleDateString('en-KE')}`} />
        <label className="label mt-4" htmlFor="cc">What are you counting?</label>
        <select id="cc" className="field" value={cat} onChange={(e) => setCat(e.target.value)}>
          <option value="">Whole shop</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name} only</option>)}
        </select>
        <p className="hint">The system snapshots current stock now. Sales made during the count are handled correctly.</p>
        <button disabled={pending} onClick={() => run(() => startCount(title, cat || null), { onSuccess: (id) => router.push(`/dashboard/stock-take/${id}`), refresh: false })} className="btn btn-primary mt-5 w-full">
          {pending && <Loader2 className="size-4 animate-spin" />} Start counting
        </button>
      </Modal>
    </>
  )
}
