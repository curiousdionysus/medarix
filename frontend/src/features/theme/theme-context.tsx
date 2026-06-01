import * as React from "react";
import { storage } from "@/lib/api";

type ThemeMode = "light" | "dark" | "system";

interface ThemeState {
  mode: ThemeMode;
  resolved: "light" | "dark";
  highContrast: boolean;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
  setHighContrast: (on: boolean) => void;
}

const ThemeContext = React.createContext<ThemeState | null>(null);

function systemPrefersDark() {
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = React.useState<ThemeMode>(
    () => (storage.get("theme") as ThemeMode) || "dark",
  );
  const [highContrast, setHC] = React.useState(() => storage.get("contrast") === "high");
  const [resolved, setResolved] = React.useState<"light" | "dark">(() =>
    mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode,
  );

  React.useEffect(() => {
    const next = mode === "system" ? (systemPrefersDark() ? "dark" : "light") : mode;
    setResolved(next);
    const root = document.documentElement;
    root.classList.toggle("dark", next === "dark");
    root.classList.toggle("contrast-high", highContrast);
    root.style.colorScheme = next;
  }, [mode, highContrast]);

  React.useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => setResolved(mq.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);

  const setMode = React.useCallback((m: ThemeMode) => {
    setModeState(m);
    storage.set("theme", m);
  }, []);

  const setHighContrast = React.useCallback((on: boolean) => {
    setHC(on);
    storage.set("contrast", on ? "high" : "normal");
  }, []);

  const toggle = React.useCallback(() => {
    setMode(resolved === "dark" ? "light" : "dark");
  }, [resolved, setMode]);

  const value = React.useMemo(
    () => ({ mode, resolved, highContrast, setMode, toggle, setHighContrast }),
    [mode, resolved, highContrast, setMode, toggle, setHighContrast],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
