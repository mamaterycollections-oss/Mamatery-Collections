import type { Metadata } from 'next'
import { Catalog } from './catalog'

export const metadata: Metadata = {
  title: 'Shop all',
  description: 'Browse clothes, bags, caps and accessories. Filter by size, colour and price. Pay with M-Pesa.',
}

export default async function ShopPage({ searchParams }: PageProps<'/shop'>) {
  return <Catalog params={await searchParams} />
}
