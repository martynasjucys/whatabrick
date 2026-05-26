"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "convex/react";
import { api } from "@/lib/convex-api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export default function NewRadarPage() {
  const router = useRouter();
  const create = useMutation(api.radars.create);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim().length < 3) {
      setError("Describe your niche in a few words.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const id = await create({ freeformQuery: text });
      router.push(`/radars/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl py-12">
      <Link
        href="/dashboard"
        className="text-sm text-[var(--ink-subtle)] hover:text-foreground"
      >
        ← Dashboard
      </Link>
      <p className="mt-6 text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
        New radar
      </p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.02em] text-foreground">
        Describe what you want to track
      </h1>
      <p className="mt-3 text-base text-[var(--ink-subtle)]">
        A line or two is enough. Whatabrick will classify the niche and seed the
        search queries for you.
      </p>
      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. Minecraft magazine minifigures, EU region"
          rows={4}
          disabled={submitting}
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex items-center gap-3">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create radar"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            render={<Link href="/dashboard" />}
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
