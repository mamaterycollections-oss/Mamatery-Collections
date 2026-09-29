'use client'

import { useEffect } from 'react'
import { Printer } from 'lucide-react'

export function PrintButton({ auto = false, label = 'Print' }: { auto?: boolean; label?: string }) {
  useEffect(() => {
    if (auto) setTimeout(() => window.print(), 400)
  }, [auto])
  return (
    <button onClick={() => window.print()} className="btn btn-primary btn-sm">
      <Printer className="size-4" /> {label}
    </button>
  )
}
