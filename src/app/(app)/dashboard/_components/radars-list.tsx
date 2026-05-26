"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export function RadarsList() {
  const radars = useQuery(api.radars.list);

  if (radars === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (radars.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Your radar
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.025em] text-foreground">
          Create your first radar
        </h2>
        <p className="mt-3 max-w-md text-base text-[var(--ink-subtle)]">
          Describe a niche (e.g. &ldquo;Minecraft magazine minifigures&rdquo;)
          and Whatabrick will start tracking it.
        </p>
        <Button render={<Link href="/radars/new" />} className="mt-8">
          Create radar
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-foreground">
          Your radars
        </h2>
        <Button
          render={<Link href="/radars/new" />}
          variant="secondary"
          size="sm"
        >
          + New radar
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {radars.map((r) => (
          <Link
            key={r._id}
            href={`/radars/${r._id}`}
            className="block rounded-xl border border-border bg-card p-6 transition-colors hover:bg-popover"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="line-clamp-2 text-base font-medium text-foreground">
                {r.title}
              </h3>
              <Badge variant="secondary">{r.region}</Badge>
            </div>
            {r.expansionStatus === "pending" ? (
              <p className="mt-3 text-xs text-[var(--ink-subtle)]">
                Setting up…
              </p>
            ) : null}
            {r.expansionStatus === "ready" ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                <Badge variant="outline">{r.niche.replace(/_/g, " ")}</Badge>
                {r.theme ? <Badge variant="outline">{r.theme}</Badge> : null}
              </div>
            ) : null}
            {r.expansionStatus === "failed" ? (
              <p className="mt-3 text-xs text-destructive">
                Expansion failed — open to retry
              </p>
            ) : null}
          </Link>
        ))}
      </div>
    </>
  );
}
