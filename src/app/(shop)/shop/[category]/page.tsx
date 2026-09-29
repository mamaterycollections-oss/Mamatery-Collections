import type { Metadata } from 'next'
import { getCategories } from '@/lib/store'
import { Catalog } from '../catalog'

export async function generateMetadata({ params }: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const { category } = await params
  const c = (await getCategories()).find((x) => x.slug === category)
  return c ? { title: c.name, description: c.description ?? `Shop ${c.name} at MamaTerryCollections.` } : {}
}

export default async function CategoryPage({ params, searchParams }: PageProps<'/shop/[category]'>) {
  const { category } = await params
  return <Catalog categorySlug={category} params={await searchParams} />
}
