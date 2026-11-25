"use client";
import { useEffect, useRef, useState } from "react";
import type { Object3D } from "three";
import { Button } from "@/components/kit";
import { COLOR } from "@/design/tokens";
import type { Character, Expression, Spec } from "@/worlds/space/cast";
import type { Setup } from "@/worlds/space/intro";

const VIEWS = [["Front", 0], ["Three-quarter", 0.62], ["Side", Math.PI / 2]] as const;
const FACES: [string, Expression][] = [["Neutral", "neutral"], ["Happy", "happy"], ["Thinking", "thinking"], ["Oops", "oops"], ["Cheer", "cheer"]];
const BODY = { w: 300, h: 400 }, FACE = 220;
/** The two frames every setup is composed for: a wide screen and a phone held upright. */
const WIDE = { w: 480, h: 300 }, TALL = { w: 195, h: 422 };
const WHO = ["The cadet", "Nova", "The teacher", "The principal", "The Captain", "Maya"] as const;
const MOVES = ["Idle", "Talking", "Standing up", "Cheering"] as const;
type Who = (typeof WHO)[number];
type Move = (typeof MOVES)[number];

interface Sheet { name: string; note: string; bodies: string[]; faces: string[] }
interface Frame { wide?: string; tall?: string }

const label = "type-label-sm text-ink-2";

/**
 * The review page for the film's cast and shots, for the design lead:
 * - in motion: any character idling, talking, standing up or cheering, live;
 * - the contact sheet: every setup of the film as a still, for a wide screen and for a phone, with what it is for;
 * - each character from the front, three-quarter and side, then five faces.
 * Everything is built by the code the film uses and lit by the film's looks.
 */
