import * as THREE from "three";
import { COLOR } from "@/design/tokens";
import { audio } from "@/engine/audio";
import { CameraRig, type V3 } from "@/engine/camera";
import { Director, type Step } from "@/engine/director";
import { createOverlay, readingTime, scheduleCaptions, splitCaption } from "@/engine/overlay";
import type { Stage } from "@/engine/stage";
import { approach, clamp, ease, keyframes, seeded } from "@/engine/util";
import { prepare, warmVoice } from "@/engine/voice";
import { applyLook, LOOKS, type LookId } from "@/worlds/looks";
import { animateCharacter, ANSWERERS, cadetCloth, CAPTAIN, CLASSMATES, eyePosition, face, headPosition, makeCharacter, mix, NAMED, PLAYER, PRINCIPAL, recolour, seat, SKIN, TEACHER, type Character, type Expression } from "./cast";
import { BOARD_TEXT, buildClassroom, CHAIR_BACK, DESK_DEPTH, DESK_HEIGHT, DOOR_POINT, PLAYER_SEAT, SEAT_HEIGHT, SEATS } from "./classroom";
import { buildEarth, EARTH_RADIUS } from "./earth";
import { makeHand } from "./hand";
import { FILM_LINES, type FilmLineId } from "./lines";
import { buildHangar, PAD } from "./hangar";
import { makeRocket } from "./ships";
import { buildTown } from "./town";

/**
 * The opening film: Earth, the dive, an ordinary Tuesday, waking up in class, two quick questions,
 * the knock, the Captain, the names, the cadet picked by name, the hangar briefing, Nova, the
 * launch, and orbit. Every line is a baked Gradium Phonon clip except the cadet's name, which
 * Phonon speaks live in the teacher's voice.
 *
 * Film grammar: a new setup is a cut, and inside a setup the camera only drifts. Every setup is
 * composed for the frame it is shown in (`compose` fits its subject into the part of the frame that
 * captions and buttons leave free), so a phone held upright gets a picture of its own, not a slice
 * of the wide one. Fades are one family (eased, the colour of the void); the two exceptions are the
 * dive down through cloud at the start and the climb up through it at the end.
 *
 * The colour script: a warm gold morning in the town and the classroom; cooler from the knock, when
 * the Captain arrives; the void and gold of the hangar; the one glow of Launch; Earth below.
 */
type Env = "space" | "town" | "class" | "hangar";
interface Shot extends Step { env: Env; chapter: Chapter; firstPerson?: boolean; pick?(v: number): void; raise?(): void }
export type Chapter = "orbit" | "dive" | "wake" | "knock" | "hangar";
/** One line on screen: who says it and the words (at most two lines of them). */
export interface FilmCaption { who: string; text: string }
/**
 * What the film shows through React. `prompt.stage`: `raise` is the invitation to raise a hand, `called`
 * the hand is up and the teacher is calling on you, `choose` pick the answer. `caption` is the line being
 * spoken; `canSkip` turns true a few seconds in; `paused` is true while the tab is hidden.
 */
export interface FilmUi {
  prompt: { eq: string; options: number[]; stage: "raise" | "called" | "choose" } | null; cta: string | null; started: boolean; ended: boolean; chapter: Chapter | null;
  caption: FilmCaption | null; canSkip: boolean; paused: boolean;
}

/** One camera setup of the film, as the shot list names it. `seconds` is about how long it is on screen. */
export interface Setup { id: string; chapter: Chapter; title: string; purpose: string; seconds: number; tallOnly?: boolean }
type Op = ["go", string] | ["wait", number] | ["until", "raise" | "choose" | "answer" | "reply" | "cta" | string] | ["raise"] | ["pick", number] | ["ignite"];
/** The shot list: every setup in story order, what it is for, and how to reach it (for stills and the contact sheet). */
const SHOTS: (Setup & { how: Op[] })[] = [
  { id: "earth", chapter: "orbit", title: "Earth from orbit", purpose: "Where we are: one blue planet on the void, the frame the film will come back to", seconds: 4.6, how: [["go", "orbit"], ["wait", 2.4]] },
  { id: "dive", chapter: "dive", title: "The dive", purpose: "Down through cloud toward one town", seconds: 2.6, how: [["go", "dive"], ["wait", 1.0]] },
  { id: "town", chapter: "dive", title: "Over Maple Hill", purpose: "An ordinary morning: gold light, long shadows, the bus at the gate", seconds: 4.2, how: [["go", "town"], ["wait", 1.6]] },
  { id: "school", chapter: "dive", title: "The school door", purpose: "The crane comes to rest on the name of the place", seconds: 2.2, how: [["go", "town"], ["wait", 5.4]] },
  { id: "wake", chapter: "wake", title: "Eyes open", purpose: "We are the cadet: the desk, then the room, through sleepy eyes", seconds: 3.1, how: [["go", "wake"], ["wait", 2.8]] },
  { id: "yawn", chapter: "wake", title: "The yawn", purpose: "A hand in the cadet's own colour: this is you", seconds: 3.2, how: [["go", "yawn"], ["wait", 1.4]] },
  { id: "turn", chapter: "wake", title: "The look to the teacher", purpose: "The eyeline that hands the scene to her", seconds: 1.8, how: [["go", "turn"], ["wait", 1.6]] },
  { id: "ask", chapter: "wake", title: "The teacher asks", purpose: "Her face and the sum she has written, both lit by the window", seconds: 7, how: [["go", "q1"], ["wait", 2.6]] },
  { id: "board", chapter: "wake", title: "The sum on the board", purpose: "On a phone the question gets the frame to itself", seconds: 3, tallOnly: true, how: [["go", "q1"], ["wait", 5.6]] },
  { id: "invite", chapter: "wake", title: "The class waits", purpose: "The cadet among the class, the board ahead, one clear thing to do", seconds: 9, how: [["go", "q1"], ["until", "raise"], ["wait", 1.2]] },
  { id: "called", chapter: "wake", title: "Hand up", purpose: "The cut lands on the arm going up, in clear space", seconds: 2.5, how: [["go", "q1"], ["until", "raise"], ["wait", 0.6], ["raise"], ["wait", 0.9]] },
  { id: "choose", chapter: "wake", title: "The answer", purpose: "What the cadet is looking at: the sum, with the two answers under it", seconds: 8, how: [["go", "q1"], ["until", "raise"], ["wait", 0.6], ["raise"], ["until", "choose"], ["wait", 0.6]] },
  { id: "answer", chapter: "wake", title: "You answer", purpose: "The cadet's face as the answer comes out", seconds: 2.3, how: [["go", "q1"], ["until", "raise"], ["wait", 0.6], ["raise"], ["until", "choose"], ["wait", 0.4], ["pick", 8], ["wait", 0.9]] },
  { id: "reply", chapter: "wake", title: "She is pleased", purpose: "The teacher's happy face, and the sum finished", seconds: 3.4, how: [["go", "q1"], ["until", "raise"], ["wait", 0.6], ["raise"], ["until", "choose"], ["wait", 0.4], ["pick", 8], ["until", "reply"], ["wait", 1.2]] },
  { id: "faces", chapter: "wake", title: "The second question", purpose: "The class hears it: faces turned to the board", seconds: 2.6, how: [["go", "q2"], ["wait", 1.3]] },
  { id: "classmate", chapter: "wake", title: "A classmate answers", purpose: "Nobody is left waiting: a friend's hand goes up", seconds: 2.6, how: [["go", "q2"], ["until", "answer"], ["wait", 1.1]] },
  { id: "lesson", chapter: "wake", title: "Today's word", purpose: "Multiplication goes up on the board, over the heads of the class", seconds: 4.6, how: [["go", "mult"], ["wait", 2.4]] },
  { id: "heard", chapter: "knock", title: "The knock", purpose: "The sound first, on the faces that hear it", seconds: 1.6, how: [["go", "knock"], ["wait", 0.9]] },
  { id: "door", chapter: "knock", title: "The door", purpose: "It opens into the room and the cooler light of the hall comes in", seconds: 4, how: [["go", "knock"], ["wait", 2.9]] },
  { id: "officers", chapter: "knock", title: "The visitors", purpose: "The principal and the Captain, side by side", seconds: 6, how: [["go", "officers"], ["wait", 5.2]] },
  { id: "captain", chapter: "knock", title: "The Captain", purpose: "A steady face for a serious line", seconds: 8, how: [["go", "captain"], ["wait", 3.0]] },
  { id: "proud", chapter: "knock", title: "The teacher is proud", purpose: "Surprise, then pride", seconds: 5.5, how: [["go", "captain"], ["until", "teacher_proud"], ["wait", 3.4]] },
  { id: "names", chapter: "knock", title: "The names", purpose: "Each child stands as their name is called", seconds: 7.5, how: [["go", "names"], ["wait", 3.6]] },
  { id: "names-back", chapter: "knock", title: "The back row", purpose: "On a phone the back pair get a frame of their own", seconds: 3, tallOnly: true, how: [["go", "names"], ["wait", 5.3]] },
  { id: "picked", chapter: "knock", title: "The fifth cadet", purpose: "The cadet's name, the stand, the cheer", seconds: 6, how: [["go", "picked"], ["wait", 4.3]] },
  { id: "nave", chapter: "hangar", title: "The hangar", purpose: "A cathedral for one rocket: the aisle leads to it, the window behind draws the journey", seconds: 2.4, how: [["go", "hangar"], ["wait", 1.5]] },
  { id: "briefing", chapter: "hangar", title: "The Captain's welcome", purpose: "Gold key on his face, the rocket soft behind him", seconds: 5.5, how: [["go", "hangar"], ["until", "captain_brief1"], ["wait", 2.2]] },
  { id: "ship", chapter: "hangar", title: "Your ship", purpose: "The rocket from low down, as tall as it will ever look", seconds: 6, how: [["go", "hangar"], ["until", "captain_brief2"], ["wait", 2.4]] },
  { id: "rule", chapter: "hangar", title: "The rule", purpose: "Too few and ships slip past, too many and fuel burns: the Captain and the ship in one frame", seconds: 6, how: [["go", "hangar"], ["until", "captain_brief4"], ["wait", 2.2]] },
  { id: "nova", chapter: "hangar", title: "Nova", purpose: "Your co-pilot, close, with the one button under her", seconds: 9, how: [["go", "nova"], ["until", "cta"], ["wait", 0.8]] },
  { id: "countdown", chapter: "hangar", title: "The countdown", purpose: "Anticipation: the pad's lights come on one by one, then a held breath", seconds: 2.9, how: [["go", "nova"], ["wait", 0.4], ["ignite"], ["wait", 1.8]] },
  { id: "ignition", chapter: "hangar", title: "Ignition", purpose: "Release: the one glow in the film", seconds: 1.4, how: [["go", "nova"], ["wait", 0.4], ["ignite"], ["wait", 3.0]] },
  { id: "liftoff", chapter: "hangar", title: "Lift-off", purpose: "The camera tips back to follow the rocket up to the oculus", seconds: 2.2, how: [["go", "nova"], ["wait", 0.4], ["ignite"], ["wait", 4.45]] },
  { id: "arrive", chapter: "hangar", title: "Orbit", purpose: "The last frame, and the first of the battle: the rocket at bottom centre, Earth's horizon below", seconds: 6, how: [["go", "arrive"], ["wait", 5.6]] },
];
export const SETUPS: Setup[] = SHOTS.map(({ id, chapter, title, purpose, seconds, tallOnly }) => ({ id, chapter, title, purpose, seconds, tallOnly }));

