"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { api } from "@/lib/convex-api";

export function NotificationBell() {
  const unread = useQuery(api.alerts.unreadCount);
  const count = unread ?? 0;

  return (
    <Link
      href="/alerts"
      aria-label="Alerts"
      className="relative inline-flex size-9 items-center justify-center rounded-full text-[var(--ink-subtle)] hover:bg-popover hover:text-foreground"
    >
      <Bell className="size-4" />
      {count > 0 ? (
        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--brand-primary)] px-1 text-[10px] font-medium text-white">
          {count > 9 ? "9+" : count}
        </span>
      ) : null}
    </Link>
  );
}
