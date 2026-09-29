'use client'

import { Check, Trash2, X } from 'lucide-react'
import { useAction } from '@/components/dash/use-action'
import { deleteReview, moderateReview } from './actions'

export function ReviewActions({ id, status, canDelete }: { id: string; status: string; canDelete: boolean }) {
  const { pending, run } = useAction()
  return (
    <div className="flex gap-2">
      {status !== 'approved' && <button disabled={pending} onClick={() => run(() => moderateReview(id, 'approved'), { success: 'Published' })} className="btn btn-primary btn-sm"><Check className="size-4" /> Publish</button>}
      {status !== 'rejected' && <button disabled={pending} onClick={() => run(() => moderateReview(id, 'rejected'), { success: 'Rejected' })} className="btn btn-light btn-sm"><X className="size-4" /> Reject</button>}
      {canDelete && <button disabled={pending} onClick={() => confirm('Delete this review permanently?') && run(() => deleteReview(id), { success: 'Deleted' })} className="btn-icon btn-ghost text-danger" aria-label="Delete"><Trash2 className="size-4" /></button>}
    </div>
  )
}
