"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function TrackedItemsList({ radarId }: { radarId: Id<"radars"> }) {
  const tracked = useQuery(api.items.listForRadar, { radarId });
  const remove = useMutation(api.items.removeTrackedItem);

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
              <div className="mt-1 flex flex-wrap gap-1.5">
                <Badge variant="outline">{item.rebrickableType}</Badge>
                <Badge variant="outline">{item.rebrickableId}</Badge>
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
