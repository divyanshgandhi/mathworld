"""Bake the fixed voice lines with Gradium Phonon (phonon-31m-en, Apache 2.0) into public/vo/.

Run from the repo root:  uvx --from ptts python scripts/bake-voices.py
Needs ffmpeg on PATH. Writes public/vo/<id>.mp3 and public/vo/vo.json (voice, text, duration).
Lines that contain a cadet's name or live numbers are spoken in the browser instead (src/engine/voice.ts).
Each entry also records `end`: where the speech stops before the clip's trailing silence, so the film
can pace its pauses on what you hear. `--measure` refreshes `end` for every clip without re-baking.
"""
import json
import subprocess
import sys
import wave
from pathlib import Path



def speech_end(mp3: Path, duration: float) -> float:
    """The start of the trailing silence, or the full length when the clip ends on speech."""
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(mp3), "-af", "silencedetect=noise=-38dB:d=0.12", "-f", "null", "-"], capture_output=True, text=True).stderr
    starts = [float(l.split("silence_start: ")[1]) for l in out.splitlines() if "silence_start: " in l]
    ends = [float(l.split("silence_end: ")[1].split()[0]) for l in out.splitlines() if "silence_end: " in l]
    if starts and ends and len(starts) == len(ends) and ends[-1] >= duration - 0.05 and starts[-1] > 0.2:
        return round(starts[-1], 3)
    return round(duration, 3)



OUT = Path(__file__).resolve().parent.parent / "public" / "vo"
OUT.mkdir(parents=True, exist_ok=True)

TEACHER, KID, PRINCIPAL, CAPTAIN, NOVA = "Hadley", "Fennick the Young Elf", "Preston", "Miles", "Zoey"

