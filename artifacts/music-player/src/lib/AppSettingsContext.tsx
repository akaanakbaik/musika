import React, { createContext, useContext, useEffect, useState } from "react";
import type { Lang } from "./i18n";

export type AccentColor = "#1DB954" | "#FF0000" | "#FF4E6B" | "#FF5500" | string;
export type Theme = "dark" | "light";

interface AppSettings {
  theme: Theme;
  accentColor: AccentColor;
  lang: Lang;
  setTheme: (t: Theme) => void;
  setAccentColor: (c: AccentColor) => void;
  setLang: (l: Lang) => void;
}

const AppSettingsContext = createContext<AppSettings | null>(null);

const STORAGE_KEY = "musika-settings-v1";

const DEFAULTS = {
  theme: "dark" as Theme,
  accentColor: "#1DB954" as AccentColor,
  lang: "id" as Lang,
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

function saveSettings(s: Partial<typeof DEFAULTS>) {
  try {
    const cur = loadSettings();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cur, ...s }));
  } catch {}
}

function applyTheme(theme: Theme, accent: AccentColor) {
  const root = document.documentElement;
  if (theme === "light") {
    root.classList.remove("dark-theme");
    root.classList.add("light-theme");
    root.style.setProperty("--bg-primary", "#F5F5F5");
    root.style.setProperty("--bg-secondary", "#EBEBEB");
    root.style.setProperty("--bg-card", "#FFFFFF");
    root.style.setProperty("--text-primary", "#121212");
    root.style.setProperty("--text-secondary", "#404040");
    root.style.setProperty("--border-color", "rgba(0,0,0,0.12)");
  } else {
    root.classList.remove("light-theme");
    root.classList.add("dark-theme");
    root.style.setProperty("--bg-primary", "#121212");
    root.style.setProperty("--bg-secondary", "#181818");
    root.style.setProperty("--bg-card", "#282828");
    root.style.setProperty("--text-primary", "#FFFFFF");
    root.style.setProperty("--text-secondary", "rgba(255,255,255,0.7)");
    root.style.setProperty("--border-color", "rgba(255,255,255,0.08)");
  }
  root.style.setProperty("--accent", accent);
  const hex = accent.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  root.style.setProperty("--accent-rgb", `${r},${g},${b}`);
}

export function AppSettingsProvider({ children }: { children: React.ReactNode }) {
  const saved = loadSettings();
  const [theme, setThemeState] = useState<Theme>(saved.theme);
  const [accentColor, setAccentState] = useState<AccentColor>(saved.accentColor);
  const [lang, setLangState] = useState<Lang>(saved.lang);

  useEffect(() => {
    applyTheme(theme, accentColor);
  }, [theme, accentColor]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    saveSettings({ theme: t });
    applyTheme(t, accentColor);
  };

  const setAccentColor = (c: AccentColor) => {
    setAccentState(c);
    saveSettings({ accentColor: c });
    applyTheme(theme, c);
  };

  const setLang = (l: Lang) => {
    setLangState(l);
    saveSettings({ lang: l });
  };

  return (
    <AppSettingsContext.Provider value={{ theme, accentColor, lang, setTheme, setAccentColor, setLang }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const ctx = useContext(AppSettingsContext);
  if (!ctx) throw new Error("useAppSettings must be used within AppSettingsProvider");
  return ctx;
}
