import type { Metadata, Viewport } from "next";
import { RouteFade } from "@/components/kit/RouteFade";
import { SoundToggle } from "@/components/SoundToggle";
import { COLOR } from "@/design/tokens";
import "./globals.css";
import "@/components/kit/kit.css";

export const metadata: Metadata = {
  title: "Math World",
  description: "Answer to fire. Learn from the miss. Climb the solar system.",
};

export const viewport: Viewport = { themeColor: COLOR.void, colorScheme: "dark" };

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
