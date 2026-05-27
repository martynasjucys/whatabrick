"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Region = "EU" | "UK" | "US" | "OTHER";
type Currency = "EUR" | "GBP" | "USD";
type AlertChannel = "email" | "none";

export default function SettingsPage() {
  const me = useQuery(api.users.me);
  const updateMe = useMutation(api.weeklyDigest.updateMe);
  const [saving, setSaving] = useState(false);

  if (me === undefined) {
    return (
      <div className="mx-auto w-full max-w-2xl py-12">
        <p className="text-sm text-[var(--ink-subtle)]">Loading…</p>
      </div>
    );
  }
  if (me === null) return null;

  const digestEnabled = me.weeklyDigestEnabled !== false;

  async function patch(fields: Parameters<typeof updateMe>[0]) {
    setSaving(true);
    try {
      await updateMe(fields);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
        Preferences
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground">
        Settings
      </h1>

      <section className="mt-8 rounded-xl border border-border bg-card p-6">
        <Row label="Region">
          <Select
            value={me.region}
            onValueChange={(v) => patch({ region: v as Region })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["EU", "UK", "US", "OTHER"].map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Currency">
          <Select
            value={me.currency}
            onValueChange={(v) => patch({ currency: v as Currency })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["EUR", "GBP", "USD"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Row>
        <Row label="Alerts">
          <Select
            value={me.alertChannel}
            onValueChange={(v) => patch({ alertChannel: v as AlertChannel })}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email + in-app</SelectItem>
              <SelectItem value="none">In-app only</SelectItem>
            </SelectContent>
          </Select>
        </Row>
        <Row
          label="Weekly digest"
          description="Monday morning recap of price drops, scarcity changes, and verdict shifts."
        >
          <Button
            size="sm"
            variant={digestEnabled ? "secondary" : "default"}
            disabled={saving}
            onClick={() => patch({ weeklyDigestEnabled: !digestEnabled })}
          >
            {digestEnabled ? "On" : "Off"}
          </Button>
        </Row>
      </section>
    </div>
  );
}

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-border py-4 last:border-0">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description ? (
          <p className="mt-1 text-xs text-[var(--ink-subtle)]">{description}</p>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
