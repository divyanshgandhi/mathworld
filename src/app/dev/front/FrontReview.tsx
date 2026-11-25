"use client";
import { useState } from "react";
import { Button, Loading, PillLink, TopBar, HomeLink } from "@/components/kit";

/** Throws while rendering, so the nearest error.tsx takes over (exactly what a real crash does). */
function Broken(): never {
  throw new Error("A test break from /dev/front");
}

/**
 * The shell's states, side by side with a way to trigger each: the error screen (a real render
 * error, caught by src/app/error.tsx), the loading state, and the not-found page.
 */
export function FrontReview() {
  const [broken, setBroken] = useState(false);
  return (
    <div className="min-h-dvh bg-void text-approach">
      <TopBar left={<HomeLink />} title="Front review" />
      <main className="mx-auto flex max-w-[960px] flex-col gap-10 px-5 py-10">
        <section className="flex flex-col items-start gap-4">
          <h2 className="m-0 type-display text-[32px]">Error</h2>
          <p className="m-0 type-body text-ink-2">Breaks this screen while rendering. Try again brings it back.</p>
          <Button onClick={() => setBroken(true)} icon="flag">Break this screen</Button>
          {broken && <Broken />}
        </section>
        <section className="flex flex-col items-start gap-4">
          <h2 className="m-0 type-display text-[32px]">Loading</h2>
          <div className="grid h-56 w-full place-items-center rounded-panel border border-dashed border-line-1"><Loading /></div>
        </section>
        <section className="flex flex-col items-start gap-4">
          <h2 className="m-0 type-display text-[32px]">Not found</h2>
          <PillLink href="/no-such-place">Open a page that is not there</PillLink>
        </section>
      </main>
    </div>
  );
}
