import type { Metadata } from "next";
import { MockConsole } from "./MockConsole";

export const metadata: Metadata = { title: "Guide on a mock console · Math World", robots: { index: false, follow: false } };

/** /dev/teach/console: the guided first shot on a stand-in battle (framed by /dev/teach at two sizes). */
export default function MockConsolePage() {
  return <MockConsole />;
}
