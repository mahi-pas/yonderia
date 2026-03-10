import type { ReactNode } from "react";
import type { Metadata } from "next";
import { Baloo_2, Manrope } from "next/font/google";
import AuthProvider from "@/components/auth/AuthProvider";
import "./globals.css";

const displayFont = Baloo_2({
  subsets: ["latin"],
  variable: "--font-display",
});

const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Yonderia",
  description: "Plan adventures with your people.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${displayFont.variable} ${bodyFont.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
