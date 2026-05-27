"use client";

import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Condition = "N" | "U";

const LABELS: Record<Condition, { tab: string; price: string }> = {
  N: { tab: "Sealed (new)", price: "sealed" },
  U: { tab: "Loose (used)", price: "loose" },
};

export function MarketCard({ itemId }: { itemId: Id<"items"> }) {
  const [condition, setCondition] = useState<Condition>("N");
  const itemData = useQuery(api.items.get, { id: itemId });
  const latest = useQuery(api.marketSnapshots.latest, { itemId, condition });
  const chart = useQuery(api.marketSnapshots.historyForChart, {
    itemId,
    condition,
    days: 30,
  });
  const refresh = useAction(api.marketSnapshotsActions.requestManualRefresh);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      await refresh({ itemId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }

  const stock = latest?.stock;
  const sold = latest?.sold;
  const currency = stock?.currency ?? sold?.currency ?? "EUR";
  const item = itemData?.item;
  const isUnpriced = item?.bricklinkStatus === "unpriced";
  const isPriced = item?.bricklinkStatus === "priced";
  const lastSyncedAt = item?.lastBrickLinkSyncAt;
  const isCooldownError = error?.startsWith("Already refreshed recently");

  return (
    <section className="mt-12 rounded-xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Market
          </p>
          <h2 className="mt-1 text-lg font-medium text-foreground">
            BrickLink price guide
          </h2>
        </div>
        <Button
          size="sm"
          variant="secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </Button>
      </div>

      {error ? (
        <p
          className={`mt-3 text-sm ${isCooldownError ? "text-[var(--ink-subtle)]" : "text-destructive"}`}
        >
          {error}
        </p>
      ) : null}

      <Tabs
        value={condition}
        onValueChange={(v) => setCondition(v as Condition)}
        className="mt-5"
      >
        <TabsList>
          <TabsTrigger value="N">{LABELS.N.tab}</TabsTrigger>
          <TabsTrigger value="U">{LABELS.U.tab}</TabsTrigger>
        </TabsList>
      </Tabs>

      {!stock && !sold ? (
        isUnpriced ? (
          <div className="mt-6 rounded-md border border-border bg-popover/40 p-4">
            <p className="text-sm text-foreground">
              Not priced on BrickLink.
            </p>
            <p className="mt-1 text-sm text-[var(--ink-subtle)]">
              {item?.bricklinkLastError ??
                "BrickLink doesn't have a price guide for this catalog item."}
            </p>
            {lastSyncedAt ? (
              <p className="mt-2 text-xs text-[var(--ink-subtle)]">
                Last checked {new Date(lastSyncedAt).toLocaleString()}.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-6 text-sm text-[var(--ink-subtle)]">
            {chart === undefined || itemData === undefined
              ? "Loading…"
              : isPriced && lastSyncedAt
                ? `BrickLink has no ${LABELS[condition].price} listings for this item right now.`
                : `Fetching the first snapshot from BrickLink… give it a few seconds.`}
          </p>
        )
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          <Stat
            label="Lowest"
            value={stock?.minPriceCents}
            currency={currency}
          />
          <Stat
            label="Qty-avg ask"
            value={stock?.qtyAvgPriceCents}
            currency={currency}
          />
          <Stat
            label="Qty-avg sold"
            value={sold?.qtyAvgPriceCents}
            currency={currency}
          />
          <Stat
            label="Active listings"
            value={stock?.activeListingCount}
            raw
          />
        </div>
      )}

      {chart && chart.length > 0 ? (
        <div className="mt-6 h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={chart}
              margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            >
              <CartesianGrid stroke="var(--hairline)" strokeDasharray="2 4" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDateTick}
                stroke="var(--ink-subtle)"
                fontSize={11}
              />
              <YAxis
                stroke="var(--ink-subtle)"
                fontSize={11}
                tickFormatter={(v) => `${v.toFixed(0)}`}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--surface-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "var(--ink)",
                }}
                labelFormatter={(v) =>
                  typeof v === "number"
                    ? new Date(v).toLocaleDateString()
                    : ""
                }
                formatter={(value, name) => {
                  const n = typeof value === "number" ? value : 0;
                  return [
                    `${currency} ${n.toFixed(2)}`,
                    name === "stock" ? "Asking" : "Sold",
                  ];
                }}
              />
              <Line
                type="monotone"
                dataKey="stock"
                stroke="var(--ink-subtle)"
                strokeWidth={1.5}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="sold"
                stroke="var(--brand-primary)"
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}
    </section>
  );
}

function Stat({
  label,
  value,
  currency,
  raw,
}: {
  label: string;
  value?: number;
  currency?: string;
  raw?: boolean;
}) {
  const display =
    value === undefined
      ? "—"
      : raw
        ? value.toString()
        : `${currency ?? ""} ${(value / 100).toFixed(2)}`.trim();
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
        {label}
      </p>
      <p className="mt-1 text-base font-medium text-foreground">{display}</p>
    </div>
  );
}

function formatDateTick(ms: number) {
  const d = new Date(ms);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}
