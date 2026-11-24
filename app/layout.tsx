import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AppFrame from "./components/AppFrame";
import FontCatalogLoader from "./components/FontCatalogLoader";
import SyncManager from "./components/SyncManager";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Rhinestone Template Tool",
  description: "Precision SVG templates for Cricut Maker 3 + Magic Flock",
};

// Real device width, and let the page draw under the notch / home indicator (the studios pad their
// bottom bar with env(safe-area-inset-bottom)). Zooming is left enabled for accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-[radial-gradient(circle_at_top,_rgba(139,92,246,0.12),_transparent_35%),linear-gradient(180deg,#f7f5f3_0%,#f3f0ee_100%)] text-zinc-900">
        <FontCatalogLoader />
        <SyncManager />
        <AppFrame>{children}</AppFrame>
      </body>
    </html>
  );
}
