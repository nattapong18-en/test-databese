import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Pulseboard — Realtime Stocks", description: "A simulated realtime stock dashboard" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