export const SPACE_AT = new THREE.Vector3(0, 0, -6000);
const TOWN_AT = new THREE.Vector3(1500, 0, 0), HANGAR_AT = new THREE.Vector3(-1500, 0, 0);
const CLASS_CENTRE = new THREE.Vector3(0, 1, 1.2);
/** The desk in front of the cadet stands empty, so the cadet (and the camera) can see the teacher and the board. */
const EMPTY_SEAT = 1;
/** Where the teacher stands: at the left end of the board, in the light of the first window. */
const TEACHER_MARK = new THREE.Vector3(-2.1, 0, -3.75);
// the walk in: from down the hall, through the middle of the doorway, to their marks clear of the open door
const HALL = [new THREE.Vector3(7.6, 0, -3.75), new THREE.Vector3(6.1, 0, DOOR_POINT.z)];
const ARRIVE = { principal: new THREE.Vector3(4.75, 0, -2.2), captain: new THREE.Vector3(3.95, 0, -3.1) };
/** Each set picks one of the three looks; no shot sets its own background, bloom, exposure or grade. */
const LOOK_OF: Record<Env, LookId> = { space: "space", town: "interior", class: "interior", hangar: "hero" };
/**
 * The story grade inside the classroom: the ordinary Tuesday is warm and a touch muted; from the knock the
 * picture cools and its colour comes up. `hall` is how much the hallway lights the room.
 */
const MOODS = { tuesday: { sat: 0.9, hall: 0, tint: [1.035, 1.0, 0.94] }, knock: { sat: 1.04, hall: 1, tint: [0.955, 0.995, 1.06] } } as const;
/** The morning outdoors, a little more gold than the room. */
const MORNING = [1.05, 1.0, 0.92] as const;
/** One fade grammar, in seconds: out to the void, and back in. */
const FADE = { out: 0.7, in: 0.9 };
/** How long the class waits for a hand, when a classmate's goes up, and how long it waits for an answer before a classmate helps. */
const WAIT = { hand: 7.5, rival: 4.5, answer: 8, launch: 20 };
/** Skip is offered once the film has run this long. */
const SKIP_AFTER = 3;
/** The lens, in degrees of vertical field of view: for a wide screen, and for a tall phone (a wide setup, and a portrait of one person). */
const FOV = 48, FOV_TALL = 76, FOV_TALL_PORTRAIT = 50;
/** The part of the frame a subject may use, in half-frames from the centre: the bottom is the caption's, and more of it when there are buttons. */
interface Box { x0: number; x1: number; y0: number; y1: number }
const SAFE: Box = { x0: -0.84, x1: 0.84, y0: -0.54, y1: 0.8 }, WITH_BUTTONS: Box = { x0: -0.84, x1: 0.84, y0: -0.3, y1: 0.82 };
/** Where the Earth battle fights (the same point cadetBay.ts uses), and the film's last frame in front of it. */
const BAY = new THREE.Vector3(0, 34, 46);
/** The battle's opening camera and rocket (measured from Cadet Bay as it opens), without its sideways shift: straight on, the frame lifted by `lift` of its height. */
const LAST = { cam: new THREE.Vector3(0, 2.77, 10.9), rocket: new THREE.Vector3(0, 1.16, 1.8), scale: 0.55, lift: 0.12 };
const UP = new THREE.Vector3(0, 1, 0);
/** Where Nova hovers through the briefing, and where she backs away to for the launch (in the hangar's own space). */
const NOVA_HOME = new THREE.Vector3(3.2, 2.8, 0.8), NOVA_CLEAR = new THREE.Vector3(6.4, 3.3, -0.4);
const smooth = (k: number) => { k = clamp(k); return k * k * (3 - 2 * k); };
const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface IntroOptions {
  onUi?: (ui: FilmUi) => void;
  onEnd?: () => void;
  /** Does this piece of a line fit its caption plate (two lines at this screen's width)? Without it a line is cut by length. */
  fits?: (who: string, text: string) => boolean;
  /** The cadet's colour from sign-up (a token colour): the hoodie and the first-person sleeve take it. */
  colour?: string;
}

