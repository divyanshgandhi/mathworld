import * as THREE from "three";
import { audio } from "@/engine/audio";
import { CameraRig, type V3 } from "@/engine/camera";
import { Director, type Step } from "@/engine/director";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { approach, clamp, ease, keyframes, seeded } from "@/engine/util";
import { prepare, warmVoice } from "@/engine/voice";
import { animateCharacter, CAPTAIN, CLASSMATES, eyePosition, face, headPosition, makeCharacter, PLAYER, PRINCIPAL, seat, SKIN, TEACHER, type Character } from "./cast";
import { buildClassroom, DOOR_POINT, PLAYER_SEAT, SEATS } from "./classroom";
import { buildEarth, EARTH_RADIUS } from "./earth";
import { makeHand } from "./hand";
import { buildHangar } from "./hangar";
import { buildTown } from "./town";

/**
 * The opening film. Storyline and voice lines follow the Gemini showcase: Earth, the dive, an
 * ordinary Tuesday, waking up in class, two quick questions, the knock, the captain, the names,
 * the cadet picked by name, the hangar briefing, Nova, and ignition. Every line is a baked Gradium
 * Phonon clip except the cadet's name, which Phonon speaks live in the teacher's voice.
 */
type Env = "space" | "town" | "class" | "hangar";
interface Shot extends Step { env: Env; chapter: Chapter; firstPerson?: boolean; pick?(v: number): void; raise?(): void }
export type Chapter = "orbit" | "dive" | "wake" | "knock" | "hangar";
export interface FilmUi { prompt: { eq: string; options: number[]; stage: "raise" | "choose" } | null; cta: string | null; started: boolean; ended: boolean; chapter: Chapter | null }

export const SPACE_AT = new THREE.Vector3(0, 0, -6000);
const TOWN_AT = new THREE.Vector3(1500, 0, 0), HANGAR_AT = new THREE.Vector3(-1500, 0, 0);
const CLASS_CENTRE = new THREE.Vector3(0, 1, 1.2);
const HALL = [new THREE.Vector3(7.0, 0, -3.2), new THREE.Vector3(6.2, 0, -3.4)];
const ARRIVE = { principal: new THREE.Vector3(4.5, 0, -2.4), captain: new THREE.Vector3(3.5, 0, -3.8) };
const MOODS = {
  tuesday: { sat: 0.62, tint: [1.03, 1.0, 0.95], exposure: 0.95, hall: 0.2, spill: 0, fill: 0, buzz: true },
  knock: { sat: 0.86, tint: [1.04, 1.0, 0.95], exposure: 1.0, hall: 0.85, spill: 16, fill: 5, buzz: false },
} as const;