export function CastReview() {
  const holder = useRef<HTMLDivElement>(null), live = useRef<HTMLDivElement>(null), filmBox = useRef<HTMLDivElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [who, setWho] = useState<Who>("The cadet");
  const [move, setMove] = useState<Move>("Idle");
  const [setups, setSetups] = useState<Setup[]>([]);
  const [frames, setFrames] = useState<Record<string, Frame>>({});
  const [sheetOn, setSheetOn] = useState(false);
  const choice = useRef({ who, move });
  useEffect(() => { choice.current = { who, move }; }, [who, move]);

  // the still sheets: one hidden stage draws them all, then lets its WebGL context go
  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [THREE, { createStage }, cast, { applyLook }] = await Promise.all([import("three"), import("@/engine/stage"), import("@/worlds/space/cast"), import("@/worlds/looks")]);
      if (gone || !holder.current) return;
      const stage = createStage(holder.current, { fill: true });
      cleanup = () => stage.dispose();
      stage.paused = true;
      const look = applyLook(stage, "interior");
      const { scene, camera, mats: M } = stage;
      scene.add(new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity * 1.4));
      const key = new THREE.DirectionalLight(look.key.color, look.key.intensity * 0.5);
      key.position.set(-2.4, 3.2, 3.6);
      const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity * 1.6);
      rim.position.set(2.5, 2.2, -3);
      scene.add(key, rim);
      // a hairline circle to stand on: the only ground the void needs
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.52, 0.528, 96), new THREE.MeshBasicMaterial({ color: COLOR.approach, transparent: true, opacity: 0.3 }));
      ring.rotation.x = -Math.PI / 2;
      scene.add(ring);
      camera.fov = 24;
      camera.updateProjectionMatrix();

      const rnd = () => 0.5;
      const shot = (w: number, h: number, crop: boolean) => {
        stage.step(0);
        const src = stage.renderer.domElement, c = document.createElement("canvas"), k = src.width / BODY.w;
        c.width = w * k; c.height = h * k;
        const sx = crop ? (src.width - c.width) / 2 : 0, sy = crop ? (src.height - c.height) / 2 : 0;
        c.getContext("2d")!.drawImage(src, sx, sy, c.width, c.height, 0, 0, c.width, c.height);
        return c.toDataURL("image/png");
      };
      const aim = (y: number, tall: number) => {
        const d = (tall / 2) / Math.tan((camera.fov * Math.PI) / 360);
        camera.position.set(0, y + tall * 0.04, d);
        camera.lookAt(0, y, 0);
      };
      const people: [string, string, Spec][] = [
        ["The cadet", "You. The hoodie takes the colour you picked at sign-up; gold is the Star Fleet's.", cast.PLAYER],
        ["The teacher", "Warm, quick to praise.", cast.TEACHER],
        ["The principal", "Kind and a little formal.", cast.PRINCIPAL],
        ["The Captain", "Calm, steady, in Star Fleet navy and gold.", cast.CAPTAIN],
        ...(["Maya", "Leo", "Aarav", "Zoe"] as const).map((n, i): [string, string, Spec] => [n, "A classmate, and a cadet too.", cast.CLASSMATES[cast.NAMED[i]]]),
      ];
      const out: Sheet[] = [];

      // Nova first: she floats, so her tiles are framed on her body
      const nova = cast.makeNova(M);
      scene.add(nova.group);
      ring.visible = false;
      const novaShot = (yaw: number, e: Expression, tall: number, w: number, h: number, crop: boolean) => {
        nova.express(e);
        for (let i = 0; i < 40; i++) nova.animate(0, 1 / 30, 0, 0);
        nova.group.position.y = 0;
        nova.group.rotation.set(0, yaw, e === "thinking" ? 0.22 : e === "oops" ? -0.14 : 0);
        aim(0, tall);
        return shot(w, h, crop);
      };
      out.push({ name: "Nova", note: "Your co-pilot. Matte, no glow; her eyes do the talking.", bodies: VIEWS.map(([, yaw]) => novaShot(yaw, "neutral", 2.1, BODY.w, BODY.h, false)), faces: FACES.map(([, e]) => novaShot(0.25, e, 1.5, FACE, FACE, true)) });
      nova.group.visible = false;
      ring.visible = true;

      for (const [name, note, spec] of people) {
        const c = cast.makeCharacter(spec, M, rnd);
        scene.add(c.group);
        const pose = (yaw: number, e: Expression) => {
          cast.setExpression(c, e, true);
          c.group.rotation.y = yaw;
          c.rig.look = null;
          cast.animateCharacter(c, 0, 1 / 60, rnd, 0);
          c.rig.head.rotation.set(0, 0, e === "thinking" ? 0.12 : 0);
        };
        const bodies = VIEWS.map(([, yaw]) => { pose(yaw, "neutral"); aim(1.02, 2.14); return shot(BODY.w, BODY.h, false); });
        ring.visible = false;
        const headY = c.rig.L + c.rig.Ht + c.rig.H * 1.1;
        const faces = FACES.map(([, e]) => { pose(0.3, e); aim(e === "cheer" ? headY + 0.08 : headY, e === "cheer" ? 1.45 : 0.95); return shot(FACE, FACE, true); });
        ring.visible = true;
        c.group.visible = false;
        out.push({ name, note, bodies, faces });
        if (gone) return;
      }
      setSheets(out);
      stage.dispose();
      cleanup = () => {};
      setSheetOn(true); // one hidden stage at a time: the contact sheet starts when the cast is drawn
    })();
    return () => { gone = true; cleanup(); };
  }, []);

  // in motion: one live stage; the buttons choose who is on it and what they do
  useEffect(() => {
    let gone = false, cleanup = () => {};
    (async () => {
      const [THREE, { createStage }, cast, { applyLook }, { seeded }] = await Promise.all([import("three"), import("@/engine/stage"), import("@/worlds/space/cast"), import("@/worlds/looks"), import("@/engine/util")]);
      if (gone || !live.current) return;
      const stage = createStage(live.current, { fill: true });
      cleanup = () => stage.dispose();
      const look = applyLook(stage, "interior");
      const { scene, camera, mats: M } = stage, rnd = seeded(7);
      scene.add(new THREE.HemisphereLight(look.fill.sky, look.fill.ground, look.fill.intensity * 1.3));
      const key = new THREE.DirectionalLight(look.key.color, look.key.intensity * 0.55);
      key.position.set(-2.4, 3.2, 3.6);
      key.castShadow = true;
      Object.assign(key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.5, far: 12 });
      key.shadow.radius = 3;
      const rim = new THREE.DirectionalLight(look.rim.color, look.rim.intensity * 1.6);
      rim.position.set(2.5, 2.2, -3);
      scene.add(key, rim);
      // a floor of the void's own colour to take the shadow, a hairline to stand on, and a child's chair and desk
      const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), M.clay(cast.mix(COLOR.void, COLOR.shadow, 0.5), { roughness: 0.95 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      scene.add(floor);
      const SEAT = 0.32, DESK = 0.58;
      const chair = new THREE.Group(), wood = M.clay(cast.mix(COLOR.disk, COLOR.horizon, 0.35), { roughness: 0.8 });
      const part = (w: number, h: number, d: number, x: number, y: number, z: number, parent: Object3D = chair) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wood); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); };
      part(0.32, 0.03, 0.34, 0, SEAT - 0.015, 0); part(0.32, 0.22, 0.03, 0, SEAT + 0.29, -0.165);
      for (const a of [-1, 1]) { part(0.03, SEAT, 0.03, a * 0.135, SEAT / 2, 0.135); part(0.03, SEAT + 0.36, 0.03, a * 0.135, (SEAT + 0.36) / 2, -0.18); }
      const desk = new THREE.Group();
      part(1.0, 0.035, 0.55, 0, DESK - 0.0175, 0.5, desk);
      for (const a of [-1, 1]) for (const b of [-1, 1]) part(0.04, DESK - 0.035, 0.04, a * 0.45, (DESK - 0.035) / 2, 0.5 + b * 0.23, desk);
      scene.add(chair, desk);

      const specs: Record<Exclude<Who, "Nova">, Spec> = { "The cadet": cast.PLAYER, "The teacher": cast.TEACHER, "The principal": cast.PRINCIPAL, "The Captain": cast.CAPTAIN, Maya: cast.CLASSMATES[cast.NAMED[0]] };
      const built = new Map<string, Character>();
      const nova = cast.makeNova(M);
      nova.group.visible = false;
      scene.add(nova.group);
      let shown = "", clock = 0;
      const stop = stage.onUpdate((dt, t) => {
        const { who: w, move: m } = choice.current, key2 = `${w}|${m}`;
        if (key2 !== shown) {
          // a new choice: put the right figure on, seated if it is a child about to stand
          shown = key2; clock = 0;
          for (const c of built.values()) c.group.visible = false;
          nova.group.visible = w === "Nova";
          const kid = w === "The cadet" || w === "Maya", sit = kid && m === "Standing up";
          chair.visible = desk.visible = sit;
          chair.position.z = 0;
          if (w !== "Nova") {
            let c = built.get(w);
            if (!c) { c = cast.makeCharacter(specs[w], M, rnd); built.set(w, c); scene.add(c.group); }
            c.group.visible = true;
            c.rig.seat = null; c.rig.s = c.rig.stand = 0; c.rig.walk = null; c.rig.raise = false; c.rig.r = c.rig.rv = 0;
            c.group.position.set(0, 0, 0); c.group.rotation.y = 0;
            if (sit) cast.seat(c, 0, SEAT, 0, { chair, desk: DESK, edge: 0.225 });
            cast.setExpression(c, "neutral", true);
          }
          const tall = w === "Nova" ? 1.7 : kid ? 1.75 : 2.3, y = w === "Nova" ? 1.2 : tall * 0.5;
          camera.fov = 30; camera.updateProjectionMatrix();
          const d = (tall / 2) / Math.tan((camera.fov * Math.PI) / 360);
          camera.position.set(d * 0.52, y + 0.15, d * 0.86);
          camera.lookAt(0, y, 0.1);
        }
        clock += dt;
        if (w === "Nova") {
          nova.express(m === "Cheering" ? (clock % 3.4 < 2.2 ? "cheer" : "neutral") : m === "Talking" ? "happy" : "neutral");
          nova.animate(t, dt, 1.2, m === "Talking" ? 0.35 + 0.35 * Math.abs(Math.sin(t * 7.3)) : 0);
          return;
        }
        const c = built.get(w);
        if (!c) return;
        c.rig.talking = m === "Talking"; c.rig.mime = true;
        c.rig.look = null;
        if (m === "Standing up" && c.rig.seat) c.rig.stand = clock % 5.4 < 3.2 ? 1 : 0;
        c.rig.mood = m === "Cheering" ? (clock % 3.4 < 2.2 ? "cheer" : "neutral") : m === "Talking" ? "happy" : "neutral";
        cast.animateCharacter(c, t, dt, rnd, 0);
      });
      window.__mw = { stage }; // so a reviewer (or a test) can pause and step the preview
      cleanup = () => { stop(); stage.dispose(); };
    })();
    return () => { gone = true; cleanup(); };
  }, []);

  // the contact sheet: the film itself, run to each setup on a hidden stage, once for each frame
  useEffect(() => {
    if (!sheetOn) return;
    let gone = false, cleanup = () => {};
    (async () => {
      const [{ createStage }, intro, { audio }] = await Promise.all([import("@/engine/stage"), import("@/worlds/space/intro"), import("@/engine/audio")]);
      await audio.preload(); // the clip lengths pace the film
      setSetups(intro.SETUPS);
      for (const [size, slot] of [[WIDE, "wide"], [TALL, "tall"]] as const) {
        const box = filmBox.current;
        if (gone || !box) return;
        box.style.width = `${size.w}px`; box.style.height = `${size.h}px`;
        const stage = createStage(box, { fill: true });
        stage.paused = true;
        const film = intro.mountIntro(stage);
        film.setCadet("Kit");
        await film.ready;
        cleanup = () => { film.dispose(); stage.dispose(); };
        for (const s of intro.SETUPS) {
          if (gone) return;
          if (s.tallOnly && slot === "wide") continue;
          film.still(s.id);
          const src = stage.renderer.domElement.toDataURL("image/jpeg", 0.86);
          setFrames((f) => ({ ...f, [s.id]: { ...f[s.id], [slot]: src } }));
          await new Promise((r) => setTimeout(r, 0)); // let the page draw the tile before the next one
        }
        cleanup();
        cleanup = () => {};
      }
    })();
    return () => { gone = true; cleanup(); };
  }, [sheetOn]);

  const done = setups.length > 0 && setups.every((s) => frames[s.id]?.tall);
  return (
    <main className="min-h-screen bg-void px-[clamp(20px,4vw,64px)] pb-20 pt-10 text-ink-1">
      <div ref={holder} aria-hidden className="fixed -left-[4000px] top-0" style={{ width: BODY.w, height: BODY.h }} />
      <div ref={filmBox} aria-hidden className="fixed -left-[4000px] top-0" style={{ width: WIDE.w, height: WIDE.h }} />
      <h1 className="type-display m-0 text-[clamp(34px,5vw,64px)] leading-none">The cast</h1>
      <p className="mt-3.5 max-w-[56ch] text-[18px] leading-normal text-ink-2">
        The people of the film, moving and still, and every camera setup the film uses. These are the film&apos;s own models, sets and lights.
      </p>

      <section aria-label="In motion" className="mt-11 border-t border-line-1 pt-7">
        <h2 className="type-name m-0 text-[28px] font-light">In motion</h2>
        <p className="mb-5 mt-1.5 text-[17px] text-ink-2">Breath, blinks and small glances never stop. Pick who, then what they do.</p>
        <div className="flex flex-wrap items-start gap-6">
          <div ref={live} className="relative h-[420px] w-[min(100%,340px)] overflow-hidden rounded-panel border border-line-1" role="img" aria-label={`${who}: ${move.toLowerCase()}`} />
          <div className="flex max-w-[520px] flex-col gap-5">
            <div role="group" aria-label="Character" className="flex flex-wrap gap-2">
              {WHO.map((w) => <Button key={w} size="sm" aria-pressed={who === w} onClick={() => setWho(w)}>{w}</Button>)}
            </div>
            <div role="group" aria-label="Action" className="flex flex-wrap gap-2">
              {MOVES.map((m) => <Button key={m} size="sm" aria-pressed={move === m} onClick={() => setMove(m)}>{m}</Button>)}
            </div>
            <p className="m-0 text-[16px] text-ink-3">Standing up is a child&apos;s move: the cadet and Maya rise from a chair at a desk; everyone else is already on their feet.</p>
          </div>
        </div>
      </section>

      <section aria-label="Contact sheet" className="mt-11 border-t border-line-1 pt-7">
        <h2 className="type-name m-0 text-[28px] font-light">Every setup in the film</h2>
        <p className="mb-5 mt-1.5 max-w-[60ch] text-[17px] text-ink-2">
          The shot list in story order: each setup as the film frames it on a wide screen and on a phone held upright, how long it is on screen, and what it is for. Captions and buttons are not drawn here; every setup leaves the foot of the frame clear for them.
        </p>
        {!done && <p className="text-[17px] text-ink-2" role="status">{sheetOn ? "Drawing the film, one setup at a time…" : "The contact sheet is drawn after the cast."}</p>}
        <ol className="m-0 mt-6 grid list-none grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-x-6 gap-y-9 p-0">
          {setups.map((s, i) => (
            <li key={s.id}>
              <div className="flex items-end gap-2.5">
                <Still src={frames[s.id]?.wide} w={WIDE.w * 0.44} h={WIDE.h * 0.44} alt={`${s.title}, wide screen`} empty={s.tallOnly ? "Phone only" : undefined} />
                <Still src={frames[s.id]?.tall} w={TALL.w * 0.44} h={TALL.h * 0.44} alt={`${s.title}, phone`} />
              </div>
              <p className="mb-0 mt-2.5 text-[17px] text-ink-1"><span className="type-number text-ink-3">{i + 1}</span> {s.title}</p>
              <p className="m-0 text-[16px] leading-snug text-ink-2">{s.purpose}.</p>
              <p className={`${label} m-0 mt-1.5`}>{s.chapter} · about {s.seconds} s</p>
            </li>
          ))}
        </ol>
      </section>

      {sheets.length === 0 && <p className="mt-10 text-[18px] text-ink-2">Drawing the cast…</p>}
      {sheets.map((s) => (
        <section key={s.name} aria-label={s.name} className="mt-11 border-t border-line-1 pt-7">
          <h2 className="type-name m-0 text-[28px] font-light">{s.name}</h2>
          <p className="mb-4 mt-1.5 text-[17px] text-ink-2">{s.note}</p>
          <div className="flex flex-wrap items-end gap-3">
            {s.bodies.map((src, i) => <Tile key={VIEWS[i][0]} src={src} text={VIEWS[i][0]} w={180} h={240} alt={`${s.name}, ${VIEWS[i][0].toLowerCase()} view`} />)}
            {s.faces.map((src, i) => <Tile key={FACES[i][0]} src={src} text={FACES[i][0]} w={140} h={140} alt={`${s.name}, ${FACES[i][0].toLowerCase()}`} />)}
          </div>
        </section>
      ))}
    </main>
  );
}

function Tile({ src, text, w, h, alt }: { src: string; text: string; w: number; h: number; alt: string }) {
  return (
    <figure className="m-0">
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on this page; there is nothing for the image optimiser to do */}
      <img src={src} alt={alt} width={w} height={h} className="block rounded-chip border border-line-1" />
      <figcaption className={`${label} mt-2`}>{text}</figcaption>
    </figure>
  );
}

/** One frame of the contact sheet, or its place while it is being drawn. */
function Still({ src, w, h, alt, empty }: { src?: string; w: number; h: number; alt: string; empty?: string }) {
  const box = { width: Math.round(w), height: Math.round(h) };
  if (!src) return <div style={box} className="grid flex-none place-items-center rounded-chip border border-line-1 text-center text-[13px] text-ink-3">{empty ?? ""}</div>;
  // eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on this page; there is nothing for the image optimiser to do
  return <img src={src} alt={alt} {...box} className="block flex-none rounded-chip border border-line-1" />;
}
