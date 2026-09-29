// Shared layout for policy / help pages: readable measure, consistent typography.
export function InfoPage({ eyebrow, title, intro, updated, children }: { eyebrow?: string; title: string; intro?: React.ReactNode; updated?: string; children: React.ReactNode }) {
  return (
    <article className="container-page max-w-3xl pt-10 sm:pt-16">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1 className="mt-2 font-display text-4xl tracking-tight sm:text-6xl">{title}</h1>
      {intro && <p className="mt-5 text-lg leading-relaxed text-muted">{intro}</p>}
      {updated && <p className="mt-3 text-xs text-muted">Last updated {updated}</p>}
      <div className="prose-mt mt-10 space-y-8 text-[0.95rem] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_h2]:font-display [&_h2]:text-2xl [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_p+p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5">
        {children}
      </div>
    </article>
  )
}
