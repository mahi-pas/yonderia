import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import "./globals.css";

const displayFont = Space_Grotesk({
  weight: ["500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const siteOrigin =
  process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);

export const metadata: Metadata = {
  metadataBase: siteOrigin ? new URL(siteOrigin) : undefined,
  title: {
    default: "Yonderia – Plan & Share Adventures with Your People",
    template: "%s | Yonderia",
  },
  description:
    "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan adventures together on Yonderia.",
  icons: {
    icon: "/yonderia_logo.jpg",
  },
  openGraph: {
    title: "Yonderia – Plan & Share Adventures with Your People",
    description:
      "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan adventures together on Yonderia.",
    type: "website",
    images: [{ url: "/yonderia_logo.jpg", alt: "Yonderia – Plan adventures with your people" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yonderia – Plan & Share Adventures with Your People",
    description:
      "Create and share trip itineraries with friends. Coordinate dates, locations, and activities in one place. Plan adventures together on Yonderia.",
    images: ["/yonderia_logo.jpg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-background text-foreground antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
