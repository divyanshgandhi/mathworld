"use client";
import type { ReactNode } from "react";
import { Icon } from "@/components/kit/Icon";
import { MasteryMark } from "@/components/kit/Marks";
import { MASTERY } from "@/design/tokens";
import type { ManualScene } from "@/teach/manual";
import {
  arrayBox, arrayLayout, countFrame, countPeriod, fireFrame, firePeriod, flipFrame, flipLayouts, flipPeriod, missFrame, missPeriod,
  rewardFrame, rewardPeriod, SCENE_H, SCENE_W, squadsFrame, squadsPeriod, type ShipCell, type VolleyFrame,
} from "@/teach/scenes";
import type { ShipTone } from "@/teach/shipKinds";
import { useLoop } from "./motion";
import { useShipSprite } from "./ShipSprite";

/**
 * The Field Manual's pictures: small live scenes from the game's own ship art, always true arrays.
 * All layout and timing is in src/teach/scenes.ts; this file only draws a frame. Each scene loops
 * gently while its page is the one in view, and holds one still frame under reduced motion.
 * Only one thing moves at a time.
 */
const NUM = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
const say = (n: number) => NUM[n] ?? String(n);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sprites are baked a little larger than drawn, so the picture stays sharp when it scales up. */
const BAKE = 1.5;

function useFleetArt(cell: number) {
  const px = Math.round(cell * BAKE);
  const art = {
    ember: useShipSprite("invader", px, "ember"), apricot: useShipSprite("invader", px, "apricot"),
    emberLead: useShipSprite("leader", px, "ember"), apricotLead: useShipSprite("leader", px, "apricot"),
  };
  return (tone: ShipTone, leader: boolean) => art[`${tone}${leader ? "Lead" : ""}` as keyof typeof art];
}

/** One drone, or the empty socket it leaves when hit (so you can still count what fell). */
function Ship({ s, cell, art, popped = false, x = s.x, y = s.y, opacity = 1 }: { s: ShipCell; cell: number; art: ReturnType<typeof useFleetArt>; popped?: boolean; x?: number; y?: number; opacity?: number }) {
  if (popped) return <circle cx={x} cy={y} r={cell * 0.3} className="fill-none stroke-line-2" strokeWidth={1} strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />;
  const url = art(s.tone, s.leader);
  if (!url) return <circle cx={x} cy={y} r={cell * 0.32} className="fill-none stroke-line-1" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={opacity} />;
  return <image href={url} x={x - cell / 2} y={y - cell / 2} width={cell} height={cell} opacity={opacity} />;
}

