import Link from "next/link";

const SCENES = [
  { href: "/intro", title: "The intro film", note: "Earth, an ordinary Tuesday, the knock, cadet selected" },
  { href: "/wave", title: "A Moon wave", note: "The space look: clay light, green toon invaders, neon glow" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-8 py-16">
      <div>
        <p className="font-mono text-xs tracking-[0.3em] text-lime-300">MATH WORLD</p>
        <h1 className="mt-3 text-5xl font-semibold leading-tight">Answer to fire.<br />Learn from the miss.</h1>
      </div>
      <ul className="grid gap-3">
        {SCENES.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-xl border border-white/10 px-5 py-4 transition hover:border-lime-300/60">
              <span className="text-lg">{s.title} →</span>
              <span className="mt-1 block text-sm text-white/55">{s.note}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
