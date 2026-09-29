'use client'

import { useActionState } from 'react'
import { PackageSearch } from 'lucide-react'
import { Field, FormAlert, Submit } from '@/components/ui/form'
import { trackOrder } from './actions'

export default function TrackPage() {
  const [state, action, pending] = useActionState(trackOrder, {})
  return (
    <div className="container-page grid min-h-[70dvh] place-items-center py-12">
      <div className="w-full max-w-md animate-fade-up">
        <span className="grid size-14 place-items-center rounded-2xl bg-clay-soft text-clay"><PackageSearch className="size-7" /></span>
        <h1 className="mt-5 font-display text-4xl">Track your order</h1>
        <p className="mt-3 text-muted">Enter your order number (e.g. MT1024) and the phone number you used at checkout.</p>
        <form action={action} className="mt-8 grid gap-4">
          <Field label="Order number" name="order" required placeholder="MT1024" autoCapitalize="characters" />
          <Field label="Phone number" name="phone" type="tel" inputMode="tel" required placeholder="0712 345 678" />
          <FormAlert error={state.error} />
          <Submit pending={pending}>Find my order</Submit>
        </form>
      </div>
    </div>
  )
}
