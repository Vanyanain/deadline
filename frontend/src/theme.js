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

/** Theme state synced to <html> class + localStorage. */
export function useTheme() {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Keep multiple toggles (e.g. across route changes) in sync.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "theme" && e.newValue) setTheme(e.newValue);
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback(
    () => setTheme((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  return { theme, toggle, setTheme };
}
