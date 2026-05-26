import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { TopNav } from "@/components/top-nav";
import { EnsureUser } from "@/components/ensure-user";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  return (
    <>
      <EnsureUser />
      <TopNav />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-6 py-12">
        {children}
      </main>
    </>
  );
}
