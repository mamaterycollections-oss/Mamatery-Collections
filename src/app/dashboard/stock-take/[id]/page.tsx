import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { CountSheet } from './count-sheet'

export default async function CountPage({ params }: PageProps<'/dashboard/stock-take/[id]'>) {
  const { id } = await params
  await requireStaff('manager')
  const supabase = await createClient()
  const { data: count } = await supabase
    .from('stock_counts')
    .select('id, title, status, created_at, stock_count_lines(variant_id, expected, counted, product_variants(sku, barcode_value, size, colour, products(name)))')
    .eq('id', id)
    .maybeSingle()
  if (!count) notFound()
  const lines = count.stock_count_lines
    .map((l) => ({
      variantId: l.variant_id, expected: l.expected, counted: l.counted,
      name: l.product_variants?.products?.name ?? '', label: [l.product_variants?.size, l.product_variants?.colour].filter(Boolean).join(' / '),
      sku: l.product_variants?.sku ?? '', barcode: l.product_variants?.barcode_value ?? '',
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.label.localeCompare(b.label))
  return (
    <>
      <PageHeader back={{ href: '/dashboard/stock-take', label: 'Stock counts' }} title={count.title} description={`Started ${formatDateTime(count.created_at)} · ${count.status}`} />
      <CountSheet id={count.id} open={count.status === 'open'} lines={lines} />
    </>
  )
}
