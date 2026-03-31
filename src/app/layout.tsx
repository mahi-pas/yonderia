import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import AppShell from "@/components/navigation/AppShell";
import OfflineBanner from "@/components/ui/OfflineBanner";
import "./globals.css";

const outfit = Outfit({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-sans",
});

const displayFont = Outfit({
  weight: ["700", "900"],
  subsets: ["latin"],
  variable: "--font-display",
});

const siteOrigin =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
  "https://yonderia.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: {
    default: "Yonderia – Plan trips beautifully",
    template: "%s | Yonderia",
  },
  description:
    "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan trips beautifully on Yonderia.",
  icons: {
    icon: [
      { url: "/favicon.jpg", type: "image/jpeg" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    title: "Yonderia – Plan trips beautifully",
    description:
      "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan trips beautifully on Yonderia.",
    type: "website",
    images: [{ url: "/yonderia_logo.jpg", alt: "Yonderia – Plan trips beautifully" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yonderia – Plan trips beautifully",
    description:
      "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan trips beautifully on Yonderia.",
    images: ["/yonderia_logo.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#D02020",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${outfit.variable} ${displayFont.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <OfflineBanner />
        <AuthProvider>
          <AppShell>{children}</AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
