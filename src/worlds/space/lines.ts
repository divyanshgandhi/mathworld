import type { ErrorType } from "@/rig/errors";
import type { PlanetId } from "@/rig/pools";
import type { TrickId } from "@/rig/tricks";
import type { CombatLineId } from "@/battle/lines";

/**
 * The film's spoken lines, in story order: the words the captions show. scripts/bake-voices.py bakes
 * each one under the same id and the same text (a test keeps the two in step), so a caption is right
 * even when a clip has not loaded. Words follow docs/glossary.md: plasma balls, squads, ships.
 */
export const FILM_LINES = {
  teacher_intro: "Okay class, you know how to add and take away. So, four plus four is... who is going to tell me?",
  kid_eight: "Ooh! Eight! It is eight!",
  teacher_yes: "Yes? Go ahead!",
  teacher_eight_ok: "Eight! Spot on, lovely work.",
  teacher_eight_close: "Ooh, super close! Four plus four is eight.",
  teacher_q2: "And what is five minus three?",
  kid_two: "Two! That one is two!",
  teacher_two_ok: "Two! Brilliant.",
  teacher_two_close: "Nice try! Five minus three is two.",
  teacher_mult: "Wonderful. Today, we begin... multiplication.",
  principal_sorry: "Pardon the interruption, everyone.",
  principal_intro: "Class, this is the Captain of the Star Fleet.",
  captain_danger: "Deep space is in danger. Earth needs sharp young minds. Five cadets start today.",
  teacher_proud: "Five cadets... from my class? Captain, I know exactly who you need.",
  captain_names: "Then call their names.",
  teacher_names: "Please stand when I call your name. Maya... Leo... Aarav... Zoe...",
  teacher_pick_generic: "And our fifth cadet is... you!",
  captain_brief1: "Welcome, cadets. You will protect Earth from the ships that attack from space.",
  captain_brief2: "This is your rocket.",
  captain_nova: "And every pilot needs a co-pilot. Meet yours.",
  nova_hi: "Hi! I am Nova, your co-pilot. Ready for launch?",
} as const;
export type FilmLineId = keyof typeof FILM_LINES;

/**
 * Nova's in-battle lines: short on purpose, so a shot (fire → outcome → line → ready) stays well under
 * 10 seconds. Every line here is baked by scripts/bake-voices.py under the same id and text; until a
 * clip exists the caption still shows and the pause is paced on reading time.
 */
export const BATTLE_LINES = {
  nova_dead_on: "Dead on!",
  nova_bullseye: "Bullseye, cadet!",
  nova_perfect: "Perfect shot!",
  nova_incoming_short: "Squads incoming!",
  nova_err_added: "Careful! That added them. We need whole squads.",
  nova_err_group: "So close! One squad off.",
  nova_err_unit: "Just a hair off!",
  nova_err_place: "Check your place value, cadet!",
  nova_err_under: "Too few! Some got away. Try again.",
  nova_err_over: "Too many! Some flew past. Try again.",
  nova_err_wild: "Way off! Count the squads again.",
  nova_hold_fire: "Hold fire, cadet! Take a breath, and try a Power-Up.",
  nova_misfit: "That trick doesn't fit this fleet. Try another one!",
  // a zero fleet met for the first time: what the empty picture means, never the answer
  nova_zero_squads: "No squads at all! How many ships is that?",
  nova_zero_each: "Every squad here is empty. Count the ships!",
  nova_sector_ok: "Sector locked!",
  nova_sector_no: "Not quite. Count that sector again.",
  nova_all_locked: "All sectors locked. Fire!",
  nova_planet_clear: "Planet clear! The next world is open.",
  nova_practice_done: "Practice run complete. Nice flying!",
  nova_show_me: "Watch this, cadet.",
  pu_flip: "Flip It! Same ships, turned sideways.",
  pu_split: "Split and Add! Count each side, then add.",
  pu_borrow: "Borrow and Take Back! Fill the rows, then zap the ghosts.",
  pu_double: "Double It! Count one half, then double.",
  pu_bigsmall: "Big and Small Split! Big ships first, then the small ones.",
  pu_sector: "Sector Lock! Crack each sector, then add.",
  pu_easy: "Easy fives and tens! Count the pods.",
  pu_easy5: "Five is half of ten. Use the twin!",
  pu_fast: "Fast Adding! One squad at a time.",
  pu_jump: "Jump One More! Start from what you know.",
  pu_mirror: "Empty and Mirror! Zero is empty, one is a mirror.",
  pu_half: "Half and Double! Same ships, an easier shape.",
  // a Trick Card lands on the belt (the winning shot after its first Show Me How)
  "unlock_empty-mirror": "Empty and Mirror is on your belt now!",
  "unlock_fast-adding": "Fast Adding is on your belt now!",
  "unlock_flip-it": "Flip It is on your belt now!",
  "unlock_double-it": "Double It is on your belt now!",
  "unlock_easy-5-10": "Easy fives and tens is on your belt now!",
  "unlock_jump-one-more": "Jump One More is on your belt now!",
  "unlock_split-and-add": "Split and Add is on your belt now!",
  "unlock_borrow-take-back": "Borrow and Take Back is on your belt now!",
  "unlock_big-small-split": "Big and Small Split is on your belt now!",
  "unlock_half-double": "Half and Double is on your belt now!",
  captain_jump_mars: "Ace telemetry! Hyper-Jump straight to Mars?",
  "captain_jump_asteroid-belt": "Ace telemetry! Hyper-Jump straight to the Asteroid Belt?",
  captain_jump_jupiter: "Ace telemetry! Hyper-Jump straight to Jupiter?",
  captain_jump_saturn: "Ace telemetry! Hyper-Jump straight to Saturn?",
  captain_jump_uranus: "Ace telemetry! Hyper-Jump straight to Uranus?",
  "captain_jump_deep-space": "Ace telemetry! Hyper-Jump straight to Deep Space?",
} as const;
export type LineId = keyof typeof BATTLE_LINES;

export const EXACT_LINES: LineId[] = ["nova_dead_on", "nova_bullseye", "nova_perfect"];
/** The one praise line for a right answer (the others stay baked for the Academy and older callers). */
export const EXACT_LINE: LineId = "nova_dead_on";
/** The line each kind of miss plays. A wild guess plays the combat track's "Way off! Count the squads with me." */
export const ERROR_LINE: Record<ErrorType, LineId | CombatLineId> = {
  added_instead: "nova_err_added", off_by_one_group: "nova_err_group", off_by_one_unit: "nova_err_unit", place_value: "nova_err_place",
  undershoot_close: "nova_err_under", overshoot_close: "nova_err_over", wild_guess: "nova_err_way_off",
};
export const POWERUP_LINE: Record<TrickId, LineId> = {
  "empty-mirror": "pu_mirror", "fast-adding": "pu_fast", "flip-it": "pu_flip", "double-it": "pu_double", "easy-5-10": "pu_easy",
  "jump-one-more": "pu_jump", "split-and-add": "pu_split", "borrow-take-back": "pu_borrow", "big-small-split": "pu_bigsmall", "half-double": "pu_half",
};
export const jumpLine = (to: PlanetId) => `captain_jump_${to}` as LineId;
export const unlockLine = (t: TrickId) => `unlock_${t}` as LineId;

export const PLANET_NAMES: Record<PlanetId, string> = {
  earth: "Earth", moon: "The Moon", mars: "Mars", "asteroid-belt": "Asteroid Belt", jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", "deep-space": "Deep Space",
};
