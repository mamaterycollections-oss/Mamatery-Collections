import Link from 'next/link'
import { Star } from 'lucide-react'
import { EmptyState, PageHeader, Tabs } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { ReviewActions } from './review-actions'

export const metadata = { title: 'Reviews' }

export default async function ReviewsPage({ searchParams }: PageProps<'/dashboard/reviews'>) {
  const { perms } = await requireStaff('manager')
  const sp = await searchParams
  const tab = (typeof sp.tab === 'string' ? sp.tab : 'pending') as 'pending' | 'approved' | 'rejected'
  const supabase = await createClient()
  const [{ data }, { count }] = await Promise.all([
    supabase.from('reviews').select('id, rating, title, comment, author_name, verified_purchase, status, created_at, products(name, slug)').eq('status', tab).order('created_at', { ascending: false }).limit(100),
    supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
  ])
  return (
    <>
      <PageHeader title="Reviews" description="Approve reviews before they appear on product pages." />
      <Tabs active={tab} tabs={[
        { key: 'pending', label: 'To moderate', href: '?tab=pending', count },
        { key: 'approved', label: 'Published', href: '?tab=approved' },
        { key: 'rejected', label: 'Rejected', href: '?tab=rejected' },
      ]} />
      {!data?.length ? (
        <div className="rounded-2xl border border-line bg-white"><EmptyState Icon={Star} title={tab === 'pending' ? 'No reviews waiting' : 'Nothing here'} /></div>
      ) : (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className="rounded-2xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map((s) => <Star key={s} className={`size-4 ${s <= r.rating ? 'fill-gold text-gold' : 'text-stone'}`} />)}</div>
                  {r.title && <p className="mt-2 font-bold">{r.title}</p>}
                  {r.comment && <p className="mt-1 text-sm text-muted">{r.comment}</p>}
                  <p className="mt-2 text-xs text-muted">
                    {r.author_name ?? 'Customer'}{r.verified_purchase ? ' · verified buyer' : ''} · {formatDateTime(r.created_at)} · on{' '}
                    {r.products && <Link href={`/product/${r.products.slug}`} target="_blank" className="font-semibold text-ink underline">{r.products.name}</Link>}
                  </p>
                </div>
                <ReviewActions id={r.id} status={r.status} canDelete={perms.owner} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
