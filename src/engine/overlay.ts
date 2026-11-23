/**
 * The 2D layer over the canvas: captions, titles, fades, eyelids, answer choices and a timer bar.
 * Plain DOM, driven imperatively by the film so it stays in lockstep with the 3D frame.
 */
const css = (el: HTMLElement, s: Partial<CSSStyleDeclaration>) => Object.assign(el.style, s);

function div(parent: HTMLElement, s: Partial<CSSStyleDeclaration>) {
  const d = document.createElement("div");
  css(d, { position: "absolute", pointerEvents: "none", ...s });
  parent.appendChild(d);
  return d;
}

export interface Overlay {
  caption(name: string, text: string): void;
  title(main: string, sub?: string, big?: boolean): void;
  titleOut(): void;
  fade(opacity: number, color?: string): void;
  lids(open: number): void;
  blur(px: number): void;
  choices(options: number[], onPick: (v: number) => void): void;
  hideChoices(): void;
  timer(fraction: number | null): void;
  button(label: string | null, onClick?: () => void): void;
  dispose(): void;
}

export function createOverlay(container: HTMLElement, canvas: HTMLCanvasElement): Overlay {
  const root = div(container, { inset: "0", fontFamily: "var(--font-sans, system-ui), sans-serif" });
  const lidT = div(root, { left: "-10%", width: "120%", height: "62%", top: "0", background: "#000", borderRadius: "0 0 50% 50%", transform: "translateY(-100%)" });
  const lidB = div(root, { left: "-10%", width: "120%", height: "62%", bottom: "0", background: "#000", borderRadius: "50% 50% 0 0", transform: "translateY(100%)" });
  const fade = div(root, { inset: "0", background: "#000", opacity: "0" });
  const title = div(root, { inset: "0", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff", textAlign: "center", transition: "opacity .9s", opacity: "0", textShadow: "0 2px 18px rgba(0,0,0,.45)" });
  const t1 = document.createElement("div"), t2 = document.createElement("div");
  css(t2, { fontSize: "15px", lineHeight: "1.4", letterSpacing: ".18em", marginTop: "14px", opacity: ".85" });
  title.append(t1, t2);
  const cap = div(root, { left: "50%", bottom: "16px", transform: "translateX(-50%)", maxWidth: "80%", background: "rgba(13,14,26,.74)", color: "#f3f1ea", fontSize: "15px", lineHeight: "1.45", padding: "8px 14px", borderRadius: "10px", textAlign: "center", transition: "opacity .3s", opacity: "0" });
  const choices = div(root, { left: "0", right: "0", bottom: "76px", display: "none", justifyContent: "center", gap: "18px" });
  const barW = div(root, { left: "50%", bottom: "8px", transform: "translateX(-50%)", width: "180px", height: "3px", borderRadius: "2px", background: "rgba(255,255,255,.15)", opacity: "0" });
  const bar = div(barW, { position: "relative", height: "100%", width: "0", background: "#b6f23a", borderRadius: "2px" });
  const btn = document.createElement("button");
  css(btn, { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", fontFamily: "inherit", fontSize: "16px", fontWeight: "500", padding: "14px 26px", borderRadius: "999px", border: "0", background: "#b6f23a", color: "#0d0e1a", cursor: "pointer", display: "none" });
  root.appendChild(btn);

  return {
    caption(name, text) {
      cap.innerHTML = "";
      if (name) {
        const b = document.createElement("b");
        css(b, { color: "#b6f23a", fontWeight: "500", marginRight: "6px" });
        b.textContent = name;
        cap.appendChild(b);
      }
      cap.append(text);
      cap.style.opacity = text ? "1" : "0";
    },
    title(main, sub = "", big = true) {
      t1.textContent = main;
      t2.textContent = sub;
      css(t1, big
        ? { font: "400 64px/1 Georgia, 'Times New Roman', serif", letterSpacing: ".32em", paddingLeft: ".32em", fontStyle: "normal" }
        : { font: "italic 400 30px/1 Georgia, 'Times New Roman', serif", letterSpacing: ".04em", paddingLeft: "0" });
      title.style.opacity = "1";
    },
    titleOut: () => void (title.style.opacity = "0"),
    fade(o, color) {
      if (color) fade.style.background = color;
      fade.style.opacity = String(o);
    },
    lids(o) {
      lidT.style.transform = `translateY(${-o * 100}%)`;
      lidB.style.transform = `translateY(${o * 100}%)`;
    },
    blur: (px) => void (canvas.style.filter = px > 0.05 ? `blur(${px}px)` : "none"),
    choices(options, onPick) {
      choices.innerHTML = "";
      for (const v of options) {
        const b = document.createElement("button");
        css(b, { pointerEvents: "auto", fontFamily: "inherit", fontSize: "26px", fontWeight: "500", width: "74px", height: "74px", borderRadius: "50%", border: "2px solid rgba(255,255,255,.8)", background: "rgba(13,14,26,.55)", color: "#fff", cursor: "pointer" });
        b.textContent = String(v);
        b.onclick = () => onPick(v);
        choices.appendChild(b);
      }
      choices.style.display = "flex";
    },
    hideChoices: () => void (choices.style.display = "none"),
    timer(f) {
      barW.style.opacity = f === null ? "0" : "1";
      bar.style.width = `${(f ?? 0) * 100}%`;
    },
    button(label, onClick) {
      btn.style.display = label ? "" : "none";
      if (label) btn.textContent = label;
      btn.onclick = onClick ?? null;
    },
    dispose: () => root.remove(),
  };
}
