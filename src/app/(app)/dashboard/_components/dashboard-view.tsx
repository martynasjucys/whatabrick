"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Eye, TrendingDown, AlertTriangle, Flame } from "lucide-react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  type Verdict,
} from "@/lib/verdict-ui";

export function DashboardView() {
  const data = useQuery(api.dashboard.summary);

  if (data === undefined) {
    return (
      <div className="py-8">
        <Skeleton className="h-9 w-48" />
        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }
  if (data === null) return null;

  const { counts, radars, attentionItems, latestDigestId } = data;

  if (radars.length === 0) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Your radar
        </p>
        <h1 className="mt-4 text-5xl font-semibold tracking-[-0.025em] text-foreground">
          Create your first radar
        </h1>
        <p className="mt-3 max-w-md text-base text-[var(--ink-subtle)]">
          Describe a niche (e.g. &ldquo;Minecraft magazine minifigures&rdquo;)
          and Whatabrick will start tracking it.
        </p>
        <Button render={<Link href="/radars/new" />} size="lg" className="mt-8">
          Create radar
        </Button>
      </div>
    );
  }

  return (
    <div className="py-8">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Today
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground">
            Your radar
          </h1>
        </div>
        <Button
          render={<Link href="/radars/new" />}
          variant="secondary"
          size="sm"
        >
          + New radar
        </Button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={<Eye className="size-4" />}
          label="Items to watch"
          value={counts.itemsToWatch}
          href="/dashboard"
        />
        <KpiTile
          icon={<TrendingDown className="size-4" />}
          label="Price drops this week"
          value={counts.priceDropsThisWeek}
          href="/alerts"
        />
        <KpiTile
          icon={<AlertTriangle className="size-4" />}
          label="Scarcity alerts"
          value={counts.scarcityAlertsThisWeek}
          href="/alerts"
        />
        <KpiTile
          icon={<Flame className="size-4" />}
          label="Possible hype"
          value={counts.hypeThisWeek}
          href="/alerts"
        />
      </div>

      <section className="mt-12">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
          Your radars
        </h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {radars.map((r) => (
            <Link
              key={r._id}
              href={`/radars/${r._id as Id<"radars">}`}
              className="block rounded-xl border border-border bg-card p-5 transition-colors hover:bg-popover"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                  {r.title}
                </h3>
                <Badge variant="secondary">{r.region}</Badge>
              </div>
              <p className="mt-3 text-xs text-[var(--ink-subtle)]">
                {r.trackedCount} tracked
                {r.newThisWeek > 0 ? ` · ${r.newThisWeek} new` : ""}
              </p>
              {r.priceDropsThisWeek > 0 || r.scarcityThisWeek > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {r.priceDropsThisWeek > 0 ? (
                    <Badge variant="outline">
                      {r.priceDropsThisWeek} price drop
                      {r.priceDropsThisWeek === 1 ? "" : "s"}
                    </Badge>
                  ) : null}
                  {r.scarcityThisWeek > 0 ? (
                    <Badge variant="outline">
                      {r.scarcityThisWeek} scarcity
                    </Badge>
                  ) : null}
                </div>
              ) : null}
            </Link>
          ))}
        </div>
      </section>

      {attentionItems.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
            Items needing attention
          </h2>
          <div className="mt-4 -mx-1 flex gap-3 overflow-x-auto px-1 pb-2 sm:grid sm:grid-cols-2 sm:overflow-visible lg:grid-cols-3">
            {attentionItems.map((it) => {
              const verdict = it.verdict as Verdict;
              const tone = VERDICT_TONE[verdict];
              const price =
                it.currentPriceCents !== undefined && it.currency
                  ? `${it.currency} ${(it.currentPriceCents / 100).toFixed(2)}`
                  : null;
              return (
                <Link
                  key={it.itemId as string}
                  href={`/items/${it.itemId as Id<"items">}`}
                  className="block min-w-[220px] rounded-xl border border-border bg-card p-4 transition-colors hover:bg-popover sm:min-w-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="size-12 shrink-0 overflow-hidden rounded-md bg-popover">
                      {it.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={it.imageUrl}
                          alt=""
                          className="size-full object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {it.name}
                      </p>
                      {price ? (
                        <p className="text-xs text-[var(--ink-subtle)]">
                          {price}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <span
                    className={`mt-3 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.bg} ${tone.fg}`}
                  >
                    {VERDICT_LABEL[verdict]}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {latestDigestId ? (
        <Link
          href="/digest"
          className="mt-12 block rounded-xl border border-border bg-card p-8 transition-colors hover:bg-popover"
        >
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Weekly digest
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-foreground">
            Your weekly recap is ready — open it.
          </p>
          <p className="mt-1 text-sm text-[var(--ink-subtle)]">
            See what got scarcer, what dipped below target, and what shifted in
            verdict.
          </p>
        </Link>
      ) : null}
    </div>
  );
}

function KpiTile({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-border bg-card p-5 transition-colors hover:bg-popover"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[var(--brand-primary)]">{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          {label}
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.02em] text-foreground">
        {value}
      </p>
    </Link>
  );
}
