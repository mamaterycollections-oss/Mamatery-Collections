'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { BadgeCheck, Loader2, Star } from 'lucide-react'
import { useAuth } from '@/components/auth-provider'
import { submitReview } from '@/app/(shop)/product/[slug]/actions'
import { cn, formatDate } from '@/lib/utils'

type Review = { id: string; rating: number; title: string | null; comment: string | null; author_name: string | null; verified_purchase: boolean; created_at: string }

export function Reviews({ productId, productSlug, reviews, average, count }: { productId: string; productSlug: string; reviews: Review[]; average: number; count: number }) {
  const { userId } = useAuth()
  const [writing, setWriting] = useState(false)
  const bars = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => r.rating === s).length }))

  return (
    <section id="reviews" className="scroll-mt-24 border-t border-line pt-14">
      <div className="grid gap-10 lg:grid-cols-[20rem_1fr]">
        <div>
          <h2 className="font-display text-3xl sm:text-4xl">Reviews</h2>
          {count > 0 ? (
            <>
              <p className="mt-4 flex items-end gap-2">
                <span className="font-display text-5xl">{average.toFixed(1)}</span>
                <span className="pb-2 text-sm text-muted">out of 5 · {count} review{count === 1 ? '' : 's'}</span>
              </p>
              <Stars value={average} className="mt-2" />
              <div className="mt-5 space-y-1.5">
                {bars.map(({ s, n }) => (
                  <div key={s} className="flex items-center gap-3 text-xs">
                    <span className="w-3">{s}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone">
                      <motion.div className="h-full bg-gold" initial={{ width: 0 }} whileInView={{ width: `${reviews.length ? (n / reviews.length) * 100 : 0}%` }} viewport={{ once: true }} transition={{ duration: 0.8 }} />
                    </div>
                    <span className="w-5 text-right text-muted">{n}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-muted">No reviews yet. Bought this? Be the first to share your thoughts.</p>
          )}
          {userId ? (
            <button onClick={() => setWriting((w) => !w)} className="btn btn-outline mt-6">
              {writing ? 'Cancel' : 'Write a review'}
            </button>
          ) : (
            <Link href={`/login?next=/product/${productSlug}%23reviews`} className="btn btn-outline mt-6">
              Sign in to review
            </Link>
          )}
        </div>

        <div>
          <AnimatePresence>{writing && <ReviewForm productId={productId} productSlug={productSlug} onDone={() => setWriting(false)} />}</AnimatePresence>
          <ul className="divide-y divide-line">
            {reviews.map((r) => (
              <li key={r.id} className="py-6 first:pt-0">
                <div className="flex items-center justify-between gap-3">
                  <Stars value={r.rating} />
                  <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
                </div>
                {r.title && <p className="mt-3 font-bold">{r.title}</p>}
                {r.comment && <p className="mt-1 leading-relaxed text-muted">{r.comment}</p>}
                <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold">
                  {r.author_name ?? 'Customer'}
                  {r.verified_purchase && (
                    <span className="flex items-center gap-1 text-success"><BadgeCheck className="size-3.5" /> Verified buyer</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export function Stars({ value, className, size = 'size-4' }: { value: number; className?: string; size?: string }) {
  return (
    <div className={cn('flex gap-0.5', className)} aria-label={`${value.toFixed(1)} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={cn(size, s <= Math.round(value) ? 'fill-gold text-gold' : 'text-stone')} />
      ))}
    </div>
  )
}

function ReviewForm({ productId, productSlug, onDone }: { productId: string; productSlug: string; onDone: () => void }) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [state, action, pending] = useActionState(submitReview, null)

  if (state?.ok) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-2xl bg-success-soft p-5 text-sm text-success">
        <p className="font-bold">Thank you for your review!</p>
        <p className="mt-1">It will appear here once our team has approved it.</p>
        <button onClick={onDone} className="mt-3 font-bold underline">Close</button>
      </motion.div>
    )
  }
  return (
    <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} action={action} className="mb-8 overflow-hidden">
      <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
        <input type="hidden" name="product_id" value={productId} />
        <input type="hidden" name="slug" value={productSlug} />
        <input type="hidden" name="rating" value={rating} />
        <div>
          <p className="label">Your rating</p>
          <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((s) => (
              <button type="button" key={s} onMouseEnter={() => setHover(s)} onClick={() => setRating(s)} aria-label={`${s} star${s > 1 ? 's' : ''}`}>
                <Star className={cn('size-7 transition', s <= (hover || rating) ? 'scale-110 fill-gold text-gold' : 'text-stone')} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label" htmlFor="rv-title">Headline</label>
          <input id="rv-title" name="title" maxLength={80} className="field" placeholder="Sum it up in a few words" />
        </div>
        <div>
          <label className="label" htmlFor="rv-comment">Your review</label>
          <textarea id="rv-comment" name="comment" rows={4} maxLength={1200} className="field" placeholder="Fit, quality, colour — what did you think?" required />
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <button className="btn btn-primary" disabled={pending || !rating}>
          {pending && <Loader2 className="size-4 animate-spin" />} Submit review
        </button>
      </div>
    </motion.form>
  )
}
