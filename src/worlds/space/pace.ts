import { PACE, readingTime, scheduleCaptions, splitCaption } from "@/engine/overlay";
import { FILM_LINES, type FilmLineId } from "./lines";

/**
 * The film's clock as data: every wait, lead and tail the intro plays by, in seconds. intro.ts reads
 * these numbers and `filmSchedule` walks the same numbers, so the timeline a test checks is the one
 * that plays. The limits they must keep are `PACE` (engine/overlay.ts).
 */
export const FILM_PACE = {
  /** One fade grammar: out to the void and back in. Together they are a join of two chapters. */
  fade: { out: 0.5, in: 0.5 },
  /** A heard caption leaves this long after its voice. */
  linger: 0.2,
  /** Listeners turn to the next speaker this long before the first word. */
  turnLead: 0.2,
  orbit: { d: 4.0, cardOff: 3.3 },
  dive: { d: 2.6 },
  town: { d: 5.8, crane: 4.3, cardOff: 3.9, in: 0.6 },
  wake: { d: 3.0 },
  yawn: { d: 3.2 },
  turn: { d: 1.25, look: 1.1 },
  /** A classroom question: how long the class waits, when a classmate's hand goes up, and the breaths around the answer. */
  question: { wait: PACE.wait, rival: 3, answer: PACE.wait, mime: 1.0, reply: 0.25, kidReply: 0.3, tail: 0.4 },
  mult: { lead: 0.1, tail: 0.4 },
  knock: { sound: 1.0, door: 1.2, d: 1.9 },
  officers: { lead: 0.9, walk: 2.1, behind: 0.35, gap: 0.4, tail: 0.1 },
  captain: { lead: 0.2, proud: 0.3, names: 0.25, tail: 0.1 },
  names: { lead: 0.25, tail: 0.25 },
  /** The cadet is picked: they stand at `stand` of the line, the name card rises `card` after it, the picture leaves `out` after it. */
  picked: { lead: 0.25, stand: 0.8, card: 0.7, out: 2.9 },
  hangar: { lead: 1.6, cardOff: 1.3, brief2: 0.45, nova: 0.5, tail: 0.3 },
  nova: { wait: PACE.wait },
  launch: { beat: 0.7, breath: 2.0, fire: 2.5, lift: 3.3, cloud: 4.85, end: 5.75 },
  arrival: { clear: 0.6, settle: 3.0, card: [1.0, 4.0], end: 4.5 },
} as const;

export interface FilmLine {
  id: string; who: string; text: string;
  /** How long the voice speaks (the clip, less its trailing silence). */
  clip: number;
  start: number; voiceEnd: number;
  /** When the line is over for whoever follows: the voice's end when heard, the last caption's end when read alone. */
  end: number;
  captions: { text: string; on: number; off: number; need: number }[];
}
/** `reply`, `same` and `scene` keep PACE's ranges; `input` is the player's own time; `wait` is an invitation nobody took; `action` is on the allow-list. */
export type GapKind = "reply" | "same" | "scene" | "input" | "wait" | "action";
export interface FilmGap { after: string; before: string; kind: GapKind; seconds: number; what?: string }
/** A stretch with no line at all: what is on screen, and for how long. */
export interface FilmHold { name: string; start: number; seconds: number; what: string }

/** Why each long silence is allowed: something is visibly happening all the way through it. */
export const ALLOWED: Record<string, { max: number; why: string }> = {
  orbit: { max: 4.0, why: "Earth turns and drifts closer under its title, which needs its reading time" },
  dive: { max: 2.6, why: "the plunge through cloud, gathering speed the whole way" },
  town: { max: 5.8, why: "one crane down over the town to the school's name, under the day's title" },
  wake: { max: 3.0, why: "the cadet's eyes open in three blinks and lift from the desk" },
  yawn: { max: 3.2, why: "the yawn: a hand comes up and drops, timed to the yawn you hear" },
  turn: { max: 1.25, why: "the look across to the teacher, who speaks on the cut" },
  "knock>principal_sorry": { max: 2.0, why: "the door swings open and the two visitors walk in; the principal speaks while still walking" },
  "teacher_pick_generic>captain_brief1": { max: 5.0, why: "the cadet stands and cheers, the name card rises over the cheer, a one second dip to the hangar, and the hangar is seen whole before the Captain speaks" },
  launch: { max: 5.75, why: "the countdown: three lights with their beeps, a held breath, the fire, the climb into cloud" },
  arrive: { max: 4.5, why: "the cloud clears, the rocket climbs to its place over Earth, the mission's title is read" },
};

export interface ScheduleOptions {
  /** Sound on (captions leave with the voice) or off (captions are read alone). */
  heard: boolean;
  /** Seconds of speech in a clip (`end` in public/vo/vo.json). */
  spoken: (id: string) => number;
  /** Does this piece of a line fit its plate? Without it a line is cut at 84 characters. */
  fits?: (who: string, text: string) => boolean;
  /** `true`: every invitation is taken the moment it shows. `false`: nobody presses anything. */
  input: boolean;
}

