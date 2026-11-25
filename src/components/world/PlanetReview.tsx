"use client";
import { COLOR, INK, LINE, TYPE } from "@/design/tokens";
import { BODY_IDS, BODY_NAME } from "@/worlds/space/bodies";
import { PlanetSprite } from "./PlanetSprite";

const SIZES = [48, 96, 200] as const;

/** The /dev/planets sheet: each body from the one factory, large, then at the three sprite sizes, on the void. */
export function PlanetReview() {
  return (
    <main className="min-h-screen overflow-x-clip px-6 py-10 sm:px-12" style={{ background: COLOR.void, color: INK[1], fontFamily: `"${TYPE.family}", sans-serif` }}>
      <h1 className="m-0 text-3xl uppercase" style={{ fontWeight: TYPE.display.weight, fontStretch: `${TYPE.display.stretch}%`, letterSpacing: "0.08em" }}>Planets</h1>
      <p className="mt-2 text-base" style={{ color: INK[2] }}>Every body from the one planet factory, in the space look: large, then as a sprite at 48, 96 and 200 px.</p>
      <ul className="m-0 mt-8 list-none p-0">
        {BODY_IDS.map((id) => (
          <li key={id} className="flex flex-wrap items-center gap-8 py-8" style={{ borderTop: `1px solid ${LINE[1]}` }}>
            <PlanetSprite id={id} size={360} />
            <div className="flex flex-col gap-4">
              <h2 className="m-0 text-xl" style={{ fontWeight: 500, fontStretch: "115%" }}>{BODY_NAME[id]}</h2>
              <div className="flex flex-wrap items-end gap-6">
                {SIZES.map((s) => (
                  <figure key={s} className="m-0 flex flex-col items-center gap-2">
                    <PlanetSprite id={id} size={s} alt={`${BODY_NAME[id]}, ${s} px`} />
                    <figcaption className="text-sm" style={{ color: INK[3] }}>{s} px</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
