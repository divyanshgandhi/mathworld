import * as THREE from "three";
import { CameraRig, type V3 } from "@/engine/camera";
import { Director, type Step } from "@/engine/director";
import { add, PALETTE } from "@/engine/materials";
import { createOverlay } from "@/engine/overlay";
import { sfx, unlockAudio } from "@/engine/sound";
import type { Stage } from "@/engine/stage";
import { approach, clamp, ease, keyframes, seeded } from "@/engine/util";
import { animateCharacter, CAPTAIN, CLASSMATES, headPosition, makeCharacter, PLAYER, PRINCIPAL, seat, SKIN, STYLES, TEACHER, type Character, type StyleKey } from "./cast";
import { buildClassroom, DOOR_POINT, PLAYER_SEAT, SEATS } from "./classroom";
import { buildEarth, EARTH_RADIUS } from "./earth";
import { buildTown } from "./town";

type Phase = "space" | "town" | "class";
interface Shot extends Step { phase: Phase; firstPerson?: boolean; pick?(v: number): void }

const SPACE_AT = new THREE.Vector3(0, 0, -6000);
const TOWN_AT = new THREE.Vector3(1500, 0, 0);
const CLASS_CENTRE = new THREE.Vector3(0, 1, 1.2);
const HALL: THREE.Vector3[] = [new THREE.Vector3(7.0, 0, -3.2), new THREE.Vector3(6.2, 0, -3.4)];
const ARRIVE = { principal: new THREE.Vector3(4.6, 0, -2.8), captain: new THREE.Vector3(4.8, 0, -4.15) };
const VIEWS: Record<string, [V3, V3]> = {
  back: [[-1.5, 2.3, 3.9], [0.8, 1.1, -4]],
  door: [[1.5, 1.8, -2.1], [5.6, 1.25, -3.6]],
  captain: [[2.4, 1.75, -4.65], [4.8, 1.55, -4.0]],
  onPlayer: [[1.1, 1.55, -0.5], [0, 1.15, 1.1]],
};
const MOODS = {
  tuesday: { sat: 0.58, tint: [1.03, 1.0, 0.95], exposure: 0.95, hall: 0.2, spill: 0, fill: 0, buzz: true },
  knock: { sat: 0.82, tint: [1.04, 1.0, 0.95], exposure: 1.0, hall: 0.85, spill: 16, fill: 5, buzz: false },
} as const;
const NAMES: [string, number][] = [["Maya", 0], ["Leo", 2], ["Aarav", 5], ["Zoe", 6]];
export const CHAPTERS = { earth: "earth", classroom: "wake", knock: "knock" } as const;

/**
 * The opening film: Earth, the school on an ordinary Tuesday, waking up in class, two quick
 * questions, the knock, and being picked as a cadet. Returns controls for the page.
 */
