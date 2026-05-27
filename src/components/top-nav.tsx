import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { NotificationBell } from "@/components/notification-bell";

export function TopNav() {
  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-[1280px] items-center justify-between px-6">
        <Link
          href="/"
          className="text-base font-medium tracking-tight text-foreground"
        >
          Whatabrick
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--ink-subtle)]">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <Link href="/digest" className="hover:text-foreground">
            Digest
          </Link>
          <Link href="/settings" className="hover:text-foreground">
            Settings
          </Link>
          <NotificationBell />
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
