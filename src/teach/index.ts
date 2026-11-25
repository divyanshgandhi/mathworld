/**
 * The teaching layer's logic: copy, seen keys, the manual's pages and pictures, the guided first shot.
 * Components live in src/components/teach. See docs/teaching.md for the script they follow.
 */
export { MAX_WORDS, words, sentences, readMs } from "./words";
export { SEEN_KEY_RE, greetKey, manualKey, GUIDE_FIRST_SHOT } from "./keys";
export { GREETINGS, GREET_SCREENS, type GreetScreen, type GreetLine } from "./greetings";
export { MANUAL_PAGES, MANUAL_TOPICS, pageOf, manualPageKey, type ManualPage, type ManualTopic, type ManualScene } from "./manual";
export { TOURS, TOUR_IDS, TOURED_SCREENS, TOUR_MAX_WORDS, TOUR_MAX_STEPS, tourKey, liveSteps, nextStep, placePlate, ringOf, clipTo, type TourId, type TourStep, type PlatePlace } from "./tour";
export { tourState } from "./tourState";
export { GUIDE_LINES, GUIDE_START, COUNT_MS, guideStep, guideShows, placeCaption, freeArea, type GuideStep, type GuideState, type GuideEvent, type GuideUi, type GuideAnchor, type Box, type Side } from "./guide";
