'use client'

import { useMemo, useState } from 'react'
import { formatKes } from '@/lib/utils'

type Point = { label: string; value: number; sub?: string }

// Single-series bar chart (one hue, no legend): thin bars with 4px rounded tops
// anchored to the baseline, recessive grid, hover tooltip, and an sr-only table.
export function BarChart({ data, height = 220, title, format = formatKes }: { data: Point[]; height?: number; title: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const ticks = useMemo(() => {
    const step = niceStep(max / 4)
    return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step)
  }, [max])
  const top = Math.max(max, ticks.at(-1) ?? max)
  const W = 100 / Math.max(1, data.length)
  const labelEvery = Math.ceil(data.length / 8)

  return (
    <figure className="relative" aria-label={title}>
      <div className="relative flex" style={{ height }}>
        <div className="relative w-14 shrink-0 text-right text-[0.65rem] text-muted tabular-nums">
          {ticks.map((t) => (
            <span key={t} className="absolute right-2 -translate-y-1/2" style={{ bottom: `${(t / top) * 100}%` }}>
              {compact(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${(t / top) * 100}%` }} />
          ))}
          <div className="absolute inset-0 flex items-end">
            {data.map((d, i) => (
              <div key={i} className="relative flex h-full items-end justify-center" style={{ width: `${W}%` }} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${d.label}: ${format(d.value)}`}>
                <div
                  className="w-[62%] max-w-7 rounded-t-[4px] bg-clay transition-[height,opacity] duration-500"
                  style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 2 : 0, opacity: hover == null || hover === i ? 1 : 0.45 }}
                />
              </div>
            ))}
          </div>
          {hover != null && data[hover] && (
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lift"
              style={{ left: `${(hover + 0.5) * W}%`, bottom: `calc(${(data[hover].value / top) * 100}% + 8px)` }}
            >
              <p className="font-bold whitespace-nowrap text-ink">{format(data[hover].value)}</p>
              <p className="whitespace-nowrap text-muted">{data[hover].label}{data[hover].sub ? ` · ${data[hover].sub}` : ''}</p>
            </div>
          )}
        </div>
      </div>
      <div className="relative ml-14 h-6 text-[0.65rem] text-muted">
        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <span key={i} className="absolute top-2 -translate-x-1/2 whitespace-nowrap" style={{ left: `${(i + 0.5) * W}%` }}>
              {d.label}
            </span>
          ) : null,
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {data.map((d, i) => (
            <tr key={i}><th>{d.label}</th><td>{format(d.value)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// Horizontal bars for ranked lists (e.g. profit by category).
export function HBarList({ rows, format = formatKes }: { rows: { label: string; value: number; note?: string }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)))
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="truncate font-semibold">{r.label}</span>
            <span className="shrink-0 tabular-nums">{format(r.value)}{r.note && <span className="ml-2 text-xs text-muted">{r.note}</span>}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-sand">
            <div className="h-full rounded-full bg-clay" style={{ width: `${(Math.max(0, r.value) / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

function niceStep(raw: number) {
  if (raw <= 0) return 1
  const p = 10 ** Math.floor(Math.log10(raw))
  const n = raw / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p
}
function compact(n: number) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(n)
}
