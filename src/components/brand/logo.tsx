import { cn } from '@/lib/utils'

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('shrink-0', className)} aria-hidden>
      <rect width="100" height="100" rx="24" fill="#B4532A" />
      <g transform="translate(7 7) scale(0.86)">
        <path d="M50 17.5c0-4.2 3.2-7.3 7.2-7.3 3.9 0 6.9 2.9 6.9 6.6 0 3.2-2.1 5.3-5.1 6.6-2.4 1-4 2.4-4 5v2.6" fill="none" stroke="#C49A4A" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M50 31 18 47.5h64Z" fill="none" stroke="#C49A4A" strokeWidth="3.2" strokeLinejoin="round" />
        <text x="50" y="86" textAnchor="middle" fontFamily="Georgia, serif" fontSize="44" fontWeight="700" fill="#FBF8F3">M</text>
      </g>
    </svg>
  )
}

export function Logo({ className, light = false, compact = false }: { className?: string; light?: boolean; compact?: boolean }) {
  return (
    <span className={cn('inline-flex flex-col items-center leading-none', className)}>
      <span className={cn('font-display text-[1.45rem] font-semibold tracking-tight sm:text-[1.65rem]', light ? 'text-paper' : 'text-ink')}>
        MamaTerry
      </span>
      {!compact && (
        <span className={cn('mt-1 text-[0.52rem] font-bold tracking-[0.42em] sm:text-[0.58rem]', light ? 'text-gold' : 'text-clay')}>
          COLLECTIONS
        </span>
      )}
    </span>
  )
}
