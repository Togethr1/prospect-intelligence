import type { Metadata } from "next";
import "./globals.css";
import "@livekit/components-styles";

export const metadata: Metadata = {
  title: "Prospect Intelligence",
  description: "Practice cold calls with AI personas that push back.",
};

// A per-request CSP nonce cannot be applied to statically generated HTML.
export const dynamic = "force-dynamic";

import { Navigation } from "@/components/navigation";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased min-h-screen flex flex-col bg-background"
      >
        <div className="mx-auto w-full max-w-7xl px-5 pb-12 pt-6 sm:px-8">
            <header className="flex flex-col gap-5 border-b border-border/60 pb-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center glow-primary">
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ width: 22, height: 22, color: "var(--primary)" }}
                >
                  <path d="M10 20h4V4h-4v16ZM4 20h4v-8H4v8Zm12 0h4V8h-4v12Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Prospect Intelligence
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Premium prospecting & practice platform
                </p>
              </div>
              </div>
              <Navigation />
            </header>
            <main className="flex-1 pt-8">
              {children}
            </main>
        </div>
      </body>
    </html>
  );
}