export function mountIntro(stage: Stage, { onUi, onEnd }: { onUi?: (ui: FilmUi) => void; onEnd?: () => void } = {}) {
  const { scene, camera, mats: M } = stage;
  const rnd = seeded(11);
  void audio.preload();
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const cam = new CameraRig();
  const hemi = new THREE.HemisphereLight(0xdfe6f0, 0x6b5a4a, 0.8);
  scene.add(hemi);

  const earth = buildEarth(scene, M, rnd, SPACE_AT);
  const town = buildTown(scene, M, rnd, TOWN_AT);
  const room = buildClassroom(scene, M, rnd);
  const hangar = buildHangar(scene, M, rnd, HANGAR_AT);

  // first-person hand for the yawn, with a soft light so it never reads as a dark blob
  const hand = makeHand(M, SKIN[PLAYER.skin], PLAYER.top);
  camera.add(hand.group);
  hand.group.visible = false;
  const handLight = new THREE.PointLight(0xffe2c4, 0, 1.2, 2);
  handLight.position.set(-0.15, 0.1, -0.05);
  camera.add(handLight);

  /** The yawn pose, 0 = down out of frame, 1 = palm turned in over the mouth. */
  const HAND_POSE = (up: number) => {
    hand.group.position.set(0.11 - 0.07 * up, -0.33 + 0.26 * up, -0.21);
    hand.group.rotation.set(-0.5 + 0.3 * up, -0.95 + 0.25 * up, 0.55 - 0.15 * up);
    hand.curl(0.35 * up);
  };
  let novaLen = 4;

  // the cast
  const kids: Character[] = [];
  let player!: Character;
  let j = 0;
  SEATS.forEach(([x, z], i) => {
    const c = makeCharacter(i === PLAYER_SEAT ? PLAYER : CLASSMATES[j++], M, rnd);
    seat(c, x, 0.47, z + 0.5);
    c.group.rotation.y = Math.PI;
    scene.add(c.group);
    if (i === PLAYER_SEAT) player = c; else kids.push(c);
  });
  const teacher = makeCharacter(TEACHER, M, rnd), principal = makeCharacter(PRINCIPAL, M, rnd), captain = makeCharacter(CAPTAIN, M, rnd), captainH = makeCharacter(CAPTAIN, M, rnd);
  teacher.group.position.set(-1.7, 0, -4.05);
  teacher.group.rotation.y = 0.2;
  for (const c of [teacher, principal, captain]) scene.add(c.group);
  captainH.group.position.set(-3.9, 0, 1.8);
  captainH.group.rotation.y = 0.42;
  hangar.group.add(captainH.group);
  const people = () => [...kids, player, teacher, principal, captain];

  let speaker: Character | "nova" | null = null;
  const talk = (c: Character | "nova" | null) => { speaker = c; for (const p of [...people(), captainH]) p.rig.talking = p === c; };
  /** Everyone looks at `t`; the teacher looks at `teacherAt` (the class, when she is the one talking). */
  const lookAt = (t: THREE.Vector3, teacherAt: THREE.Vector3 = t) => {
    for (const p of people()) {
      // whoever is being looked at addresses the room: grown-ups face the class, kids the teacher
      const self = headPosition(p).distanceTo(t) < 0.4;
      p.rig.look = !self ? t : p.spec.role && p.spec.role !== "kid" ? CLASS_CENTRE : headPosition(teacher);
    }
    teacher.rig.look = teacherAt;
  };
  const glide = (p: V3, l: V3, speed = 2.2) => cam.shot(p, l, speed);
  const cut = (p: V3, l: V3) => cam.shot(p, l, 0);
  const at = (o: THREE.Vector3, x: number, y: number, z: number): V3 => [o.x + x, o.y + y, o.z + z];

  // ui published to React (the choices, the ignition button)
  let ui: FilmUi = { prompt: null, cta: null, started: false, ended: false, chapter: null };
  const setUi = (p: Partial<FilmUi>) => { ui = { ...ui, ...p }; onUi?.(ui); };

  // the cadet's name: spoken live by Phonon in the teacher's voice, prepared while the film plays
  let cadet = "", nameLine: AudioBuffer | null = null;

  // environments: four sets far apart in one scene; switching changes sky, fog, light and grade
  let env: Env | null = null, mood: keyof typeof MOODS = "tuesday", firstPerson = false, doorTarget = 0, shake = 0;
  let fade = 0, fadeColor = "#000", lids = 1, blur = 0;
  function setEnv(e: Env) {
    env = e;
    const space = e === "space", tw = e === "town", cls = e === "class", hg = e === "hangar";
    scene.background = tw ? null : new THREE.Color(space ? 0x030612 : cls ? 0x1f1b24 : 0x050918);
    scene.fog = tw ? new THREE.FogExp2(0xf5cfa0, 0.0026) : hg ? new THREE.FogExp2(0x081126, 0.008) : null;
    camera.far = space ? 3000 : tw ? 700 : 120;
    camera.near = space ? 0.5 : 0.02;
    camera.updateProjectionMatrix();
    hemi.color.set(space ? 0x3a5a8c : tw ? 0xfff0d4 : hg ? 0x7dd3fc : 0xfff1dc);
    hemi.groundColor.set(space ? 0x070a18 : tw ? 0x3f6e3b : hg ? 0x1e293b : 0x6e543f);
    hemi.intensity = space ? 0.5 : tw ? 0.85 : hg ? 0.6 : 0.62;
    earth.sun.intensity = space ? 3 : 0;
    town.sun.intensity = tw ? 3.0 : 0;
    hangar.lights(hg);
    Object.assign(stage.bloom, space ? { strength: 0.65, threshold: 1.0 } : hg ? { strength: 0.5, threshold: 1.1 } : { strength: 0.3, threshold: 1.25 });
    const m = cls ? MOODS[mood] : { sat: 1, tint: [1, 1, 1], exposure: tw ? 0.98 : 1.02 };
    stage.grade.sat.value = m.sat;
    stage.grade.tint.value.set(m.tint[0], m.tint[1], m.tint[2]);
    stage.renderer.toneMappingExposure = m.exposure;
  }

  const S = SPACE_AT, T = TOWN_AT, H = HANGAR_AT;
  const eye = () => eyePosition(player);
  const lidCurve = keyframes([[0, 0], [0.55, 0], [1.1, 0.4], [1.45, 0.1], [2.05, 0.65], [2.35, 0.3], [2.9, 1]]);

  /** A breath between two lines of dialogue, measured from where the words stop. */
  const GAP = 0.55;
  type Who = Character | "nova" | null;
  /** Speak one baked line (or a live buffer); returns how long until the words stop. */
  const speak = (id: string, who: string, c: Who, live?: AudioBuffer | null, text?: string) => {
    talk(c);
    overlay.caption(who, text ?? audio.text(id));
    if (live) { void audio.play(live); return audio.spokenLength(live); }
    void audio.say(id);
    return audio.spoken(id);
  };

  interface Beat { id: string; who: string; c: () => Who; gap?: number; go?: () => void; live?: () => AudioBuffer | null; text?: () => string; after?: (t: number, start: number, len: number) => void }
  /**
   * Lines spoken one after another: each waits for the last one's words to stop plus a breath
   * (`gap`, default GAP), mouths close in the pauses, and the step ends `tail` seconds after the
   * last line. Nothing is ever cut off by the next shot.
   */
  function dialogue(beats: Beat[], { lead = 0.25, tail = 0.7 } = {}) {
    let i = -1, next = 0, start = 0, len = 0, endAt = Infinity;
    return {
      begin() { i = -1; next = lead; endAt = Infinity; len = 0; },
      update(t: number) {
        if (i >= 0 && t >= start + len && speaker !== null) talk(null);
        if (i >= 0) beats[i].after?.(t, start, len);
        if (i < beats.length - 1 && t >= next) {
          const b = beats[++i];
          b.go?.();
          start = t;
          len = speak(b.id, b.who, b.c(), b.live?.(), b.text?.());
          next = t + len + (beats[i + 1]?.gap ?? GAP);
          if (i === beats.length - 1) endAt = t + len + tail;
        }
      },
      done: (t: number) => t >= endAt,
    };
  }

  /**
   * A classroom question: the teacher asks and finishes; then a few seconds to raise your hand
   * (Space or the button). Raise it and she calls on you, then the two answers appear. Wait too
   * long and a classmate's hand goes up and they answer. The teacher replies after a breath.
   */
  function question(o: { name: string; eq: string; answer: number; options: number[]; ask: string; kid: number; kidClip: string; ok: string; close: string }): Shot {
    type Phase = "ask" | "raise" | "called" | "choose" | "answer" | "reply" | "done";
    let phase: Phase = "ask", at0 = 0, len = 0, result: "right" | "close" | "classmate" = "right", keen = false;
    const to = (p: Phase) => { phase = p; at0 = director.t; };
    const prompt = (stage: "raise" | "choose") => setUi({ prompt: { eq: o.eq, options: o.options, stage } });
    const shot: Shot = {
      name: o.name, env: "class", chapter: "wake",
      enter() {
        phase = "ask"; at0 = 0; keen = false;
        room.write(o.eq);
        lookAt(headPosition(teacher), CLASS_CENTRE);
        len = speak(o.ask, "Teacher", teacher);
        glide([-0.7, 1.65, -1.0], [-1.55, 1.4, -4.0], 2.2); // a medium on the teacher while she asks
      },
      update(t) {
        const since = t - at0;
        if (since >= len && speaker !== null && phase !== "raise" && phase !== "choose") talk(null);
        if (phase === "ask" && since >= len + 0.35) {
          to("raise");
          talk(null);
          prompt("raise");
          glide([-1.4, 2.25, 4.0], [-0.3, 1.4, -3.6], 1.6);
        } else if (phase === "raise") {
          const left = 1 - since / 5;
          overlay.timer(clamp(left));
          if (since > 2.4 && !keen) { keen = true; kids[o.kid].rig.raise = true; } // someone else is keen too
          if (left <= 0) classmate();
        } else if (phase === "called" && since >= len + 0.3) {
          to("choose");
          prompt("choose");
        } else if (phase === "answer" && since >= len + GAP) {
          to("reply");
          for (const p of people()) p.rig.raise = false;
          room.write(o.eq.replace("?", String(o.answer)));
          lookAt(headPosition(teacher), CLASS_CENTRE);
          len = speak(result === "close" ? o.close : o.ok, "Teacher", teacher);
        } else if (phase === "reply" && since >= len + 0.8) to("done");
      },
      done: () => phase === "done",
    };
    function classmate() {
      to("answer");
      overlay.timer(null);
      setUi({ prompt: null });
      result = "classmate";
      const who = kids[o.kid];
      who.rig.raise = true;
      lookAt(headPosition(who));
      len = speak(o.kidClip, "Classmate", who, null, `${o.answer}!`);
    }
    shot.raise = () => {
      if (phase !== "raise" || director.current !== shot) return;
      to("called");
      overlay.timer(null);
      setUi({ prompt: null });
      kids[o.kid].rig.raise = false;
      player.rig.raise = true;
      lookAt(headPosition(player));
      len = speak("teacher_yes", "Teacher", teacher);
    };
    shot.pick = (v: number) => {
      if (phase === "raise") shot.raise?.(); // answering straight away still raises the hand first
      if (phase !== "choose" && phase !== "called") return;
      to("answer");
      setUi({ prompt: null });
      result = v === o.answer ? "right" : "close";
      audio.sfx(result === "right" ? "blip_ok" : "blip_close");
      talk(player);
      overlay.caption("You", result === "right" ? `${v}!` : `${v}?`);
      len = 0.9;
    };
    return shot;
  }

  const q1 = question({ name: "q1", eq: "4 + 4 = ?", answer: 8, options: [8, 9], ask: "teacher_intro", kid: 1, kidClip: "kid_eight", ok: "teacher_eight_ok", close: "teacher_eight_close" });
  const q2 = question({ name: "q2", eq: "5 − 3 = ?", answer: 2, options: [3, 2], ask: "teacher_q2", kid: 3, kidClip: "kid_two", ok: "teacher_two_ok", close: "teacher_two_close" });

  /** A step that is nothing but dialogue (plus its own camera and staging in `enter`). */
  const talkShot = (s: Omit<Shot, "update" | "done"> & { beats: Beat[]; lead?: number; tail?: number; extra?: (t: number) => void }): Shot => {
    const dl = dialogue(s.beats, { lead: s.lead, tail: s.tail });
    return { ...s, enter() { dl.begin(); s.enter?.(); }, update(t) { dl.update(t); s.extra?.(t); }, done: dl.done };
  };
  const T_ = () => teacher, CAP = () => captain, CAPH = () => captainH, PR = () => principal;

  const steps: Shot[] = [
    { name: "orbit", env: "space", chapter: "orbit", d: 3.6,
      enter() { audio.mood("space"); fade = 0; lids = 1; overlay.caption("", ""); overlay.card("SECTOR 001 · MILKY WAY", "EARTH", "An ordinary blue planet…"); cut(at(S, -14, 9, 150), at(S, 0, 0, 0)); glide(at(S, 10, 6, 128), at(S, 0, 0, 0), 0.7); } },
    { name: "dive", env: "space", chapter: "dive", d: 2.5,
      enter() { overlay.card("", ""); audio.sfx("dive"); cam.hold(); },
      update(t) {
        const k = Math.min(1, t / 2.5), e = Math.pow(k, 2.3), d = 128 - e * (128 - EARTH_RADIUS - 2);
        cam.p.set(S.x + 10 * (1 - e), S.y + 6 * (1 - e) + 3 * e, S.z + d);
        cam.l.set(S.x, S.y + 2 * e, S.z);
        fadeColor = "#fff8ec"; fade = Math.max(0, (k - 0.65) / 0.35);
      } },
    { name: "town", env: "town", chapter: "dive", d: 4.6,
      // wide over the rooftops, then square on to the porch so the school's name reads in full
      enter() { audio.sfx("chime"); overlay.card("8:42 AM", "An Ordinary Tuesday…", "", "top"); cut(at(T, 30, 24, 52), at(T, 0, 4, 0)); glide(at(T, 0, 3.1, 13.5), at(T, 0, 3.5, 5.9), 1.15); },
      update(t) {
        if (t > 2.5) overlay.card("", ""); // the sign gets the frame to itself
        if (t < 0.8) { fadeColor = "#fff8ec"; fade = 1 - t / 0.8; }
        else if (t > 3.8) { fadeColor = "#04060d"; fade = (t - 3.8) / 0.8; }
        else fade = 0;
      } },
    { name: "wake", env: "class", chapter: "wake", firstPerson: true, d: 3.0,
      enter() {
        audio.mood("classroom"); fade = 0; overlay.card("", ""); overlay.caption("", "");
        mood = "tuesday"; doorTarget = 0;
        room.write("4 + 4 = ?");
        lookAt(headPosition(teacher), CLASS_CENTRE);
        const e = eye();
        cut([e.x, e.y, e.z], [e.x, 0.6, e.z - 1.2]);
        lids = 0; blur = 8;
      },
      update(t) {
        lids = lidCurve(t); blur = Math.max(0, 8 * (1 - t / 2.2));
        const e = eye();
        cam.p.copy(e);
        cam.l.set(e.x + Math.sin(t * 0.9) * 0.08, 0.6 + t * 0.15, e.z - 1.2);
      } },
    { name: "yawn", env: "class", chapter: "wake", firstPerson: true, d: 3.4,
      enter() { lids = 1; blur = 0; audio.sfx("yawn"); hand.group.visible = true; handLight.intensity = 0.05; },
      update(t) {
        // the right hand comes up from the lower right, palm turned in to cover the yawning
        // mouth, fingers loosely together, holds, then drops away
        const up = t < 0.75 ? ease(t / 0.75) : t < 2.45 ? 1 : 1 - ease(clamp((t - 2.45) / 0.75));
        HAND_POSE(up);
        lids = 1 - 0.12 * clamp((t - 0.6) / 0.5) * (1 - clamp((t - 2.3) / 0.5)); // a sleepy squint while yawning
        const e = eye();
        cam.p.copy(e);
        cam.l.set(e.x, 1.0 + 0.45 * up, e.z - 1.2); // head tips back
        if (t > 3.3) { hand.group.visible = false; handLight.intensity = 0; }
      } },
    { name: "turn", env: "class", chapter: "wake", firstPerson: true, d: 1.4,
      enter() { lids = 1; const e = eye(); cam.shot([e.x, e.y, e.z], [-1.7, 1.55, -4.05], 2.2); },
      update(t) { if (t > 0.7 && firstPerson) { firstPerson = false; glide([-1.4, 2.25, 4.0], [-0.3, 1.4, -3.6], 1.6); } } },
    q1,
    q2,
    talkShot({ name: "mult", env: "class", chapter: "wake", lead: 0.2, tail: 0.9,
      enter() { room.write("× MULTIPLICATION"); lookAt(headPosition(teacher), CLASS_CENTRE); glide([-0.4, 2.0, -1.3], [-0.6, 2.0, -5.3], 1.8); },
      beats: [{ id: "teacher_mult", who: "Teacher", c: T_ }] }),
    { name: "knock", env: "class", chapter: "knock", d: 2.6,
      enter() { talk(null); overlay.caption("", "KNOCK!  KNOCK!  KNOCK!"); audio.sfx("knock"); shake = 0.08; lookAt(DOOR_POINT); cut([1.1, 1.9, -1.5], [6.0, 1.6, -3.4]); },
      update(t) { if (t > 1.2 && doorTarget === 0) { doorTarget = 1.45; mood = "knock"; audio.sfx("door"); audio.mood("heroic"); overlay.caption("", ""); } } },
    talkShot({ name: "officers", env: "class", chapter: "knock", lead: 1.5, tail: 0.5,
      enter() {
        doorTarget = 1.45; mood = "knock";
        for (const [c, to, delay] of [[principal, ARRIVE.principal, 0], [captain, ARRIVE.captain, 0.3]] as const) {
          c.group.visible = true;
          c.group.position.copy(HALL[0]);
          c.rig.walk = { pts: [HALL[0], HALL[1], to], t0: stage.time + delay, d: 1.6, face: CLASS_CENTRE };
        }
        lookAt(new THREE.Vector3(4.5, 1.6, -2.6));
        glide([0.6, 1.95, -0.6], [4.2, 1.5, -3.0], 2.2);
      },
      beats: [
        { id: "principal_sorry", who: "Principal", c: PR },
        { id: "principal_intro", who: "Principal", c: PR, go: () => { lookAt(headPosition(captain)); glide([1.6, 1.85, -1.9], [3.5, 1.75, -3.8], 1.8); } },
      ] }),
    talkShot({ name: "captain", env: "class", chapter: "knock", lead: 0.3, tail: 0.6,
      enter() { lookAt(headPosition(captain)); glide([1.9, 1.8, -2.3], [3.5, 1.8, -3.8], 2.0); },
      beats: [
        { id: "captain_danger", who: "Captain", c: CAP },
        // the teacher answers, proud; then the captain asks her to name them
        { id: "teacher_proud", who: "Teacher", c: T_, gap: 0.7, go: () => { lookAt(headPosition(teacher), headPosition(captain)); glide([-0.7, 1.65, -1.0], [-1.55, 1.4, -4.0], 2.2); } },
        { id: "captain_names", who: "Captain", c: CAP, gap: 0.5, go: () => { lookAt(headPosition(captain), headPosition(captain)); glide([1.6, 1.85, -1.9], [3.5, 1.75, -3.8], 2.4); } },
      ] }),
    talkShot({ name: "names", env: "class", chapter: "knock", lead: 0.35, tail: 0.6,
      enter() { lookAt(headPosition(teacher), CLASS_CENTRE); glide([-2.2, 2.35, 4.3], [0.2, 1.35, -2.4], 2.0); },
      beats: [{ id: "teacher_names", who: "Teacher", c: T_, after: (t, start, len) => {
        // the four names fill the last ~55% of the line: each kid stands as theirs is called
        [0, 2, 5, 6].forEach((k, i) => { if (t > start + len * (0.47 + i * 0.13)) kids[k].rig.stand = 1; });
      } }] }),
    talkShot({ name: "picked", env: "class", chapter: "knock", lead: 0.5, tail: 2.6,
      enter() {
        lookAt(headPosition(player));
        const ph = headPosition(player);
        glide([0.4, 1.32, -0.35], [ph.x, ph.y + 0.02, ph.z], 2.5); // eye level: the cadet's face as their name is called
      },
      beats: [{ id: "teacher_pick_generic", who: "Teacher", c: T_, live: () => nameLine, text: () => `And our fifth cadet is… ${cadet || "you"}!`,
        go: () => audio.sfx("fanfare"),
        after: (t, start, len) => {
          if (t > start + len * 0.8) { player.rig.stand = 1; player.rig.raise = true; }
          if (t > start + len + 0.5) overlay.card("STARFLEET CADET PROGRAM", `CADET ${(cadet || "YOU").toUpperCase()}`, "Transferring to Earth Orbit Hangar…", "top");
          if (t > start + len + 1.9) { fadeColor = "#040712"; fade = (t - (start + len + 1.9)) / 0.7; }
        } }] }),
    talkShot({ name: "hangar", env: "hangar", chapter: "hangar", lead: 0.9, tail: 0.4,
      enter() { hangar.reset(); overlay.card("", ""); audio.mood("hangar"); cut(at(H, -1.5, 4.4, 13.8), at(H, 0, 3.3, -1.8)); glide(at(H, -2.6, 3.6, 11.4), at(H, -0.6, 3.2, -1.5), 1.3); },
      extra(t) { fadeColor = "#040712"; fade = t < 0.7 ? 1 - t / 0.7 : 0; },
      beats: [
        { id: "captain_brief1", who: "Captain", c: CAPH, go: () => glide(at(H, -2.3, 2.15, 5.6), at(H, -3.6, 1.75, 1.8), 1.1) }, // in to the captain
        { id: "captain_brief2", who: "Captain", c: CAPH, gap: 0.6, go: () => glide(at(H, 2.8, 3.8, 11.8), at(H, 0, 3.3, -1.8), 0.9) },
        { id: "captain_nova", who: "Captain", c: CAPH, gap: 0.7, go: () => glide(at(H, 0.6, 3.4, 7.6), at(H, 2.6, 3.0, 0.8), 1.4) },
      ] }),
    { name: "nova", env: "hangar", chapter: "hangar", d: Infinity,
      enter() { audio.sfx("nova_chirp"); novaLen = speak("nova_hi", "Nova", "nova"); glide(at(H, 4.4, 3.15, 5.6), at(H, 3.0, 2.95, 1.2), 2.2); }, // Nova centre frame, the ship behind her
      update(t) {
        hangar.nova.group.position.set(3.2 + Math.sin(t * 1.8) * 0.25, 2.8, 0.8 + Math.min(0.9, t * 0.5));
        if (t >= novaLen && speaker !== null) talk(null);
        if (t > novaLen + 0.3 && !ui.cta) { overlay.caption("", ""); setUi({ cta: "Ignite thrusters · Launch" }); }
      } },
    { name: "launch", env: "hangar", chapter: "hangar", d: 4.6,
      enter() { talk(null); overlay.caption("", ""); setUi({ cta: null }); audio.sfx("ignition"); audio.sfx("fanfare"); hangar.launch(); shake = 0.22; glide(at(H, -4.2, 2.8, 9.8), at(H, 0, 4.5, -12), 1.4); },
      update(t) {
        if (t < 2.2) shake = Math.max(shake, 0.14 * (1 - t / 2.2));
        if (t > 2.3) overlay.card("MISSION 01 · EARTH ORBIT", "CADET BAY", "Level 0 · Empty & Mirror");
        if (t > 3.6) { fadeColor = "#030612"; fade = (t - 3.6) / 0.9; }
      } },
  ];

  const director = new Director<Shot>(steps, {
    beforeEnter(s) {
      talk(null);
      setUi({ prompt: null, chapter: s.chapter });
      overlay.timer(null);
      if (s.env !== env) setEnv(s.env);
      firstPerson = !!s.firstPerson;
      hand.group.visible = false;
      audio.stopVoice();
    },
    onEnd() { setUi({ ended: true }); onEnd?.(); },
  });

  function reset() {
    for (const p of people()) { p.rig.raise = false; p.rig.talking = false; p.rig.walk = null; if (p.rig.seat) { p.rig.stand = 0; p.rig.s = 0; } }
    for (const c of [principal, captain]) { c.group.visible = false; c.group.position.copy(HALL[0]); }
    mood = "tuesday"; doorTarget = 0; room.door.rotation.y = 0;
    overlay.card("", ""); overlay.caption("", ""); overlay.timer(null);
    hand.group.visible = false; lids = 1; blur = 0; fade = 0; firstPerson = false;
    hangar.reset();
    room.write("4 + 4 = ?");
    setUi({ prompt: null, cta: null, ended: false });
  }

  function jump(chapter: Chapter) {
    reset();
    const first = { orbit: "orbit", dive: "dive", wake: "wake", knock: "knock", hangar: "hangar" }[chapter];
    const i = Math.max(0, director.find(first));
    if (i >= director.find("knock")) { setEnv("class"); room.write("× MULTIPLICATION"); glide([-1.4, 2.25, 4.0], [-0.3, 1.4, -3.6], 0); lookAt(headPosition(teacher), CLASS_CENTRE); }
    audio.unlock();
    void warmVoice();
    setUi({ started: true });
    director.go(i);
  }

  const stop = stage.onUpdate((dt, time) => {
    director.update(dt);
    const voice = audio.level();
    overlay.eq(voice);
    if (env === "space") earth.update(dt);
    if (env === "town") town.update(time);
    if (env === "class") {
      const m = MOODS[mood], tint = stage.grade.tint.value;
      stage.grade.sat.value = approach(stage.grade.sat.value, m.sat, 1.5, dt);
      tint.set(approach(tint.x, m.tint[0], 1.5, dt), approach(tint.y, m.tint[1], 1.5, dt), approach(tint.z, m.tint[2], 1.5, dt));
      stage.renderer.toneMappingExposure = approach(stage.renderer.toneMappingExposure, m.exposure, 1.5, dt);
      room.door.rotation.y = approach(room.door.rotation.y, doorTarget, 2.5, dt);
      room.update(time, dt, { hall: m.hall, spill: m.spill, fill: m.fill, buzz: m.buzz, on: true });
      for (const p of people()) animateCharacter(p, time, dt, rnd, p === speaker ? voice : 0);
      player.rig.head.visible = !(firstPerson && cam.p.distanceTo(eye()) < 0.6);
    } else {
      room.update(time, dt, { hall: 0, spill: 0, fill: 0, buzz: false, on: false });
    }
    if (env === "hangar") { hangar.update(time, dt, voice, speaker === "nova"); animateCharacter(captainH, time, dt, rnd, speaker === captainH ? voice : 0); }
    shake *= 0.88;
    cam.sway = env === "class" && !firstPerson ? 1 : 0;
    cam.apply(camera, dt, time);
    if (shake > 0.001) camera.position.add(new THREE.Vector3((rnd() - 0.5) * shake, (rnd() - 0.5) * shake, 0));
    overlay.fade(fade, fadeColor);
    overlay.lids(lids);
    overlay.blur(blur);
  });

  const onKey = (e: KeyboardEvent) => {
    const s = director.current;
    if (!s?.pick || !ui.prompt) return;
    if (e.code === "Space") { e.preventDefault(); s.raise?.(); }
    const ix = e.key === "1" ? 0 : e.key === "2" ? 1 : -1;
    if (ix >= 0 && ui.prompt.stage === "choose") s.pick(ui.prompt.options[ix]);
  };
  window.addEventListener("keydown", onKey);

  // resting state before Play: Earth turning slowly
  reset();
  setEnv("space");
  cut(at(S, -4, 10, 160), at(S, 0, 0, 0));
  face(teacher.group, CLASS_CENTRE);
  teacher.group.rotation.y = 0.2;

  return {
    director,
    /** Start from the top (from a click, so audio can start). */
    play: () => jump("orbit"),
    jump,
    pick: (v: number) => director.current?.pick?.(v),
    raise: () => director.current?.raise?.(),
    ignite: () => { if (director.current?.name === "nova") director.go(director.find("launch")); },
    setName(name: string) {
      cadet = name.trim();
      nameLine = null;
      if (!cadet) return;
      audio.unlock();
      void prepare(`And our fifth cadet is... ${cadet}!`, "Hadley").then((b) => { nameLine = b; });
    },
    get ui() { return ui; },
    dispose() { stop(); window.removeEventListener("keydown", onKey); overlay.dispose(); audio.stopVoice(); hand.group.removeFromParent(); handLight.removeFromParent(); },
  };
}
export type Film = ReturnType<typeof mountIntro>;
