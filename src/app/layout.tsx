import type { Metadata } from "next";
import { Geist, Geist_Mono, Figtree } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ConvexClientProvider } from "@/components/convex-client-provider";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-sans" });

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Whatabrick — LEGO collectible radar",
  description:
    "Track LEGO collectibles, spot scarcity signals, and understand market changes without checking ten sites every day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
    >
      <html
        lang="en"
        className={cn(
          "h-full dark",
          "antialiased",
          geistSans.variable,
          geistMono.variable,
          "font-sans",
          figtree.variable,
        )}
      >
        <body className="min-h-full flex flex-col bg-background text-foreground">
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
