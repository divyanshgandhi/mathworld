import type { Metadata, Viewport } from "next";
import { RouteFade } from "@/components/kit/RouteFade";
import { SoundToggle } from "@/components/SoundToggle";
import { COLOR } from "@/design/tokens";
import "./globals.css";
import "@/components/kit/kit.css";

/**
 * Where the site lives, so a shared link carries absolute addresses for its picture. Vercel names the
 * production host; `MW_SITE_URL` overrides it (a custom domain).
 */
const SITE =
  process.env.MW_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3200");

const DESCRIPTION = "A space game for times tables: answer with your shots and clear the planets.";
/** A shared link shows little more than its title, so this one says what the game is. */
const SHARE_TITLE = "Math World · A space game for times tables";

/** The share picture is the title screen itself: `opengraph-image.png` and `twitter-image.png` beside this file. */
export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: "Math World",
  description: DESCRIPTION,
  applicationName: "Math World",
  appleWebApp: { capable: true, title: "Math World", statusBarStyle: "black" },
  openGraph: { type: "website", siteName: "Math World", title: SHARE_TITLE, description: DESCRIPTION, url: "/", locale: "en_US" },
  twitter: { card: "summary_large_image", title: SHARE_TITLE, description: DESCRIPTION },
};

/**
 * The phone's frame. `viewportFit` stays at the default for now: every full-screen surface must pad
 * with env(safe-area-inset-*) before it can be "cover" (the title, the bay and the kit already do).
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: COLOR.void,
  colorScheme: "dark",
};

/** One void behind every screen, one typeface (Saira, from globals.css), and a fade between routes. */
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full bg-void antialiased">
      <body className="flex min-h-full flex-col bg-void font-sans text-approach">
        <RouteFade>{children}</RouteFade>
        <SoundToggle />
      </body>
    </html>
  );
}
