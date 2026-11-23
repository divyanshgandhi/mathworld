// Copies the phonon-tts browser package (module, worker, wasm) into public/vendor/phonon-tts so the
// browser loads it as-is: the worker and wasm resolve beside index.js, and no bundler rewrites them.
import { cpSync, existsSync, rmSync } from "node:fs";

const from = "node_modules/phonon-tts", to = "public/vendor/phonon-tts";
if (!existsSync(from)) { console.log("vendor-phonon: phonon-tts not installed, skipping"); process.exit(0); }
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true, filter: (p) => !p.endsWith(".md") && !p.includes("THIRD_PARTY") });
console.log("vendor-phonon: copied to", to);
