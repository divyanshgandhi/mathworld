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