export function mountIntro(stage: Stage, { style = "story" as StyleKey, onEnd }: { style?: StyleKey; onEnd?: () => void } = {}) {
  const { scene, camera, mats: M } = stage;
  const rnd = seeded(11);
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const cam = new CameraRig();
  const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x6b5a4a, 0.8);
  scene.add(hemi);

  const earth = buildEarth(scene, M, rnd, SPACE_AT);
  const town = buildTown(scene, M, rnd, TOWN_AT);
  const room = buildClassroom(scene, M, rnd);

  // the player's own hand, for the first-person yawn
  const hand = new THREE.Group();
  camera.add(hand);
  hand.visible = false;
  hand.scale.setScalar(0.7);
  const skin = M.clay(SKIN[PLAYER.skin], { roughness: 0.55 });
  add(hand, new THREE.SphereGeometry(0.055, 18, 14), skin, 0, 0, 0, { cast: false }).scale.set(1, 1.15, 0.85);
  for (let k = 0; k < 4; k++) add(hand, new THREE.CapsuleGeometry(0.014, 0.035, 4, 8), skin, -0.03 + k * 0.02, 0.06, 0.012, { cast: false });
  const sleeve = add(hand, new THREE.CapsuleGeometry(0.05, 0.28, 6, 12), M.clay(PALETTE.invader), 0.03, -0.2, 0.08, { cast: false });
  sleeve.rotation.set(0.5, 0, -0.2);

  // the cast, rebuilt whenever the character style changes
  let styleKey = style;
  let kids: Character[] = [], player!: Character, teacher!: Character, principal!: Character, captain!: Character;
  const people = () => [...kids, player, teacher, principal, captain];
  function cast(k: StyleKey) {
    styleKey = k;
    if (player) people().forEach((c) => scene.remove(c.group));
    const st = STYLES[k];
    kids = [];
    let j = 0;
    SEATS.forEach(([x, z], i) => {
      const c = makeCharacter(i === PLAYER_SEAT ? PLAYER : CLASSMATES[j++], st, M, rnd);
      seat(c, x, 0.47 - st.kid.L, z + 0.5);
      c.group.rotation.y = Math.PI;
      scene.add(c.group);
      if (i === PLAYER_SEAT) player = c; else kids.push(c);
    });
    teacher = makeCharacter(TEACHER, st, M, rnd);
    teacher.group.position.set(-1.7, 0, -4.0);
    principal = makeCharacter(PRINCIPAL, st, M, rnd);
    captain = makeCharacter(CAPTAIN, st, M, rnd);
    for (const c of [teacher, principal, captain]) scene.add(c.group);
  }
  cast(style);

  const lookAt = (k: "door" | "player" | "captain" | "teacher") => {
    const t = k === "door" ? DOOR_POINT : k === "player" ? headPosition(player) : k === "captain" ? headPosition(captain) : headPosition(teacher);
    kids.forEach((c) => (c.rig.look = t));
    player.rig.look = k === "player" ? headPosition(teacher) : t;
    teacher.rig.look = k === "teacher" ? CLASS_CENTRE : t;
    principal.rig.look = captain.rig.look = CLASS_CENTRE;
  };
  const talk = (c: Character | null) => people().forEach((p) => (p.rig.talking = p === c));
  const eye = () => headPosition(player).add(new THREE.Vector3(0, player.rig.H, -player.rig.H * 0.85));
  const view = (v: keyof typeof VIEWS, speed: number) => cam.shot(...VIEWS[v], speed);

  // phases: space, town and classroom live far apart in one scene; a phase switches sky, fog and lights
  let titled = false, phase: Phase | null = null, mood: keyof typeof MOODS = "tuesday", firstPerson = false, doorTarget = 0, fade = 0, lids = 1, blur = 0;
  function setPhase(p: Phase) {
    phase = p;
    const space = p === "space", tw = p === "town", cls = p === "class";
    scene.background = new THREE.Color(space ? 0x000000 : tw ? 0xa9d3f5 : 0x2a2440);
    scene.fog = tw ? new THREE.Fog(0xa9d3f5, 140, 520) : null;
    camera.far = space ? 3000 : tw ? 700 : 60;
    camera.near = space ? 0.5 : 0.05;
    camera.updateProjectionMatrix();
    hemi.color.set(space ? 0x223355 : tw ? 0xcfe6ff : 0xdfe6f0);
    hemi.groundColor.set(space ? 0x000000 : tw ? 0x6a8a5a : 0x6b5a4a);
    hemi.intensity = space ? 0.25 : tw ? 1.0 : 0.8;
    earth.sun.intensity = space ? 3 : 0;
    town.sun.intensity = tw ? 2.7 : 0;
    const m = cls ? MOODS[mood] : { sat: 1, tint: [1, 1, 1], exposure: 1 };
    stage.grade.sat.value = m.sat;
    stage.grade.tint.value.set(m.tint[0], m.tint[1], m.tint[2]);
    stage.renderer.toneMappingExposure = m.exposure;
  }

  function choice(right: number, options: number[], word: string, kid: number): Shot {
    let result: "right" | "wrong" | "none" | null = null, at = 0, replied = false;
    const resolve = (r: "right" | "wrong" | "none", v: number, t: number) => {
      result = r; at = t;
      overlay.hideChoices();
      overlay.timer(null);
      const who = r === "none" ? kids[kid] : player;
      who.rig.raise = true;
      talk(who);
      sfx.blip(r === "right");
      overlay.caption(r === "none" ? "Classmate" : "You", `${r === "none" ? right : v}!`);
    };
    return {
      phase: "class",
      enter() {
        result = null; replied = false;
        overlay.caption("Teacher", "Who's going to tell me?");
        talk(teacher);
        overlay.choices(options, (v) => this.pick?.(v));
      },
      pick(v) { if (!result) resolve(v === right ? "right" : "wrong", v, director.t); },
      update(t) {
        if (!result) {
          overlay.timer(clamp(1 - t / 5));
          if (t > 1.6) talk(null);
          if (t >= 5) resolve("none", right, t);
        } else if (!replied && t - at > 1.7) {
          replied = true;
          people().forEach((p) => (p.rig.raise = false));
          talk(teacher);
          overlay.caption("Teacher", result === "wrong" ? `Ooh, close. It's ${right}.` : `${word}. Lovely!`);
        }
      },
      done: (t) => result !== null && t - at > 4,
    };
  }

  const lidCurve = keyframes([[0, 0], [0.5, 0], [1.1, 0.32], [1.5, 0.08], [2.1, 0.55], [2.4, 0.25], [3.0, 1]]);
  const S = SPACE_AT, T = TOWN_AT;
  const steps: Shot[] = [
    { name: "earth", phase: "space", d: 3.4,
      enter() { cam.shot([S.x, S.y + 8, S.z + 150], [S.x, S.y, S.z], 0); overlay.title("EARTH", "an ordinary planet"); fade = 0; },
      update(t) { cam.p.set(S.x + t * 3, S.y + 8 - t * 0.6, S.z + 150 - t * 4); } },
    { name: "dive", phase: "space", d: 3.2,
      enter() { overlay.titleOut(); sfx.whoosh(); overlay.fade(0, "#fff"); },
      update(t) {
        const k = t / 3.2, e = Math.pow(k, 2.4), d = 136 - e * (136 - EARTH_RADIUS - 2);
        cam.p.set(S.x + 10 * (1 - e), S.y + 8 * (1 - e) + 4 * e, S.z + d);
        cam.l.set(S.x, S.y + 2 * e, S.z);
        fade = clamp((k - 0.72) / 0.25);
      } },
    { name: "town", phase: "town", d: 4.6,
      update(t) {
        fade = clamp(1 - t / 0.9);
        const k = ease(clamp(t / 4.6));
        cam.p.set(T.x + 40 - 34 * k, 70 - 63.5 * k, 90 - 66 * k);
        cam.l.set(T.x, 4 * k, 0);
      } },
    { name: "tuesday", phase: "town", d: 3.2,
      enter() { overlay.title("An ordinary Tuesday…", "", false); sfx.chime(); },
      update(t) { cam.p.set(T.x + 6 - t * 0.25, 6.5 - t * 0.1, 24 - t * 0.5); cam.l.set(T.x, 4.2, 0); } },
    { name: "to-class", phase: "town", d: 1.0,
      enter() { overlay.titleOut(); overlay.fade(0, "#000"); },
      update(t) { fade = clamp(t / 0.9); } },
    { name: "wake", phase: "class", firstPerson: true, d: 3.0,
      enter() { fade = 0; lids = 0; blur = 7; room.write("4 + 4 = ?"); lookAt("teacher"); const e = eye(); cam.shot([e.x, e.y, e.z], [e.x, 0.55, e.z - 0.9], 0); },
      update(t) {
        lids = lidCurve(t);
        blur = 7 * (1 - clamp((t - 0.6) / 2.4));
        const e = eye();
        cam.p.copy(e);
        cam.l.set(e.x + Math.sin(t * 0.8) * 0.1, 0.55 + t * 0.12, e.z - 0.9);
      } },
    { name: "yawn", phase: "class", firstPerson: true, d: 2.7,
      enter() { lids = 1; blur = 0; sfx.yawn(); hand.visible = true; },
      update(t) {
        const up = t < 0.7 ? ease(t / 0.7) : t < 1.9 ? 1 : 1 - ease(clamp((t - 1.9) / 0.7));
        hand.position.set(0.12 - 0.1 * up, -0.48 + 0.37 * up, -0.36 + 0.06 * up);
        hand.rotation.set(0.3 * up, 0, -0.4 + 0.3 * up);
        const e = eye();
        cam.p.copy(e);
        cam.l.set(e.x, 0.95 + 0.5 * up, e.z - 0.9);
        if (t > 2.6) hand.visible = false;
      } },
    { name: "teacher", phase: "class", firstPerson: true, d: 4.4,
      enter() {
        hand.visible = false;
        overlay.caption("Teacher", "Class, you have learned addition and subtraction. As we all know, 4 + 4 is…");
        talk(teacher);
        const e = eye();
        cam.shot([e.x, e.y, e.z], [-1.7, 1.55, -4], 1.8);
      },
      update(t) { if (t > 1.6 && firstPerson) { firstPerson = false; view("back", 1.1); } } },
    { name: "q1", ...choice(8, [8, 9], "Eight", 1) },
    { name: "q2-ask", phase: "class", d: 2.6, enter() { room.write("5 − 3 = ?"); overlay.caption("Teacher", "And what's 5 − 3?"); talk(teacher); } },
    { name: "q2", ...choice(2, [3, 2], "Two", 3) },
    { name: "multiplication", phase: "class", d: 3.4, enter() { room.write("×"); overlay.caption("Teacher", "Okay class, today we're starting multiplication…"); talk(teacher); } },
    { name: "knock", phase: "class", d: 1.9, enter() { overlay.caption("", "knock knock"); sfx.knock(); lookAt("door"); view("door", 0); } },
    { name: "enter", phase: "class", d: 2.8,
      enter() {
        overlay.caption("", "");
        mood = "knock";
        doorTarget = 1.35; // opens outward, into the hallway
        for (const [c, to, delay] of [[principal, ARRIVE.principal, 0], [captain, ARRIVE.captain, 0.5]] as const) {
          c.group.visible = true;
          c.group.position.copy(HALL[0]);
          c.rig.walk = { pts: [HALL[0], HALL[1], to], t0: stage.time + delay, d: 2.0 };
        }
      } },
    { name: "principal", phase: "class", d: 2.3, enter() { overlay.caption("Principal", "Sorry to interrupt."); talk(principal); } },
    { name: "captain", phase: "class", d: 4.4,
      enter() { overlay.caption("Captain", "There is grave danger in space. We are enrolling five of your brightest students as cadets."); talk(captain); view("captain", 1.6); lookAt("captain"); } },
    { name: "names", phase: "class", d: 4.2,
      enter() { talk(teacher); view("back", 1.4); lookAt("teacher"); },
      update(t) {
        const called = NAMES.filter((_, i) => t > 0.3 + i * 0.9);
        overlay.caption("Teacher", called.map(([n]) => n).join("… ") + "…");
        called.forEach(([, i]) => (kids[i].rig.stand = 1));
      } },
    { name: "you", phase: "class", d: 3.4,
      enter() { overlay.caption("Teacher", "…and you!"); talk(teacher); lookAt("player"); view("onPlayer", 1.3); },
      update(t) { if (t > 0.5) player.rig.stand = 1; } },
    { name: "selected", phase: "class", d: 3.5,
      enter() { overlay.caption("", ""); overlay.fade(0, "#0d0e1a"); titled = false; },
      update(t) { fade = clamp(t / 1.2); if (t > 1.2 && !titled) { titled = true; overlay.title("CADET SELECTED", "next: the Starfleet hangar"); } } },
  ];

  const director = new Director<Shot>(steps, {
    beforeEnter(s) {
      talk(null);
      if (s.phase !== phase) setPhase(s.phase);
      firstPerson = !!s.firstPerson;
    },
    onEnd() {
      overlay.button("↻ Replay", () => play());
      onEnd?.();
    },
  });

  function reset() {
    people().forEach((c) => { c.rig.raise = false; c.rig.talking = false; c.rig.walk = null; if (c.rig.seat) { c.rig.stand = 0; c.rig.s = 0; } });
    for (const c of [principal, captain]) { c.group.visible = false; c.group.position.copy(HALL[0]); }
    mood = "tuesday"; doorTarget = 0; room.door.rotation.y = 0;
    overlay.titleOut(); overlay.caption("", ""); overlay.hideChoices(); overlay.timer(null); overlay.button(null);
    hand.visible = false; lids = 1; blur = 0; fade = 0; firstPerson = false;
    room.write("4 + 4 = ?");
  }

  function jump(name: string) {
    reset();
    const i = Math.max(0, director.find(name));
    if (i >= director.find("knock")) { setPhase("class"); room.write("×"); view("back", 0); lookAt("teacher"); }
    director.go(i);
  }

  function play() {
    unlockAudio();
    jump("earth");
  }

  stage.onUpdate((dt, time) => {
    director.update(dt);
    if (phase === "space") earth.update(dt);
    if (phase === "town") town.update(time);
    if (phase === "class") {
      const m = MOODS[mood], tint = stage.grade.tint.value;
      stage.grade.sat.value = approach(stage.grade.sat.value, m.sat, 1.5, dt);
      tint.set(approach(tint.x, m.tint[0], 1.5, dt), approach(tint.y, m.tint[1], 1.5, dt), approach(tint.z, m.tint[2], 1.5, dt));
      stage.renderer.toneMappingExposure = approach(stage.renderer.toneMappingExposure, m.exposure, 1.5, dt);
      room.door.rotation.y = approach(room.door.rotation.y, doorTarget, 2.5, dt);
      room.update(time, dt, { hall: m.hall, spill: m.spill, fill: m.fill, buzz: m.buzz, on: true });
      people().forEach((c) => animateCharacter(c, time, dt, rnd, CLASS_CENTRE));
      player.rig.head.visible = !(firstPerson && cam.p.distanceTo(eye()) < 0.6);
    } else {
      room.update(time, dt, { hall: 0, spill: 0, fill: 0, buzz: false, on: false });
    }
    cam.sway = phase === "class" && !firstPerson ? 1 : 0;
    cam.apply(camera, dt, time);
    overlay.fade(fade);
    overlay.lids(lids);
    overlay.blur(blur);
  });

  // start on the Earth, waiting for a click (browsers need a gesture before sound)
  reset();
  setPhase("space");
  cam.shot([S.x, S.y + 8, S.z + 150], [S.x, S.y, S.z], 0);
  overlay.button("▶ Play the intro", () => play());

  return {
    director,
    play,
    jump,
    /** Answer the current question, as if the matching button were tapped. */
    pick: (v: number) => director.current?.pick?.(v),
    get style() { return styleKey; },
    setStyle(k: StyleKey) {
      const at = director.index;
      cast(k);
      jump(at >= director.find("knock") ? "knock" : at >= director.find("wake") ? "wake" : "earth");
    },
    dispose() {
      overlay.dispose();
    },
  };
}

