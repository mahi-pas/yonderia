"use client";

import type { ReactNode } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import AppNavigation from "./AppNavigation";
import { TripNavThemeProvider } from "./TripNavThemeContext";

type AppShellProps = {
  children: ReactNode;
};

export default function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();

  if (!user) {
    return <>{children}</>;
  }

  return (
    <TripNavThemeProvider>
      <div className="min-h-screen pb-24 md:pb-0">
        <AppNavigation />
        {children}
        <AppNavigation mobile />
      </div>
    </TripNavThemeProvider>
  );
}