LINES = [
    # The classroom (storyline as in the Gemini showcase)
    ("teacher_intro", TEACHER, "Okay class, you have mastered addition and subtraction. As we all know, four plus four is... who is going to tell me?"),
    ("kid_eight", KID, "Ooh! Eight! It is eight!"),
    ("teacher_eight_ok", TEACHER, "Eight! Spot on, lovely work."),
    ("teacher_eight_close", TEACHER, "Ooh, super close! Four plus four is eight."),
    ("teacher_q2", TEACHER, "And what is five minus three?"),
    ("kid_two", KID, "Two! That one is two!"),
    ("teacher_two_ok", TEACHER, "Two! Brilliant."),
    ("teacher_two_close", TEACHER, "Nice try! Five minus three is two."),
    ("teacher_mult", TEACHER, "Wonderful. Today, we begin... multiplication."),
    ("teacher_yes", TEACHER, "Yes? Go ahead!"),
    ("principal_sorry", PRINCIPAL, "Pardon the interruption, everyone."),
    ("principal_intro", PRINCIPAL, "Class, this is the Captain of the Star Fleet."),
    ("captain_danger", CAPTAIN, "There is grave danger in deep space. Earth needs its sharpest young minds. We are enrolling five cadets today."),
    ("teacher_proud", TEACHER, "Five cadets... from my class? Captain, I know exactly who you need."),
    ("captain_names", CAPTAIN, "Then call their names."),
    ("teacher_names", TEACHER, "Please stand when I call your name. Maya... Leo... Aarav... Zoe..."),
    ("teacher_pick_generic", TEACHER, "And our fifth cadet is... you!"),
    # The hangar
    ("captain_brief1", CAPTAIN, "Welcome, cadets. You are going to be the protectors of Earth against enemies in space."),
    ("captain_brief2", CAPTAIN, "You have a spaceship, your co-pilot, and plasma balls to clear every squadron. Remember, plasma cells are precious. Too few and invaders slip past. Too many and we burn extra fuel."),
    ("captain_nova", CAPTAIN, "And every pilot needs a co-pilot. Meet yours."),
    ("nova_hi", NOVA, "Hey! I am Nova, your co-pilot! Together we will calibrate every shot dead on. Ready for launch?"),
    # Nova, Level 0 (Earth, Cadet Bay): Empty & Mirror from docs/tricks.md
    ("nova_l0_intro", NOVA, "Welcome to Cadet Bay! Drones fly in squadrons. Count every drone, load that many plasma balls, and fire!"),
    ("nova_zero", NOVA, "Zero squads means empty space. Not a single invader!"),
    ("nova_zero_ask", NOVA, "How many plasma balls do we need for empty space?"),
    ("nova_mirror", NOVA, "One squad is just a mirror. It keeps the exact same number."),
    ("nova_mirror_repeat", NOVA, "Remember Empty and Mirror: times zero is zero, times one stays the same!"),
    ("nova_exact", NOVA, "Dead on! Perfect calibration, cadet!"),
    ("nova_over", NOVA, "Too many! The extra plasma balls flew past into space."),
    ("nova_under", NOVA, "Some drones slipped past! We need more plasma balls."),
    ("nova_retry", NOVA, "Shields are back up. Try that shot again!"),
    ("nova_l0_clear", NOVA, "Cadet Bay is clear! The Moon is open. Let's fly!"),
    # Nova, the Moon wave demo
    ("nova_incoming", NOVA, "Squadrons incoming! One plasma ball for every drone."),
    ("nova_wave_clear", NOVA, "Wave cleared! Nice shooting, cadet."),
    # Battle (src/worlds/space/lines.ts BATTLE_LINES, same ids and text): short, so a shot stays under 10 s
    ("nova_dead_on", NOVA, "Dead on!"),
    ("nova_bullseye", NOVA, "Bullseye, cadet!"),
    ("nova_perfect", NOVA, "Perfect shot!"),
    ("nova_incoming_short", NOVA, "Squadrons incoming!"),
    ("nova_err_added", NOVA, "Careful! That added them. We need whole squads."),
    ("nova_err_group", NOVA, "So close! One squad off."),
    ("nova_err_unit", NOVA, "Just a hair off!"),
    ("nova_err_place", NOVA, "Check your place value, cadet!"),
    ("nova_err_under", NOVA, "Too few! Load a few more."),
    ("nova_err_over", NOVA, "Too many! Load a few less."),
    ("nova_err_wild", NOVA, "Way off! Radar is up."),
    ("nova_radar", NOVA, "Radar is up. Pick a target!"),
    ("nova_invite", NOVA, "Sneaky squad! Try a Power-Up, the Radar, or Show Me How."),
    ("nova_hold_fire", NOVA, "Hold fire, cadet! Take a breath, and try a Trick Power-Up."),
    ("nova_misfit", NOVA, "That trick doesn't fit this fleet. Try another one!"),
    ("nova_sector_ok", NOVA, "Sector locked!"),
    ("nova_sector_no", NOVA, "Not quite. Count that sector again."),
    ("nova_all_locked", NOVA, "All sectors locked. Fire!"),
    ("nova_planet_clear", NOVA, "Planet clear! The next world is open."),
    ("nova_practice_done", NOVA, "Practice run complete. Nice flying!"),
    ("nova_show_me", NOVA, "Watch this, cadet."),
    ("pu_flip", NOVA, "Flip It! Same ships, turned sideways."),
    ("pu_split", NOVA, "Split and Add! Count each side, then add."),
    ("pu_borrow", NOVA, "Borrow and Take Back! Fill the rows, then zap the ghosts."),
    ("pu_double", NOVA, "Double It! Count one half, then double."),
    ("pu_bigsmall", NOVA, "Big and Small Split! Big ships first, then the small ones."),
    ("pu_sector", NOVA, "Sector Lock! Crack each sector, then add."),
    ("pu_easy", NOVA, "Easy fives and tens! Count the pods."),
    ("pu_easy5", NOVA, "Five is half of ten. Use the twin!"),
    ("pu_fast", NOVA, "Fast Adding! One squad at a time."),
    ("pu_jump", NOVA, "Jump One More! Start from what you know."),
    ("pu_mirror", NOVA, "Empty and Mirror! Zero is empty, one is a mirror."),
    ("pu_half", NOVA, "Half and Double! Same ships, an easier shape."),
    # Show Me How in battle (src/rig/showme.ts): fixed trick lines, matched to a lesson's words by lineKey()
    ("tr_sectors_total", NOVA, "Add up the sectors: what's the total?"),
    ("tr_total", NOVA, "What's the total?"),
    ("tr_all_total", NOVA, "Add them all up: what's the total?"),
    ("tr_left", NOVA, "What's left?"),
    ("tr_sector_brief", NOVA, "Crack each sector, then add them up!"),
    ("tr_tens_ones_brief", NOVA, "Ten Squads first, then the Fighters!"),
    ("tr_carriers_ones_brief", NOVA, "Carriers first, then the Fighters!"),
    ("tr_carriers_tens_brief", NOVA, "Carriers first, then the Ten Squads!"),
    ("tr_half_brief", NOVA, "Halve one side, double the other!"),
    ("tr_borrow_brief", NOVA, "Borrow the ghosts, then take them back!"),
    ("tr_mirror_brief", NOVA, "Times zero is zero, times one stays the same!"),
    ("tr_zero_each", NOVA, "Zero ships in every squad means empty space. Not a single invader!"),
    ("tr_mirror_each", NOVA, "One ship in each squad is just a mirror. It keeps the exact same number."),
    ("tr_pods_why", NOVA, "Every squad of ten packs into one glowing Squadron Pod!"),
    ("tr_pods_brief", NOVA, "Each squad of ten is one Pod!"),
    ("tr_twin_why", NOVA, "Five is the secret twin of ten. It's exact half!"),
    ("tr_double2_why", NOVA, "Multiplying by two? Just Double It!"),
    ("tr_double4_why", NOVA, "Multiplying by four? Just Double It, twice!"),
    ("tr_jump3_why", NOVA, "Three is just one more than easy two!"),
    ("tr_jump6_why", NOVA, "Six is just one more than easy five!"),
    ("tr_jump7_why", NOVA, "Seven is just one more than six!"),
    ("tr_jump8_why", NOVA, "Eight is just one more than seven!"),
    ("tr_shy9", NOVA, "Nine is just one shy of ten!"),
    ("tr_shy19", NOVA, "19 is just one shy of 20!"),
    ("tr_shy29", NOVA, "29 is just one shy of 30!"),
    ("tr_shy99", NOVA, "99 is just one shy of 100!"),
    ("tr_shy199", NOVA, "199 is just one shy of 200!"),
    ("tr_pods_ask_2", NOVA, "Two Pods of ten: how many ships?"),
    ("tr_pods_ask_3", NOVA, "Three Pods of ten: how many ships?"),
    ("tr_pods_ask_4", NOVA, "Four Pods of ten: how many ships?"),
    ("tr_pods_ask_5", NOVA, "Five Pods of ten: how many ships?"),
    ("tr_pods_ask_6", NOVA, "Six Pods of ten: how many ships?"),
    ("tr_pods_ask_7", NOVA, "Seven Pods of ten: how many ships?"),
    ("tr_pods_ask_8", NOVA, "Eight Pods of ten: how many ships?"),
    ("tr_pods_ask_9", NOVA, "Nine Pods of ten: how many ships?"),
    ("tr_pods_ask_10", NOVA, "Ten Pods of ten: how many ships?"),
    ("unlock_empty-mirror", NOVA, "Empty and Mirror is on your belt now!"),
    ("unlock_fast-adding", NOVA, "Fast Adding is on your belt now!"),
    ("unlock_flip-it", NOVA, "Flip It is on your belt now!"),
    ("unlock_double-it", NOVA, "Double It is on your belt now!"),
    ("unlock_easy-5-10", NOVA, "Easy fives and tens is on your belt now!"),
    ("unlock_jump-one-more", NOVA, "Jump One More is on your belt now!"),
    ("unlock_split-and-add", NOVA, "Split and Add is on your belt now!"),
    ("unlock_borrow-take-back", NOVA, "Borrow and Take Back is on your belt now!"),
    ("unlock_big-small-split", NOVA, "Big and Small Split is on your belt now!"),
    ("unlock_half-double", NOVA, "Half and Double is on your belt now!"),
    ("captain_jump_mars", CAPTAIN, "Ace telemetry! Hyper-Jump straight to Mars?"),
    ("captain_jump_asteroid-belt", CAPTAIN, "Ace telemetry! Hyper-Jump straight to the Asteroid Belt?"),
    ("captain_jump_jupiter", CAPTAIN, "Ace telemetry! Hyper-Jump straight to Jupiter?"),
    ("captain_jump_saturn", CAPTAIN, "Ace telemetry! Hyper-Jump straight to Saturn?"),
    ("captain_jump_uranus", CAPTAIN, "Ace telemetry! Hyper-Jump straight to Uranus?"),
    ("captain_jump_deep-space", CAPTAIN, "Ace telemetry! Hyper-Jump straight to Deep Space?"),
]

