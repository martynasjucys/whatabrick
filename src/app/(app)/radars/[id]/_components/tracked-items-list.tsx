"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  VERDICT_LABEL,
  VERDICT_TONE,
  type Verdict,
} from "@/lib/verdict-ui";

export function TrackedItemsList({ radarId }: { radarId: Id<"radars"> }) {
  const tracked = useQuery(api.items.listForRadar, { radarId });
  const remove = useMutation(api.items.removeTrackedItem);

  const itemIds = useMemo(
    () =>
      (tracked ?? [])
        .map((t) => t.item?._id)
        .filter((id): id is Id<"items"> => !!id),
    [tracked],
  );
  const scores = useQuery(
    api.signalScores.latestForItems,
    itemIds.length > 0 ? { itemIds } : "skip",
  );

  if (tracked === undefined) {
    return (
      <p className="mt-3 text-sm text-[var(--ink-subtle)]">Loading…</p>
    );
  }

  if (tracked.length === 0) {
    return (
      <p className="mt-3 text-sm text-[var(--ink-subtle)]">
        No items yet. Use the search above to add the first one.
      </p>
    );
  }

  return (
    <ul className="mt-3 flex flex-col gap-2">
      {tracked.map(({ tracked: t, item }) => {
        if (!item) return null;
        const score = scores ? scores[item._id] : undefined;
        const verdict = score?.verdict as Verdict | undefined;
        const tone = verdict ? VERDICT_TONE[verdict] : undefined;
        const price =
          score?.currentPriceCents !== undefined && score?.currency
            ? `${score.currency} ${(score.currentPriceCents / 100).toFixed(2)}`
            : null;

        return (
          <li
            key={t._id}
            className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
          >
            <div className="size-12 shrink-0 overflow-hidden rounded-md bg-popover">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt=""
                  className="size-full object-contain"
                />
              ) : null}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/items/${item._id}`}
                className="block truncate text-sm font-medium text-foreground hover:underline"
              >
                {item.name}
              </Link>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                {verdict && tone ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${tone.bg} ${tone.fg}`}
                  >
                    {VERDICT_LABEL[verdict]}
                  </span>
                ) : null}
                <Badge variant="outline">{item.rebrickableType}</Badge>
                {price ? (
                  <span className="text-xs text-[var(--ink-subtle)]">
                    {price}
                  </span>
                ) : null}
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => remove({ id: t._id })}
            >
              Remove
            </Button>
          </li>
        );
      })}
    </ul>
  );
}
