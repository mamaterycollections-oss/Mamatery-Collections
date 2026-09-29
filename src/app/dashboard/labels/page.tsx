import { PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { getSettings } from '@/lib/store'
import { createClient } from '@/lib/supabase/server'
import { LabelDesigner } from './label-designer'

export const metadata = { title: 'Barcode labels' }

export default async function LabelsPage({ searchParams }: PageProps<'/dashboard/labels'>) {
  await requireStaff('manager')
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data }, settings] = await Promise.all([
    supabase
      .from('products')
      .select('id, name, images, product_variants(id, size, colour, sku, barcode_value, selling_price, quantity_on_hand, is_active)')
      .order('name'),
    getSettings(),
  ])
  const products = (data ?? []).map((p) => ({ ...p, product_variants: p.product_variants.filter((v) => v.is_active).map((v) => ({ ...v, selling_price: Number(v.selling_price) })) })).filter((p) => p.product_variants.length)
  return (
    <>
      <div className="no-print">
        <PageHeader title="Barcode labels" description="Print sticker labels for stock-taking and scan-to-sell. Every size/colour has its own barcode." />
      </div>
      <LabelDesigner products={products} preselect={typeof sp.product === 'string' ? sp.product : null} storeName={settings.store_name} />
    </>
  )
}
