"use client";

import { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Region = "EU" | "UK" | "US" | "GLOBAL";
const REGIONS: Region[] = ["EU", "UK", "US", "GLOBAL"];

export default function RadarDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const radarId = id as Id<"radars">;
  const radar = useQuery(api.radars.get, { id: radarId });
  const remove = useMutation(api.radars.remove);
  const retry = useMutation(api.radars.retryExpansion);
  const update = useMutation(api.radars.update);
  const router = useRouter();

  if (radar === undefined) return <RadarSkeleton />;
  if (radar === null) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12">
        <p className="text-sm text-[var(--ink-subtle)]">Radar not found.</p>
      </div>
    );
  }

  async function onDelete() {
    if (!confirm("Delete this radar? This cannot be undone.")) return;
    await remove({ id: radarId });
    router.push("/dashboard");
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--ink-subtle)] hover:text-foreground"
      >
        ← Dashboard
      </Link>

      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.02em] text-foreground">
        {radar.title}
      </h1>
      <p className="mt-2 text-base text-[var(--ink-subtle)]">
        {radar.freeformQuery}
      </p>

      {radar.expansionStatus === "pending" && (
        <div className="mt-6 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-28 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-20 rounded-full" />
        </div>
      )}

      {radar.expansionStatus === "ready" && (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{nicheLabel(radar.niche)}</Badge>
          {radar.theme ? <Badge variant="outline">{radar.theme}</Badge> : null}
          {radar.productType ? (
            <Badge variant="outline">{radar.productType.replace(/_/g, " ")}</Badge>
          ) : null}
          <Select
            value={radar.region}
            onValueChange={(value) =>
              update({ id: radarId, region: value as Region })
            }
          >
            <SelectTrigger size="sm" className="ml-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {radar.expansionStatus === "failed" && (
        <div className="mt-6 rounded-lg border border-border bg-card p-4">
          <p className="text-sm text-destructive">
            Expansion failed: {radar.expansionError || "unknown error"}
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            onClick={() => retry({ id: radarId })}
          >
            Retry expansion
          </Button>
        </div>
      )}

      {radar.expansionStatus === "ready" && radar.seedQueries.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Seed queries
          </h2>
          <ul className="mt-3 flex flex-col gap-2">
            {radar.seedQueries.map((q, i) => (
              <li
                key={i}
                className="rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground"
              >
                {q}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Tracked items
        </h2>
        <p className="mt-3 text-sm text-[var(--ink-subtle)]">
          Item tracking is added in the next feature.
        </p>
      </section>

      <section className="mt-14 border-t border-border pt-6">
        <Button variant="ghost" onClick={onDelete}>
          Delete radar
        </Button>
      </section>
    </div>
  );
}

function RadarSkeleton() {
  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-3 h-9 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <div className="mt-6 flex gap-2">
        <Skeleton className="h-7 w-28 rounded-full" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
    </div>
  );
}

function nicheLabel(slug: string) {
  return slug.replace(/_/g, " ");
}
