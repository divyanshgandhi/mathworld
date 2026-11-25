"use client";
import { useEffect, useRef, useState } from "react";
import { COLOR, INK, LINE, RADIUS, TYPE } from "@/design/tokens";
import type { Expression, Spec } from "@/worlds/space/cast";

const VIEWS = [["Front", 0], ["Three-quarter", 0.62], ["Side", Math.PI / 2]] as const;
const FACES: [string, Expression][] = [["Neutral", "neutral"], ["Happy", "happy"], ["Thinking", "thinking"], ["Oops", "oops"], ["Cheer", "cheer"]];
const BODY = { w: 300, h: 400 }, FACE = 220;

interface Sheet { name: string; note: string; bodies: string[]; faces: string[] }

const label = { fontWeight: TYPE.label.weight, fontStretch: `${TYPE.label.stretch}%`, letterSpacing: "0.12em", textTransform: "uppercase", fontSize: TYPE.min.label, color: INK[2] } as const;

/**
 * Every character is built by the same code the film uses, lit by the interior look, and drawn
 * into still tiles: full figure from the front, three-quarter and side, then five faces up close.
 * One hidden stage renders them all, so the page costs one WebGL context.
 */
export function CastReview() {
  const holder = useRef<HTMLDivElement>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);

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
        ["The cadet", "You. Gold is yours and the Star Fleet's.", cast.PLAYER],
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
    })();
    return () => { gone = true; cleanup(); };
  }, []);

  return (
    <main style={{ background: COLOR.void, color: INK[1], fontFamily: `"${TYPE.family}", sans-serif`, minHeight: "100vh", padding: "40px clamp(20px, 4vw, 64px) 80px" }}>
      <div ref={holder} aria-hidden style={{ position: "fixed", left: -4000, top: 0, width: BODY.w, height: BODY.h }} />
      <h1 style={{ margin: 0, fontWeight: TYPE.display.weight, fontStretch: `${TYPE.display.stretch}%`, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: "clamp(34px, 5vw, 64px)", lineHeight: 1 }}>The cast</h1>
      <p style={{ margin: "14px 0 0", fontSize: 18, lineHeight: 1.5, color: INK[2], maxWidth: "56ch" }}>
        Each character from the front, three-quarter and side, then five faces: neutral, happy, thinking, oops and cheer. These are the models the film uses.
      </p>
      {sheets.length === 0 && <p style={{ marginTop: 40, fontSize: 18, color: INK[2] }}>Drawing the cast…</p>}
      {sheets.map((s) => (
        <section key={s.name} aria-label={s.name} style={{ marginTop: 44, paddingTop: 28, borderTop: `1px solid ${LINE[1]}` }}>
          <h2 style={{ margin: 0, fontWeight: 300, fontStretch: "120%", fontSize: 28, letterSpacing: "0.04em" }}>{s.name}</h2>
          <p style={{ margin: "6px 0 18px", fontSize: 17, color: INK[2] }}>{s.note}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
            {s.bodies.map((src, i) => <Tile key={VIEWS[i][0]} src={src} text={VIEWS[i][0]} w={210} h={280} alt={`${s.name}, ${VIEWS[i][0].toLowerCase()} view`} />)}
            {s.faces.map((src, i) => <Tile key={FACES[i][0]} src={src} text={FACES[i][0]} w={168} h={168} alt={`${s.name}, ${FACES[i][0].toLowerCase()}`} />)}
          </div>
        </section>
      ))}
    </main>
  );
}

function Tile({ src, text, w, h, alt }: { src: string; text: string; w: number; h: number; alt: string }) {
  return (
    <figure style={{ margin: 0 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL drawn on this page; there is nothing for the image optimiser to do */}
      <img src={src} alt={alt} width={w} height={h} style={{ display: "block", borderRadius: RADIUS.chip, border: `1px solid ${LINE[1]}` }} />
      <figcaption style={{ ...label, marginTop: 8 }}>{text}</figcaption>
    </figure>
  );
}
