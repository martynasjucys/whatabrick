"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api, type Id } from "@/lib/convex-api";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DigestPage() {
  const digest = useQuery(api.weeklyDigest.latest);

  if (digest === undefined) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="mt-3 h-4 w-2/3" />
        <Skeleton className="mt-6 h-32 w-full rounded-xl" />
      </div>
    );
  }

  if (digest === null) {
    return (
      <div className="mx-auto w-full max-w-3xl py-12">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          Weekly digest
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground">
          Your first digest hasn&apos;t shipped yet
        </h1>
        <p className="mt-3 max-w-xl text-sm text-[var(--ink-subtle)]">
          Whatabrick sends a recap every Monday morning UTC. Once you have a
          few tracked items and a week of history, this page will preview the
          next email.
        </p>
      </div>
    );
  }

  const weekStart = new Date(digest.weekStart);

  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
        Week of {weekStart.toLocaleDateString()}
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.02em] text-foreground">
        Your Whatabrick week
      </h1>
      <p className="mt-3 max-w-xl text-base text-[var(--ink-muted)]">
        {digest.content.intro}
      </p>

      {digest.content.sections.length === 0 ? (
        <p className="mt-10 text-sm text-[var(--ink-subtle)]">
          Nothing notable shifted across your tracked items this week.
        </p>
      ) : (
        <div className="mt-10 space-y-8">
          {digest.content.sections.map((section, i) => (
            <section key={i}>
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {section.title}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {section.items.map((item, j) => (
                  <li
                    key={j}
                    className="flex items-center gap-4 rounded-lg border border-border bg-card p-3"
                  >
                    <div className="size-10 shrink-0 overflow-hidden rounded-md bg-popover">
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
                        href={`/items/${item.itemId as Id<"items">}`}
                        className="block truncate text-sm font-medium text-foreground hover:underline"
                      >
                        {item.headline}
                      </Link>
                      <p className="mt-0.5 text-xs text-[var(--ink-subtle)]">
                        {item.bodySm}
                      </p>
                    </div>
                    {item.verdict ? (
                      <Badge variant="outline">
                        {item.verdict.replace(/_/g, " ")}
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 text-xs text-[var(--ink-subtle)]">
        Sent every Monday morning UTC. Manage delivery in{" "}
        <Link href="/settings" className="underline">
          settings
        </Link>
        .
      </p>
    </div>
  );
}