export function mountIntro(stage: Stage, { onUi, onEnd, fits, colour }: IntroOptions = {}) {
  const { scene, camera, mats: M } = stage;
  const rnd = seeded(11);
  const calm = typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  void audio.preload();
  const overlay = createOverlay(stage.container, stage.renderer.domElement);
  const cam = new CameraRig();
  // the cool fill of whichever look is on
  const hemi = new THREE.HemisphereLight(LOOKS.space.fill.sky, LOOKS.space.fill.ground, LOOKS.space.fill.intensity);
  scene.add(hemi);
  // the one light the film carries from setup to setup: a soft key from beside the lens, aimed at whoever the
  // shot is about, so the subject is the brightest thing in the frame. It casts no shadow and nothing glows
  const eyeLight = new THREE.SpotLight(LOOKS.interior.key.color, 0, 16, 1.05, 1, 2); // a wide, soft cone: its edge never draws a circle on a wall
  scene.add(eyeLight, eyeLight.target);

  const earth = buildEarth(scene, M, rnd, SPACE_AT);
  const town = buildTown(scene, M, rnd, TOWN_AT, LOOKS.interior);
  const room = buildClassroom(scene, M, rnd, LOOKS.interior);
  const hangar = buildHangar(scene, M, rnd, HANGAR_AT, LOOKS.hero);
  /** The people of the classroom, in one group, so the whole set can be put away at once. */
  const classCast = new THREE.Group();
  scene.add(classCast);

  // the last shot's own things: the rocket in orbit, and the dashed hairline it rides (the title screen's motif)
  const flight = new THREE.Group();
  flight.position.copy(SPACE_AT).add(BAY);
  flight.visible = false;
  scene.add(flight);
  const ship = makeRocket(M);
  ship.group.scale.setScalar(LAST.scale);
  flight.add(ship.group);
  {
    // a great circle round the Earth that passes through the rocket's place, so the rocket rides its orbit
    const v = BAY.clone().add(LAST.rocket), R = v.length(), a = v.clone().normalize(), b = new THREE.Vector3(1, 0.42, -0.2);
    b.addScaledVector(a, -b.dot(a)).normalize(); // tilted, so on screen it climbs away to the right across the void
    const pts = Array.from({ length: 361 }, (_, i) => { const t = (i / 360) * Math.PI * 2; return a.clone().multiplyScalar(Math.cos(t) * R).addScaledVector(b, Math.sin(t) * R).sub(BAY); });
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: mix(COLOR.approach, COLOR.void, 0.3), dashSize: 0.42, gapSize: 0.78, fog: false }));
    ring.computeLineDistances();
    flight.add(ring);
  }

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

  // the cast
  const kids: Character[] = [];
  let player!: Character;
  let j = 0;
  SEATS.forEach(([x, z], i) => {
    if (i === EMPTY_SEAT) return;
    const c = makeCharacter(i === PLAYER_SEAT ? PLAYER : CLASSMATES[j++], M, rnd);
    seat(c, x, SEAT_HEIGHT, z + CHAIR_BACK, { chair: room.chairs[i], desk: DESK_HEIGHT, edge: CHAIR_BACK - DESK_DEPTH / 2 });
    c.group.rotation.y = Math.PI;
    classCast.add(c.group);
    if (i === PLAYER_SEAT) player = c; else kids.push(c);
  });
  const teacher = makeCharacter(TEACHER, M, rnd), principal = makeCharacter(PRINCIPAL, M, rnd), captain = makeCharacter(CAPTAIN, M, rnd), captainH = makeCharacter(CAPTAIN, M, rnd);
  teacher.group.position.copy(TEACHER_MARK);
  for (const c of [teacher, principal, captain]) classCast.add(c.group);
  captainH.group.position.set(-3.9, 0, 1.8);
  captainH.group.rotation.y = 0.42;
  hangar.group.add(captainH.group);
  const people = () => [...kids, player, teacher, principal, captain];
  const everyone = () => [...people(), captainH];
  /** The hoodie and the sleeve take the colour the cadet chose. */
  const setColour = (c: string) => { const cloth = cadetCloth(c); recolour(player, cloth); hand.setSleeve(cloth); };
  if (colour) setColour(colour);

  let speaker: Character | "nova" | null = null;
  const talk = (c: Character | "nova" | null) => { speaker = c; for (const p of everyone()) p.rig.talking = p === c; };
  const headOf = (c: Character) => headPosition(c);
  /** Point a group's eyes at a spot. A character never looks at their own head: they address the room instead. */
  const gaze = (who: Character[], at: THREE.Vector3) => { for (const p of who) p.rig.look = headOf(p).distanceTo(at) < 0.4 ? CLASS_CENTRE : at; };
  /** Everyone looks at `t`; the teacher looks at `teacherAt` (the class, when she is the one talking). */
  const lookAt = (t: THREE.Vector3, teacherAt: THREE.Vector3 = t) => { gaze(people(), t); teacher.rig.look = teacherAt; };
  const feel = (who: Character[], e: Expression) => { for (const p of who) p.rig.mood = e; };
  const at = (o: THREE.Vector3, x: number, y: number, z: number): V3 => [o.x + x, o.y + y, o.z + z];
  const arr = (v: THREE.Vector3): V3 => [v.x, v.y, v.z];

  // ---- the camera ----
  /** A phone held upright: the frame is taller than it is wide, and every setup is composed again for it. */
  const tall = () => camera.aspect < 1;
  const tallness = () => smooth((1.5 - camera.aspect) / 0.9);
  /** Put a lens on for this setup, at once (a lens changes on a cut, never during a shot). */
  const lens = (kind: "wide" | "portrait" = "wide", extra = 0) => {
    const fov = FOV + ((kind === "wide" ? FOV_TALL : FOV_TALL_PORTRAIT) + extra - FOV) * tallness();
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
  };
  /** Stay inside the classroom's walls: a camera that would stand outside them comes back in along its own line of sight. */
  const inRoom = (p: THREE.Vector3) => Math.abs(p.x) < 5.55 && Math.abs(p.z) < 4.7 && p.y > 0.35 && p.y < 3.2;
  /**
   * Compose a shot: the camera looks along the line from `from` toward the middle of `pts`, and stands as
   * close as it can with every point inside `box` of the frame (so the subject fills the space that captions
   * and buttons leave free, on any screen). `ax` and `ay` slide the subject inside the box when there is
   * room to spare: 0 is the left or the bottom, 1 the right or the top.
   */
  function compose(pts: THREE.Vector3[], from: THREE.Vector3, box: Box = SAFE, o: { ax?: number; ay?: number; walls?: boolean; dir?: THREE.Vector3 } = {}) {
    const mid = pts.reduce((s, p) => s.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    // `dir` fixes the line of sight (a square-on shot); otherwise the camera looks from `from` toward the middle of the subject
    const d = (o.dir?.clone() ?? mid.clone().sub(from)).normalize(), r = new THREE.Vector3().crossVectors(d, UP).normalize(), u = new THREE.Vector3().crossVectors(r, d);
    const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), th = tv * camera.aspect;
    const A = pts.map((p) => [p.dot(r), p.dot(u), p.dot(d)]), nearest = Math.min(...A.map((a) => a[2]));
    const solve = (back: number) => {
      const cd = nearest - back;
      let x0 = -Infinity, x1 = Infinity, y0 = -Infinity, y1 = Infinity;
      for (const [a, b, c] of A) { const z = c - cd; x0 = Math.max(x0, a - box.x1 * z * th); x1 = Math.min(x1, a - box.x0 * z * th); y0 = Math.max(y0, b - box.y1 * z * tv); y1 = Math.min(y1, b - box.y0 * z * tv); }
      return x0 <= x1 && y0 <= y1 ? r.clone().multiplyScalar(x1 + (x0 - x1) * (o.ax ?? 0.5)).addScaledVector(u, y1 + (y0 - y1) * (o.ay ?? 0.5)).addScaledVector(d, cd) : null;
    };
    let lo = 0.3, hi = 90;
    for (let i = 0; i < 26; i++) { const m = (lo + hi) / 2; if (solve(m)) hi = m; else lo = m; }
    const p = solve(hi) ?? from.clone();
    if (o.walls) for (let i = 0; i < 40 && !inRoom(p); i++) p.addScaledVector(d, 0.15);
    if (env === "hangar") p.y = Math.max(p.y, HANGAR_AT.y + 0.3); // never under the deck
    return { p, d, dist: mid.distanceTo(p) };
  }
  /** The setup on screen now, so a turned phone or a resized window gets the same shot composed again. */
  let again: (() => void) | null = null, lastAspect = camera.aspect;
  /** Who the soft key is on, and how strongly. */
  let lit: (() => THREE.Vector3) | null = null, litPower = 0;
  const light = (on: (() => THREE.Vector3) | null, power = 1) => { lit = on; litPower = power; };
  /** A setup: cut to it, then drift a little closer (unless the player asked for less motion). */
  function shoot(pts: THREE.Vector3[], from: THREE.Vector3, o: { box?: Box; ax?: number; ay?: number; push?: number; speed?: number; walls?: boolean; dir?: THREE.Vector3 } = {}) {
    const { p, d, dist } = compose(pts, from, o.box, o), l = p.clone().addScaledVector(d, dist);
    cam.shot(arr(p), arr(l), 0);
    if (!calm && o.push !== 0) cam.shot(arr(p.clone().addScaledVector(d, dist * (o.push ?? 0.045))), arr(l), o.speed ?? 0.25);
  }
  const cut = (p: V3, l: V3) => cam.shot(p, l, 0);
  // what a setup frames
  const BT = BOARD_TEXT;
  const writing = () => [P(BT.x - BT.half, BT.y - 0.3, BT.z), P(BT.x + BT.half, BT.y + 0.34, BT.z)];
  /** A person from the top of the head down `down` heads, with room for the shoulders. */
  const bust = (c: Character, down = 2.3) => { const h = headOf(c), H = c.rig.H, R = Math.max(c.rig.R * 1.7, H * 1.35), y = h.y - H * down; return [P(h.x, h.y + H * 1.32, h.z), ...[y, h.y].flatMap((at) => [P(h.x - R, at, h.z), P(h.x + R, at, h.z), P(h.x, at, h.z - R), P(h.x, at, h.z + R)])]; };
  /** A whole person standing at `g`, from `low` metres up. */
  const figure = (c: Character, g: THREE.Vector3 = c.group.position, low = 0.05) => { const top = c.rig.L + c.rig.Ht + c.rig.H * 2.45, R = c.rig.R * 1.8; return [P(g.x, top, g.z), P(g.x - R, low, g.z), P(g.x + R, low, g.z), P(g.x, low, g.z - R), P(g.x, low, g.z + R)]; };
  /** A child's place in the room whether they sit or stand: the top of a standing head, and the seat. */
  const place = (c: Character) => { const s = c.rig.seat!; return [P(s.x, 1.4, s.z), P(s.x - 0.3, 0.42, s.z), P(s.x + 0.3, 0.42, s.z)]; };
  const H = HANGAR_AT;
  const inHangar = (x: number, y: number, z: number) => P(H.x + x, H.y + y, H.z + z);
  const rocketPts = (top = 7.3) => [inHangar(PAD.x - 2.5, 0.1, PAD.z), inHangar(PAD.x + 2.5, 0.1, PAD.z), inHangar(PAD.x, top, PAD.z)];
  const novaAt = new THREE.Vector3();
  const novaHead = () => hangar.nova.group.getWorldPosition(novaAt);

  // the standing setups of the film, by name. Each one is composed for the frame it is shown in
  const SETUP = {
    /** The teacher at the board with what she has written. On a phone the two do not fit one frame, so it is her face first. */
    ask: () => { if (tall()) return SETUP.teacher(); lens(); light(() => headOf(teacher), 0.9); shoot([...figure(teacher, TEACHER_MARK, 0.62), ...writing()], P(0, 1.5, 0), { walls: true, dir: P(0.3, -0.03, -1) }); },
    /** The teacher, close: for her own lines. */
    teacher: (from = P(-1.1, 1.5, -1.0)) => { lens("portrait"); light(() => headOf(teacher), 1); shoot(bust(teacher, tall() ? 3.6 : 3.3), from, { walls: true }); },
    /** The writing on the board, as the cadet sees it from their seat. With `buttons` it sits high, clear of the answers. */
    board: (buttons = false) => { lens(); light(null); shoot(tall() ? writing() : [...writing(), ...bust(teacher, 3)], P(0.3, 1.05, 1.0), { box: buttons ? WITH_BUTTONS : SAFE, walls: true, push: buttons ? 0 : undefined, dir: P(0.14, -0.02, -1) }); },
    /** The class from behind, the cadet in the middle of the frame and the board ahead: where the invitation to raise a hand appears. */
    invite: () => {
      lens(); light(null);
      // a phone looks down the room from high at the back: the sum above, the cadet's head under it, the button under that
      if (tall()) { cut([0.15, 2.6, 4.55], [0.3, 1.15, -3]); if (!calm) cam.shot([0.15, 2.55, 4.3], [0.3, 1.15, -3], 0.2); return; }
      const h = headOf(player); shoot([P(h.x, h.y + 0.3, h.z), P(h.x - 0.3, 0.36, h.z), P(h.x + 0.3, 0.36, h.z), ...writing(), ...(tall() ? [] : bust(teacher, 1.5))], P(0.5, 2.4, 6), { box: WITH_BUTTONS, walls: true, push: 0.02, dir: P(tall() ? -0.03 : -0.1, -0.3, -1) }); },
    /** The cadet from the front, on the side of the raised arm, so the hand goes up in clear space above the shoulder. */
    called: () => { lens("portrait"); light(() => headOf(player), 1); const h = headOf(player), H = player.rig.H; shoot([...bust(player, 2.1), P(h.x - 0.34, h.y + H * 3.1, h.z)], P(h.x - 0.55, h.y + 0.25, h.z - 1.9), { box: WITH_BUTTONS, walls: true }); },
    /** One child's face, from the front and a little to the side. */
    child: (c: Character, side = 1) => { lens("portrait"); light(() => headOf(c), 1); const h = headOf(c); shoot(bust(c, 2.5), P(h.x + side * 0.85, h.y + 0.14, h.z - 1.5), { walls: true }); },
    /** The class from the board side: faces turned to the teacher. On a phone, the cadet and the classmate who will answer. */
    faces: () => { if (tall()) return SETUP.child(player, -1); lens(); light(() => headOf(player), 0.7); shoot([...kids, player].flatMap((k) => bust(k, 1.6)), P(-4.4, 1.45, -4.2), { walls: true }); }, // on a phone it is the cadet's own face, listening
    /** The class from the door side, as the knock turns every head this way. */
    heard: () => { lens(); light(() => headOf(player), 0.7); shoot((tall() ? [kids[NAMED[1]], player, kids[NAMED[2]]] : [...kids, player]).flatMap((k) => bust(k, 1.6)), tall() ? P(4.6, 1.7, -2.6) : P(4.9, 1.45, -3.9), { walls: true }); },
    /** Over the class to the board: today's word is up there. */
    lesson: () => {
      lens(); light(() => headOf(teacher), 0.8);
      if (tall()) { cut([0.15, 2.3, 4.5], [0.3, 1.4, -3]); if (!calm) cam.shot([0.15, 2.25, 4.2], [0.3, 1.4, -3], 0.2); return; }
      shoot([...writing(), ...figure(teacher, TEACHER_MARK, 0.9), P(0, 1.22, 1.1)], P(0, 1.6, 4), { walls: true, dir: P(0.14, -0.1, -1) });
    },
    door: () => { lens(); light(null); shoot([P(6, 0.25, -4.3), P(6, 2.5, -2.8)], P(0.9, 1.45, -1.7), { walls: true, push: 0.06 }); },
    /** The principal and the Captain on their marks, clear of the open door. */
    officers: (glide = false) => {
      lens(); light(() => headOf(captain).lerp(headOf(principal), 0.5), 0.9);
      const pts = [...figure(principal, ARRIVE.principal, 0.6), ...figure(captain, ARRIVE.captain, 0.6)], from = P(1.4, 1.5, -1.6);
      if (!glide) return shoot(pts, from, { walls: true });
      const { p, d, dist } = compose(pts, from, SAFE, { walls: true });
      cam.shot(arr(p), arr(p.clone().addScaledVector(d, dist)), calm ? 0 : 0.7); // no cut: the door shot widens to hold them both as they walk in
    },
    captain: () => { lens("portrait"); light(() => headOf(captain), 1); shoot(bust(captain, 2.8), P(3.0, 1.62, -2.0), { walls: true }); }, // square on to him, the open door and the hall behind
    /** The class from beside the teacher as she calls the names: every face, and room above each head to stand up into. */
    names: () => { lens(); light(null); shoot([...kids.flatMap(place), ...place(player)], P(-4.2, 2.1, -4.7), { walls: true, push: 0.02 }); },
    /** Two of the named children, for a phone. */
    pair: (a: Character, b: Character, from: THREE.Vector3) => { lens("wide", 8); light(null); shoot([...place(a), ...place(b)], from, { walls: true, push: 0.02 }); },
    // the hangar
    /** Down the aisle to the rocket, square on: the vault's ribs and the round window behind it. */
    nave: () => { lens(); light(null); shoot([...rocketPts(8.4), inHangar(0, 13.6, -17.5), ...(tall() ? [] : [inHangar(-4.4, 0.1, 1.8)])], inHangar(0, 1.25, 17), { push: 0.03, speed: 0.2 }); },
    hCaptain: () => { lens("portrait"); light(() => headOf(captainH), 1.4); shoot(bust(captainH, 2.7), inHangar(-2.1, 1.8, 5.6)); },
    /** The rocket from low down, three-quarters on. */
    ship: () => { lens(); light(null); const n = novaHead(); shoot(tall() ? [...rocketPts(7.4), P(n.x + 0.7, n.y, n.z)] : rocketPts(7.4), inHangar(tall() ? 3.2 : 5.2, 0.7, 7.6), { push: 0.05, speed: 0.15 }); },
    /** The Captain and the ship he is talking about, in one frame. */
    rule: () => { lens(); light(() => headOf(captainH), 1.2); shoot([...figure(captainH, captainH.group.getWorldPosition(new THREE.Vector3()), 0.5), ...rocketPts(6.5)], tall() ? inHangar(-6.5, 1.5, 6.5) : inHangar(-3.0, 1.5, 9.6)); }, // on a phone he stands in front of the ship, not beside it
    /** Nova, close, the ship behind her. With `button` she sits high, clear of Launch. */
    nova: (button = false) => { lens("portrait"); light(novaHead, 0.3); // her shell is white: a little light goes a long way, and she must never bloom
      const n = novaHead(); shoot([P(n.x - 0.85, n.y + 0.62, n.z), P(n.x + 0.85, n.y - 0.6, n.z)], P(n.x + 1.5, n.y + 0.25, n.z + 4.6), { box: button ? WITH_BUTTONS : SAFE, push: button ? 0 : 0.04 }); },
    /** Low on the aisle for the countdown: the pad's lights and the whole height of the rocket. */
    countdown: () => { lens(); light(null); shoot([inHangar(PAD.x - 3.5, 0.02, PAD.z), inHangar(PAD.x + 3.5, 0.02, PAD.z), inHangar(PAD.x, 7.6, PAD.z)], inHangar(0.0, 0.75, 12), { push: 0.07, speed: 0.5 }); },
    /** Close and low at the pad, for the fire. */
    ignition: () => { lens(); light(null); shoot([inHangar(PAD.x - 3.1, 0.05, PAD.z), inHangar(PAD.x + 3.1, 0.05, PAD.z), inHangar(PAD.x, 4.2, PAD.z)], inHangar(1.3, 0.45, 5.8), { push: 0 }); }, // nearly square on: the Captain is off to the left, and Nova has backed away to the right
  };
  /** Show a setup, and remember it so a turned phone gets it composed again. */
  const show = (fn: () => void) => { again = fn; fn(); };

  // ui published to React (the caption, the choices, the launch button, Skip)
  let ui: FilmUi = { prompt: null, cta: null, started: false, ended: false, chapter: null, caption: null, canSkip: false, paused: false };
  const setUi = (p: Partial<FilmUi>) => { ui = { ...ui, ...p }; onUi?.(ui); };

  // the cadet's name: spoken live by Phonon in the teacher's voice, prepared while the film plays
  let cadet = "", nameLine: AudioBuffer | null = null;

  // ---- words on screen ----
  /** Seconds of film played since Play: captions and Skip keep this clock, which stops with the stage. */
  let played = 0;
  /** A caption may not leave the screen before this (its reading time); a caption waiting to go leaves at `clearAt`. */
  let floor = 0, clearAt = Infinity;
  let line: { who: string; pieces: string[]; starts: number[]; t0: number; i: number } | null = null;
  /** What is being said now (the id of a baked line), so a still can be taken at a known word. */
  let saying = "";
  const fit = (who: string, t: string) => (fits ? fits(who, t) : t.length <= 84);
  const put = (who: string, text: string) => { setUi({ caption: text ? { who, text } : null }); if (text) floor = played + readingTime(text); };
  /** Put a line on screen, in as many captions as it needs; returns how long it holds the screen. */
  function say(who: string, text: string, spoken: number) {
    const pieces = splitCaption(text, (t) => fit(who, t)), { starts, hold } = scheduleCaptions(pieces, spoken);
    line = { who, pieces, starts, t0: played, i: -1 };
    clearAt = Infinity;
    captions();
    return hold;
  }
  /** The caption goes, once it has had its reading time. */
  const hush = () => { line = null; clearAt = Math.max(played, floor); };
  function captions() {
    if (line) {
      let k = 0;
      while (k + 1 < line.starts.length && played - line.t0 >= line.starts[k + 1] - 1e-4) k++;
      if (k !== line.i) { line.i = k; put(line.who, line.pieces[k]); }
    }
    if (played >= clearAt) { clearAt = Infinity; if (ui.caption) put("", ""); }
  }

  // environments: four sets far apart in one scene; switching changes the look, the light rig and which set is drawn
  let env: Env | null = null, mood: keyof typeof MOODS = "tuesday", firstPerson = false, doorTarget = 0, shake = 0;
  let fade = 0, fadeColor: string = COLOR.void, lids = 1, blur = 0;
  const tint = new THREE.Vector3(1, 1, 1), tintTo = new THREE.Vector3(1, 1, 1), NEUTRAL = [1, 1, 1] as const;
  const grade = (t: readonly [number, number, number]) => tintTo.set(t[0], t[1], t[2]);
  const shadowLights = [...room.shadows, ...town.shadows, ...hangar.shadows];
  function setEnv(e: Env) {
    env = e;
    const space = e === "space", tw = e === "town", cls = e === "class", hg = e === "hangar";
    const look = applyLook(stage, LOOK_OF[e]);
    // only the set on screen is drawn, and only its lights spend a shadow pass. The lights themselves all stay
    // in the scene at strength 0, so a change of set never changes the light count (which would rebuild every shader)
    earth.group.visible = space; town.group.visible = tw; room.room.visible = classCast.visible = cls; hangar.group.visible = hg;
    const live = cls ? room.shadows : tw ? town.shadows : hg ? hangar.shadows : [];
    for (const l of shadowLights) { l.shadow.autoUpdate = live.includes(l) && !tw; l.shadow.needsUpdate = live.includes(l); } // the town does not move: one pass is enough
    scene.fog = tw ? town.fog : null;
    camera.far = space ? 3000 : tw ? 900 : 160;
    camera.near = space || tw ? 0.5 : 0.02; // nothing is near the lens outdoors, and a deeper near plane keeps far surfaces from fighting
    camera.updateProjectionMatrix();
    hemi.color.setHex(look.fill.sky);
    hemi.groundColor.setHex(look.fill.ground);
    hemi.intensity = look.fill.intensity * (hg ? 0.8 : 1);
    eyeLight.color.setHex(look.key.color);
    earth.sun.color.setHex(look.key.color);
    earth.sun.intensity = space ? look.key.intensity : 0;
    town.sun.intensity = tw ? look.key.intensity * 0.62 : 0;
    hangar.lights(hg);
    light(null);
    grade(tw ? MORNING : cls ? MOODS[mood].tint : NEUTRAL);
    tint.copy(tintTo);
    stage.grade.tint.value.copy(tint);
    stage.grade.sat.value = look.sat * (cls ? MOODS[mood].sat : 1);
  }
  const fadeOut = (t: number, from: number, d = FADE.out) => smooth((t - from) / d);
  const fadeIn = (t: number, d = FADE.in) => 1 - smooth(t / d);

  const S = SPACE_AT, T = TOWN_AT;
  const eye = () => eyePosition(player);
  const lidCurve = keyframes([[0, 0], [0.55, 0], [1.1, 0.4], [1.45, 0.1], [2.05, 0.65], [2.35, 0.3], [2.9, 1]]);

  /** A breath between two lines of dialogue, measured from where the words stop. */
  const GAP = 0.55;
  type Who = Character | "nova" | null;
  /** Speak one baked line (or a live buffer): `len` is how long until the words stop, `hold` how long its captions need the screen. */
  const speak = (id: string, who: string, c: Who, live?: AudioBuffer | null, text?: string) => {
    talk(c);
    saying = id;
    let len: number;
    if (live) { void audio.play(live); len = audio.spokenLength(live); }
    else { void audio.say(id); len = audio.spoken(id); }
    return { len, hold: say(who, text ?? FILM_LINES[id as FilmLineId] ?? audio.text(id), len) };
  };

  interface Beat { id: string; who: string; c: () => Who; gap?: number; go?: () => void; live?: () => AudioBuffer | null; text?: () => string; after?: (t: number, start: number, len: number) => void }
  /**
   * Lines spoken one after another: each waits for the last one's words to stop and its caption to be
   * read, plus a breath (`gap`, default GAP); mouths close in the pauses; and the step ends `tail`
   * seconds after the last line. Nothing is ever cut off by the next shot.
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
          const s = speak(b.id, b.who, b.c(), b.live?.(), b.text?.());
          len = s.len;
          next = t + s.hold + (beats[i + 1]?.gap ?? GAP);
          if (i === beats.length - 1) endAt = t + Math.max(s.len + tail, s.hold + 0.2);
        }
      },
      done: (t: number) => t >= endAt,
    };
  }

  /**
   * A classroom question: the teacher asks and finishes; then the class waits for a hand (Space or
   * the button). Raise yours and it goes up at once, she calls on you, and the two answers appear
   * under the sum. Wait, at either point, and a classmate's hand goes up and they answer: nobody is
   * left stuck, and nobody is told off. The teacher replies after a breath.
   */
  let phaseNow = "";
  function question(o: { name: string; eq: string; answer: number; options: number[]; ask: string; kid: number; kidClip: string; ok: string; close: string; open: () => void; during?: (since: number, len: number) => void }): Shot {
    type Phase = "ask" | "raise" | "called" | "choose" | "answer" | "reply" | "done";
    let phase: Phase = "ask", at0 = 0, len = 0, hold = 0, result: "right" | "close" | "classmate" = "right", keen = false;
    const to = (p: Phase) => { phase = p; phaseNow = p; at0 = director.t; };
    const prompt = (stage: "raise" | "called" | "choose") => setUi({ prompt: { eq: o.eq, options: o.options, stage } });
    const shot: Shot = {
      name: o.name, env: "class", chapter: "wake",
      enter() {
        phase = "ask"; phaseNow = "ask"; at0 = 0; keen = false;
        room.write(o.eq);
        feel(people(), "neutral");
        lookAt(headOf(teacher), CLASS_CENTRE);
        ({ len, hold } = speak(o.ask, "Teacher", teacher));
        o.open();
      },
      update(t) {
        const since = t - at0;
        if (since >= len && speaker !== null && phase !== "raise" && phase !== "choose") talk(null);
        if (phase === "ask") {
          o.during?.(since, len);
          if (since >= hold + 0.3) {
            to("raise");
            talk(null);
            hush(); // the question is on the board and in the invitation now
            prompt("raise");
            show(SETUP.invite);
          }
        } else if (phase === "raise") {
          if (since > WAIT.rival && !keen) { keen = true; kids[o.kid].rig.raise = true; kids[o.kid].rig.mood = "happy"; } // someone else is keen too
          if (since >= WAIT.hand) classmate();
        } else if (phase === "called" && since >= hold + 0.2) {
          to("choose");
          hush();
          prompt("choose");
          show(() => SETUP.board(true)); // what the cadet is looking at: the sum, with the answers under it
        } else if (phase === "choose" && since >= WAIT.answer) classmate(); // a long think: a classmate helps out
        else if (phase === "answer" && since >= hold + GAP) {
          to("reply");
          for (const p of people()) p.rig.raise = false;
          room.write(o.eq.replace("?", String(o.answer)));
          lookAt(headOf(teacher), CLASS_CENTRE);
          feel([teacher], "happy");
          ({ len, hold } = speak(result === "close" ? o.close : o.ok, "Teacher", teacher));
          show(SETUP.ask);
        } else if (phase === "reply" && since >= Math.max(len + 0.8, hold + 0.2)) to("done");
      },
      done: () => phase === "done",
    };
    function classmate() {
      to("answer");
      setUi({ prompt: null });
      result = "classmate";
      const who = kids[o.kid];
      player.rig.raise = false;
      who.rig.raise = true;
      who.rig.mood = "happy";
      lookAt(headOf(who));
      who.rig.look = headOf(teacher);
      ({ len, hold } = speak(o.kidClip, "Classmate", who));
      show(() => SETUP.child(who, who.group.position.x > 0 ? -1 : 1));
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
      feel([teacher], "happy"); // she is glad of the hand, and waits kindly for the answer
      ({ len, hold } = speak("teacher_yes", "Teacher", teacher));
      show(SETUP.called); // the cut lands on the arm going up
    };
    shot.pick = (v: number) => {
      if (phase !== "choose" || director.current !== shot) return;
      to("answer");
      setUi({ prompt: null });
      result = v === o.answer ? "right" : "close";
      audio.sfx(result === "right" ? "blip_ok" : "blip_close");
      talk(player);
      saying = "you";
      player.rig.mime = true; // the cadet's own answer has no recording to follow
      player.rig.mood = result === "right" ? "happy" : "thinking";
      len = 1.1;
      hold = say("You", result === "right" ? `${v}!` : `${v}?`, len);
      show(() => SETUP.child(player, 1));
    };
    return shot;
  }

  let boardCut = false;
  const q1 = question({ name: "q1", eq: "4 + 4 = ?", answer: 8, options: [8, 9], ask: "teacher_intro", kid: ANSWERERS[0], kidClip: "kid_eight", ok: "teacher_eight_ok", close: "teacher_eight_close",
    open: () => { boardCut = false; show(SETUP.ask); },
    // a phone cannot hold her and the sum in one frame: her face for the first half of the line, then the sum
    during: (since, len) => { if (tall() && !boardCut && since > len * 0.56) { boardCut = true; show(() => SETUP.board()); } } });
  const q2 = question({ name: "q2", eq: "5 − 3 = ?", answer: 2, options: [3, 2], ask: "teacher_q2", kid: ANSWERERS[1], kidClip: "kid_two", ok: "teacher_two_ok", close: "teacher_two_close", open: () => show(SETUP.faces) }); // the class hears the second one

  /** A step that is nothing but dialogue (plus its own camera and staging in `enter`). */
  const talkShot = (s: Omit<Shot, "update" | "done"> & { beats: Beat[]; lead?: number; tail?: number; extra?: (t: number) => void }): Shot => {
    const dl = dialogue(s.beats, { lead: s.lead, tail: s.tail });
    return { ...s, enter() { dl.begin(); s.enter?.(); }, update(t) { dl.update(t); s.extra?.(t); }, done: dl.done };
  };
  const T_ = () => teacher, CAP = () => captain, CAPH = () => captainH, PR = () => principal;
  const named = () => NAMED.map((k) => kids[k]);
  let diveFrom = new THREE.Vector3(), cardShown = false, backPair = false, novaLen = 4, novaHold = 4, ctaAt = 0, launchCut = 0;
  const turnFrom = new THREE.Vector3();
  /** The launch, in seconds from the press: three beats of lights, a held breath, the fire, the climb, the cloud. */
  const LAUNCH = { beat: 0.7, breath: 2.0, fire: 2.5, lift: 3.3, cloud: 4.85, end: 5.75 };
  /** The last shot: the cloud clears, the rocket climbs to its place, the title holds, and the frame is left clean. */
  const ARRIVAL = { clear: 1.0, settle: 3.0, card: [1.1, 4.5] as const, end: 5.9 };
  /** Put the last frame on screen exactly as the film leaves it (the battle opens on this frame, and Skip lands here). */
  let framed = false;
  const unframe = () => { if (framed) { framed = false; camera.clearViewOffset(); } };
  function lastFrame() {
    flight.visible = true;
    ship.group.position.copy(LAST.rocket);
    ship.flicker(stage.time, 0.55);
    // the battle's lens and its lifted frame, whatever the screen: the rocket sits at bottom centre
    if (camera.fov !== FOV) { camera.fov = FOV; camera.updateProjectionMatrix(); }
    const W = stage.container.clientWidth || 1, Hh = stage.container.clientHeight || 1;
    camera.setViewOffset(W, Hh, 0, -LAST.lift * Hh, W, Hh);
    framed = true;
    const c = SPACE_AT.clone().add(BAY).add(LAST.cam);
    cut(arr(c), [c.x, c.y, c.z - 10]);
    fade = 0; lids = 1; blur = 0; shake = 0;
    overlay.card("", "");
  }

  const steps: Shot[] = [
    { name: "orbit", env: "space", chapter: "orbit", d: 4.6,
      enter() { audio.mood("space"); lids = 1; hush(); lens(); overlay.card("", "Earth", "An ordinary blue planet", "low"); again = null; cut(at(S, -14, 9, 150), at(S, 0, 0, 0)); if (!calm) cam.shot(at(S, 10, 6, 128), at(S, 0, 0, 0), 0.55); },
      update(t) { fadeColor = COLOR.void; fade = fadeIn(t); if (t > 3.7) overlay.card("", ""); } },
    { name: "dive", env: "space", chapter: "dive", d: 2.6,
      // the plunge starts from wherever the orbit left the camera, so there is no jump at the cut
      enter() { overlay.card("", ""); audio.sfx("dive"); cam.hold(); diveFrom = cam.p.clone(); },
      update(t) {
        const k = clamp(t / 2.6), e = calm ? 0 : k * k; // gathers speed from the first frame, fastest at the cloud (and stays put for less motion)
        cam.p.set(diveFrom.x + (S.x - diveFrom.x) * e, diveFrom.y + (S.y + 3 - diveFrom.y) * e, diveFrom.z + (S.z + EARTH_RADIUS + 10 - diveFrom.z) * e);
        cam.l.set(S.x, S.y + 2 * e, S.z);
        fadeColor = COLOR.approach; fade = fadeOut(t, 1.3, 0.85); // into the cloud, which closes before the ground rushes up
      } },
    { name: "town", env: "town", chapter: "dive", d: 6.6,
      // wide over the rooftops, then down to the gate, square on to the porch so the school's name reads in full
      enter() { audio.sfx("chime"); lens(); overlay.card("", "An ordinary Tuesday", "8:42 in the morning", "top"); again = null; cut(at(T, 34, 23, 56), at(T, 0, 4, 2)); cam.hold(); },
      update(t) {
        // one eased crane down from over the rooftops: slow away, gentle in, then it rests on the sign.
        // For less motion it is two still frames instead: the town, then the door
        const k = calm ? (t < 3.6 ? 0 : 1) : smooth(t / 4.3), far = tall() ? 19.5 : 16.2;
        cam.p.set(T.x + 34 * (1 - k), 23 + (2.35 - 23) * k, 56 + (far - 56) * k);
        cam.l.set(T.x, 4 + (3.45 - 4) * k, 2 + (5.9 - 2) * k);
        if (t > 3.9) overlay.card("", ""); // the sign gets the frame to itself
        if (t < 1) { fadeColor = COLOR.approach; fade = fadeIn(t, 1); }
        else if (t > 6.6 - FADE.out) { fadeColor = COLOR.void; fade = fadeOut(t, 6.6 - FADE.out); }
        else fade = 0;
      } },
    { name: "wake", env: "class", chapter: "wake", firstPerson: true, d: 3.1,
      enter() {
        audio.mood("classroom"); fade = 0; overlay.card("", ""); hush();
        mood = "tuesday"; doorTarget = 0;
        room.write("4 + 4 = ?");
        feel(people(), "neutral");
        lookAt(headOf(teacher), CLASS_CENTRE);
        lens(); light(null); again = null;
        const e = eye();
        cut([e.x, e.y, e.z], [e.x, 0.45, e.z - 1.0]);
        lids = 0; blur = 8;
      },
      update(t) {
        lids = lidCurve(t); blur = Math.max(0, 8 * (1 - t / 2.2));
        // eyes open on the desk, then lift toward the front of the room
        const e = eye(), up = smooth((t - 1.2) / 1.9);
        cam.p.copy(e);
        cam.l.set(e.x + (calm ? 0 : Math.sin(t * 0.9) * 0.06 * (1 - up)), 0.45 + up * 0.75, e.z - 1.0 - up * 1.5); // the drowsy drift is gone by the time the head is up
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
      update(t) { const e = eye(), k = smooth(t / 1.3); cam.p.copy(e); cam.l.set(turnFrom.x + (TEACHER_MARK.x + 0.3 - turnFrom.x) * k, turnFrom.y + (1.5 - turnFrom.y) * k, turnFrom.z + (-4.05 - turnFrom.z) * k); } },
    q1,
    q2,
    talkShot({ name: "mult", env: "class", chapter: "wake", lead: 0.3, tail: 0.9,
      enter() { room.write("× Multiplication"); feel(people(), "neutral"); feel([teacher], "happy"); lookAt(headOf(teacher), CLASS_CENTRE); show(SETUP.lesson); },
      beats: [{ id: "teacher_mult", who: "Teacher", c: T_ }] }),
    { name: "knock", env: "class", chapter: "knock", d: 4.1,
      // the sound first, on the faces that hear it; then the door, as it opens
      enter() { talk(null); saying = "knock"; say("", "Knock, knock, knock.", 1.0); audio.sfx("knock"); shake = 0.025; feel(people(), "oops"); lookAt(DOOR_POINT); show(SETUP.heard); },
      update(t) {
        if (t > 1.6 && doorTarget === 0) { doorTarget = 1; mood = "knock"; grade(MOODS.knock.tint); audio.sfx("door"); audio.mood("heroic"); show(SETUP.door); }
        if (t > 2.3) feel(people(), "neutral");
        if (t > 2.6) hush();
      } },
    talkShot({ name: "officers", env: "class", chapter: "knock", lead: 2.3, tail: 0.5,
      enter() {
        doorTarget = 1; mood = "knock"; grade(MOODS.knock.tint);
        for (const [c, to, delay] of [[principal, ARRIVE.principal, 0], [captain, ARRIVE.captain, 0.35]] as const) {
          c.group.visible = true;
          c.group.position.copy(HALL[0]);
          face(c.group, HALL[1]);
          c.rig.walk = { pts: [HALL[0], HALL[1], to], t0: stage.time + delay, d: 2.1, face: CLASS_CENTRE };
          c.rig.look = CLASS_CENTRE;
        }
        gaze([...kids, player, teacher], new THREE.Vector3(4.6, 1.5, -2.7));
        again = () => SETUP.officers();
        SETUP.officers(true);
      },
      beats: [
        { id: "principal_sorry", who: "Principal", c: PR, go: () => { feel([principal], "happy"); gaze([...kids, player, teacher], headOf(principal)); } },
        { id: "principal_intro", who: "Principal", c: PR, go: () => { principal.rig.look = headOf(captain); gaze([...kids, player, teacher], headOf(captain)); } },
      ] }),
    talkShot({ name: "captain", env: "class", chapter: "knock", lead: 0.35, tail: 0.6,
      enter() { lookAt(headOf(captain)); captain.rig.look = CLASS_CENTRE; principal.rig.look = headOf(captain); feel([principal], "neutral"); show(SETUP.captain); },
      beats: [
        { id: "captain_danger", who: "Captain", c: CAP },
        // the teacher answers, surprised and then proud; then the Captain asks her to name them
        { id: "teacher_proud", who: "Teacher", c: T_, gap: 0.7, go: () => { lookAt(headOf(teacher), headOf(captain)); captain.rig.look = headOf(teacher); feel([teacher], "oops"); show(() => SETUP.teacher(P(0.2, 1.5, -1.5))); },
          after: (t, start, len) => { if (t > start + len * 0.45) feel([teacher], "happy"); } },
        { id: "captain_names", who: "Captain", c: CAP, gap: 0.5, go: () => { lookAt(headOf(captain)); captain.rig.look = headOf(teacher); show(SETUP.captain); } },
      ] }),
    talkShot({ name: "names", env: "class", chapter: "knock", lead: 0.4, tail: 1.5,
      enter() {
        backPair = false;
        lookAt(headOf(teacher), CLASS_CENTRE); gaze([captain, principal], CLASS_CENTRE); feel([teacher], "happy");
        // a phone held upright cannot hold the whole room: the front pair is seen from the corner by the board as
        // Maya and Leo rise, then a cut to the back pair, from high over the middle row, as Aarav and Zoe do
        show(() => (tall() ? SETUP.pair(named()[0], named()[1], P(-5.2, 2.2, -4.5)) : SETUP.names()));
      },
      beats: [{ id: "teacher_names", who: "Teacher", c: T_, after: (t, start, len) => {
        // the four names fill the last half of the line: each child stands as theirs is called
        named().forEach((kid, i) => {
          if (t > start + len * (0.47 + i * 0.13) && kid.rig.stand === 0) {
            kid.rig.stand = 1; kid.rig.mood = "happy"; kid.rig.look = headOf(teacher); teacher.rig.look = headOf(kid); gaze(kids.filter((k) => k.rig.stand === 0), headOf(kid));
          }
        });
        if (!backPair && t > start + len * (0.47 + 2 * 0.13) - 0.15) { backPair = true; if (tall()) show(() => (tall() ? SETUP.pair(named()[2], named()[3], P(-1.3, 3.0, -2.9)) : SETUP.names())); }
      } }] }),
    talkShot({ name: "picked", env: "class", chapter: "knock", lead: 0.5, tail: 7.7,
      enter() {
        cardShown = false;
        lookAt(headOf(player));
        player.rig.look = headOf(teacher);
        show(() => SETUP.child(player, 1));
      },
      beats: [{ id: "teacher_pick_generic", who: "Teacher", c: T_, live: () => nameLine, text: () => `And our fifth cadet is… ${cadet || "you"}!`,
        go: () => audio.sfx("fanfare"),
        after: (t, start, len) => {
          if (t > start + len * 0.8 && player.rig.stand === 0) { player.rig.stand = 1; player.rig.mood = "happy"; }
          // the camera stays on the cadet as they rise and holds the whole cheer: both hands stay in the frame
          if (player.rig.s > 0.02) {
            const h = headOf(player), H = player.rig.H, up = player.rig.cheer;
            lens("portrait");
            const { p, d, dist } = compose([...bust(player, 2.4), P(h.x - 0.36, h.y + H * (1.4 + 1.9 * up), h.z), P(h.x + 0.36, h.y + H * (1.4 + 1.9 * up), h.z)], P(h.x + 0.85, h.y - 0.1, h.z - 1.5), SAFE, { walls: true });
            cam.shot(arr(p), arr(p.clone().addScaledVector(d, dist)), calm ? 0 : 5);
          }
          if (player.rig.s > 0.9) player.rig.mood = "cheer";
          // out to the void, and the cadet's new name on it
          const out = start + Math.max(len + 2.0, readingTime(`And our fifth cadet is ${cadet || "you"}!`) + 0.2);
          if (t > out) { fadeColor = COLOR.void; fade = fadeOut(t, out); hush(); }
          if (t > out + FADE.out && !cardShown) { cardShown = true; overlay.card("", `Cadet ${cadet || "you"}`, "Next stop: the Star Fleet hangar"); }
          if (t > out + FADE.out + 4.3) overlay.card("", "");
        } }] }),
    talkShot({ name: "hangar", env: "hangar", chapter: "hangar", lead: 1.9, tail: 0.5,
      enter() { hangar.reset(); hangar.nova.express("neutral"); overlay.card("", ""); hush(); audio.mood("hangar"); captainH.rig.look = null; show(SETUP.nave); },
      extra(t) { fadeColor = COLOR.void; fade = fadeIn(t - 0.2); },
      beats: [
        { id: "captain_brief1", who: "Captain", c: CAPH, go: () => show(SETUP.hCaptain) }, // in to the Captain
        { id: "captain_brief2", who: "Captain", c: CAPH, gap: 0.6, go: () => show(SETUP.ship) }, // the ship he is talking about
        { id: "captain_brief3", who: "Captain", c: CAPH, gap: 0.6, go: () => show(SETUP.hCaptain) },
        { id: "captain_brief4", who: "Captain", c: CAPH, gap: 0.5, go: () => show(SETUP.rule) },
        { id: "captain_nova", who: "Captain", c: CAPH, gap: 0.7, go: () => { show(SETUP.hCaptain); }, after: (t, start, len) => { if (t > start + len * 0.55) captainH.rig.look = novaHead().clone(); } },
      ] }),
    { name: "nova", env: "hangar", chapter: "hangar", d: Infinity,
      enter() { audio.sfx("nova_chirp"); hangar.set({ lamps: 0, burn: 0, rise: 0 }); hangar.nova.express("happy"); ctaAt = 0; ({ len: novaLen, hold: novaHold } = speak("nova_hi", "Nova", "nova")); show(() => SETUP.nova(!!ui.cta)); },
      update(t) {
        if (t >= novaLen && speaker !== null) talk(null);
        if (t > novaHold + 0.3 && !ui.cta) { hush(); ctaAt = t; setUi({ cta: "Launch" }); show(() => SETUP.nova(true)); }
        // a cadet who never presses it is carried along: Nova launches for them
        if (ctaAt && t > ctaAt + WAIT.launch) director.go(director.find("launch"));
      } },
    { name: "launch", env: "hangar", chapter: "hangar", d: LAUNCH.end,
      enter() { talk(null); line = null; clearAt = Infinity; if (ui.caption) put("", ""); setUi({ cta: null }); hangar.nova.express("cheer"); launchCut = 0; show(SETUP.countdown); },
      update(t, dt) {
        const L = LAUNCH;
        // anticipation: the pad's lights come on in three beats, then everything holds its breath
        const beats = Math.min(3, Math.floor(t / L.beat) + 1);
        if (t < L.breath && beats > launchCut) { launchCut = beats; audio.sfx("blip_ok"); }
        const burn = smooth((t - L.fire) / 0.55), up = Math.max(0, t - L.lift);
        hangar.set({ lamps: Math.min(1, beats / 3), burn, rise: 1.5 * up * up + 0.9 * up * up * up });
        // Nova backs away from the pad as the lights come on: the fire gets the frame to itself
        hangar.nova.group.position.lerp(NOVA_CLEAR, Math.min(1, dt * 2.2));
        // release: cut in close on the fire, then tip back to follow the rocket up
        if (t >= L.fire && launchCut < 4) { launchCut = 4; audio.sfx("ignition"); audio.sfx("fanfare"); shake = 0.07; again = null; SETUP.ignition(); cam.hold(); }
        if (launchCut === 4) {
          if (t < L.lift + 1.2) shake = Math.max(shake, 0.045 * (1 - (t - L.fire) / (L.lift + 1.2 - L.fire)));
          const rise = 1.5 * up * up + 0.9 * up * up * up, follow = calm ? Math.min(rise, 3) : rise;
          cam.l.lerp(inHangar(PAD.x, 2.0 + follow * 0.92, PAD.z), 0.12);
        }
        // the climb through cloud: the same white the film dived through at the start
        fadeColor = COLOR.approach; fade = fadeOut(t, L.cloud, L.end - L.cloud - 0.05);
      } },
    { name: "arrive", env: "space", chapter: "hangar", d: ARRIVAL.end,
      enter() { lastFrame(); again = null; },
      update(t) {
        const A = ARRIVAL, k = 1 - Math.pow(1 - clamp(t / A.settle), 3);
        // the cloud clears on Earth's horizon; the rocket climbs into the frame and settles at bottom centre
        fadeColor = COLOR.approach; fade = fadeIn(t, A.clear);
        ship.group.position.set(LAST.rocket.x, LAST.rocket.y - (calm ? 0 : 7.5 * (1 - k)), LAST.rocket.z);
        ship.flicker(stage.time, 0.55 + 1.3 * (1 - k));
        if (t > A.card[0] && t < A.card[1]) overlay.card("", "Cadet Bay", "Your first mission", "top"); else overlay.card("", "");
      } },
  ];

  const director = new Director<Shot>(steps, {
    beforeEnter(s) {
      talk(null);
      setUi({ prompt: null, chapter: s.chapter });
      overlay.timer(null);
      if (s.env !== env) { setEnv(s.env); line = null; clearAt = Infinity; if (ui.caption) put("", ""); }
      flight.visible = s.name === "arrive";
      if (s.name !== "arrive") unframe();
      firstPerson = !!s.firstPerson;
      hand.group.visible = false;
      audio.stopVoice();
    },
    onEnd() { setUi({ ended: true, canSkip: false, caption: null, prompt: null, cta: null }); pause(false, true); onEnd?.(); },
  });

  function reset() {
    for (const p of everyone()) { p.rig.raise = false; p.rig.talking = false; p.rig.mime = false; p.rig.walk = null; p.rig.mood = "neutral"; p.rig.r = p.rig.rv = 0; if (p.rig.seat) { p.rig.stand = 0; p.rig.s = 0; } }
    for (const c of [principal, captain]) { c.group.visible = false; c.group.position.copy(HALL[0]); }
    teacher.group.position.copy(TEACHER_MARK);
    teacher.group.rotation.y = 0.2;
    mood = "tuesday"; doorTarget = 0; room.reset();
    overlay.card("", ""); overlay.timer(null);
    line = null; clearAt = Infinity; saying = ""; phaseNow = "";
    hand.group.visible = false; lids = 1; blur = 0; fade = 0; firstPerson = false; shake = 0;
    hangar.reset();
    hangar.nova.express("neutral");
    hangar.nova.group.position.copy(NOVA_HOME);
    captainH.rig.look = null;
    flight.visible = false;
    unframe();
    room.write("4 + 4 = ?");
    setUi({ prompt: null, cta: null, ended: false, caption: null });
  }

  /** Start the film at a step, with the world as the story would have left it by then. */
  function seek(name: string) {
    reset();
    const i = Math.max(0, director.find(name)), after = (n: string) => i > director.find(n);
    if (i >= director.find("knock")) { setEnv("class"); room.write("× Multiplication"); show(SETUP.lesson); lookAt(headOf(teacher), CLASS_CENTRE); }
    if (after("knock")) { doorTarget = 1; mood = "knock"; room.set(1); }
    if (after("officers")) for (const [c, to] of [[principal, ARRIVE.principal], [captain, ARRIVE.captain]] as const) { c.group.visible = true; c.group.position.copy(to); face(c.group, CLASS_CENTRE); c.rig.look = CLASS_CENTRE; }
    if (after("names")) for (const k of named()) { k.rig.stand = 1; k.rig.s = 1; k.rig.mood = "happy"; }
    played = 0;
    setUi({ started: true, canSkip: false });
    director.go(i);
  }
  function jump(chapter: Chapter) {
    audio.unlock();
    void warmVoice(["Hadley", "Zoey"]); // the cadet's name, then Nova's live lesson lines
    seek({ orbit: "orbit", dive: "dive", wake: "wake", knock: "knock", hangar: "hangar" }[chapter]);
  }

  /**
   * Stop and start the film (picture, captions and sound together): the stage's clock freezes and the audio
   * clock is suspended on the same call, so they come back in step. The tab being hidden does this by itself.
   */
  function pause(on: boolean, quiet = false) {
    if (on === ui.paused || (on && (!ui.started || ui.ended))) return;
    stage.paused = on;
    const ctx = audio.context;
    if (ctx) void (on ? ctx.suspend() : ctx.resume()).catch(() => {});
    if (!quiet) setUi({ paused: on }); else ui = { ...ui, paused: on };
  }
  const onHidden = () => pause(document.hidden);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onHidden);

  /**
   * Skip to the end: a quick dip to the void, then the film's own last frame, then the end, exactly as if it
   * had played through (the same `onEnd`, once). One tap; the film can be watched again, so there is no confirm.
   */
  let skipping = -1;
  function skip() {
    if (!ui.started || ui.ended || skipping >= 0) return;
    pause(false);
    skipping = 0;
    audio.stopVoice();
    talk(null);
    line = null; clearAt = Infinity;
    setUi({ prompt: null, cta: null, caption: null, canSkip: false });
  }

  const kick = new THREE.Vector3(), right = new THREE.Vector3(), aim = new THREE.Vector3();
  const stop = stage.onUpdate((dt, time) => {
    if (skipping >= 0) {
      // the dip to the void, then the last frame: nothing of the skipped steps runs
      skipping += dt;
      const D = 0.28;
      if (skipping < D) { fadeColor = COLOR.void; fade = Math.max(fade, smooth(skipping / D)); }
      else if (director.current?.name !== "arrive" || fade > 0.001) {
        if (director.running && director.current?.name !== "arrive") { reset(); director.index = director.find("arrive"); director.t = ARRIVAL.end - 0.01; setUi({ chapter: "hangar" }); setEnv("space"); overlay.card("", ""); }
        lastFrame();
        fadeColor = COLOR.void; fade = 1 - smooth((skipping - D) / D);
        if (skipping >= D * 2) { fade = 0; skipping = -1; director.go(steps.length); }
      }
    } else director.update(dt);
    if (ui.started && !ui.ended) {
      played += dt;
      captions();
      if (!ui.canSkip && played >= SKIP_AFTER && skipping < 0) setUi({ canSkip: true });
    }
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
    // the grade eases from one part of the colour script to the next (the cut to a new set snaps it)
    tint.lerp(tintTo, Math.min(1, dt * 1.2));
    stage.grade.tint.value.copy(tint);
    // a rumble, not noise: two slow sines per axis, fading at the same rate at any frame rate
    shake *= Math.exp(-dt * 5);
    // a turned phone or a resized window gets the setup composed again for its new frame
    if (Math.abs(camera.aspect - lastAspect) > 0.02) { lastAspect = camera.aspect; again?.(); }
    cam.sway = env === "class" && !firstPerson && !calm ? 1 : 0;
    cam.apply(camera, dt, time);
    if (shake > 0.001 && !calm) camera.position.add(kick.set(Math.sin(time * 41) + Math.sin(time * 67.3), Math.sin(time * 53) + Math.sin(time * 71.9), 0).multiplyScalar(shake * 0.5));
    // the soft key stands beside the lens, up and to the left, and follows its subject
    if (lit && (env === "class" || env === "hangar")) {
      aim.copy(lit());
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      eyeLight.position.copy(camera.position).addScaledVector(right, -0.9).add(kick.set(0, 0.75, 0));
      eyeLight.target.position.copy(aim);
      const d = eyeLight.position.distanceTo(aim);
      eyeLight.intensity = approach(eyeLight.intensity, 2.6 * litPower * d * d, 6, dt);
    } else eyeLight.intensity = 0;
    overlay.fade(fade, fadeColor);
    overlay.lids(lids);
    overlay.blur(blur);
  });

  const onKey = (e: KeyboardEvent) => {
    const s = director.current;
    if (!s?.pick || !ui.prompt || e.repeat) return;
    if (e.code === "Space") { e.preventDefault(); s.raise?.(); }
    const ix = e.key === "1" ? 0 : e.key === "2" ? 1 : -1;
    if (ix >= 0 && ui.prompt.stage === "choose") s.pick(ui.prompt.options[ix]);
  };
  window.addEventListener("keydown", onKey);

  /**
   * Get every set ready while the first one plays, so no chapter change hitches: each set is drawn once into a
   * tiny off-screen frame, which compiles its shaders, uploads its textures and fills its shadow map.
   */
  let warm: THREE.WebGLRenderTarget | null = null;
  function prepareSets() {
    const was = env, r = stage.renderer;
    warm ??= new THREE.WebGLRenderTarget(32, 32);
    const culled: THREE.Object3D[] = [];
    scene.traverse((o) => { if (o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    for (const e of ["town", "class", "hangar", "space"] as Env[]) {
      if (e === was) continue;
      setEnv(e);
      r.setRenderTarget(warm);
      r.render(scene, camera);
    }
    r.setRenderTarget(null);
    for (const o of culled) o.frustumCulled = true;
    if (was) setEnv(was);
  }

  // resting state before Play: Earth turning slowly
  reset();
  setEnv("space");
  cut(at(S, -4, 10, 160), at(S, 0, 0, 0));
  let prepared = false;
  const prepTimer = typeof window !== "undefined" ? window.setTimeout(() => { if (!prepared && !ui.started) { prepared = true; prepareSets(); } }, 300) : 0;

  return {
    director,
    /** The shot list, in story order. */
    setups: SETUPS,
    /** Resolves when the first picture (Earth) has its maps: a still taken before this shows a bare globe. */
    ready: earth.earth.sharp,
    /** Start from the top (from a click, so audio can start). */
    play: () => { if (!prepared) { prepared = true; prepareSets(); } jump("orbit"); },
    jump,
    pick: (v: number) => director.current?.pick?.(v),
    raise: () => director.current?.raise?.(),
    ignite: () => { if (director.current?.name === "nova") director.go(director.find("launch")); },
    skip,
    pause,
    setName(name: string) {
      cadet = name.trim();
      nameLine = null;
      if (!cadet) return;
      audio.unlock();
      void prepare(`And our fifth cadet is... ${cadet}!`, "Hadley").then((b) => { nameLine = b; });
    },
    /** The cadet's name for captions and cards only: nothing is spoken and no sound is unlocked (stills, review pages). */
    setCadet(name: string) { cadet = name.trim(); },
    setColour,
    /**
     * Put one setup of the shot list on screen as a still: the film runs to it on the stage's own clock (the
     * stage should be paused), with the hand raised and the answers given as the setup needs. For review pages and tests.
     */
    still(id: string) {
      const shot = SHOTS.find((s) => s.id === id);
      if (!shot) return false;
      const stepTo = (ok: () => boolean, max: number) => { for (let t = 0; t < max && !ok(); t += 0.05) stage.step(0.05); };
      for (const op of shot.how) {
        if (op[0] === "go") seek(op[1]);
        else if (op[0] === "wait") { let left = op[1]; stepTo(() => (left -= 0.05) < -1e-6, op[1] + 1); }
        else if (op[0] === "until") { const w = op[1]; stepTo(() => (w === "cta" ? !!ui.cta : w === "raise" || w === "choose" ? ui.prompt?.stage === w : w === "answer" || w === "reply" ? phaseNow === w : saying === w), 40); }
        else if (op[0] === "raise") director.current?.raise?.();
        else if (op[0] === "pick") director.current?.pick?.(op[1]);
        else if (op[0] === "ignite") director.go(director.find("launch"));
      }
      stage.step(0);
      return true;
    },
    /** For tests and review: the film's clock, the step, and what is being said. */
    get state() { return { played, step: director.current?.name ?? null, t: director.t, saying, env, fov: camera.fov }; },
    get ui() { return ui; },
    dispose() {
      window.clearTimeout(prepTimer);
      stop();
      pause(false, true);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("visibilitychange", onHidden);
      overlay.dispose();
      audio.stopVoice();
      hand.group.removeFromParent();
      // the last shot's rocket and orbit are the film's own: the battle that follows brings its rocket to the same place
      flight.removeFromParent();
      unframe();
      eyeLight.intensity = 0;
      stage.grade.tint.value.set(1, 1, 1);
      warm?.dispose();
      camera.fov = FOV;
      camera.updateProjectionMatrix();
    },
  };
}
export type Film = ReturnType<typeof mountIntro>;
