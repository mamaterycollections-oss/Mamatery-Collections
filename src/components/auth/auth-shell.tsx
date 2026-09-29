import Image from 'next/image'
import { createPublicClient } from '@/lib/supabase/public'

// Split layout for sign-in screens: form on the left, brand imagery on the right.
export async function AuthShell({ children }: { children: React.ReactNode }) {
  const { data } = await createPublicClient().from('products').select('images, name').eq('is_active', true).eq('is_featured', true).limit(2)
  const [a, b] = data ?? []
  return (
    <div className="container-page grid min-h-[calc(100dvh-8rem)] items-center gap-10 py-10 lg:grid-cols-2">
      <div className="mx-auto w-full max-w-md animate-fade-up">{children}</div>
      <div className="relative hidden h-[36rem] overflow-hidden rounded-[2rem] bg-ink lg:block">
        <div className="absolute -top-20 -right-20 size-80 rounded-full bg-clay/50 blur-3xl" />
        {a?.images[0] && (
          <div className="absolute top-12 left-12 aspect-[4/5] w-[52%] -rotate-3 overflow-hidden rounded-3xl shadow-lift">
            <Image src={a.images[0]} alt={a.name} fill sizes="25vw" className="object-cover" />
          </div>
        )}
        {b?.images[0] && (
          <div className="absolute right-12 bottom-24 aspect-[4/5] w-[40%] rotate-3 overflow-hidden rounded-3xl border-4 border-ink shadow-lift">
            <Image src={b.images[0]} alt={b.name} fill sizes="20vw" className="object-cover" />
          </div>
        )}
        <p className="absolute bottom-8 left-10 max-w-xs font-display text-3xl leading-tight text-paper">
          Style that <span className="text-gold italic">speaks</span> for you.
        </p>
      </div>
    </div>
  )
}
