"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  type Confidence,
  type Verdict,
} from "@/lib/verdict-ui";

const SCORE_LABELS: { key: ScoreKey; label: string }[] = [
  { key: "scarcityScore", label: "Scarcity" },
  { key: "demandScore", label: "Demand" },
  { key: "exclusivityScore", label: "Exclusivity" },
  { key: "momentumScore", label: "Momentum" },
  { key: "riskScore", label: "Risk" },
];

type ScoreKey =
  | "scarcityScore"
  | "demandScore"
  | "exclusivityScore"
  | "momentumScore"
  | "riskScore";

export function VerdictCard({ itemId }: { itemId: Id<"items"> }) {
  const score = useQuery(api.signalScores.latest, { itemId });
  const [expanded, setExpanded] = useState(false);

  if (score === undefined) {
    return (
      <section className="mt-12 rounded-xl border border-border bg-card p-6">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <Skeleton className="mt-3 h-4 w-1/2" />
      </section>
    );
  }
  if (score === null) {
    return (
      <section className="mt-12 rounded-xl border border-border bg-card p-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Verdict
        </p>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Waiting for the first BrickLink snapshot — verdict appears within a
          minute of adding the item.
        </p>
      </section>
    );
  }

  const verdict = score.verdict as Verdict;
  const tone = VERDICT_TONE[verdict];
  const confidence = score.confidence as Confidence;

  return (
    <section className="mt-12 rounded-xl border border-border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Verdict
          </p>
          <div className="mt-2 flex items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${tone.bg} ${tone.fg}`}
            >
              {VERDICT_LABEL[verdict]}
            </span>
            <Badge variant="outline">{confidence} confidence</Badge>
          </div>
        </div>
        {score.targetPriceCents !== undefined &&
        score.currency !== undefined ? (
          <div className="text-right">
            <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
              Fair-buy target
            </p>
            <p className="mt-1 text-base font-medium text-foreground">
              ≤ {score.currency} {(score.targetPriceCents / 100).toFixed(2)}
            </p>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 text-left text-sm text-foreground hover:text-[var(--ink-muted)]"
      >
        {expanded ? score.explanation : truncate(score.explanation, 160)}
        {score.explanation.length > 160 ? (
          <span className="ml-2 text-[var(--ink-subtle)]">
            {expanded ? "Show less" : "Show more"}
          </span>
        ) : null}
      </button>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
        {SCORE_LABELS.map(({ key, label }) => {
          const value = score[key] as number;
          return (
            <div key={key}>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
                  {label}
                </dt>
                <dd className="text-xs font-medium text-foreground">
                  {value}
                </dd>
              </div>
              <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full bg-[var(--brand-primary)]"
                  style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
                />
              </div>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}
