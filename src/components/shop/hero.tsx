'use client'

import Image from 'next/image'
import Link from 'next/link'
import { motion, useScroll, useTransform } from 'motion/react'
import { useRef } from 'react'
import { ArrowRight } from 'lucide-react'

const WORDS = ['Style', 'that', 'speaks', 'for', 'you.']

export function Hero({ images, tagline }: { images: { src: string; alt: string; href: string }[]; tagline: string | null }) {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const y1 = useTransform(scrollYProgress, [0, 1], [0, -80])
  const y2 = useTransform(scrollYProgress, [0, 1], [0, -160])
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -40])
  const [a, b, c] = images

  return (
    <section ref={ref} className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[36rem] rounded-full bg-clay-soft blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute top-1/2 -left-48 size-[28rem] rounded-full bg-sand blur-3xl" />

      <div className="container-page relative grid items-center gap-12 pt-8 pb-12 sm:pt-16 lg:min-h-[calc(100dvh-7rem)] lg:grid-cols-[1.05fr_1fr] lg:py-10">
        <div className="relative z-10">
          <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="eyebrow flex items-center gap-3">
            <span className="h-px w-10 bg-clay" /> New season · Clothes · Bags · Caps
          </motion.p>
          <h1 className="mt-6 font-display text-[2.85rem] leading-[0.95] tracking-tight sm:text-7xl xl:text-[6.4rem]">
            {WORDS.map((w, i) => (
              <span key={w} className="inline-block overflow-hidden pb-2 align-bottom">
                <motion.span
                  className={`inline-block ${w === 'speaks' ? 'italic text-clay' : ''}`}
                  initial={{ y: '110%' }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: 0.1 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}&nbsp;
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-muted sm:text-lg"
          >
            {(tagline ?? 'Clothes, bags & caps picked for real life in Kenya').replace(/[.!]?$/, '.')} Checkout in seconds with M-Pesa and get it delivered to your door.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.75 }} className="mt-8 flex gap-3">
            <Link href="/shop?sort=new" className="btn btn-primary group flex-1 py-4 sm:flex-none sm:px-7 sm:py-[1.1rem]">
              Shop new arrivals <ArrowRight className="size-4 transition group-hover:translate-x-1" />
            </Link>
            <Link href="/shop/bags" className="btn btn-outline flex-1 py-4 sm:flex-none sm:px-7 sm:py-[1.1rem]">
              The bag edit
            </Link>
          </motion.div>
          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-10 grid max-w-md grid-cols-3 gap-3 border-t border-line pt-6 text-sm"
          >
            {[
              ['M-Pesa', 'Instant checkout'],
              ['Countrywide', 'Delivery'],
              ['Easy', 'Returns'],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="font-display text-lg sm:text-xl">{k}</dt>
                <dd className="text-xs text-muted">{v}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <div className="relative mx-auto aspect-[5/6] w-full max-w-xl lg:max-w-none">
          {a && (
            <motion.div style={{ y: y1 }} className="absolute top-[4%] left-[18%] w-[56%]">
              <motion.div initial={{ opacity: 0, scale: 0.92, rotate: -2 }} animate={{ opacity: 1, scale: 1, rotate: -2 }} transition={{ duration: 1, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                <Link href={a.href} className="relative block aspect-[4/5] overflow-hidden rounded-[2rem] shadow-lift">
                  <Image src={a.src} alt={a.alt} fill priority sizes="(min-width:1024px) 28vw, 56vw" className="object-cover transition duration-700 hover:scale-105" />
                </Link>
              </motion.div>
            </motion.div>
          )}
          {b && (
            <motion.div style={{ y: y2 }} className="absolute right-0 bottom-[2%] w-[42%]">
              <motion.div initial={{ opacity: 0, x: 40, rotate: 4 }} animate={{ opacity: 1, x: 0, rotate: 4 }} transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                <Link href={b.href} className="relative block aspect-[4/5] overflow-hidden rounded-[1.6rem] border-4 border-paper shadow-lift">
                  <Image src={b.src} alt={b.alt} fill sizes="(min-width:1024px) 20vw, 42vw" className="object-cover transition duration-700 hover:scale-105" />
                </Link>
              </motion.div>
            </motion.div>
          )}
          {c && (
            <motion.div style={{ y: y3 }} className="absolute bottom-[8%] left-0 w-[36%]">
              <motion.div initial={{ opacity: 0, x: -40, rotate: -5 }} animate={{ opacity: 1, x: 0, rotate: -5 }} transition={{ duration: 1, delay: 0.65, ease: [0.22, 1, 0.36, 1] }}>
                <Link href={c.href} className="relative block aspect-square overflow-hidden rounded-[1.4rem] border-4 border-paper shadow-lift">
                  <Image src={c.src} alt={c.alt} fill sizes="(min-width:1024px) 16vw, 36vw" className="object-cover transition duration-700 hover:scale-105" />
                </Link>
              </motion.div>
            </motion.div>
          )}
          {/* Rotating brand seal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, type: 'spring' }}
            className="absolute top-[2%] right-[4%] size-24 sm:size-28"
          >
            <motion.svg viewBox="0 0 100 100" className="size-full" animate={{ rotate: 360 }} transition={{ duration: 22, repeat: Infinity, ease: 'linear' }}>
              <defs>
                <path id="seal" d="M50 50m-38 0a38 38 0 1 1 76 0a38 38 0 1 1-76 0" />
              </defs>
              <circle cx="50" cy="50" r="49" fill="#17130F" />
              <text fontSize="9.5" fontWeight="700" letterSpacing="3.2" fill="#FBF8F3">
                <textPath href="#seal">MAMATERRY • COLLECTIONS • </textPath>
              </text>
            </motion.svg>
            <span className="absolute inset-0 grid place-items-center font-display text-2xl text-gold italic">MT</span>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items]
  return (
    <div className="overflow-hidden border-y border-line bg-sand py-4">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
        {[...row, ...row].map((t, i) => (
          <span key={i} className="flex items-center gap-10 font-display text-lg italic sm:text-xl">
            {t} <span className="text-clay not-italic">✦</span>
          </span>
        ))}
      </div>
    </div>
  )
}
