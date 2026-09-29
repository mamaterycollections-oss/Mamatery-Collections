import { PageHeader, Tabs } from '@/components/dash/ui'
import { requireStaff } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CategoriesSettings, CouponsSettings, OptionsSettings, StoreSettings, ZonesSettings } from './settings-forms'

export const metadata = { title: 'Settings' }

export default async function SettingsPage({ searchParams }: PageProps<'/dashboard/settings'>) {
  await requireStaff('owner')
  const sp = await searchParams
  const tab = typeof sp.tab === 'string' ? sp.tab : 'store'
  const supabase = await createClient()
  const [{ data: settings }, { data: zones }, { data: categories }, { data: options }, { data: coupons }] = await Promise.all([
    supabase.from('store_settings').select('*').eq('id', 1).single(),
    supabase.from('delivery_zones').select('*').order('sort_order'),
    supabase.from('categories').select('*, products(count)').order('sort_order'),
    supabase.from('attribute_options').select('*').order('sort_order'),
    supabase.from('coupons').select('*').order('created_at', { ascending: false }),
  ])
  return (
    <>
      <PageHeader title="Settings" description="Everything customers see and how checkout works. Changes go live immediately." />
      <Tabs active={tab} tabs={[
        { key: 'store', label: 'Store & checkout', href: '?tab=store' },
        { key: 'zones', label: 'Delivery areas', href: '?tab=zones' },
        { key: 'categories', label: 'Categories', href: '?tab=categories' },
        { key: 'options', label: 'Sizes & colours', href: '?tab=options' },
        { key: 'coupons', label: 'Discount codes', href: '?tab=coupons' },
      ]} />
      {tab === 'store' && settings && <StoreSettings settings={settings} />}
      {tab === 'zones' && <ZonesSettings zones={zones ?? []} />}
      {tab === 'categories' && <CategoriesSettings categories={(categories ?? []).map((c) => ({ ...c, productCount: (c.products as unknown as { count: number }[])[0]?.count ?? 0 }))} />}
      {tab === 'options' && <OptionsSettings options={options ?? []} />}
      {tab === 'coupons' && <CouponsSettings coupons={coupons ?? []} />}
    </>
  )
}
