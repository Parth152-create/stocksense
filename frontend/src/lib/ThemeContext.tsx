"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";

type Theme = "dark" | "light";

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  isDark: true,
  toggleTheme: () => {},
  setTheme: () => {},
});

function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "dark") {
    root.style.setProperty("--bg-base",        "#0a0a0a");
    root.style.setProperty("--bg-card",        "#111111");
    root.style.setProperty("--bg-sunken",      "#080808");
    root.style.setProperty("--border",         "#1f1f1f");
    root.style.setProperty("--border-subtle",  "#1a1a1a");
    root.style.setProperty("--text-primary",   "#ffffff");
    root.style.setProperty("--text-secondary", "#888888");
    root.style.setProperty("--text-muted",     "#555555");
    root.style.setProperty("--accent",         "#8FFFD6");
    root.style.setProperty("--accent-end",     "#00c896");
    root.setAttribute("data-theme", "dark");
  } else {
    root.style.setProperty("--bg-base",        "#f4f4f5");
    root.style.setProperty("--bg-card",        "#ffffff");
    root.style.setProperty("--bg-sunken",      "#ebebeb");
    root.style.setProperty("--border",         "#e4e4e7");
    root.style.setProperty("--border-subtle",  "#f0f0f0");
    root.style.setProperty("--text-primary",   "#09090b");
    root.style.setProperty("--text-secondary", "#52525b");
    root.style.setProperty("--text-muted",     "#a1a1aa");
    root.style.setProperty("--accent",         "#00a87a");
    root.style.setProperty("--accent-end",     "#007a58");
    root.setAttribute("data-theme", "light");
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("stocksense-theme") as Theme) ?? "dark";
    setThemeState(saved);
    applyTheme(saved);
  }, []);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("stocksense-theme", t);
    applyTheme(t);
  };

  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ theme, isDark: theme === "dark", toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}