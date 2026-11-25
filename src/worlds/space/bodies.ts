/** The bodies of Math World and the names the player reads. No three.js here, so 2D code can import it cheaply. */
export type BodyId = "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "asteroid-belt" | "jupiter" | "saturn" | "uranus" | "neptune" | "deep-space";

/** Every body, in order from the Sun. */
export const BODY_IDS: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "neptune", "deep-space"];

/** The names the player reads (also the sprites' alt text). */
export const BODY_NAME: Record<BodyId, string> = {
  sun: "The Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", moon: "The Moon", mars: "Mars", "asteroid-belt": "The Asteroid Belt",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", "deep-space": "Deep Space",
};

/**
 * How far a body's sprite reaches past the body itself, as a multiple of its radius (rings, the Sun's halo,
 * the spread of the belt). The sprite square is `2 × extent × 1.04` radii wide, so the body's disc is
 * `spriteDisc(id)` of the square: the size of the hairline circle that holds its place while it renders.
 */
export const SPRITE_EXTENT: Partial<Record<BodyId, number>> = { saturn: 2.25, uranus: 2.05, "asteroid-belt": 1.25, sun: 1.25 };
export const SPRITE_MARGIN = 1.04;
export const spriteDisc = (id: BodyId) => 1 / ((SPRITE_EXTENT[id] ?? 1) * SPRITE_MARGIN);
