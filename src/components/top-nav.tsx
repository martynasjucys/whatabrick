import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

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
        <nav className="flex items-center gap-6 text-sm text-[var(--ink-subtle)]">
          <Link href="/dashboard" className="hover:text-foreground">
            Dashboard
          </Link>
          <UserButton />
        </nav>
      </div>
    </header>
  );
}
