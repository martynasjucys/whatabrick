"use client";

import { useState } from "react";
import { useAction, useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Candidate = {
  rebrickableType: "minifig" | "part" | "set";
  rebrickableId: string;
  name: string;
  imageUrl?: string;
  releaseYear?: number;
};

export function ItemSearch({
  radarId,
  radarContext,
}: {
  radarId: Id<"radars">;
  radarContext: { theme?: string; productType?: string; niche?: string };
}) {
  const search = useAction(api.itemsActions.searchByDescription);
  const addTracked = useMutation(api.items.addTrackedItem);
  const tracked = useQuery(api.items.listForRadar, { radarId });

  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const trackedKeys = new Set(
    (tracked ?? []).flatMap((t) =>
      t.item ? [`${t.item.rebrickableType}:${t.item.rebrickableId}`] : [],
    ),
  );

  const visibleCandidates = candidates.filter(
    (c) => !trackedKeys.has(`${c.rebrickableType}:${c.rebrickableId}`),
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await search({ query, radarContext });
      setCandidates(res.candidates);
      if (res.candidates.length === 0) {
        setError("No matches. Try a different phrasing.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function onAdd(c: Candidate) {
    const key = `${c.rebrickableType}:${c.rebrickableId}`;
    setAddingKey(key);
    try {
      await addTracked({ radarId, candidate: c });
    } finally {
      setAddingKey(null);
    }
  }

  return (
    <div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder='Search the LEGO catalog — e.g. "creeper", "skeleton horseman", "white dog"'
          disabled={submitting}
        />
        <Button type="submit" disabled={submitting || query.trim().length < 2}>
          {submitting ? "Searching…" : "Search"}
        </Button>
      </form>
      {error ? (
        <p className="mt-3 text-sm text-destructive">{error}</p>
      ) : null}

      {visibleCandidates.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {visibleCandidates.map((c) => {
            const key = `${c.rebrickableType}:${c.rebrickableId}`;
            return (
              <li
                key={key}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-md bg-popover">
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.imageUrl}
                      alt=""
                      className="size-full object-contain"
                    />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge variant="outline">{c.rebrickableType}</Badge>
                    <Badge variant="outline">{c.rebrickableId}</Badge>
                    {c.releaseYear ? (
                      <Badge variant="outline">{c.releaseYear}</Badge>
                    ) : null}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={addingKey === key}
                  onClick={() => onAdd(c)}
                >
                  {addingKey === key ? "Adding…" : "Add"}
                </Button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
