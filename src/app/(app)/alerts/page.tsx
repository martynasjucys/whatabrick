"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type AlertType =
  | "PRICE_BELOW_TARGET"
  | "PRICE_ABOVE_SELL_TARGET"
  | "LISTING_COUNT_DROP"
  | "VERDICT_TRANSITION"
  | "NEW_LISTING_SPIKE";

const TYPE_LABEL: Record<AlertType, string> = {
  PRICE_BELOW_TARGET: "Price below buy target",
  PRICE_ABOVE_SELL_TARGET: "Sell target hit",
  LISTING_COUNT_DROP: "Becoming harder to find",
  NEW_LISTING_SPIKE: "New listings appeared",
  VERDICT_TRANSITION: "Verdict changed",
};

export default function AlertsPage() {
  const alerts = useQuery(api.alerts.list, {});
  const markRead = useMutation(api.alerts.markRead);
  const markAllRead = useMutation(api.alerts.markAllRead);
  const dismiss = useMutation(api.alerts.dismiss);

  if (alerts === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12">
        <Skeleton className="h-9 w-40" />
        <div className="mt-6 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
            Inbox
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground">
            Alerts
          </h1>
        </div>
        {alerts.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => markAllRead({})}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {alerts.length === 0 ? (
        <div className="mt-12 rounded-xl border border-border bg-card p-8 text-center">
          <p className="text-base text-foreground">No alerts yet.</p>
          <p className="mt-1 text-sm text-[var(--ink-subtle)]">
            Set a target price on a tracked item and Whatabrick will email you
            when it dips below.
          </p>
        </div>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {alerts.map(({ alert, item }) => {
            const type = alert.type as AlertType;
            const isUnread = !alert.readAt;
            return (
              <li
                key={alert._id}
                className={`rounded-xl border border-border p-4 ${
                  isUnread ? "bg-card" : "bg-card/40"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="size-12 shrink-0 overflow-hidden rounded-md bg-popover">
                    {item?.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="size-full object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{TYPE_LABEL[type]}</Badge>
                      <span className="text-xs text-[var(--ink-subtle)]">
                        {new Date(alert.triggeredAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-foreground">
                      <span className="font-medium">{item?.name ?? "Item"}</span>{" "}
                      — {renderBody(type, alert.payload)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {item ? (
                      <Button
                        size="sm"
                        variant="secondary"
                        render={
                          <Link
                            href={`/items/${item._id as Id<"items">}`}
                          />
                        }
                        onClick={() => {
                          if (isUnread) void markRead({ id: alert._id });
                        }}
                      >
                        Open
                      </Button>
                    ) : null}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismiss({ id: alert._id })}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function renderBody(
  type: AlertType,
  p: {
    priceCents?: number;
    currency?: string;
    targetPriceCents?: number;
    listingsBefore?: number;
    listingsAfter?: number;
    changePct?: number;
    verdictFrom?: string;
    verdictTo?: string;
  },
): string {
  const fmt = (cents?: number, currency = "EUR") =>
    cents !== undefined
      ? `${currency} ${(cents / 100).toFixed(2)}`
      : "n/a";
  switch (type) {
    case "PRICE_BELOW_TARGET":
      return `Lowest asking dropped to ${fmt(p.priceCents, p.currency)} (buy target ${fmt(p.targetPriceCents, p.currency)}).`;
    case "PRICE_ABOVE_SELL_TARGET":
      return `Going rate climbed to ${fmt(p.priceCents, p.currency)} (sell target ${fmt(p.targetPriceCents, p.currency)}).`;
    case "LISTING_COUNT_DROP":
      return `Active listings fell ${p.listingsBefore ?? 0} → ${p.listingsAfter ?? 0} (${p.changePct ?? 0}%).`;
    case "NEW_LISTING_SPIKE":
      return `Active listings jumped ${p.listingsBefore ?? 0} → ${p.listingsAfter ?? 0} (+${p.changePct ?? 0}%).`;
    case "VERDICT_TRANSITION":
      return `Verdict shifted ${p.verdictFrom ?? "?"} → ${p.verdictTo ?? "?"}.`;
  }
}
