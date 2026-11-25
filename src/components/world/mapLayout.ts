/**
 * Where everything sits on one page of the Star map pager, from the page's size. Pure, so it is tested.
 *
 * - `side` (wider than tall): the planet left of centre, its card to the right, the two centred as one group.
 *   When the page is short (a phone on its side) the journey dots sit under the planet, not under the page.
 * - `stack` (taller than wide): the planet above, its card below, the dots at the bottom.
 *
 * Every page of one size shares one geometry, so the planet arrives at the same spot on every page.
 */
export interface MapLayout {
  mode: "side" | "stack";
  /** The page's width. */
  w: number;
  /** A short page: the card sets itself tighter (and, on its side, the dots move under the planet). */
  short: boolean;
  /** The hero planet's size and centre, in page pixels. */
  hero: number; heroCx: number; heroCy: number;
  /** The card's left edge and widest width; in `side` it is centred on `cardCy`, in `stack` it starts at `cardTop`. */
  cardLeft: number; cardMaxW: number; cardCy: number; cardTop: number;
  /** The neighbours that peek in: their size and centres (they may sit half off the page). */
  peek: number; peekLeftCx: number; peekRightCx: number;
  /** The two arrow buttons: their left edges and their centre line. */
  arrowY: number; arrowLeftX: number; arrowRightX: number;
  /** The dots row: its centre, its top edge and the width of one dot's button (44 px where there is room). */
  dotsCx: number; dotsTop: number; dotEach: number;
}

export const ARROW = 48;
export const DOTS_H = 52;
/** The journey's ten stops, one dot each. */
const STOPS = 10;
const CARD_MAX = 420, CARD_MIN = 320;
/** Sprite sizes are drawn in 8 px steps, so a small resize never redraws a planet. */
const step = (n: number) => Math.max(8, Math.floor(n / 8) * 8);
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

export function mapLayout(w: number, h: number, cardH: number, cardW = 0): MapLayout {
  const side = w >= 600 && w > h * 1.1;
  if (side) {
    const short = h < 520, gap = short ? 32 : 56;
    const cardMaxW = Math.min(CARD_MAX, Math.max(CARD_MIN, Math.round(w * 0.42)));
    const roomH = short ? h - DOTS_H - 24 : h - DOTS_H - 40;
    const roomW = w - 2 * (ARROW + 24) - gap - cardMaxW;
    const hero = step(clamp(Math.min(roomH * (short ? 0.92 : 0.74), roomW * 0.9, w * 0.3), 96, 400));
    // centred on the widest card as drawn (a card is as wide as its words), not on the room it may take
    const drawnW = cardW > 0 ? Math.min(cardW, cardMaxW) : cardMaxW;
    const groupW = hero + gap + drawnW;
    const heroCx = Math.round((w - groupW) / 2 + hero / 2);
    const heroCy = Math.round(short ? 12 + roomH / 2 : (h - DOTS_H) / 2);
    const heroL = heroCx - hero / 2, cardLeft = heroCx + hero / 2 + gap, cardR = cardLeft + drawnW;
    const peek = step(clamp(hero * 0.2, 40, 72));
    const arrowL = 16 + ARROW, arrowR = w - 16 - ARROW;
    // a neighbour sits midway in the gutter when it fits there, else half off the page's edge
    const peekLeftCx = heroL - arrowL >= peek + 24 ? Math.round((arrowL + heroL) / 2) : 0;
    const peekRightCx = arrowR - cardR >= peek + 24 ? Math.round((cardR + arrowR) / 2) : w;
    return {
      mode: "side", w, short, hero, heroCx, heroCy,
      cardLeft: Math.round(cardLeft), cardMaxW, cardCy: short ? Math.round(h / 2) : heroCy, cardTop: 0,
      peek, peekLeftCx, peekRightCx,
      arrowY: heroCy, arrowLeftX: 16, arrowRightX: w - 16 - ARROW,
      // a phone on its side keeps the dots in the planet's column, clear of the card
      dotsCx: short ? Math.round((cardLeft - 16) / 2) : Math.round(w / 2), dotsTop: short ? Math.round(heroCy + hero / 2 + 8) : h - DOTS_H - 4,
      dotEach: Math.min(44, Math.floor(((short ? cardLeft - 16 : w) - 16) / STOPS)),
    };
  }
  const cardMaxW = Math.min(CARD_MAX, w - 32);
  const stageH = h - cardH - DOTS_H - 12;
  const hero = step(clamp(Math.min(stageH - 32, w * 0.56), 88, 360));
  // the planet and the tallest card centred as one column above the dots
  const top = Math.max(12, (h - DOTS_H - 12 - (hero + 24 + cardH)) / 2);
  const heroCx = Math.round(w / 2), heroCy = Math.round(top + hero / 2);
  const cardTop = Math.round(top + hero + 24);
  const peek = step(clamp(hero * 0.26, 32, 56));
  const arrowLeftX = Math.max(8, Math.round(heroCx - hero / 2 - ARROW - 10));
  return {
    mode: "stack", w, short: h < 600, hero, heroCx, heroCy,
    cardLeft: Math.round((w - cardMaxW) / 2), cardMaxW, cardCy: 0, cardTop,
    peek, peekLeftCx: 0, peekRightCx: w,
    arrowY: heroCy, arrowLeftX, arrowRightX: w - arrowLeftX - ARROW,
    dotsCx: heroCx, dotsTop: h - DOTS_H - 4, dotEach: Math.min(44, Math.floor((w - 16) / STOPS)),
  };
}
