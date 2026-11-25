import * as THREE from "three";
import { COLOR } from "@/design/tokens";
import { audio } from "@/engine/audio";
import { CameraRig, type V3 } from "@/engine/camera";
import { Director, type Step } from "@/engine/director";
import { createOverlay } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { approach, clamp, ease, keyframes, seeded } from "@/engine/util";
import { prepare, warmVoice } from "@/engine/voice";
import { applyLook, LOOKS, type LookId } from "@/worlds/looks";
import { animateCharacter, ANSWERERS, CAPTAIN, CLASSMATES, eyePosition, face, headPosition, makeCharacter, NAMED, PLAYER, PRINCIPAL, seat, SKIN, TEACHER, type Character, type Expression } from "./cast";
import { buildClassroom, CHAIR_BACK, DESK_DEPTH, DESK_HEIGHT, DOOR_POINT, PLAYER_SEAT, SEAT_HEIGHT, SEATS } from "./classroom";
import { buildEarth, EARTH_RADIUS } from "./earth";
import { makeHand } from "./hand";
import { buildHangar } from "./hangar";
import { buildTown } from "./town";

/**
 * The opening film: Earth, the dive, an ordinary Tuesday, waking up in class, two quick questions,
 * the knock, the Captain, the names, the cadet picked by name, the hangar briefing, Nova, and
 * ignition. Every line is a baked Gradium Phonon clip except the cadet's name, which Phonon speaks
 * live in the teacher's voice.
 *
 * Film grammar: a new setup is a cut, and inside a setup the camera only drifts. Fades are one
 * family (eased, the colour of the void); the single exception is the dive, which goes through cloud.
 */
type Env = "space" | "town" | "class" | "hangar";
interface Shot extends Step { env: Env; chapter: Chapter; firstPerson?: boolean; pick?(v: number): void; raise?(): void }
export type Chapter = "orbit" | "dive" | "wake" | "knock" | "hangar";
/** `raise`: the invitation to raise a hand; `called`: the hand is up and the teacher is calling on you; `choose`: pick the answer. */
export interface FilmUi { prompt: { eq: string; options: number[]; stage: "raise" | "called" | "choose" } | null; cta: string | null; started: boolean; ended: boolean; chapter: Chapter | null }

export const SPACE_AT = new THREE.Vector3(0, 0, -6000);
const TOWN_AT = new THREE.Vector3(1500, 0, 0), HANGAR_AT = new THREE.Vector3(-1500, 0, 0);
const CLASS_CENTRE = new THREE.Vector3(0, 1, 1.2);
/** The desk in front of the cadet stands empty, so the cadet (and the camera) can see the teacher and the board. */
const EMPTY_SEAT = 1;
// the walk in: from down the hall, through the middle of the doorway, to their marks clear of the open door
const HALL = [new THREE.Vector3(7.6, 0, -3.75), new THREE.Vector3(6.1, 0, DOOR_POINT.z)];
const ARRIVE = { principal: new THREE.Vector3(4.75, 0, -2.2), captain: new THREE.Vector3(3.95, 0, -3.1) };
/** Each set picks one of the three looks; no shot sets its own background, bloom, exposure or grade. */
const LOOK_OF: Record<Env, LookId> = { space: "space", town: "interior", class: "interior", hangar: "hero" };
/** The one story grade: the ordinary Tuesday is a touch muted, and colour arrives with the knock. `hall` is how much the hallway lights the room. */
const MOODS = { tuesday: { sat: 0.86, hall: 0 }, knock: { sat: 1, hall: 1 } } as const;
/** One fade grammar, in seconds: out to the void, and back in. */
const FADE = { out: 0.7, in: 0.9 };
/** How long the class waits for a hand, and when a classmate's goes up. */
const RAISE = { window: 9, rival: 5.5 };
/** The lens, in degrees of vertical field of view: the film's own on a wide screen, and a wider one for a tall phone. */
const FOV = 48, FOV_TALL = 76;
const smooth = (k: number) => { k = clamp(k); return k * k * (3 - 2 * k); };

