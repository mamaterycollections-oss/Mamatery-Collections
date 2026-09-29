import { PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { loadEditorData } from '../load'
import { ProductEditor } from '../product-editor'

export const metadata = { title: 'New product' }

export default async function NewProductPage() {
  const { perms } = await requireStaff('manager')
  const data = await loadEditorData(perms)
  return (
    <>
      <PageHeader back={{ href: '/dashboard/products', label: 'Products' }} title="New product" description="Barcodes and SKUs are created automatically for every size/colour." />
      <ProductEditor {...data} perms={{ margins: perms.margins, owner: perms.owner }} />
    </>
  )
}
