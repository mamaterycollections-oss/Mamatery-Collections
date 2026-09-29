'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; name: string }

export function Field({ label, hint, className, type, ...props }: FieldProps) {
  const [show, setShow] = useState(false)
  const id = props.id ?? `f-${props.name}`
  const isPassword = type === 'password'
  return (
    <div className={className}>
      <label htmlFor={id} className="label">{label}</label>
      <div className="relative">
        <input id={id} type={isPassword && show ? 'text' : type} className={cn('field', isPassword && 'pr-12')} {...props} />
        {isPassword && (
          <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-muted hover:text-ink" aria-label={show ? 'Hide password' : 'Show password'}>
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {hint && <p className="hint">{hint}</p>}
    </div>
  )
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  return (
    <AnimatePresence mode="wait">
      {(error || message) && (
        <motion.p
          key={error ?? message}
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          role={error ? 'alert' : 'status'}
          className={cn('flex items-start gap-2 rounded-xl p-3 text-sm', error ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success')}
        >
          {error ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
          {error ?? message}
        </motion.p>
      )}
    </AnimatePresence>
  )
}

export function Submit({ pending, children, className }: { pending: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button type="submit" disabled={pending} className={cn('btn btn-primary btn-lg w-full', className)}>
      {pending && <Loader2 className="size-4 animate-spin" />} {children}
    </button>
  )
}
