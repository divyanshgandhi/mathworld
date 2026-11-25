/** The bodies of Math World and the names the player reads. No three.js here, so 2D code can import it cheaply. */
export type BodyId = "sun" | "mercury" | "venus" | "earth" | "moon" | "mars" | "asteroid-belt" | "jupiter" | "saturn" | "uranus" | "neptune" | "deep-space";

/** Every body, in order from the Sun. */
export const BODY_IDS: readonly BodyId[] = ["sun", "mercury", "venus", "earth", "moon", "mars", "asteroid-belt", "jupiter", "saturn", "uranus", "neptune", "deep-space"];

/** The names the player reads (also the sprites' alt text). */
export const BODY_NAME: Record<BodyId, string> = {
  sun: "The Sun", mercury: "Mercury", venus: "Venus", earth: "Earth", moon: "The Moon", mars: "Mars", "asteroid-belt": "The Asteroid Belt",
  jupiter: "Jupiter", saturn: "Saturn", uranus: "Uranus", neptune: "Neptune", "deep-space": "Deep Space",
};
