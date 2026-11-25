import { ImageResponse } from "next/og";
import { ringLogo } from "./icon";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** The home-screen icon on phones and tablets: the ring logo on the void. */
export default function AppleIcon() {
  return new ImageResponse(ringLogo(size.width), { ...size });
}
