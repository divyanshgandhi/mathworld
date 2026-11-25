"use client";
import { useEffect } from "react";
import { Button, EmptyState, PillLink } from "@/components/kit";

/**
 * When a screen breaks: plain words, one way to try again and one way home, on the void.
 * The cadet's progress lives in the event log, so nothing is lost; the screen just reloads.
 */
export default function ScreenError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <main className="fixed inset-0 grid place-items-center overflow-y-auto bg-void px-6 text-approach">
      <EmptyState size="page" icon="flag" title="Something went wrong" action={
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <Button variant="primary" size="lg" onClick={() => retry()} className="justify-between">Try again</Button>
          <PillLink href="/bay" icon="bay" size="lg">Resting Bay</PillLink>
        </div>
      }>
        Your progress is safe. Try again, or go back to the Resting Bay.
      </EmptyState>
    </main>
  );
}
