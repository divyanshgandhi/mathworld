import type { Bus } from "./bus";

/**
 * Telemetry for the ?dev readout: fire → ready again for every shot (the 5–10 s rule), and Show Me
 * How start → last line said. Wall-clock ms, as the readout has always shown.
 */
export function attachTelemetry(bus: Bus, report: (t: { shots?: number[]; lessons?: number[] }) => void, now = () => performance.now()) {
  let shotStart = 0, lessonT0 = 0;
  const shots: number[] = [], lessons: number[] = [];
  const offs = [
    bus.on("fire", () => { shotStart = now(); }),
    bus.on("ready", () => { if (shotStart) { shots.push(Math.round(now() - shotStart)); shotStart = 0; report({ shots: [...shots] }); } }),
    bus.on("lesson_started", () => { lessonT0 = now(); }),
    bus.on("lesson_spoken", () => { lessons.push(Math.round(now() - lessonT0)); report({ lessons: [...lessons] }); }),
  ];
  return () => offs.forEach((off) => off());
}
