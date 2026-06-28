import { useState, useEffect, useCallback } from "react";

export function getInitialTheme() {
  try {
    return localStorage.getItem("theme") || "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {}
}

/** Theme state shared across ALL consumers in the tab (custom event) and across
 *  tabs (storage). Without the same-tab broadcast, only the toggling component
 *  updated and others (e.g. the 3D background) stayed stale until a refresh. */
export function useTheme() {
  const [theme, setThemeState] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    const sync = () => setThemeState(getInitialTheme());
    window.addEventListener("theme-change", sync);
    const onStorage = (e) => { if (e.key === "theme") sync(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("theme-change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const setTheme = useCallback((t) => {
    applyTheme(t);
    setThemeState(t);
    window.dispatchEvent(new Event("theme-change")); // notify other consumers in this tab
  }, []);

  const toggle = useCallback(() => {
    setTheme(getInitialTheme() === "dark" ? "light" : "dark");
  }, [setTheme]);

  return { theme, toggle, setTheme };
}
