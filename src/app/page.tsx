import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/dashboard");

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-24">
      <div className="mx-auto w-full max-w-3xl text-center">
        <p className="text-[13px] font-medium uppercase tracking-[0.4px] text-[var(--ink-subtle)]">
          AI LEGO collectible radar
        </p>
        <h1 className="mt-6 text-5xl font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-7xl">
          Track LEGO collectibles.
          <br />
          Spot scarcity signals.
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--ink-muted)]">
          Whatabrick monitors prices and listing counts across BrickLink so you
          understand market changes — without checking ten sites every day.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button render={<Link href="/sign-up" />} size="lg">
            Get started
          </Button>
          <Button
            render={<Link href="/sign-in" />}
            size="lg"
            variant="secondary"
          >
            Sign in
          </Button>
        </div>
      </div>
    </main>
  );
}
