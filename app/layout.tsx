import type { Viewport } from "next";
import "./globals.css";

export const metadata = {
  title: "Atlas Ops Globe",
  description: "Real-time global intelligence visualization scaffold",
};

// Without this, mobile browsers assume a ~980px layout width and scale the page
// down — so the responsive breakpoints never fire and the HUD renders oversized
// and clipped. `device-width` makes the layout track the real screen.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#06090d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
