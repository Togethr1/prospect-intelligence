import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Sales Assistant",
  description: "Practice cold calls with AI personas that push back.",
};

import { Navigation } from "@/components/navigation";
import { Zap } from "lucide-react";

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
        <div className="container max-w-5xl mx-auto pt-8 px-6">
            <header className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center glow-primary">
                <Zap className="w-5 h-5 text-primary fill-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Prospect Intelligence
                </h1>
                <p className="text-xs text-muted-foreground font-medium">
                  Premium prospecting & practice platform
                </p>
              </div>
            </header>
            
            <Navigation />
            
            <main className="flex-1">
              {children}
            </main>
        </div>
      </body>
    </html>
  );
}
