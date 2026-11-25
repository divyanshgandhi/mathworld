import type { Metadata } from "next";
import { Suspense } from "react";
import { ManualRoute } from "./ManualRoute";

export const metadata: Metadata = { title: "How to play · Math World" };

/**
 * /manual: the Field Manual on its own page (a link, a bookmark, a new tab). `?topic=fire` opens
 * that page. Close goes back where the player came from, or to the Resting Bay.
 */
export default function ManualPage() {
  return (
    <div className="fixed inset-0 bg-void">
      <Suspense fallback={null}>
        <ManualRoute />
      </Suspense>
    </div>
  );
}
