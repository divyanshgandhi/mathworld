import { COLOR, INK, LINE, MOTION, RADIUS, TYPE } from "@/design/tokens";

/**
 * The 2D layer over the canvas, display only: captions with a speaker's name (text only: the voice
 * is heard, not drawn), title cards, fades, eyelids, blur and a timer line. Everything is set in
 * Saira from the design tokens. Interactive controls (choices, buttons, the keypad) are React
 * components on @ui-sdk/react, layered above this.
 */
const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);
function div(parent: HTMLElement, s: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("div");
  css(d, { position: "absolute", pointerEvents: "none", ...s });
  parent.appendChild(d);
  return d;
}

const FAMILY = `"${TYPE.family}", system-ui, sans-serif`;
const stretch = (n: number) => `${n}%`;
/** A token colour at an opacity. */
const alpha = (c: string, a: number) => `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},${a})`;
/** Every speaker's name is quiet ink; Nova's is her own colour. A name reads without its colour. */
const NAME_INK: Record<string, string> = { Nova: COLOR.sky };

/**
 * The least time a caption stays on screen, in seconds. Heard (the voice is saying it): 1.5 plus 0.3
 * for every word, since the ear carries the line and the eye only follows. Read alone (sound off, or no
 * clip): 1 plus 0.67 for every word, the pace of a Grade 3 reader (about 90 words a minute).
 */
export const readingTime = (text: string, heard = true) => {
  const n = text.trim().split(/\s+/).filter(Boolean).length;
  return heard ? 1.5 + 0.3 * n : 1 + 0.67 * n;
};

/** A word with a hyphen in it ("co-pilot") is never broken across two lines: the hyphen becomes a non-breaking one. */
export const keepWhole = (text: string) => text.replace(/(\p{L})-(?=\p{L})/gu, "$1\u2011");

/**
 * Break a spoken line into captions that each fit their plate. `fits(piece)` says whether a piece
 * does (for the film: in two lines at the width of this screen). A break falls at the end of a
 * sentence when the back half of the piece has one, else at a comma, else between two words, and
 * a single word is never left over for the last caption.
 */
