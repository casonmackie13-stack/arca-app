"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { ThemeMode } from "@/lib/types";

type ThemeContextValue = {
  theme: ThemeMode;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("arca-theme-change", onChange);
      return () => window.removeEventListener("arca-theme-change", onChange);
    },
    () => document.documentElement.dataset.theme === "light" ? "light" : "dark",
    () => "dark" as ThemeMode,
  );

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => {
        const next = theme === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("arca-theme", next);
        window.dispatchEvent(new Event("arca-theme-change"));
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