if sys.argv[1:] == ["--measure"]:
    path = OUT / "vo.json"
    data = json.loads(path.read_text())
    for line_id, entry in data.items():
        entry["end"] = speech_end(OUT / f"{line_id}.mp3", entry["duration"])
    path.write_text(json.dumps(data, indent=2) + "\n")
    print(f"Measured {len(data)} clips")
    sys.exit(0)

import ptts  # noqa: E402  (only needed when baking)

only = set(sys.argv[1:])
tts = ptts.TTS("hf://gradium/phonon-31m-en", lang="en", quant="q8")
manifest_path = OUT / "vo.json"
manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
for line_id, voice, text in LINES:
    if only and line_id not in only:
        continue
    wav_path, mp3_path = OUT / f"{line_id}.wav", OUT / f"{line_id}.mp3"
    print(f"[{line_id}] {voice}: {text}", flush=True)
    tts.save(str(wav_path), text, voice=voice)
    with wave.open(str(wav_path), "rb") as wf:
        duration = wf.getnframes() / float(wf.getframerate())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav_path), "-b:a", "96k", str(mp3_path)], check=True)
    wav_path.unlink()
    manifest[line_id] = {"voice": voice, "text": text, "duration": round(duration, 3), "end": speech_end(mp3_path, duration), "src": f"/vo/{line_id}.mp3"}

manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
print(f"Baked {len(manifest)} lines into {OUT}")