function Rocket({ x, y, size = 44, n }: { x: number; y: number; size?: number; n?: number | null }) {
  const url = useShipSprite("rocket", Math.round(size * BAKE));
  return (
    <g>
      {url ? <image href={url} x={x - size / 2} y={y - size / 2} width={size} height={size} />
        : <circle cx={x} cy={y} r={size * 0.3} className="fill-none stroke-line-1" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
      {/* the typed number rides on the rocket, as it does in battle */}
      {n != null && n > 0 && <text x={x + size * 0.42} y={y - size * 0.12} className="type-number fill-approach" fontSize={22} fontWeight={500}>{n}</text>}
    </g>
  );
}

function Balls({ balls }: { balls: VolleyFrame["balls"] }) {
  const url = useShipSprite("ball", 21);
  return <>{balls.map((b, i) => b.on && (url ? <image key={i} href={url} x={b.x - 7} y={b.y - 7} width={14} height={14} /> : <circle key={i} cx={b.x} cy={b.y} r={4} className="fill-gold" />))}</>;
}

/** The console's Fire button, drawn: "Fire 12". Gold edge while pressed. */
function FirePill({ x, y, n, pressed }: { x: number; y: number; n: number; pressed: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={78} height={34} rx={17} className={pressed ? "fill-raised stroke-gold" : "fill-none stroke-line-3"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={x + 39} y={y + 22} textAnchor="middle" className="type-name type-number fill-approach" fontSize={15} fontWeight={600}>{n > 0 ? `Fire ${n}` : "Fire"}</text>
    </g>
  );
}

function Picture({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg viewBox={`0 0 ${SCENE_W} ${SCENE_H}`} role="img" aria-label={label} className="block h-auto w-full select-none" style={{ fontFamily: "inherit" }}>
      {children}
    </svg>
  );
}

/* 1. Ships fly in squads */
function Squads({ squads, each, active }: { squads: number; each: number; active: boolean }) {
  const cell = 30, ships = arrayLayout(squads, each, { cell, top: 24 }), art = useFleetArt(cell), box = arrayBox(ships, cell);
  const f = squadsFrame(squads, useLoop(squadsPeriod(squads), active));
  return (
    <Picture label={`${say(squads)} squads of ${say(each)} ships. Each row is one squad.`}>
      {Array.from({ length: squads }, (_, s) => (
        <rect key={s} x={box.x - 7} y={ships[s * each].y - cell / 2 - 5} width={box.w + 14} height={cell + 10} rx={(cell + 10) / 2}
          className="fill-none stroke-gold" strokeWidth={1} vectorEffect="non-scaling-stroke" opacity={s < f.outlined ? 1 : 0} />
      ))}
      {ships.map((s) => <Ship key={s.i} s={s} cell={cell} art={art} />)}
      <Rocket x={SCENE_W / 2} y={170} />
    </Picture>
  );
}

/* 2. Count them. Type the number. */
function Count({ squads, each, active }: { squads: number; each: number; active: boolean }) {
  const cell = 30, n = squads * each, ships = arrayLayout(squads, each, { cell, top: 12 }), art = useFleetArt(cell);
  const f = countFrame(n, useLoop(countPeriod(n), active));
  return (
    <Picture label={`${say(n)} ships, counted one by one. The rocket shows ${n}.`}>
      {ships.map((s) => <Ship key={s.i} s={s} cell={cell} art={art} />)}
      {ships.map((s) => s.i < f.counted && <circle key={s.i} cx={s.x} cy={s.y + cell / 2 + 3} r={2.2} className="fill-gold" />)}
      <Rocket x={SCENE_W / 2} y={164} n={f.counted} />
      <FirePill x={232} y={147} n={f.counted} pressed={false} />
    </Picture>
  );
}

/* 3. Press Fire. One plasma ball for each ship. */
function Fire({ squads, each, active }: { squads: number; each: number; active: boolean }) {
  const cell = 34, n = squads * each, ships = arrayLayout(squads, each, { cell, top: 18 }), art = useFleetArt(cell);
  const nose = { x: SCENE_W / 2, y: 146 };
  const f = fireFrame(ships, nose.x, nose.y, useLoop(firePeriod(n), active));
  return (
    <Picture label={`${say(n)} ships and ${say(n)} plasma balls: one ball for each ship.`}>
      {ships.map((s) => <Ship key={s.i} s={s} cell={cell} art={art} popped={f.popped[s.i]} opacity={f.back ?? 1} />)}
      <Balls balls={f.balls} />
      <Rocket x={nose.x} y={168} n={n} />
      <FirePill x={232} y={151} n={n} pressed={f.pressed && f.balls.length > 0} />
    </Picture>
  );
}

/* 4. Too few and some get away. Too many and some fly past. */
function Miss({ squads, each, under, over, active }: { squads: number; each: number; under: number; over: number; active: boolean }) {
  const cell = 26, n = squads * each, art = useFleetArt(cell);
  const left = arrayLayout(squads, each, { cell, gap: 6, cx: 80, top: 30 }), right = arrayLayout(squads, each, { cell, gap: 6, cx: 240, top: 30 });
  const f = missFrame(left, right, under, over, { l: [80, 142], r: [240, 142] }, useLoop(missPeriod(), active));
  return (
    <Picture label={`Left: ${n} ships, ${under} plasma balls, ${n - under} ships get away. Right: ${n} ships, ${over} plasma balls, ${over - n} fly past.`}>
      <line x1={SCENE_W / 2} y1={18} x2={SCENE_W / 2} y2={190} className="stroke-line-1" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      {left.map((s) => {
        const hit = f.under.popped[s.i], away = s.i >= under;
        return <Ship key={s.i} s={s} cell={cell} art={art} popped={hit} y={away ? s.y - f.escape : s.y} opacity={away ? Math.max(0, 1 - f.escape / 60) : 1} />;
      })}
      <Balls balls={f.under.balls} />
      <Rocket x={80} y={164} size={40} n={under} />
      {right.map((s) => <Ship key={s.i} s={s} cell={cell} art={art} popped={f.over?.popped[s.i] ?? false} />)}
      {f.over && <Balls balls={f.over.balls} />}
      <Rocket x={240} y={164} size={40} n={over} />
    </Picture>
  );
}

/* 5. Show Me How and Power-Ups: Flip It turns the fleet sideways. Same ships, easier to count. */
function Flip({ squads, each, active }: { squads: number; each: number; active: boolean }) {
  const cell = 22, art = useFleetArt(cell);
  const { before, to } = flipLayouts(squads, each, { cell, gap: 6, squadGap: 7, cx: 100, top: 8 }, { cell, gap: 6, squadGap: 7, cx: 100, top: 72 });
  const f = flipFrame(useLoop(flipPeriod(), active));
  const pill = (y: number, icon: "help" | "trick", words: string, on: boolean) => (
    <g>
      <rect x={204} y={y} width={108} height={36} rx={18} className={on ? "fill-raised stroke-gold" : "fill-none stroke-line-3"} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <Icon name={icon} size={18} x={214} y={y + 9} className={on ? "text-gold" : "text-approach"} />
      <text x={238} y={y + 23} className="type-name fill-approach" fontSize={14} fontWeight={500}>{words}</text>
    </g>
  );
  return (
    <Picture label={`${say(squads)} squads of ${say(each)} turn sideways into ${say(each)} squads of ${say(squads)}. Same ${squads * each} ships.`}>
      {before.map((s, i) => <Ship key={s.i} s={s} cell={cell} art={art} x={lerp(s.x, to[i].x, f.k)} y={lerp(s.y, to[i].y, f.k)} />)}
      {pill(62, "help", "Show Me How", false)}
      {pill(108, "trick", "Flip It!", f.pressed)}
    </Picture>
  );
}

/* 6. First-try answers earn orbs. Facts you know in a flash turn Gold. */
function Reward({ squads, each, active }: { squads: number; each: number; active: boolean }) {
  const f = rewardFrame(4, useLoop(rewardPeriod(), active));
  return (
    <div role="img" aria-label={`${squads} times ${each} is ${squads * each}, right on the first try: one more orb. The fact turns Gold.`}
      className="flex aspect-[320/200] w-full items-center justify-center gap-[clamp(28px,9vw,64px)]">
      <div className="flex flex-col items-center gap-4">
        <p className="m-0 flex items-center gap-2 type-display type-number text-[clamp(30px,9vw,44px)] leading-none">
          {squads}<span className="text-ink-3">×</span>{each}<span className="text-ink-3">=</span>{squads * each}
          <Icon name="check" size={26} className={`text-gold transition-opacity duration-quick ${f.right ? "opacity-100" : "opacity-0"}`} />
        </p>
        <p className="m-0 flex items-center gap-2.5 type-name text-[17px]">
          <MasteryMark level={f.level} size={16} />
          <span className={f.level === "gold" ? "text-gold" : "text-ink-2"}>{MASTERY[f.level].word}</span>
        </p>
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Icon name="orb" size={40} className="text-gold" />
        <p className="m-0 type-number text-[28px] font-medium leading-none">{f.orbs}</p>
        <p className="m-0 type-body-sm text-ink-2">orbs</p>
      </div>
    </div>
  );
}

/** The picture for one manual page. `active`: the page is in view (only then does it move). */
export function ManualPicture({ scene, active }: { scene: ManualScene; active: boolean }) {
  switch (scene.kind) {
    case "squads": return <Squads squads={scene.squads} each={scene.each} active={active} />;
    case "count": return <Count squads={scene.squads} each={scene.each} active={active} />;
    case "fire": return <Fire squads={scene.squads} each={scene.each} active={active} />;
    case "miss": return <Miss squads={scene.squads} each={scene.each} under={scene.under} over={scene.over} active={active} />;
    case "flip": return <Flip squads={scene.squads} each={scene.each} active={active} />;
    case "reward": return <Reward squads={scene.squads} each={scene.each} active={active} />;
  }
}
