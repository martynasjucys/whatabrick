"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AlertControls({ itemId }: { itemId: Id<"items"> }) {
  const data = useQuery(api.alerts.myTrackedItem, { itemId });
  const setTargetPrice = useMutation(api.alerts.setTargetPrice);
  const setSellTargetPrice = useMutation(api.alerts.setSellTargetPrice);
  const muteItem = useMutation(api.alerts.muteItem);

  if (!data?.tracked) return null;

  return (
    <section className="mt-6 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Alerts
          </p>
          <h2 className="mt-1 text-lg font-medium text-foreground">
            Price targets
          </h2>
        </div>
        <Button
          size="sm"
          variant={data.muted ? "secondary" : "ghost"}
          onClick={() => muteItem({ itemId, muted: !data.muted })}
        >
          {data.muted ? "Unmute" : "Mute"}
        </Button>
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <PriceTargetField
          label="Buy target"
          description="Alert when the lowest sealed listing drops to or below this price."
          storedCents={data.tracked.targetPriceCents}
          onSave={(cents) =>
            setTargetPrice({ itemId, targetPriceCents: cents })
          }
        />
        <PriceTargetField
          label="Sell target"
          description="Alert when the going rate (qty-avg ask) climbs to or above this price."
          storedCents={data.tracked.sellTargetPriceCents}
          onSave={(cents) =>
            setSellTargetPrice({ itemId, sellTargetPriceCents: cents })
          }
        />
      </div>
    </section>
  );
}

function PriceTargetField({
  label,
  description,
  storedCents,
  onSave,
}: {
  label: string;
  description: string;
  storedCents: number | undefined;
  onSave: (cents: number | undefined) => Promise<unknown>;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const stored =
    storedCents !== undefined ? (storedCents / 100).toFixed(2) : "";
  const value = draft ?? stored;

  async function commit(cents: number | undefined) {
    setSaving(true);
    try {
      await onSave(cents);
      setDraft(null);
    } finally {
      setSaving(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const raw = value.trim();
    if (raw === "") return commit(undefined);
    const cents = Math.round(parseFloat(raw) * 100);
    if (!isFinite(cents) || cents < 0) return;
    await commit(cents);
  }

  return (
    <div>
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-[var(--ink-subtle)]">{description}</p>
      <form onSubmit={onSubmit} className="mt-3 flex items-center gap-2">
        <Input
          type="number"
          step="0.01"
          min="0"
          value={value}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="None"
          disabled={saving}
          className="max-w-[140px]"
        />
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {storedCents !== undefined ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={saving}
            onClick={() => commit(undefined)}
          >
            Clear
          </Button>
        ) : null}
      </form>
    </div>
  );
}
