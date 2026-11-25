import type { Metadata, Viewport } from "next";
import { RouteFade } from "@/components/kit/RouteFade";
import { SoundToggle } from "@/components/SoundToggle";
import { COLOR } from "@/design/tokens";
import "./globals.css";
import "@/components/kit/kit.css";

export const metadata: Metadata = {
  title: "Math World",
  description: "A space game for times tables: answer with your shots and clear the planets.",
  applicationName: "Math World",
  appleWebApp: { capable: true, title: "Math World", statusBarStyle: "black" },
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
