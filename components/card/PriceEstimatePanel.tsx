"use client";

import { Badge, Panel } from "@/components/ui/Surface";
import { Button } from "@/components/ui/Button";
import type { BadgeTone } from "@/lib/types";
import type { PriceEstimateResponse, PricingConfidence, PricingSale } from "@/lib/pricing/types";

const confidenceTone: Record<PricingConfidence, BadgeTone> = {
  low: "warning",
  medium: "info",
  high: "success",
};

const basisLabel: Record<PriceEstimateResponse["pricing_basis"], string> = {
  recent_exact_sales: "Based on recent exact sales",
  recent_raw_sales: "Based on recent raw sales",
  exact_grade_sales: "Based on exact-grade sales",
  similar_comps: "Comp-based estimate (not exact sales)",
  ai_metadata_estimate: "AI-estimated from card metadata",
  insufficient_data: "Insufficient data",
};

function formatMoney(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${Math.round(value).toLocaleString()}`;
}

function SalesList({ title, sales, muted }: { title: string; sales: PricingSale[]; muted?: boolean }) {
  if (!sales.length) return null;
  return (
    <div>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.12em] ${muted ? "text-[var(--text-tertiary)]" : "text-[var(--gold-primary)]"}`}>
        {title}
      </p>
      <ul className="mt-2 space-y-2">
        {sales.slice(0, 5).map((sale, index) => {
          const grade = [sale.grading_company, sale.grade].filter(Boolean).join(" ") || (sale.is_raw ? "Raw" : "Ungraded");
          const meta = [sale.source, sale.sale_date, grade].filter(Boolean).join(" · ");
          const inner = (
            <>
              <span className="font-semibold tabular-nums">{formatMoney(sale.price)} {sale.currency || "USD"}</span>
              <span className="mt-0.5 block text-xs text-[var(--text-tertiary)]">{meta || sale.title}</span>
            </>
          );
          return (
            <li key={`${sale.source}-${sale.url}-${index}`} className="rounded-lg border border-[var(--border-subtle)] p-3">
              {sale.url ? (
                <a href={sale.url} target="_blank" rel="noreferrer" className="block">{inner}</a>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Additive post-autofill "Price Estimate" section. Never blocks autofill or
 * card creation — pricing failures surface here as messages only.
 */
export default function PriceEstimatePanel({
  data,
  loading,
  error,
  isGraded,
  onRefresh,
  onUseEstimate,
}: {
  data: PriceEstimateResponse | null;
  loading: boolean;
  error?: string;
  isGraded: boolean;
  onRefresh: () => void;
  onUseEstimate?: (value: number) => void;
}) {
  const hasRange = Boolean(
    data && (data.estimated_value_low != null || data.estimated_value_mid != null || data.estimated_value_high != null),
  );
  const aiOnly = data?.pricing_basis === "ai_metadata_estimate";
  const hasLiveSales = Boolean(
    data && (
      data.recent_sales.raw.length +
      data.recent_sales.psa_9.length +
      data.recent_sales.psa_10.length +
      data.recent_sales.exact_grade.length +
      data.recent_sales.similar_comps.length
    ) > 0,
  );

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Market intelligence</p>
          <h3 className="heading-3 mt-2">Price Estimate</h3>
        </div>
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? "Estimating…" : data ? "Refresh" : "Estimate"}
        </Button>
      </div>

      {loading && (
        <p className="mt-4 text-sm text-[var(--text-secondary)]">Generating AI price estimate…</p>
      )}

      {!loading && error && (
        <p className="mt-4 text-sm text-[var(--status-warning)]">{error}</p>
      )}

      {!loading && !error && !data && (
        <p className="mt-4 text-sm leading-6 text-[var(--text-tertiary)]">
          Run an estimate to generate an AI value range from card metadata. This runs automatically after autofill.
        </p>
      )}

      {!loading && !error && data && (
        <div className="mt-4 space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={confidenceTone[data.confidence]}>{data.confidence} confidence</Badge>
            <span className="text-xs text-[var(--text-tertiary)]">{basisLabel[data.pricing_basis]}</span>
          </div>

          {aiOnly && (
            <p className="rounded-lg border border-[var(--status-warning)]/40 bg-[var(--status-warning-bg)] px-4 py-3 text-sm leading-6 text-[var(--status-warning)]">
              No live recent sales provider connected yet. This estimate is based on AI market reasoning from card metadata and similar general comps.
            </p>
          )}

          {hasRange ? (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-center">
                  <span className="text-xs text-[var(--text-tertiary)]">Low</span>
                  <strong className="mt-1 block tabular-nums">{formatMoney(data.estimated_value_low)}</strong>
                </div>
                <div className="rounded-lg border border-[var(--border-strong)] bg-[color-mix(in_srgb,var(--gold-primary)_8%,transparent)] p-3 text-center">
                  <span className="text-xs text-[var(--gold-primary)]">Fair estimate</span>
                  <strong className="mt-1 block tabular-nums">{formatMoney(data.estimated_value_mid)}</strong>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] p-3 text-center">
                  <span className="text-xs text-[var(--text-tertiary)]">High</span>
                  <strong className="mt-1 block tabular-nums">{formatMoney(data.estimated_value_high)}</strong>
                </div>
              </div>
              {onUseEstimate && data.estimated_value_mid != null && (
                <Button variant="outline" size="sm" onClick={() => onUseEstimate(data.estimated_value_mid as number)}>
                  Use fair estimate as value
                </Button>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-[var(--status-warning)] bg-[var(--status-warning-bg)] px-4 py-3 text-sm leading-6 text-[var(--status-warning)]">
              {data.notes}
            </p>
          )}

          {data.notes && hasRange && !aiOnly && (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{data.notes}</p>
          )}
          {data.notes && hasRange && aiOnly && (
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{data.notes}</p>
          )}

          <div className="space-y-4">
            {hasLiveSales ? (
              isGraded ? (
                <SalesList title="Recent exact-grade sales" sales={data.recent_sales.exact_grade} />
              ) : (
                <>
                  <SalesList title="Recent raw sales" sales={data.recent_sales.raw} />
                  <SalesList title="Recent PSA 9 sales (context only)" sales={data.recent_sales.psa_9} muted />
                  <SalesList title="Recent PSA 10 sales (context only)" sales={data.recent_sales.psa_10} muted />
                </>
              )
            ) : (
              <p className="text-sm leading-6 text-[var(--text-tertiary)]">
                {isGraded
                  ? "Exact-grade recent sales require a live sales provider."
                  : "PSA 9/10 recent sales require a live sales provider."}
              </p>
            )}
            <SalesList title="Similar comparable sales" sales={data.recent_sales.similar_comps} muted />
          </div>

          {data.warnings.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-xs leading-5 text-[var(--text-tertiary)]">
              {data.warnings.map((warning) => <li key={warning}>{warning}</li>)}
            </ul>
          )}
        </div>
      )}

      <p className="mt-4 border-t border-[var(--border-subtle)] pt-3 text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
        AI-assisted estimate, not an appraisal.
      </p>
    </Panel>
  );
}
