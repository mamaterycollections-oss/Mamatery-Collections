import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExternalLink, Tags } from 'lucide-react'
import { PageHeader } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { loadEditorData } from '../load'
import { ProductEditor } from '../product-editor'

export default async function EditProductPage({ params }: PageProps<'/dashboard/products/[id]'>) {
  const { id } = await params
  const { perms } = await requireStaff('manager')
  const data = await loadEditorData(perms, id)
  if (!data.product) notFound()
  return (
    <>
      <PageHeader
        back={{ href: '/dashboard/products', label: 'Products' }}
        title={data.product.name}
        actions={
          <>
            <Link href={`/dashboard/labels?product=${id}`} className="btn btn-light btn-sm"><Tags className="size-4" /> Print labels</Link>
            <Link href={`/product/${data.product.slug}`} target="_blank" className="btn btn-light btn-sm"><ExternalLink className="size-4" /> View in shop</Link>
          </>
        }
      />
      <ProductEditor {...data} perms={{ margins: perms.margins, owner: perms.owner }} />
    </>
  )
}
