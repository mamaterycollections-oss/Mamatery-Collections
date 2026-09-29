'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

// A <select> bound to one URL query parameter.
export function ParamSelect({ param, options, label, className }: { param: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  return (
    <select
      aria-label={label}
      className={className ?? 'field field-sm w-44'}
      value={params.get(param) ?? ''}
      onChange={(e) => {
        const p = new URLSearchParams(params.toString())
        if (e.target.value) p.set(param, e.target.value)
        else p.delete(param)
        router.replace(`${pathname}?${p}`, { scroll: false })
      }}
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}
