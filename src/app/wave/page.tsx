import Link from "next/link";
import { MoonWave } from "@/components/MoonWave";

export default function WavePage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-6 py-8">
      <Link href="/" className="text-sm text-white/50 hover:text-white">← Math World</Link>
      <MoonWave />
    </main>
  );
}
