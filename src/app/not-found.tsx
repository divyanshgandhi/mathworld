import { EmptyState, PillLink } from "@/components/kit";

/** A page that is not in the game: plain words and one way home, on the void. */
export default function NotFound() {
  return (
    <main className="fixed inset-0 grid place-items-center overflow-y-auto bg-void px-6 text-approach">
      <EmptyState size="page" icon="map" title="Nothing out here" action={<PillLink href="/bay" variant="primary" size="lg" className="justify-between">Resting Bay</PillLink>}>
        This page is not part of the game. The Resting Bay will get you flying again.
      </EmptyState>
    </main>
  );
}
