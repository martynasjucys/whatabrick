import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function AppHome() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
        Your radar
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.025em] text-foreground">
        Create your first radar
      </h1>
      <p className="mt-3 max-w-md text-base text-[var(--ink-subtle)]">
        Describe a niche (e.g. &ldquo;Minecraft magazine minifigures&rdquo;) and
        Whatabrick will start tracking it.
      </p>
      <Button render={<Link href="/radars/new" />} className="mt-8">
        Create radar
      </Button>
    </div>
  );
}
