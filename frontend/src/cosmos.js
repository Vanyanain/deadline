import { useState, useEffect, useCallback } from "react";

export function getCosmos() {
  try {
    return localStorage.getItem("cosmos") || "on";
  } catch {
    return "on";
  }
}

/** Cosmos on/off, persisted + synced across components (mirrors theme.js). */
export function useCosmos() {
  const [mode, setMode] = useState(getCosmos);
  useEffect(() => {
    const sync = () => setMode(getCosmos());
    window.addEventListener("cosmos-change", sync);
    const onStorage = (e) => { if (e.key === "cosmos") sync(); };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("cosmos-change", sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  const toggle = useCallback(() => {
    const next = getCosmos() === "on" ? "off" : "on";
    try { localStorage.setItem("cosmos", next); } catch {}
    window.dispatchEvent(new Event("cosmos-change"));
  }, []);
  return { on: mode === "on", toggle };
}
