import type { Metadata } from "next";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { CadetDetail, cadetOf, PlayerTable, SignOut } from "@/components/admin/Dashboard";
import { getDb } from "@/db";
import { eventsByPlayer, listPlayers } from "@/db/store";
import { ADMIN_COOKIE, adminSecret, checkAccess, MIN_KEY } from "./access";

export const metadata: Metadata = { title: "Math World · Admin", robots: { index: false, follow: false } };

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

/** Every cadet with their folded log, as of now (the clock is read here, at request time, not in render). */
async function loadCadets() {
  await connection(); // request time, never prerendered: the clock and the log are live
  const db = await getDb();
  const [players, byPlayer] = await Promise.all([listPlayers(db), eventsByPlayer(db)]);
  const now = Date.now();
  return { now, cadets: players.map((p) => cadetOf(p, byPlayer.get(p.id) ?? [], now)) };
}

/**
 * The testing dashboard (not linked from the game): every cadet's transfer rate and Day-2 return, and
 * per cadet the 0–10 mastery heatmap, planet progress and event timeline. Reads the event log
 * server-side; guarded by the MW_ADMIN_KEY passphrase (off when it is not set).
 */
async function Admin({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const sp = await searchParams, key = one(sp.key), selected = one(sp.player) ?? null;
  const access = checkAccess(adminSecret(), { query: key, cookie: (await cookies()).get(ADMIN_COOKIE)?.value });
  if (access === "off") {
    return (
      <div className="m-auto max-w-md p-6 text-center text-ink-2">
        <p className="type-label-sm text-ink-2">Math World · admin</p>
        <p className="mt-3">The dashboard is off. Set <code className="font-code text-approach">MW_ADMIN_KEY</code> (at least {MIN_KEY} characters) in the server environment to turn it on.</p>
      </div>
    );
  }
  if (access === "locked") return <AdminLogin denied={sp.denied === "1"} />;

  const { cadets, now } = await loadCadets();
  // a key given in the URL travels with the links; the passphrase form's cookie needs nothing
  const linkFor = (id: string) => `/admin?${new URLSearchParams({ ...(key ? { key } : {}), player: id })}`;
  const focus = cadets.find((c) => c.player.id === selected) ?? null;
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-5 md:p-8">
      <header className="flex items-center justify-between">
        <div>
          <p className="type-label-sm text-ink-2">Math World · admin</p>
          <h1 className="mt-1 type-name text-2xl">Cadets · {cadets.length}</h1>
        </div>
        <SignOut />
      </header>
      <PlayerTable cadets={cadets} linkFor={linkFor} selected={focus?.player.id ?? null} />
      {focus ? <CadetDetail cadet={focus} now={now} /> : cadets.length > 0 && <p className="type-body-sm text-ink-3">Pick a cadet for their mastery heatmap, transfer rate by trick and event timeline.</p>}
    </main>
  );
}

export default function AdminPage(props: PageProps<"/admin">) {
  return (
    <div className="min-h-dvh bg-void text-approach">
      <Suspense fallback={<p className="p-8 type-label-sm text-ink-3">Loading telemetry…</p>}>
        <Admin searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
