import "./cockpit.css";

/**
 * The cockpit's class names. The styles live in `cockpit.css` (global, every class prefixed `mwc-`);
 * `css.fire` is "mwc-fire". The project's CSS pipeline treats every .css file as global, so this
 * stands in for a CSS module.
 */
export const css: Record<string, string> = new Proxy({}, { get: (_, k) => `mwc-${String(k)}` });
