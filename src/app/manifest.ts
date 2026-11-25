import type { MetadataRoute } from "next";
import { COLOR } from "@/design/tokens";

/** Installed to a home screen, the game opens full screen on the void, at the Title. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Math World",
    short_name: "Math World",
    description: "A space game for times tables: answer with your shots and clear the planets.",
    start_url: "/",
    display: "standalone",
    orientation: "any",
    background_color: COLOR.void,
    theme_color: COLOR.void,
    icons: [
      { src: "/icon", sizes: "64x64", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
