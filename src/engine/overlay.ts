/**
 * The 2D layer over the canvas, display only: speaker-coloured captions (text only: the voice is
 * heard, not drawn), title cards, fades, eyelids, blur and a timer bar. Interactive controls (choices,
 * buttons, the keypad) are React components on @ui-sdk/react, layered above this.
 */
const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);
function div(parent: HTMLElement, s: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("div");
  css(d, { position: "absolute", pointerEvents: "none", ...s });
  parent.appendChild(d);
  return d;
}

/** Speaker → [chip background, chip text]. */
const SPEAKERS: Record<string, [string, string]> = {
  Teacher: ["rgba(20,184,166,0.24)", "#5eead4"],
  Classmate: ["rgba(251,191,36,0.24)", "#fde68a"],
  You: ["rgba(182,242,58,0.24)", "#d9f99d"],
  Principal: ["rgba(148,163,184,0.26)", "#e2e8f0"],
  Captain: ["rgba(251,146,60,0.26)", "#fed7aa"],
  Nova: ["rgba(56,189,248,0.3)", "#67e8f9"],
};

export interface Overlay {
  caption(speaker: string, text: string): void;
  /** Lift captions clear of a panel docked at the bottom of the frame (px from the bottom). */
  captionAt(bottomPx: number): void;
  /** A title card; `at: "top"` keeps the middle of the frame clear for what the shot is showing. */
  card(kicker: string, main: string, sub?: string, at?: "centre" | "top"): void;
  fade(opacity: number, color?: string): void;
  lids(open: number): void;
  blur(px: number): void;
  timer(fraction: number | null): void;
  dispose(): void;
}

export function createOverlay(container: HTMLElement, canvas: HTMLCanvasElement): Overlay {
  const root = div(container, { inset: "0", fontFamily: "var(--font-sans, system-ui), sans-serif", overflow: "hidden" });
  const lidT = div(root, { left: "-10%", width: "120%", top: "0", height: "0%", background: "#000", borderRadius: "0 0 50% 50% / 0 0 30% 30%" });
  const lidB = div(root, { left: "-10%", width: "120%", bottom: "0", height: "0%", background: "#000", borderRadius: "50% 50% 0 0 / 30% 30% 0 0" });
  const fade = div(root, { inset: "0", background: "#000", opacity: "0" });

  const card = div(root, { inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#fff", opacity: "0", transition: "opacity .8s", textShadow: "0 2px 22px rgba(0,0,0,.55)", padding: "0 6%" });
  const kicker = document.createElement("div"), main = document.createElement("div"), sub = document.createElement("div");
  css(kicker, { fontFamily: "var(--font-mono, monospace)", fontSize: "13px", letterSpacing: ".3em", color: "#d9f99d", background: "rgba(13,14,26,.62)", padding: "5px 12px 5px 16px", borderRadius: "999px", marginBottom: "14px", textShadow: "none" });
  css(main, { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(30px, 6.5vw, 68px)", letterSpacing: ".18em", lineHeight: "1.05", maxWidth: "100%", overflowWrap: "anywhere" });
  css(sub, { fontSize: "15px", letterSpacing: ".08em", marginTop: "14px", opacity: ".85" });
  card.append(kicker, main, sub);

  const cap = div(root, { left: "50%", bottom: "18px", transform: "translateX(-50%)", maxWidth: "84%", display: "flex", alignItems: "center", gap: "10px", background: "rgba(13,14,26,.78)", color: "#f3f1ea", fontSize: "15px", lineHeight: "1.45", padding: "9px 14px", borderRadius: "12px", opacity: "0", transition: "opacity .25s", backdropFilter: "blur(6px)" });
  const chip = document.createElement("span"), text = document.createElement("span");
  css(chip, { flex: "none", fontSize: "11px", fontWeight: "600", letterSpacing: ".08em", textTransform: "uppercase", padding: "3px 8px", borderRadius: "999px" });
  cap.append(chip, text);

  const barW = div(root, { left: "50%", bottom: "8px", transform: "translateX(-50%)", width: "200px", height: "4px", borderRadius: "2px", background: "rgba(255,255,255,.15)", opacity: "0" });
  const bar = div(barW, { position: "relative", height: "100%", width: "0", background: "#b6f23a", borderRadius: "2px" });

  return {
    caption(speaker, txt) {
      const [bg, fg] = SPEAKERS[speaker] ?? ["rgba(255,255,255,0.14)", "#f8fafc"];
      chip.textContent = speaker;
      chip.style.display = speaker ? "" : "none";
      css(chip, { background: bg, color: fg });
      text.textContent = txt;
      cap.style.opacity = txt ? "1" : "0";
    },
    captionAt(px) { cap.style.bottom = `${px}px`; barW.style.bottom = `${Math.max(8, px - 10)}px`; },
    card(k, m, s = "", at = "centre") {
      kicker.textContent = k;
      kicker.style.display = k ? "" : "none";
      css(card, at === "top" ? { justifyContent: "flex-start", paddingTop: "5%" } : { justifyContent: "center", paddingTop: "0" });
      main.textContent = m;
      sub.textContent = s;
      card.style.opacity = m ? "1" : "0";
    },
    fade(o, color) {
      if (color) fade.style.background = color;
      fade.style.opacity = String(Math.max(0, Math.min(1, o)));
    },
    lids(open) {
      const h = Math.max(0, (1 - open) * 56);
      lidT.style.height = lidB.style.height = `${h}%`;
    },
    blur: (px) => void (canvas.style.filter = px > 0.05 ? `blur(${px.toFixed(1)}px)` : "none"),
    timer(f) {
      barW.style.opacity = f === null ? "0" : "1";
      bar.style.width = `${(f ?? 0) * 100}%`;
    },
    dispose: () => root.remove(),
  };
}
