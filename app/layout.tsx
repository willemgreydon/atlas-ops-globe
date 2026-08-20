import "./globals.css";

export const metadata = {
  title: "Atlas Ops Globe",
  description: "Real-time global intelligence visualization scaffold",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
