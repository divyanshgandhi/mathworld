"use client";
import { Dialog, DialogBackdrop, DialogContent, DialogDescription, DialogTitle } from "@ui-sdk/react/dialog";
import type { ReactNode } from "react";
import { Button, PillLink } from "@/components/kit/Button";
import { Icon } from "@/components/kit/Icon";
import { PlanetSprite } from "@/components/world/PlanetSprite";
import type { TrickId } from "@/rig/tricks";
import type { BodyId } from "@/worlds/space/bodies";
import { backdrop, dialogBox } from "./ui";
import { POWERUP_DOES, PowerUpGlyph, SECTOR_LOCK_DOES } from "./PowerUpGlyph";
import { css } from "./cockpit";
import { STOP_WORDS } from "@/components/world/words";

/** What each planet teaches, in a child's words (the briefing card): the Star map's words, one source. */
export const PLANET_TEACHES: Record<string, string> = Object.fromEntries(Object.entries(STOP_WORDS).map(([id, w]) => [id, w.long]));

/**
 * One designed moment over the battle: a scrim (no blur), a sheet, a title, a few plain words and
 * exactly one primary action. `dismissible` lets Escape close it (only where closing is harmless).
 */
export function Card({ open, title, children, actions, art, dismissible = false, onClose, label }: {
  open: boolean; title: ReactNode; children?: ReactNode; actions: ReactNode; art?: ReactNode; dismissible?: boolean; onClose?: () => void; label?: string;
}) {
  return (
    <Dialog open={open} dismissible={dismissible} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogBackdrop className={backdrop} />
      <DialogContent className={`${dialogBox} ${css.card}`} data-art={art ? "" : undefined} aria-label={label} initialFocus="[data-primary]">
        {art && <div className={css.cardArt}>{art}</div>}
        <DialogTitle className={css.cardTitle}>{title}</DialogTitle>
        {children && <DialogDescription render={<div />} className={`${css.cardBody} flex flex-col items-center gap-2`}>{children}</DialogDescription>}
        <div className={css.cardActions}>{actions}</div>
      </DialogContent>
    </Dialog>
  );
}

/** Before launch: the planet, what it teaches, how to win, Launch (and a quiet way back to the Star map). */
export function BriefingCard({ open, body, name, teaches, win, onLaunch }: {
  open: boolean; body: BodyId | null; name: string; teaches: string; win: string; onLaunch: () => void;
}) {
  return (
    <Card open={open} title={name} label={`${name} briefing`}
      art={body && <PlanetSprite id={body} size={132} alt="" />}
      actions={<>
        <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={onLaunch}>Launch</Button>
        {/* the wrong planet tapped on the map: a quiet way back that is not the browser */}
        <PillLink href="/map" variant="quiet" size="sm" icon="map" className="w-full justify-center">Star map</PillLink>
      </>}>
      <p className={css.cardText}>{teaches}</p>
      <p className={css.cardText}><b>{win}</b></p>
    </Card>
  );
}

/** A trick just landed on the belt: its name, what it does to the fleet, Got it. */
export function UnlockCard({ open, id, name, sector, onClose }: { open: boolean; id: TrickId; name: string; sector?: boolean; onClose: () => void }) {
  return (
    <Card open={open} title={name} dismissible onClose={onClose} label={`New Power-Up: ${name}`}
      art={<span className={css.puBadge}><PowerUpGlyph id={id} lock={sector} size={40} /></span>}
      actions={<Button variant="primary" size="md" glyph={false} data-primary className="w-full" onClick={onClose}>Got it</Button>}>
      <p className={css.cardText}>A new Power-Up. {sector ? SECTOR_LOCK_DOES : POWERUP_DOES[id]}</p>
      <p className={css.cardText}>Tap it any time. It is free.</p>
    </Card>
  );
}

/** The Hyper-Jump offer, in plain words. */
export function OfferCard({ open, title, name, body, onJump, onStay }: { open: boolean; title: string; name: string; body: BodyId | null; onJump: () => void; onStay: () => void }) {
  return (
    <Card open={open} title={title} label="Hyper-Jump"
      art={body && <PlanetSprite id={body} size={112} alt="" />}
      actions={<>
        <Button variant="primary" size="md" data-primary className="w-full justify-between" onClick={onJump}>Jump</Button>
        <Button variant="secondary" size="md" className="w-full" onClick={onStay}>Stay here</Button>
      </>}>
      <p className={css.cardText}>You are flying through these. Jump ahead to <b>{name}</b>?</p>
    </Card>
  );
}

/** A planet cleared: the planet in a gold ring, "<planet> is clear", the orbs earned, one way on. */
export function ClearCard({ open, body, title, sub, orbs, actions }: {
  open: boolean; body: BodyId | null; title: string; sub?: string;
  /** What this card pays for (a planet clear, a practice run), never a running total: the lines add up to `amount`. */
  orbs: { amount: number; lines: { label: string; amount: number }[] } | null;
  actions: ReactNode;
}) {
  return (
    <Card open={open} title={title} label={title}
      art={body && <span className={`${css.planetRing} mb-2 mt-2`}><PlanetSprite id={body} size={128} alt="" /></span>}
      actions={actions}>
      {orbs && orbs.amount > 0 && <p className={css.orbsLine}><Icon name="orb" size={24} />+{orbs.amount}<small>orbs</small></p>}
      {orbs && orbs.amount > 0 && <p className={css.cardText}>{orbs.lines.map((l, i) => <span key={l.label}>{i ? " · " : ""}{l.label}{orbs.lines.length > 1 ? <> <b>+{l.amount}</b></> : null}</span>)}</p>}
      {sub && <p className={css.cardText}>{sub}</p>}
    </Card>
  );
}
