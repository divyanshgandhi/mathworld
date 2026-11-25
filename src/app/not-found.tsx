import Link from "next/link";

// the kit's sheet and primary pill (battle/ui is a client module, so its class strings are not imported here)
const glass = "mw-sheet";
const lime = "mw-btn mw-primary mw-md";

/** A wrong turn in space: still the game's look, with one way home. */
export default function NotFound() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-void text-approach">
      <div className={`${glass} flex flex-col items-center gap-3 p-7 text-center`}>
        <p className="type-label-sm text-ink-2">Navigation · no signal</p>
        <p className="type-display text-[32px]">Nothing out here, cadet.</p>
        <p className="type-body text-ink-2">That sector is not on the star chart.</p>
        <Link href="/" className={`${lime} mt-3`}>Back to base</Link>
      </div>
    </main>
  );
}
