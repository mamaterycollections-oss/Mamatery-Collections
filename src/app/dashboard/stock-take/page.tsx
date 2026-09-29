import Link from 'next/link'
import { ClipboardCheck } from 'lucide-react'
import { EmptyState, PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { NewCount } from './new-count'

export const metadata = { title: 'Stock count' }

export default async function StockTakePage() {
  await requireStaff('manager')
  const supabase = await createClient()
  const [{ data: counts }, { data: categories }] = await Promise.all([
    supabase.from('stock_counts').select('id, title, status, created_at, completed_at, categories(name), stock_count_lines(counted, expected)').order('created_at', { ascending: false }).limit(50),
    supabase.from('categories').select('id, name').order('sort_order'),
  ])
  return (
    <>
      <PageHeader title="Stock count" description="Walk the shelves and scan every item. When you finish, differences are corrected and recorded." actions={<NewCount categories={categories ?? []} />} />
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {!counts?.length ? (
          <EmptyState Icon={ClipboardCheck} title="No stock counts yet" body="Start one to check what's really on the shelves against the system." />
        ) : (
          <table className="table">
            <thead><tr><th>Count</th><th>Scope</th><th>Progress</th><th>Differences</th><th>Status</th></tr></thead>
            <tbody>
              {counts.map((c) => {
                const counted = c.stock_count_lines.filter((l) => l.counted != null)
                const diffs = counted.filter((l) => l.counted !== l.expected).length
                return (
                  <tr key={c.id}>
                    <td><Link href={`/dashboard/stock-take/${c.id}`} className="font-bold hover:text-clay">{c.title}</Link><p className="text-xs text-muted">{formatDateTime(c.created_at)}</p></td>
                    <td>{c.categories?.name ?? 'Whole shop'}</td>
                    <td>{counted.length} / {c.stock_count_lines.length}</td>
                    <td>{diffs ? <span className="chip bg-warning-soft text-warning">{diffs}</span> : '—'}</td>
                    <td><span className={`chip ${c.status === 'open' ? 'bg-info-soft text-info' : c.status === 'completed' ? 'bg-success-soft text-success' : 'bg-sand text-muted'}`}>{c.status}</span></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