export function mountIntro(stage: Stage, { onUi, onEnd }: { onUi?: (ui: FilmUi) => void; onEnd?: () => void } = {}) {
  const { scene, camera, mats: M } = stage;
  const rnd = seeded(11);
  const calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  void audio.preload();
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const cam = new CameraRig();
  // the cool fill of whichever look is on
  const hemi = new THREE.HemisphereLight(LOOKS.space.fill.sky, LOOKS.space.fill.ground, LOOKS.space.fill.intensity);
  scene.add(hemi);

  const earth = buildEarth(scene, M, rnd, SPACE_AT);
  const town = buildTown(scene, M, rnd, TOWN_AT, LOOKS.interior);
  const room = buildClassroom(scene, M, rnd, LOOKS.interior);
  const hangar = buildHangar(scene, M, rnd, HANGAR_AT);
  // the hangar set is lit for its ship; the film adds the hero look's key from the camera side for the
  // people in it (from that side the polished deck throws no glare back at the lens)
  const hangarKey = new THREE.DirectionalLight(LOOKS.hero.key.color, 0);
  hangarKey.position.copy(HANGAR_AT).add(new THREE.Vector3(-3, 7, 11));
  hangarKey.target.position.copy(HANGAR_AT).add(new THREE.Vector3(-1, 1.5, 0));
  scene.add(hangarKey, hangarKey.target);

  // the cadet's own hand, for the yawn
  const hand = makeHand(M, SKIN[PLAYER.skin], PLAYER.top);
  camera.add(hand.group);
  hand.group.visible = false;
  /** The yawn pose, 0 = down out of frame, 1 = up under the mouth: low in the frame, so the board stays in view. */
  const HAND_POSE = (up: number) => {
    hand.group.position.set(0.085 - 0.03 * up, -0.34 + 0.2 * up, -0.3);
    hand.group.rotation.set(-0.35 + 0.2 * up, -1.0 + 0.25 * up, 0.5 - 0.2 * up);
    hand.curl(0.3 * up);
  };
  let novaLen = 4;

  // the cast
  const kids: Character[] = [];
  let player!: Character;
  let j = 0;
  SEATS.forEach(([x, z], i) => {
    if (i === EMPTY_SEAT) return;
    const c = makeCharacter(i === PLAYER_SEAT ? PLAYER : CLASSMATES[j++], M, rnd);
    seat(c, x, SEAT_HEIGHT, z + CHAIR_BACK, { chair: room.chairs[i], desk: DESK_HEIGHT, edge: CHAIR_BACK - DESK_DEPTH / 2 });
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
  const everyone = () => [...people(), captainH];

  let speaker: Character | "nova" | null = null;
  const talk = (c: Character | "nova" | null) => { speaker = c; for (const p of everyone()) p.rig.talking = p === c; };
  const headOf = (c: Character) => headPosition(c);
  /** Point a group's eyes at a spot. A character never looks at their own head: they address the room instead. */
  const gaze = (who: Character[], at: THREE.Vector3) => { for (const p of who) p.rig.look = headOf(p).distanceTo(at) < 0.4 ? CLASS_CENTRE : at; };
  /** Everyone looks at `t`; the teacher looks at `teacherAt` (the class, when she is the one talking). */
  const lookAt = (t: THREE.Vector3, teacherAt: THREE.Vector3 = t) => { gaze(people(), t); teacher.rig.look = teacherAt; };
  const feel = (who: Character[], e: Expression) => { for (const p of who) p.rig.mood = e; };
  const cut = (p: V3, l: V3) => cam.shot(p, l, 0);
  /** A setup: cut to it, then drift slowly toward a second framing. */
  const setup = (p: V3, l: V3, p2: V3 = p, l2: V3 = l, speed = 0.3) => { cam.shot(p, l, 0); cam.shot(p2, l2, speed); };
  const at = (o: THREE.Vector3, x: number, y: number, z: number): V3 => [o.x + x, o.y + y, o.z + z];

  /** A phone held upright sees a narrow slice of the room, so two setups stand further back for it. */
  const tall = () => camera.aspect < 1;
  /** The names beat on a phone: which of its three follow shots have been taken. */
  let phoneShot = [false, false, false];
  /** Extra degrees on the tall lens, for the one phone shot that must hold a whole row of desks. */
  let lensBoost = 0;
  // the standing setups of the classroom, by name
  const SETUP = {
    /** The teacher at the board, from among the desks: she and what she has written are both in frame. */
    teacher: () => tall()
      ? setup([0.55, 1.62, 1.7], [-0.62, 1.55, -4.9], [0.5, 1.62, 1.4], [-0.64, 1.55, -4.9], 0.22)
      : setup([1.0, 1.5, -0.3], [-0.75, 1.6, -4.9], [0.85, 1.5, -0.6], [-0.78, 1.6, -4.9], 0.22),
    /** The whole class from behind, the cadet in the middle of the frame. */
    wide: () => setup([1.3, 2.25, 4.7], [-0.4, 0.5, -1.8], [1.1, 2.2, 4.4], [-0.4, 0.5, -1.8], 0.2),
    /** Over the class to the board, low among the desks: today's word is up there. */
    lesson: () => tall()
      ? setup([-0.3, 1.5, 3.2], [-0.4, 1.7, -4.9], [-0.3, 1.5, 2.7], [-0.4, 1.7, -4.9], 0.25)
      : setup([-1.5, 1.45, 3.6], [-0.3, 1.6, -4.9], [-1.3, 1.45, 3.1], [-0.3, 1.6, -4.9], 0.25),
    /** One child's face, from the front and a little to the side. */
    child: (c: Character, side = 1) => { const h = headOf(c); setup([h.x + side * 0.8, h.y + 0.12, h.z - 1.45], [h.x, h.y - 0.02, h.z], [h.x + side * 0.7, h.y + 0.1, h.z - 1.3], [h.x, h.y - 0.02, h.z], 0.3); },
    /** The class from the board side: every face, turning. */
    faces: () => setup([-3.6, 1.35, -3.3], [0.6, 0.85, 0.9], [-3.3, 1.35, -3.1], [0.7, 0.85, 0.9], 0.25),
    door: () => setup([0.7, 1.45, -2.0], [6.0, 1.2, -3.5], [1.1, 1.45, -2.1], [6.0, 1.2, -3.5], 0.3),
    captain: () => setup([1.9, 1.58, -2.2], [3.95, 1.62, -3.1], [2.15, 1.6, -2.3], [3.95, 1.64, -3.1], 0.22),
    /** The room from the back corner by the door side: every desk, the teacher, the visitors. */
    names: () => tall()
      ? setup([0.5, 3.2, 4.9], [-0.1, 0.1, -0.6], [0.4, 3.1, 4.8], [-0.1, 0.1, -0.6], 0.15)
      : setup([4.9, 2.55, 4.75], [-0.9, 0.75, -1.0], [4.5, 2.45, 4.6], [-0.8, 0.75, -1.0], 0.15),
  };

  // ui published to React (the choices, the ignition button)
  let ui: FilmUi = { prompt: null, cta: null, started: false, ended: false, chapter: null };
  const setUi = (p: Partial<FilmUi>) => { ui = { ...ui, ...p }; onUi?.(ui); };

  // the cadet's name: spoken live by Phonon in the teacher's voice, prepared while the film plays
  let cadet = "", nameLine: AudioBuffer | null = null;

  // environments: four sets far apart in one scene; switching changes the look and the light rig
  let env: Env | null = null, mood: keyof typeof MOODS = "tuesday", firstPerson = false, doorTarget = 0, shake = 0;
  let fade = 0, fadeColor: string = COLOR.void, lids = 1, blur = 0;
  function setEnv(e: Env) {
    env = e;
    const space = e === "space", tw = e === "town", cls = e === "class", hg = e === "hangar";
    const look = applyLook(stage, LOOK_OF[e]);
    scene.fog = tw ? town.fog : null;
    camera.far = space ? 3000 : tw ? 700 : 160;
    camera.near = space || tw ? 0.5 : 0.02; // nothing is near the lens outdoors, and a deeper near plane keeps far surfaces from fighting
    camera.updateProjectionMatrix();
    hemi.color.setHex(look.fill.sky);
    hemi.groundColor.setHex(look.fill.ground);
    hemi.intensity = look.fill.intensity;
    earth.sun.color.setHex(look.key.color);
    earth.sun.intensity = space ? look.key.intensity : 0;
    town.sun.intensity = tw ? look.key.intensity : 0;
    hangar.lights(hg);
    hangarKey.intensity = hg ? look.key.intensity : 0;
    stage.grade.tint.value.set(1, 1, 1);
    stage.grade.sat.value = look.sat * (cls ? MOODS[mood].sat : 1);
  }
  const fadeOut = (t: number, from: number, d = FADE.out) => smooth((t - from) / d);
  const fadeIn = (t: number, d = FADE.in) => 1 - smooth(t / d);

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
   * A classroom question: the teacher asks and finishes; then the class waits for a hand (Space or
   * the button). Raise yours and it goes up at once, she calls on you, and the two answers appear.
   * Wait, and a classmate's hand goes up and they answer. The teacher replies after a breath.
   */
  function question(o: { name: string; eq: string; answer: number; options: number[]; ask: string; kid: number; kidClip: string; ok: string; close: string; open: () => void }): Shot {
    type Phase = "ask" | "raise" | "called" | "choose" | "answer" | "reply" | "done";
    let phase: Phase = "ask", at0 = 0, len = 0, result: "right" | "close" | "classmate" = "right", keen = false;
    const to = (p: Phase) => { phase = p; at0 = director.t; };
    const prompt = (stage: "raise" | "called" | "choose") => setUi({ prompt: { eq: o.eq, options: o.options, stage } });
    const shot: Shot = {
      name: o.name, env: "class", chapter: "wake",
      enter() {
        phase = "ask"; at0 = 0; keen = false;
        room.write(o.eq);
        feel(people(), "neutral");
        lookAt(headOf(teacher), CLASS_CENTRE);
        len = speak(o.ask, "Teacher", teacher);
        o.open();
      },
      update(t) {
        const since = t - at0;
        if (since >= len && speaker !== null && phase !== "raise" && phase !== "choose") talk(null);
        if (phase === "ask" && since >= len + 0.4) {
          to("raise");
          talk(null);
          overlay.caption("", ""); // the question is on the board and in the invitation now
          prompt("raise");
          SETUP.wide();
        } else if (phase === "raise") {
          if (since > RAISE.rival && !keen) { keen = true; kids[o.kid].rig.raise = true; kids[o.kid].rig.mood = "happy"; } // someone else is keen too
          if (since >= RAISE.window) classmate();
        } else if (phase === "called" && since >= len + 0.3) {
          to("choose");
          prompt("choose");
        } else if (phase === "answer" && since >= len + GAP) {
          to("reply");
          for (const p of people()) p.rig.raise = false;
          room.write(o.eq.replace("?", String(o.answer)));
          lookAt(headOf(teacher), CLASS_CENTRE);
          feel([teacher], "happy");
          len = speak(result === "close" ? o.close : o.ok, "Teacher", teacher);
          SETUP.teacher();
        } else if (phase === "reply" && since >= len + 0.8) to("done");
      },
      done: () => phase === "done",
    };
    function classmate() {
      to("answer");
      setUi({ prompt: null });
      result = "classmate";
      const who = kids[o.kid];
      who.rig.raise = true;
      who.rig.mood = "happy";
      lookAt(headOf(who));
      who.rig.look = headOf(teacher);
      len = speak(o.kidClip, "Classmate", who);
      SETUP.child(who, who.group.position.x > 0 ? -1 : 1);
    }
    shot.raise = () => {
      if (phase !== "raise" || director.current !== shot) return;
      to("called");
      prompt("called");
      kids[o.kid].rig.raise = false;
      kids[o.kid].rig.mood = "neutral";
      player.rig.raise = true;
      player.rig.r = Math.max(player.rig.r, 0.25); // the arm is already moving on the frame of the press
      audio.sfx("blip_ok");
      lookAt(headOf(player));
      player.rig.look = headOf(teacher);
      len = speak("teacher_yes", "Teacher", teacher);
      // the cadet from the front, on the side of the raised arm, so the hand goes up in clear space
      // above the shoulder (from behind, the head hid it); the head sits high, clear of the answers
      const h = headOf(player);
      setup([h.x - 0.85, h.y + 0.2, h.z - 1.75], [h.x - 0.05, h.y - 0.12, h.z], [h.x - 0.75, h.y + 0.18, h.z - 1.6], [h.x - 0.05, h.y - 0.1, h.z], 0.3);
    };
    shot.pick = (v: number) => {
      if (phase === "raise") shot.raise?.(); // answering straight away still raises the hand first
      if (phase !== "choose" && phase !== "called") return;
      to("answer");
      setUi({ prompt: null });
      result = v === o.answer ? "right" : "close";
      audio.sfx(result === "right" ? "blip_ok" : "blip_close");
      talk(player);
      player.rig.mime = true; // the cadet's own answer has no recording to follow
      player.rig.mood = result === "right" ? "happy" : "thinking";
      overlay.caption("You", result === "right" ? `${v}!` : `${v}?`);
      SETUP.child(player, 1);
      len = 1.1;
    };
    return shot;
  }

  const q1 = question({ name: "q1", eq: "4 + 4 = ?", answer: 8, options: [8, 9], ask: "teacher_intro", kid: ANSWERERS[0], kidClip: "kid_eight", ok: "teacher_eight_ok", close: "teacher_eight_close", open: () => SETUP.teacher() });
  const q2 = question({ name: "q2", eq: "5 − 3 = ?", answer: 2, options: [3, 2], ask: "teacher_q2", kid: ANSWERERS[1], kidClip: "kid_two", ok: "teacher_two_ok", close: "teacher_two_close", open: () => SETUP.faces() }); // the class hears the second one

  /** A step that is nothing but dialogue (plus its own camera and staging in `enter`). */
  const talkShot = (s: Omit<Shot, "update" | "done"> & { beats: Beat[]; lead?: number; tail?: number; extra?: (t: number) => void }): Shot => {
    const dl = dialogue(s.beats, { lead: s.lead, tail: s.tail });
    return { ...s, enter() { dl.begin(); s.enter?.(); }, update(t) { dl.update(t); s.extra?.(t); }, done: dl.done };
  };
  const T_ = () => teacher, CAP = () => captain, CAPH = () => captainH, PR = () => principal;
  const named = () => NAMED.map((k) => kids[k]);
  let diveFrom = new THREE.Vector3(), cardShown = false;
  const turnFrom = new THREE.Vector3();

  const steps: Shot[] = [
    { name: "orbit", env: "space", chapter: "orbit", d: 4.4,
      enter() { audio.mood("space"); lids = 1; overlay.caption("", ""); overlay.card("", "Earth", "An ordinary blue planet", "low"); cut(at(S, -14, 9, 150), at(S, 0, 0, 0)); cam.shot(at(S, 10, 6, 128), at(S, 0, 0, 0), 0.55); },
      update(t) { fadeColor = COLOR.void; fade = fadeIn(t); if (t > 3.5) overlay.card("", ""); } },
    { name: "dive", env: "space", chapter: "dive", d: 2.6,
      // the plunge starts from wherever the orbit left the camera, so there is no jump at the cut
      enter() { overlay.card("", ""); audio.sfx("dive"); cam.hold(); diveFrom = cam.p.clone(); },
      update(t) {
        const k = clamp(t / 2.6), e = k * k; // gathers speed from the first frame, fastest at the cloud
        cam.p.set(diveFrom.x + (S.x - diveFrom.x) * e, diveFrom.y + (S.y + 3 - diveFrom.y) * e, diveFrom.z + (S.z + EARTH_RADIUS + 10 - diveFrom.z) * e);
        cam.l.set(S.x, S.y + 2 * e, S.z);
        fadeColor = COLOR.approach; fade = fadeOut(t, 1.3, 0.85); // into the cloud, which closes before the ground rushes up
      } },
    { name: "town", env: "town", chapter: "dive", d: 5.6,
      // wide over the rooftops, then square on to the porch so the school's name reads in full
      enter() { audio.sfx("chime"); overlay.card("", "An ordinary Tuesday", "8:42 in the morning", "top"); cut(at(T, 30, 24, 52), at(T, 0, 4, 0)); cam.hold(); },
      update(t) {
        // one eased crane down from over the rooftops: slow away, gentle in, then it rests on the sign
        const k = smooth(t / 3.9);
        cam.p.set(T.x + 30 * (1 - k), 24 + (3.1 - 24) * k, 52 + (13.5 - 52) * k);
        cam.l.set(T.x, 4 + (3.5 - 4) * k, 5.9 * k);
        if (t > 3.1) overlay.card("", ""); // the sign gets the frame to itself
        if (t < 1) { fadeColor = COLOR.approach; fade = fadeIn(t, 1); }
        else if (t > 5.6 - FADE.out) { fadeColor = COLOR.void; fade = fadeOut(t, 5.6 - FADE.out); }
        else fade = 0;
      } },
    { name: "wake", env: "class", chapter: "wake", firstPerson: true, d: 3.1,
      enter() {
        audio.mood("classroom"); fade = 0; overlay.card("", ""); overlay.caption("", "");
        mood = "tuesday"; doorTarget = 0;
        room.write("4 + 4 = ?");
        feel(people(), "neutral");
        lookAt(headOf(teacher), CLASS_CENTRE);
        const e = eye();
        cut([e.x, e.y, e.z], [e.x, 0.45, e.z - 1.0]);
        lids = 0; blur = 8;
      },
      update(t) {
        lids = lidCurve(t); blur = Math.max(0, 8 * (1 - t / 2.2));
        // eyes open on the desk, then lift toward the front of the room
        const e = eye(), up = smooth((t - 1.2) / 1.9);
        cam.p.copy(e);
        cam.l.set(e.x + Math.sin(t * 0.9) * 0.06 * (1 - up), 0.45 + up * 0.75, e.z - 1.0 - up * 1.5); // the drowsy drift is gone by the time the head is up
      } },
    { name: "yawn", env: "class", chapter: "wake", firstPerson: true, d: 3.2,
      enter() { lids = 1; blur = 0; audio.sfx("yawn"); hand.group.visible = true; HAND_POSE(0); },
      update(t) {
        // the hand comes up under the mouth from the lower right, holds, then drops away; the head
        // tips back with the yawn, which lifts the board into the middle of the frame
        const up = t < 0.8 ? ease(t / 0.8) : t < 2.3 ? 1 : 1 - ease(clamp((t - 2.3) / 0.8));
        HAND_POSE(up);
        lids = 1 - 0.16 * smooth((t - 0.5) / 0.5) * (1 - smooth((t - 2.2) / 0.6)); // a sleepy squint
        const e = eye();
        cam.p.copy(e);
        cam.l.set(e.x, 1.2 + 0.32 * up, e.z - 2.5);
        if (t > 3.12) hand.group.visible = false;
      } },
    { name: "turn", env: "class", chapter: "wake", firstPerson: true, d: 1.8,
      // still through the cadet's eyes: an unhurried look over to the teacher, who is about to speak
      enter() { lids = 1; turnFrom.copy(cam.l); cam.hold(); },
      update(t) { const e = eye(), k = smooth(t / 1.3); cam.p.copy(e); cam.l.set(turnFrom.x + (-1.6 - turnFrom.x) * k, turnFrom.y + (1.5 - turnFrom.y) * k, turnFrom.z + (-4.05 - turnFrom.z) * k); } },
    q1,
    q2,
    talkShot({ name: "mult", env: "class", chapter: "wake", lead: 0.3, tail: 0.9,
      enter() { room.write("× Multiplication"); feel(people(), "neutral"); feel([teacher], "happy"); lookAt(headOf(teacher), CLASS_CENTRE); SETUP.lesson(); },
      beats: [{ id: "teacher_mult", who: "Teacher", c: T_ }] }),
    { name: "knock", env: "class", chapter: "knock", d: 3.1,
      // the sound first, on the faces that hear it; then the door, as it opens
      enter() { talk(null); overlay.caption("", "Knock, knock, knock."); audio.sfx("knock"); shake = 0.025; feel(people(), "oops"); lookAt(DOOR_POINT); SETUP.faces(); },
      update(t) {
        if (t > 1.3 && doorTarget === 0) { doorTarget = 1; mood = "knock"; audio.sfx("door"); audio.mood("heroic"); overlay.caption("", ""); SETUP.door(); }
        if (t > 2.0) feel(people(), "neutral");
      } },
    talkShot({ name: "officers", env: "class", chapter: "knock", lead: 2.3, tail: 0.5,
      enter() {
        doorTarget = 1; mood = "knock";
        for (const [c, to, delay] of [[principal, ARRIVE.principal, 0], [captain, ARRIVE.captain, 0.35]] as const) {
          c.group.visible = true;
          c.group.position.copy(HALL[0]);
          face(c.group, HALL[1]);
          c.rig.walk = { pts: [HALL[0], HALL[1], to], t0: stage.time + delay, d: 2.1, face: CLASS_CENTRE };
          c.rig.look = CLASS_CENTRE;
        }
        gaze([...kids, player, teacher], new THREE.Vector3(4.6, 1.5, -2.7));
        cam.shot([1.25, 1.5, -2.0], [4.4, 1.32, -2.7], 0.6); // no cut: the door shot widens to hold them both as they walk in
      },
      beats: [
        { id: "principal_sorry", who: "Principal", c: PR, go: () => { feel([principal], "happy"); gaze([...kids, player, teacher], headOf(principal)); } },
        { id: "principal_intro", who: "Principal", c: PR, go: () => { principal.rig.look = headOf(captain); gaze([...kids, player, teacher], headOf(captain)); } },
      ] }),
    talkShot({ name: "captain", env: "class", chapter: "knock", lead: 0.35, tail: 0.6,
      enter() { lookAt(headOf(captain)); captain.rig.look = CLASS_CENTRE; principal.rig.look = headOf(captain); feel([principal], "neutral"); SETUP.captain(); },
      beats: [
        { id: "captain_danger", who: "Captain", c: CAP },
        // the teacher answers, surprised and then proud; then the Captain asks her to name them
        { id: "teacher_proud", who: "Teacher", c: T_, gap: 0.7, go: () => { lookAt(headOf(teacher), headOf(captain)); captain.rig.look = headOf(teacher); feel([teacher], "oops"); SETUP.teacher(); },
          after: (t, start, len) => { if (t > start + len * 0.45) feel([teacher], "happy"); } },
        { id: "captain_names", who: "Captain", c: CAP, gap: 0.5, go: () => { lookAt(headOf(captain)); captain.rig.look = headOf(teacher); SETUP.captain(); } },
      ] }),
    talkShot({ name: "names", env: "class", chapter: "knock", lead: 0.4, tail: 1.5,
      enter() {
        phoneShot = [false, false, false];
        lookAt(headOf(teacher), CLASS_CENTRE); gaze([captain, principal], CLASS_CENTRE); feel([teacher], "happy");
        if (tall()) { lensBoost = 18; const a = named()[0].group.position, b = named()[1].group.position; setup([(a.x + b.x) / 2 + 0.3, 2.5, 4.75], [(a.x + b.x) / 2, 0.95, a.z], [(a.x + b.x) / 2 + 0.2, 2.45, 4.6], [(a.x + b.x) / 2, 0.95, a.z], 0.15); }
        else SETUP.names();
      },
      beats: [{ id: "teacher_names", who: "Teacher", c: T_, after: (t, start, len) => {
        // the four names fill the last half of the line: each child stands as theirs is called
        named().forEach((kid, i) => {
          if (t > start + len * (0.47 + i * 0.13) && kid.rig.stand === 0) {
            kid.rig.stand = 1; kid.rig.mood = "happy"; kid.rig.look = headOf(teacher); teacher.rig.look = headOf(kid); gaze(kids.filter((k) => k.rig.stand === 0), headOf(kid));
          }
          // a phone held upright cannot hold the whole room: the front pair is seen from the back wall on a
          // wider lens as Maya and Leo rise, then a cut to the back pair, from the front, as Aarav and Zoe do
          if (tall() && i === 2 && !phoneShot[2] && t > start + len * (0.47 + i * 0.13) - 0.15) {
            phoneShot[2] = true;
            lensBoost = 0;
            const p = kid.group.position, q = named()[3].group.position, cx = (p.x + q.x) / 2;
            setup([cx + 0.6, 1.75, p.z - 4.6], [cx, 1.05, p.z], [cx + 0.5, 1.75, p.z - 4.4], [cx, 1.08, p.z], 0.25);
          }
        });
      } }] }),
    talkShot({ name: "picked", env: "class", chapter: "knock", lead: 0.5, tail: 4.9,
      enter() {
        cardShown = false;
        lensBoost = 0;
        lookAt(headOf(player));
        player.rig.look = headOf(teacher);
        SETUP.child(player, 1);
      },
      beats: [{ id: "teacher_pick_generic", who: "Teacher", c: T_, live: () => nameLine, text: () => `And our fifth cadet is… ${cadet || "you"}!`,
        go: () => audio.sfx("fanfare"),
        after: (t, start, len) => {
          if (t > start + len * 0.8 && player.rig.stand === 0) { player.rig.stand = 1; player.rig.mood = "happy"; }
          // the camera stays on the cadet's face as they rise, from a little below eye height: the
          // classmates standing behind sit lower in the frame than the cheering hands
          const h = headOf(player);
          cam.shot([h.x + 0.8, h.y - 0.22, h.z - 1.45], [h.x, h.y + 0.04, h.z], 6);
          if (player.rig.s > 0.9) player.rig.mood = "cheer";
          // out to the void, and the cadet's new name on it
          const out = start + len + 1.9;
          if (t > out) { fadeColor = COLOR.void; fade = fadeOut(t, out); overlay.caption("", ""); }
          if (t > out + FADE.out && !cardShown) { cardShown = true; overlay.card("", `Cadet ${cadet || "you"}`, "Next stop: the Star Fleet hangar"); }
          if (t > start + len + 4.9 - 0.75) overlay.card("", "");
        } }] }),
    talkShot({ name: "hangar", env: "hangar", chapter: "hangar", lead: 1.1, tail: 0.4,
      enter() { hangar.reset(); overlay.card("", ""); audio.mood("hangar"); setup(at(H, -1.5, 4.4, 13.8), at(H, 0, 3.3, -1.8), at(H, -2.2, 3.9, 12.2), at(H, -0.4, 3.2, -1.6), 0.35); },
      extra(t) { fadeColor = COLOR.void; fade = fadeIn(t - 0.2); },
      beats: [
        { id: "captain_brief1", who: "Captain", c: CAPH, go: () => setup(at(H, -2.0, 1.95, 5.4), at(H, -3.75, 1.62, 1.8), at(H, -2.25, 1.9, 4.9), at(H, -3.78, 1.64, 1.8), 0.25) }, // in to the Captain
        { id: "captain_brief2", who: "Captain", c: CAPH, gap: 0.6, go: () => setup(at(H, 3.4, 3.4, 11.6), at(H, -0.2, 3.1, -1.8), at(H, 2.6, 3.7, 10.6), at(H, -0.1, 3.3, -1.8), 0.12) }, // the ship he is talking about
        { id: "captain_nova", who: "Captain", c: CAPH, gap: 0.7, go: () => setup(at(H, -2.0, 1.95, 5.4), at(H, -3.75, 1.62, 1.8), at(H, -2.25, 1.9, 4.9), at(H, -3.78, 1.64, 1.8), 0.25) },
      ] }),
    { name: "nova", env: "hangar", chapter: "hangar", d: Infinity,
      enter() { audio.sfx("nova_chirp"); hangar.nova.express("happy"); novaLen = speak("nova_hi", "Nova", "nova"); setup(at(H, 4.9, 3.1, 5.9), at(H, 3.1, 2.9, 1.3), at(H, 4.5, 3.05, 5.1), at(H, 3.1, 2.9, 1.3), 0.3); }, // Nova centre frame, the ship behind her
      update(t) {
        hangar.nova.group.position.set(3.2 + Math.sin(t * 0.8) * 0.12, 2.8, 0.8 + 0.9 * smooth(t / 2.2));
        if (t >= novaLen && speaker !== null) talk(null);
        if (t > novaLen + 0.4 && !ui.cta) { overlay.caption("", ""); setUi({ cta: "Launch" }); }
      } },
    { name: "launch", env: "hangar", chapter: "hangar", d: 5.6,
      enter() { talk(null); overlay.caption("", ""); setUi({ cta: null }); hangar.nova.express("cheer"); audio.sfx("ignition"); audio.sfx("fanfare"); hangar.launch(); shake = 0.06; setup(at(H, -4.2, 2.8, 9.8), at(H, 0, 3.2, -4), at(H, -4.2, 2.8, 9.8), at(H, 0, 4.6, -12), 0.9); },
      update(t) {
        if (t < 2.2) shake = Math.max(shake, 0.04 * (1 - t / 2.2));
        fadeColor = COLOR.void; fade = fadeOut(t, 2.9);
        if (t > 2.9 + FADE.out) overlay.card("", "Cadet Bay", "Your first mission");
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
    for (const p of everyone()) { p.rig.raise = false; p.rig.talking = false; p.rig.walk = null; p.rig.mood = "neutral"; if (p.rig.seat) { p.rig.stand = 0; p.rig.s = 0; } }
    for (const c of [principal, captain]) { c.group.visible = false; c.group.position.copy(HALL[0]); }
    mood = "tuesday"; doorTarget = 0; room.reset();
    overlay.card("", ""); overlay.caption("", ""); overlay.timer(null);
    hand.group.visible = false; lids = 1; blur = 0; fade = 0; firstPerson = false; shake = 0;
    hangar.reset();
    hangar.nova.express("neutral");
    room.write("4 + 4 = ?");
    setUi({ prompt: null, cta: null, ended: false });
  }

  function jump(chapter: Chapter) {
    lensBoost = 0;
    reset();
    const first = { orbit: "orbit", dive: "dive", wake: "wake", knock: "knock", hangar: "hangar" }[chapter];
    const i = Math.max(0, director.find(first));
    if (i >= director.find("knock")) { setEnv("class"); room.write("× Multiplication"); SETUP.wide(); lookAt(headOf(teacher), CLASS_CENTRE); }
    audio.unlock();
    void warmVoice(["Hadley", "Zoey"]); // the cadet's name, then Nova's live lesson lines
    setUi({ started: true });
    director.go(i);
  }

  const kick = new THREE.Vector3();
  const stop = stage.onUpdate((dt, time) => {
    director.update(dt);
    const voice = audio.level();
    if (env === "space") earth.update(dt);
    if (env === "town") town.update(time);
    if (env === "class") {
      const m = MOODS[mood];
      stage.grade.sat.value = approach(stage.grade.sat.value, LOOKS.interior.sat * m.sat, 1.5, dt);
      room.update(time, dt, { on: true, hall: m.hall, door: doorTarget });
      for (const p of people()) animateCharacter(p, time, dt, rnd, p === speaker ? voice : 0);
      player.rig.head.visible = !(firstPerson && cam.p.distanceTo(eye()) < 0.6);
    } else {
      room.update(time, dt, { on: false, hall: 0, door: doorTarget });
    }
    if (env === "hangar") {
      hangar.update(time, dt, voice, speaker === "nova");
      // Nova turns to whoever is watching: she hovers and sways, but around the line to the lens
      const n = hangar.nova.group, np = n.getWorldPosition(kick);
      n.rotation.y = Math.atan2(camera.position.x - np.x, camera.position.z - np.z) + Math.sin(time * 0.7) * 0.14;
      animateCharacter(captainH, time, dt, rnd, speaker === captainH ? voice : 0);
    }
    // a rumble, not noise: two slow sines per axis, fading at the same rate at any frame rate
    shake *= Math.exp(-dt * 5);
    // a tall phone frame gets a wider lens, so a shot composed for a wide screen still holds its subject
    const fov = FOV + (FOV_TALL + lensBoost - FOV) * smooth((1.5 - camera.aspect) / 0.9);
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    cam.sway = env === "class" && !firstPerson && !calm ? 1 : 0;
    cam.apply(camera, dt, time);
    if (shake > 0.001 && !calm) camera.position.add(kick.set(Math.sin(time * 41) + Math.sin(time * 67.3), Math.sin(time * 53) + Math.sin(time * 71.9), 0).multiplyScalar(shake * 0.5));
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
    dispose() { stop(); window.removeEventListener("keydown", onKey); overlay.dispose(); audio.stopVoice(); hand.group.removeFromParent(); camera.fov = FOV; camera.updateProjectionMatrix(); },
  };
}
export type Film = ReturnType<typeof mountIntro>;
