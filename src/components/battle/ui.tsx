/**
 * The last shared class strings from the older screens, in the Void and Gold language (see DESIGN.md).
 * The admin screens and the battle's cards and pause menu still use them; new code uses the kit (`@/components/kit`) instead:
 * <Button variant="primary">, <Sheet>, <IconButton>. The sign-up moved to `hub/CadetSignUp.tsx` and the
 * battle's keypad to `battle/Console.tsx`.
 * - `ghost`: a hairline pill (secondary).
 * - `lime`: the primary action, the gradient-edge pill. The old name stays; nothing is lime any more.
 * - `glass`: the rare raised sheet. No glass, no blur, no shadow any more.
 * - `backdrop` and `dialogBox`: dialog parts render in the top layer, so pin the scrim to the whole
 *   screen and centre the box.
 */
const btn = "mw-btn min-h-11 px-4 py-2 text-[15px]";
export const ghost = `${btn} mw-secondary`;
export const lime = `${btn} mw-primary`;
export const glass = "mw-sheet";
export const backdrop = "fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none bg-scrim p-0";
export const dialogBox = `${glass} fixed left-1/2 top-1/2 m-0 max-h-[92dvh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto text-approach`;
