import { Panel } from "@/components/ui/Surface";
import type { CardSalesResponse } from "@/lib/card-intelligence";

export default function RecentSalesPanel({ data, loading, error }: { data: CardSalesResponse | null; loading: boolean; error?: string }) {
  return <Panel className="p-5"><p className="eyebrow">Market context</p><h3 className="heading-3 mt-2">Recent sales</h3>
    {loading ? <p className="mt-3 text-sm text-[var(--text-secondary)]">Checking legitimate sales sources…</p> : error ? <p className="mt-3 text-sm text-[var(--status-error)]">{error}</p> : data?.available && data.sales.length ? <div className="mt-4 space-y-3">{data.sales.slice(0, 5).map((sale) => <a key={`${sale.source}-${sale.url}`} href={sale.url} target="_blank" rel="noreferrer" className="block rounded-lg border border-[var(--border-subtle)] p-3"><span className="font-semibold">{sale.price} {sale.currency}</span><span className="mt-1 block text-xs text-[var(--text-tertiary)]">{sale.source} · {sale.sale_date}</span></a>)}</div> : <p className="mt-3 text-sm leading-6 text-[var(--text-tertiary)]">{data?.message || "Recent sales are not connected yet."}</p>}
  </Panel>;
}
