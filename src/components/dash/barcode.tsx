'use client'

import JsBarcode from 'jsbarcode'
import { useEffect, useRef } from 'react'

// Renders a variant's EAN-13 (falls back to CODE128 for any non-EAN value) as crisp SVG for printing.
export function Barcode({ value, height = 40, width = 1.6, fontSize = 12, displayValue = true, className }: { value: string; height?: number; width?: number; fontSize?: number; displayValue?: boolean; className?: string }) {
  const ref = useRef<SVGSVGElement>(null)
  useEffect(() => {
    if (!ref.current) return
    const opts = { height, width, fontSize, displayValue, margin: 0, background: 'transparent', font: 'monospace', textMargin: 1 }
    try {
      JsBarcode(ref.current, value, { ...opts, format: /^\d{13}$/.test(value) ? 'EAN13' : 'CODE128', flat: true })
    } catch {
      JsBarcode(ref.current, value, { ...opts, format: 'CODE128' })
    }
  }, [value, height, width, fontSize, displayValue])
  return <svg ref={ref} className={className} role="img" aria-label={`Barcode ${value}`} />
}
