import { requireUser } from '@/lib/auth'
import { AccountNav } from './account-nav'

export const metadata = { title: 'My account', robots: { index: false } }

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser('/account')
  return (
    <div className="container-page pt-8 sm:pt-12">
      <p className="eyebrow">My account</p>
      <h1 className="mt-2 font-display text-4xl sm:text-5xl">Hi, {(session.full_name ?? 'there').split(' ')[0]}</h1>
      <div className="mt-8 grid gap-8 lg:grid-cols-[14rem_1fr]">
        <AccountNav staff={session.role !== 'customer'} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  )
}
