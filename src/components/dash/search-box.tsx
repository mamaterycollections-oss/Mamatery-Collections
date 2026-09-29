'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'
import { Loader2, Search } from 'lucide-react'

// URL-driven search input (debounced), keeps other query params.
export function SearchBox({ placeholder, param = 'q', autoFocus = false }: { placeholder: string; param?: string; autoFocus?: boolean }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [value, setValue] = useState(params.get(param) ?? '')
  const [pending, start] = useTransition()

  useEffect(() => {
    if (value === (params.get(param) ?? '')) return
    const t = setTimeout(() => {
      const p = new URLSearchParams(params.toString())
      if (value) p.set(param, value)
      else p.delete(param)
      p.delete('page')
      start(() => router.replace(`${pathname}?${p}`, { scroll: false }))
    }, 300)
    return () => clearTimeout(t)
  }, [value, params, param, pathname, router])

  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} className="field field-sm rounded-full py-2.5 pl-10" type="search" />
      {pending && <Loader2 className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 animate-spin text-muted" />}
    </label>
  )
}
