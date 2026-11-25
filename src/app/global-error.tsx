"use client";
import { useEffect } from "react";
import { Button, EmptyState } from "@/components/kit";
import "./globals.css";
import "@/components/kit/kit.css";

/**
 * When the game's own frame breaks (the root layout): a whole page of its own, on the void, in
 * Saira, with the same plain words. It replaces the layout, so it brings its styles with it.
 */
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <html lang="en" className="h-full bg-void antialiased">
      <body className="min-h-full bg-void font-sans text-approach">
        <title>Math World</title>
        <main className="fixed inset-0 grid place-items-center overflow-y-auto px-6">
          <EmptyState size="page" icon="flag" title="Something went wrong" action={
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <Button variant="primary" size="lg" onClick={() => retry()} className="justify-between">Try again</Button>
              {/* a plain link: a full page load is the surest way back when the frame itself failed */}
              <a href="/bay" className="mw-btn mw-secondary mw-lg">Resting Bay</a>
            </div>
          }>
            Your progress is safe. Try again, or go back to the Resting Bay.
          </EmptyState>
        </main>
      </body>
    </html>
  );
}
