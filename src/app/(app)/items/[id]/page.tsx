"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const itemId = id as Id<"items">;
  const data = useQuery(api.items.get, { id: itemId });

  if (data === undefined) return <ItemSkeleton />;
  if (data === null) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12">
        <p className="text-sm text-[var(--ink-subtle)]">Item not found.</p>
      </div>
    );
  }

  const { item, trackedCount } = data;
  const rebrickableUrl =
    item.rebrickableType === "minifig"
      ? `https://rebrickable.com/minifigs/${item.rebrickableId}/`
      : item.rebrickableType === "set"
        ? `https://rebrickable.com/sets/${item.rebrickableId}/`
        : `https://rebrickable.com/parts/${item.rebrickableId}/`;

  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--ink-subtle)] hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row">
        <div className="size-40 shrink-0 overflow-hidden rounded-xl border border-border bg-card">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt={item.name}
              className="size-full object-contain"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold tracking-[-0.02em] text-foreground">
            {item.name}
          </h1>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="secondary">{item.rebrickableType}</Badge>
            <Badge variant="outline">{item.rebrickableId}</Badge>
            {item.releaseYear ? (
              <Badge variant="outline">{item.releaseYear}</Badge>
            ) : null}
            {item.theme ? <Badge variant="outline">{item.theme}</Badge> : null}
            <Badge variant="outline">
              {trackedCount} tracker{trackedCount === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="mt-4 text-sm text-[var(--ink-subtle)]">
            <a
              href={rebrickableUrl}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              Open in Rebrickable ↗
            </a>
          </p>
        </div>
      </div>

      <section className="mt-12 rounded-xl border border-border bg-card p-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Market
        </p>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          Price snapshots and chart arrive in the market-tracking feature.
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-card p-6">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Verdict
        </p>
        <p className="mt-2 text-sm text-[var(--ink-subtle)]">
          AI verdict arrives in the item-verdicts feature.
        </p>
      </section>
    </div>
  );
}

function ItemSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Skeleton className="h-4 w-20" />
      <div className="mt-6 flex gap-6">
        <Skeleton className="size-40 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-9 w-2/3" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
