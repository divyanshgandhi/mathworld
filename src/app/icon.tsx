import { ImageResponse } from "next/og";
import { COLOR } from "@/design/tokens";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The ring logo on the void: a white orbit, a gold inner ring and a small moon (Brand.tsx's RingLogo). */
export function ringLogo(px: number) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: COLOR.void, borderRadius: px * 0.22 }}>
      <svg width={px * 0.8} height={px * 0.8} viewBox="0 0 34 34">
        <circle cx="17" cy="17" r="14.6" fill="none" stroke={COLOR.approach} strokeWidth="1.9" />
        <circle cx="17" cy="17" r="7.3" fill="none" stroke={COLOR.gold} strokeWidth="1.9" />
        <circle cx="28.9" cy="9.2" r="2.6" fill={COLOR.approach} />
      </svg>
    </div>
  );
}

/** The browser tab and bookmark icon. */
export default function Icon() {
  return new ImageResponse(ringLogo(size.width), { ...size });
}