/** Walk the whole film and write down when everything happens. */
export function filmSchedule({ heard, spoken, fits, input }: ScheduleOptions) {
  const F = FILM_PACE, lines: FilmLine[] = [], gaps: FilmGap[] = [], holds: FilmHold[] = [];
  let t = 0, prev: FilmLine | null = null;
  const text = (id: string) => FILM_LINES[id as FilmLineId] ?? "";
  const hold = (name: string, seconds: number, what: string) => { holds.push({ name, start: t, seconds, what }); t += seconds; };
  /** Speak a line at `at`; `kind` is what the gap before it is. */
  function line(id: string, who: string, at: number, kind: GapKind, o: { words?: string; clip?: number; voiced?: boolean; what?: string } = {}): FilmLine {
    const words = o.words ?? text(id), clip = o.clip ?? spoken(id), h = heard && o.voiced !== false;
    const pieces = splitCaption(words, (p) => (fits ? fits(who, p) : p.length <= 84)), { starts, hold: held } = scheduleCaptions(pieces, clip, h);
    const off = at + held + (h ? F.linger : 0);
    const l: FilmLine = { id, who, text: words, clip, start: at, voiceEnd: at + clip, end: at + held, captions: pieces.map((p, i) => ({ text: p, on: at + starts[i], off: i + 1 < pieces.length ? at + starts[i + 1] : off, need: readingTime(p, h) })) };
    if (prev) gaps.push({ after: prev.id, before: id, kind, seconds: at - prev.end, what: o.what });
    lines.push(l);
    prev = l;
    return l;
  }

  hold("orbit", F.orbit.d, "Earth from orbit, with the title \"Earth\"");
  hold("dive", F.dive.d, "the dive through cloud");
  hold("town", F.town.d, "the crane over the town to the school door, with the title \"An ordinary Tuesday\"");
  hold("wake", F.wake.d, "eyes open on the desk");
  hold("yawn", F.yawn.d, "the yawn");
  hold("turn", F.turn.d, "the look to the teacher");

  const question = (ask: string, kid: string, ok: string, answer: string, first: GapKind) => {
    const Q = F.question, q = line(ask, "Teacher", t, first);
    let last: FilmLine;
    if (input) {
      // the hand goes up the moment the invitation shows; the answer is picked the moment the two answers show
      const yes = line("teacher_yes", "Teacher", q.end, "input", { what: "the invitation, taken at once" });
      const you = line("you", "You", yes.end, "input", { words: answer, clip: Q.mime, what: "the two answers, picked at once" });
      last = line(ok, "Teacher", you.end + Q.reply, "reply");
    } else {
      const friend = line(kid, "Classmate", q.end + Q.wait, "wait", { what: "the class waits for a hand; a classmate's goes up after " + Q.rival + " s" });
      last = line(ok, "Teacher", friend.end + Q.kidReply, "reply");
    }
    t = last.end + Q.tail;
  };
  question("teacher_intro", "kid_eight", "teacher_eight_ok", "8!", "action");
  question("teacher_q2", "kid_two", "teacher_two_ok", "2!", "same");

  const mult = line("teacher_mult", "Teacher", t + F.mult.lead, "same");
  t = mult.end + F.mult.tail;
  // a sound, not a speaker: its caption is read alone even with the sound on
  line("knock", "", t, "reply", { words: "Knock, knock, knock.", clip: F.knock.sound, voiced: false });
  t += F.knock.d;
  const sorry = line("principal_sorry", "Principal", t + F.officers.lead, "action", { what: "the door opens and the visitors walk in" });
  const intro = line("principal_intro", "Principal", sorry.end + F.officers.gap, "same");
  t = intro.end + F.officers.tail;
  const danger = line("captain_danger", "Captain", t + F.captain.lead, "reply");
  const proud = line("teacher_proud", "Teacher", danger.end + F.captain.proud, "reply");
  const call = line("captain_names", "Captain", proud.end + F.captain.names, "reply");
  t = call.end + F.captain.tail;
  const names = line("teacher_names", "Teacher", t + F.names.lead, "reply");
  t = names.end + F.names.tail;
  const pick = line("teacher_pick_generic", "Teacher", t + F.picked.lead, "same", { words: "And our fifth cadet is… you!" });
  t = pick.end + F.picked.out + F.fade.out;
  const brief1 = line("captain_brief1", "Captain", t + F.hangar.lead, "action", { what: "the stand, the cheer, the name card, the dip to the hangar" });
  const brief2 = line("captain_brief2", "Captain", brief1.end + F.hangar.brief2, "same");
  const meet = line("captain_nova", "Captain", brief2.end + F.hangar.nova, "same");
  t = meet.end + F.hangar.tail;
  const nova = line("nova_hi", "Nova", t, "reply");
  t = nova.end;
  if (!input) hold("launch-wait", F.nova.wait, "Launch is on screen; nobody presses it, so Nova launches");
  hold("launch", F.launch.end, "the countdown, the fire, the climb");
  hold("arrive", F.arrival.end, "orbit: the rocket settles over Earth, with the title \"Cadet Bay\"");
  return { lines, gaps, holds, total: t, join: F.fade.out + F.fade.in };
}
