"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export type TripNavThemeStyle = CSSProperties & Record<string, string>;

type TripNavThemeContextValue = {
  navThemeStyle: TripNavThemeStyle | null;
  setNavThemeStyle: (style: TripNavThemeStyle | null) => void;
};

const TripNavThemeContext = createContext<TripNavThemeContextValue | null>(null);

export function TripNavThemeProvider({ children }: { children: ReactNode }) {
  const [navThemeStyle, setNavThemeStyleState] = useState<TripNavThemeStyle | null>(null);

  const setNavThemeStyle = useCallback((style: TripNavThemeStyle | null) => {
    setNavThemeStyleState(style);
  }, []);

  const value = useMemo(
    () => ({ navThemeStyle, setNavThemeStyle }),
    [navThemeStyle, setNavThemeStyle],
  );

  return <TripNavThemeContext.Provider value={value}>{children}</TripNavThemeContext.Provider>;
}

export function useTripNavTheme(): TripNavThemeStyle | null {
  return useContext(TripNavThemeContext)?.navThemeStyle ?? null;
}

export function useTripNavThemeSetter(): (style: TripNavThemeStyle | null) => void {
  return useContext(TripNavThemeContext)?.setNavThemeStyle ?? (() => {});
}
