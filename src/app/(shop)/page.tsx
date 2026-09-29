import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight, MessageCircle, RotateCcw, ShieldCheck, Star, Truck } from 'lucide-react'
import { Hero, Marquee } from '@/components/shop/hero'
import { ProductCard } from '@/components/shop/product-card'
import { Reveal, SectionHeading } from '@/components/ui/reveal'
import { getCategories, getOptions, getSettings, PRODUCT_CARD_FIELDS, whatsappLink } from '@/lib/store'
import { createPublicClient } from '@/lib/supabase/public'

export const revalidate = 60

export default async function HomePage() {
  const supabase = createPublicClient()
  const [settings, categories, options, featured, latest, reviews] = await Promise.all([
    getSettings(),
    getCategories(),
    getOptions(),
    supabase.from('products').select(PRODUCT_CARD_FIELDS).eq('is_active', true).eq('is_featured', true).order('created_at', { ascending: false }).limit(8),
    supabase.from('products').select(PRODUCT_CARD_FIELDS).eq('is_active', true).order('created_at', { ascending: false }).limit(8),
    supabase.from('reviews').select('id, rating, title, comment, author_name, verified_purchase, products(name, slug)').eq('status', 'approved').gte('rating', 4).order('created_at', { ascending: false }).limit(3),
  ])
  const colourHex = Object.fromEntries(options.colours.map((c) => [c.value, c.hex]))
  const featuredAll = featured.data ?? []
  // Whole rows of four on desktop
  const featuredList = featuredAll.length > 4 ? featuredAll.slice(0, Math.floor(featuredAll.length / 4) * 4) : featuredAll
  const latestList = latest.data ?? []
  const heroPool = [...featuredList, ...latestList].filter((p) => p.images[0])
  const heroImages = heroPool.slice(0, 3).map((p) => ({ src: p.images[0], alt: p.name, href: `/product/${p.slug}` }))

  // Category covers: the owner's image, or the newest product image in that category.
  const top = categories.filter((c) => !c.parent_id)
  const covers = await Promise.all(
    top.map(async (c) => {
      if (c.image_url) return c.image_url
      const { data } = await supabase.from('products').select('images').eq('category_id', c.id).eq('is_active', true).order('is_featured', { ascending: false }).limit(1).maybeSingle()
      return data?.images[0] ?? null
    }),
  )
  const wa = whatsappLink(settings.whatsapp ?? settings.phone, 'Hi MamaTerryCollections! I would like to ask about…')
  const bagHero = heroPool.find((p) => /bag|tote|clutch|crossbody/i.test(p.name)) ?? heroPool[0]

  return (
    <>
      <Hero images={heroImages} tagline={settings.tagline} />
      <Marquee items={['Pay with M-Pesa', 'Delivery across Kenya', 'New drops every week', 'Easy returns', 'Chat with us on WhatsApp']} />

      {/* Categories */}
      <section className="container-page pt-20 sm:pt-28">
        <SectionHeading eyebrow="Shop by category" title="Find your next favourite" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {top.map((c, i) => (
            <Reveal key={c.id} delay={i * 0.06}>
              <Link href={`/shop/${c.slug}`} className="group relative block aspect-[3/4] overflow-hidden rounded-3xl bg-sand">
                {covers[i] && (
                  <Image src={covers[i]!} alt={c.name} fill sizes="(min-width:1024px) 24vw, 48vw" className="object-cover transition duration-[900ms] ease-out group-hover:scale-110" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/5 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4 text-white sm:p-6">
                  <div>
                    <h3 className="font-display text-2xl sm:text-3xl">{c.name}</h3>
                    {c.description && <p className="mt-1 line-clamp-1 hidden text-xs text-white/75 sm:block">{c.description}</p>}
                  </div>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-ink transition duration-300 group-hover:-rotate-45 group-hover:bg-clay group-hover:text-white">
                    <ArrowRight className="size-4" />
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      {/* New arrivals */}
      {latestList.length > 0 && (
        <section className="container-page pt-20 sm:pt-28">
          <SectionHeading
            eyebrow="Just landed"
            title="New arrivals"
            action={
              <Link href="/shop?sort=new" className="btn btn-light btn-sm shrink-0">
                View all <ArrowRight className="size-4" />
              </Link>
            }
          />
          <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-6 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {latestList.map((p, i) => (
              <div key={p.id} className="w-[62%] shrink-0 snap-start sm:w-auto">
                <ProductCard product={p} index={i} colourHex={colourHex} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Editorial banner */}
      {bagHero && (
        <section className="container-page pt-20 sm:pt-28">
          <Reveal>
            <div className="relative grid overflow-hidden rounded-[2rem] bg-ink text-paper lg:grid-cols-2">
              <div aria-hidden className="absolute -top-24 -left-24 size-96 rounded-full bg-clay/40 blur-3xl" />
              <div className="relative z-10 flex flex-col justify-center p-8 sm:p-14">
                <p className="eyebrow text-gold">The edit</p>
                <h2 className="mt-4 font-display text-4xl leading-[1.02] sm:text-6xl">
                  Carry it <span className="text-gold italic">beautifully.</span>
                </h2>
                <p className="mt-5 max-w-sm text-paper/70">
                  Structured handbags, everyday totes and evening clutches — the finishing touch every outfit deserves.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/shop/bags" className="btn btn-lg bg-paper text-ink hover:bg-gold">
                    Shop bags <ArrowRight className="size-4" />
                  </Link>
                  <Link href="/shop/caps" className="btn btn-lg border border-paper/30 text-paper hover:bg-paper/10">
                    Caps &amp; hats
                  </Link>
                </div>
              </div>
              <Link href={`/product/${bagHero.slug}`} className="group relative min-h-80 lg:min-h-[34rem]">
                <Image src={bagHero.images[1] ?? bagHero.images[0]} alt={bagHero.name} fill sizes="(min-width:1024px) 45vw, 100vw" className="object-cover transition duration-[1200ms] group-hover:scale-105" />
              </Link>
            </div>
          </Reveal>
        </section>
      )}

      {/* Featured */}
      {featuredList.length > 0 && (
        <section className="container-page pt-20 sm:pt-28">
          <SectionHeading eyebrow="Loved by our customers" title="Most wanted" action={<Link href="/shop" className="btn btn-light btn-sm shrink-0">Shop all <ArrowRight className="size-4" /></Link>} />
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
            {featuredList.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} colourHex={colourHex} />
            ))}
          </div>
        </section>
      )}

      {/* Promise */}
      <section className="container-page pt-20 sm:pt-28">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { Icon: ShieldCheck, title: 'Pay with M-Pesa', body: 'A secure prompt straight to your phone. Cards accepted too.' },
            { Icon: Truck, title: 'Delivered to you', body: 'Fast delivery in Nairobi and countrywide by courier.' },
            { Icon: RotateCcw, title: 'Easy returns', body: `Changed your mind? Return unworn items within ${settings.return_window_days} days.` },
            { Icon: MessageCircle, title: 'Real people', body: 'Questions about sizing or colour? Chat with us on WhatsApp.' },
          ].map(({ Icon, title, body }, i) => (
            <Reveal key={title} delay={i * 0.06}>
              <div className="h-full rounded-3xl border border-line bg-white p-6 transition hover:-translate-y-1 hover:shadow-soft">
                <span className="grid size-11 place-items-center rounded-2xl bg-clay-soft text-clay">
                  <Icon className="size-5" />
                </span>
                <h3 className="mt-4 font-bold">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Reviews */}
      {(reviews.data?.length ?? 0) > 0 && (
        <section className="container-page pt-20 sm:pt-28">
          <SectionHeading eyebrow="Reviews" title="In their words" />
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.data!.map((r, i) => (
              <Reveal key={r.id} delay={i * 0.08}>
                <figure className="flex h-full flex-col rounded-3xl bg-sand p-7">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }, (_, s) => (
                      <Star key={s} className={`size-4 ${s < r.rating ? 'fill-gold text-gold' : 'text-stone'}`} />
                    ))}
                  </div>
                  <blockquote className="mt-4 flex-1 font-display text-xl leading-snug">“{r.comment ?? r.title}”</blockquote>
                  <figcaption className="mt-5 text-sm">
                    <span className="font-bold">{r.author_name ?? 'Customer'}</span>
                    {r.verified_purchase && <span className="text-muted"> · Verified buyer</span>}
                    {r.products && (
                      <Link href={`/product/${r.products.slug}`} className="block text-xs text-muted underline-offset-2 hover:underline">
                        {r.products.name}
                      </Link>
                    )}
                  </figcaption>
                </figure>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {/* WhatsApp CTA */}
      <section className="container-page pt-20 sm:pt-28">
        <Reveal>
          <div className="flex flex-col items-start justify-between gap-6 rounded-[2rem] border border-line bg-white p-8 sm:flex-row sm:items-center sm:p-12">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl">Need help choosing?</h2>
              <p className="mt-2 max-w-lg text-muted">Send us a photo of your outfit or ask about sizes — we reply fast.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {wa && (
                <a href={wa} target="_blank" rel="noreferrer" className="btn btn-lg bg-[#25D366] text-white hover:bg-[#1ebe5a]">
                  <MessageCircle className="size-4" /> Chat on WhatsApp
                </a>
              )}
              <Link href="/track" className="btn btn-outline btn-lg">Track my order</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </>
  )
}
