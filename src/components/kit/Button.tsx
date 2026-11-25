"use client";
import { Button as UiButton } from "@ui-sdk/react/button";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Icon, RocketGlyph, type IconName } from "./Icon";

export type ButtonVariant = "primary" | "secondary" | "quiet" | "icon";
export type ButtonSize = "sm" | "md" | "lg";

/**
 * The class string for a kit button, for parts that render their own element (a DialogClose,
 * a TabsTab, a DialogTrigger). Everything else should use `<Button>`.
 */
export function buttonClass(variant: ButtonVariant = "secondary", size: ButtonSize = "md", glyph = false) {
  return `mw-btn mw-${variant} ${variant === "icon" ? "" : `mw-${size}`} ${glyph ? "mw-has-glyph" : ""}`.replace(/\s+/g, " ").trim();
}

const GLYPH_SIZE: Record<ButtonSize, number> = { sm: 28, md: 34, lg: 44 };

type UiButtonProps = ComponentProps<typeof UiButton>;
export type KitButtonProps = Omit<UiButtonProps, "className" | "children"> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Primary only: the ring-and-rocket glyph on the right. On by default for `primary`. */
  glyph?: boolean;
  /** An icon before the words (secondary, quiet) or the whole face (icon). */
  icon?: IconName;
  className?: string;
  children?: ReactNode;
};

/**
 * The game's button, on the ui-sdk Button (pending, disabled and link behaviour come from there).
 * - `primary`: the gradient-edge pill with the ring-and-rocket glyph. One per screen.
 * - `secondary`: a hairline pill. `quiet`: words only. `icon`: round, 44 px, needs `aria-label`.
 * Disabled is a neutral dim state on every variant; an accent never fades.
 */
export function Button({ variant = "secondary", size = "md", glyph, icon, className = "", children, ...props }: KitButtonProps) {
  const showGlyph = variant === "primary" && glyph !== false;
  return (
    <UiButton {...props} className={`${buttonClass(variant, size, showGlyph)} ${className}`}>
      {variant === "icon" ? (
        <Icon name={icon ?? "help"} size={20} />
      ) : (
        <>
          {icon && <Icon name={icon} size={size === "sm" ? 18 : 20} />}
          {children}
          {showGlyph && <RocketGlyph size={GLYPH_SIZE[size]} />}
        </>
      )}
    </UiButton>
  );
}

/** A round 44 px icon button. The label names it for screen readers and agents. */
export function IconButton({ icon, label, className = "", ...props }: Omit<KitButtonProps, "variant" | "icon" | "children"> & { icon: IconName; label: string }) {
  return <Button {...props} variant="icon" icon={icon} aria-label={label} title={props.title ?? label} className={className} />;
}

/**
 * A link that looks like a kit button (a Next.js Link rendered through the ui-sdk Button, so a
 * disabled link cannot navigate). Use it for places: "Star map", "Hangar", "Back to the Resting Bay".
 */
export function PillLink({ href, variant = "secondary", size = "md", glyph, icon, className = "", children, disabled, ...props }: Omit<KitButtonProps, "render"> & { href: string }) {
  const showGlyph = variant === "primary" && glyph !== false;
  return (
    <UiButton {...props} disabled={disabled} render={<Link href={href} />} className={`${buttonClass(variant, size, showGlyph)} ${className}`}>
      {variant === "icon" ? <Icon name={icon ?? "home"} size={20} /> : (
        <>
          {icon && <Icon name={icon} size={size === "sm" ? 18 : 20} />}
          {children}
          {showGlyph && <RocketGlyph size={GLYPH_SIZE[size]} />}
        </>
      )}
    </UiButton>
  );
}

/** The home button every screen's top bar can carry: back to the Resting Bay. */
export function HomeLink({ href = "/bay", label = "Resting Bay" }: { href?: string; label?: string }) {
  return <PillLink href={href} variant="icon" icon="home" aria-label={label} title={label} />;
}