export function splitCaption(text: string, fits: (piece: string) => boolean): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean), out: string[] = [];
  let i = 0;
  while (i < words.length) {
    let n = words.length - i;
    while (n > 1 && !fits(words.slice(i, i + n).join(" "))) n--;
    if (i + n < words.length) {
      const stop = (re: RegExp) => { for (let k = n; k > Math.max(1, Math.floor(n * 0.45)); k--) if (re.test(words[i + k - 1])) return k; return 0; };
      n = stop(/[.!?\u2026]["')]?$/) || stop(/[,;:]$/) || n;
      // no natural stop: share the words out, so the last caption is never two or three stragglers
      const rest = words.length - (i + n);
      if (rest > 0 && rest < 4 && n > 5 && !/[.!?\u2026,;:]["')]?$/.test(words[i + n - 1])) n = Math.ceil((n + rest) / 2);
      if (words.length - (i + n) === 1 && n > 2) n--;
    }
    out.push(words.slice(i, i + n).join(" "));
    i += n;
  }
  return out;
}

/**
 * When each caption of a spoken line goes up (seconds from the first word), and how long the line
 * holds the screen in all. A caption gets its share of the speech and never less than its reading
 * time, so a slow reader is never cut off; `hold` is at least the length of the speech.
 */
export function scheduleCaptions(pieces: string[], spoken: number, heard = true) {
  const total = pieces.reduce((n, c) => n + c.length, 0) || 1;
  let t = 0;
  const starts = pieces.map((c) => { const at = t; t += Math.max(readingTime(c, heard), spoken * (c.length / total)); return at; });
  return { starts, hold: Math.max(t, spoken) };
}

export interface Overlay {
  caption(speaker: string, text: string): void;
  /**
   * Lift captions clear of a panel docked at the bottom of the frame (px from the bottom). `left`
   * moves the caption to the bottom-left corner, clear of whatever sits at the bottom centre.
   */
  captionAt(bottomPx: number, side?: "centre" | "left", maxWidthPx?: number): void;
  /**
   * A title card: one title in the display voice and an optional plain line under it. The first
   * argument is kept so earlier callers compile, and is not shown: a title carries no label above it.
   * `at: "top"` or `"low"` keeps the middle of the frame clear for what the shot is showing.
   */
  card(kicker: string, main: string, sub?: string, at?: "centre" | "top" | "low"): void;
  fade(opacity: number, color?: string): void;
  lids(open: number): void;
  blur(px: number): void;
  timer(fraction: number | null): void;
  dispose(): void;
}

export function createOverlay(container: HTMLElement, canvas: HTMLCanvasElement): Overlay {
  const ease = MOTION.ease;
  const root = div(container, { inset: "0", fontFamily: FAMILY, overflow: "hidden", color: INK[1] });
  root.style.setProperty("-webkit-font-smoothing", "antialiased");
  // eyelids: wide, shallow arcs, so that shut means shut right to the corners of the frame
  const lidT = div(root, { left: "-20%", width: "140%", top: "0", height: "0%", background: COLOR.void, borderRadius: "0 0 50% 50% / 0 0 18% 18%" });
  const lidB = div(root, { left: "-20%", width: "140%", bottom: "0", height: "0%", background: COLOR.void, borderRadius: "50% 50% 0 0 / 18% 18% 0 0" });
  const fade = div(root, { inset: "0", background: COLOR.void, opacity: "0" });

  // title card: a soft shade of the void behind the words, so they keep their contrast over any shot
  const card = div(root, { inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: "0", transition: `opacity 700ms ${ease}`, padding: "0 6%" });
  const main = document.createElement("div"), sub = document.createElement("div");
  css(main, { fontWeight: String(TYPE.display.weight), fontStretch: stretch(TYPE.display.stretch), textTransform: "uppercase", fontSize: "clamp(32px, 7.4vw, 88px)", letterSpacing: "0.08em", lineHeight: "1.02", maxWidth: "100%", overflowWrap: "anywhere" });
  css(sub, { fontWeight: String(TYPE.body.weight), fontSize: "clamp(17px, 1.9vw, 22px)", lineHeight: "1.4", marginTop: "16px", color: INK[2] });
  card.append(main, sub);

  // caption: the speaker's name, then the line, on a near-black plate with a hairline
  const cap = div(root, { left: "50%", bottom: "20px", transform: "translateX(-50%)", width: "max-content", maxWidth: "min(92%, 760px)", display: "flex", alignItems: "baseline", gap: "14px", background: alpha(COLOR.panel, 0.92), border: `1px solid ${LINE[1]}`, padding: "11px 20px 12px", borderRadius: `${RADIUS.chip}px`, opacity: "0", transition: `opacity ${MOTION.quick}ms ${ease}, bottom ${MOTION.route}ms ${ease}` });
  const chip = document.createElement("span"), text = document.createElement("span");
  css(chip, { flex: "none", fontWeight: "600", fontStretch: stretch(TYPE.label.stretch), fontSize: `${TYPE.min.body}px`, letterSpacing: "0.1em", textTransform: "uppercase", color: INK[2] });
  css(text, { fontWeight: String(TYPE.body.weight), fontSize: "clamp(17px, 0.6vw + 14px, 21px)", lineHeight: "1.4", color: INK[1], textWrap: "pretty" } as Partial<CSSStyleDeclaration>);
  cap.append(chip, text);
  cap.setAttribute("aria-hidden", "true");
  card.setAttribute("aria-hidden", "true");

  let compact = false;
  const barW = div(root, { left: "50%", bottom: "10px", transform: "translateX(-50%)", width: "200px", height: "2px", borderRadius: "1px", background: LINE[1], opacity: "0", transition: `opacity ${MOTION.quick}ms ${ease}` });
  const bar = div(barW, { position: "relative", height: "100%", width: "0", background: COLOR.approach, borderRadius: "1px" });

  return {
    caption(speaker, txt) {
      if (txt) {
        chip.textContent = speaker;
        chip.style.display = speaker && !compact ? "" : "none";
        chip.style.color = NAME_INK[speaker] ?? INK[2];
        text.textContent = txt;
      }
      cap.style.opacity = txt ? "1" : "0"; // the words stay in place while the plate fades out
      cap.setAttribute("aria-hidden", txt ? "false" : "true");
    },
    captionAt(px, side = "centre", maxPx) {
      cap.style.bottom = `${px}px`; barW.style.bottom = `${Math.max(8, px - 10)}px`;
      const left = side === "left" ? Math.min(64, Math.max(12, (root.clientWidth || 800) * 0.04)) : 0;
      css(cap, side === "left"
        ? { left: `${left}px`, transform: "none", maxWidth: maxPx ? `${Math.round(maxPx)}px` : "min(36%, 440px)" }
        : { left: "50%", transform: "translateX(-50%)", maxWidth: maxPx ? `${Math.round(maxPx)}px` : "min(92%, 760px)" });
      // a narrow plate keeps its words: the speaker's name goes (the face and the place say who is talking)
      compact = (maxPx ?? root.clientWidth) < 520;
      chip.style.display = compact || !chip.textContent ? "none" : "";
      cap.style.padding = compact ? "9px 14px 10px" : "11px 20px 12px";
    },
    card(_kicker, m, s = "", at = "centre") {
      if (m) {
        css(card, at === "top"
          ? { justifyContent: "flex-start", padding: "max(7vh, 60px) 6% 0", background: `linear-gradient(180deg, ${alpha(COLOR.void, 0.8)} 0%, ${alpha(COLOR.void, 0.45)} 20%, ${alpha(COLOR.void, 0)} 38%)` }
          : at === "low"
            ? { justifyContent: "flex-end", padding: "0 6% max(9vh, 72px)", background: `linear-gradient(0deg, ${alpha(COLOR.void, 0.8)} 0%, ${alpha(COLOR.void, 0.45)} 20%, ${alpha(COLOR.void, 0)} 38%)` }
            : { justifyContent: "center", padding: "0 6%", background: `radial-gradient(ellipse 62% 46% at 50% 50%, ${alpha(COLOR.void, 0.78)} 0%, ${alpha(COLOR.void, 0.5)} 55%, ${alpha(COLOR.void, 0)} 100%)` });
        main.style.fontSize = at === "centre" ? "clamp(32px, 7.4vw, 88px)" : "clamp(28px, 5.2vw, 64px)";
        main.textContent = m;
        sub.textContent = s;
        sub.style.display = s ? "" : "none";
      }
      card.style.opacity = m ? "1" : "0";
      card.setAttribute("aria-hidden", m ? "false" : "true");
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
    dispose: () => { canvas.style.filter = "none"; root.remove(); },
  };
}
