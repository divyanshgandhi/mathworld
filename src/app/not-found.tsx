import Link from "next/link";

// the game's glass and lime (battle/ui is a client module, so its class strings are not imported here)
const glass = "rounded-2xl border border-white/10 bg-[#0b0d1a]/78 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,.45)]";
const lime = "rounded-xl bg-lime-300 font-medium text-[#0d0e1a] outline-none transition hover:bg-lime-200 focus-visible:ring-2 focus-visible:ring-lime-300";

/** A wrong turn in space: still the game's look, with one way home. */
export default function NotFound() {
  return (
    <main className="fixed inset-0 grid place-items-center bg-[radial-gradient(ellipse_at_center,#10142b_0%,#02030a_70%)] text-white">
      <div className={`${glass} flex flex-col items-center gap-3 p-7 text-center`}>
        <p className="font-mono text-xs tracking-[0.3em] text-lime-300">NAVIGATION · NO SIGNAL</p>
        <p className="text-2xl font-semibold">Nothing out here, cadet.</p>
        <p className="text-sm text-white/65">That sector is not on the star chart.</p>
        <Link href="/" className={`${lime} mt-2 px-6 py-3 text-base`}>Back to base</Link>
      </div>
    </main>
  );
}
