/**
 * The teaching kit: the Field Manual, first-visit greetings, the guided first shot, ship sprites.
 * Mounting steps for every screen are in docs/overhaul/w2-manual.md.
 */
export { FieldManual } from "./FieldManual";
export { Greeting } from "./Greeting";
export { FirstShotGuide } from "./FirstShotGuide";
export { ShipSprite, useShipSprite } from "./ShipSprite";
export { ManualPicture } from "./ManualScenes";
export { useReducedMotion, useLoop } from "./motion";
export { Tour, ScreenTour, useTour, findAnchor, pageBusy } from "./Tour";
export { TOURS, TOUR_IDS, tourKey, type TourId, type TourStep } from "@/teach/tour";
export { tourState } from "@/teach/tourState";
export { useSeen, memorySource, resetSeen, type SeenSource } from "@/teach/seen";
