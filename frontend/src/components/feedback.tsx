import type { ReactNode } from 'react'
import { pageSize } from '../constants'
import { display } from '../utils/format'

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mb-[15px] flex items-center justify-between gap-3 rounded-lg border border-[#f0d7d3] bg-[#fff6f4] px-[13px] py-[11px] text-[11px] leading-[1.5] text-[#a44e45]" role="alert">
      <span>{message}</span>
      {onRetry && <button className="button button-quiet" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ title, detail, action }: { title: string; detail: string; action?: ReactNode }) {
  return (
    <div className="grid min-h-[260px] content-center justify-items-center rounded-xl border border-dashed border-[#dfe7df] bg-white/60 px-5 py-7 text-center">
      <div className="grid size-11 place-items-center rounded-[14px] bg-[#edf5ed] text-[28px] text-[#6c9878]" aria-hidden="true">⌁</div>
      <h3 className="mt-[14px] mb-1 font-bold text-[14px] text-[#415248]">{title}</h3>
      <p className="max-w-[370px] text-[11px] leading-[1.65] text-[#929d96]">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading data…' }: { label?: string }) {
  return <div className="flex min-h-[210px] items-center justify-center gap-2.5 text-xs text-[#89968e]" role="status"><span className="size-4 animate-spin rounded-full border-2 border-[#e0ebe2] border-t-[#2e7b5c]" />{label}</div>
}

export function PageHeading({
  eyebrow,
  title,
  description,
  action,
  back,
  backLabel = 'Back to list',
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
  back?: () => void
  backLabel?: string
}) {
  return (
    <div className="page-heading">
      <div>
        {back && <button className="back-link" onClick={back}><span aria-hidden="true">←</span><span>{backLabel}</span></button>}
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  )
}

export function Pagination({ page, count, onChange }: { page: number; count: number; onChange: (page: number) => void }) {
  return (
    <div className="pagination">
      <span>Showing {count ? page * pageSize + 1 : 0}–{page * pageSize + count} records</span>
      <div>
        <button className="button button-outline" disabled={page === 0} onClick={() => onChange(page - 1)}>Previous</button>
        <button className="button button-outline" disabled={count < pageSize} onClick={() => onChange(page + 1)}>Next</button>
      </div>
    </div>
  )
}

export function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return <section className="detail-card"><h2>{title}</h2><div className="detail-items">{children}</div></section>
}

export function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <div className="detail-item"><span>{label}</span><strong>{display(value)}</strong></div>
}
