import { Suspense, lazy, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useTheme } from "../theme";
import { useCosmos } from "../cosmos";

const CosmosCanvas = lazy(() => import("./CosmosCanvas"));

function capable() {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

/** Fixed full-viewport 3D cosmos behind the whole app, with a readability scrim.
 *  Lazy-loaded so it never blocks first paint; falls back to the plain UI when
 *  WebGL is unavailable or the user prefers reduced motion / turns it off. */
export default function CosmosBackground() {
  const { theme } = useTheme();
  const { on } = useCosmos();
  const onLogin = useLocation().pathname === "/login";
  const [ok] = useState(capable);
  const [hidden, setHidden] = useState(document.hidden);
  // Login is always immersive (first impression); the app respects the toggle.
  const active = (on || onLogin) && ok;

  // Toggle the global class that makes surfaces translucent (glass over cosmos).
  useEffect(() => {
    document.documentElement.classList.toggle("cosmos-on", active);
    return () => document.documentElement.classList.remove("cosmos-on");
  }, [active]);

  // Pause rendering when the tab is hidden (battery/CPU).
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  if (!active) return null;

  return (
    <>
      <div className="cosmos-canvas" aria-hidden="true">
        {!hidden && (
          <Suspense fallback={null}>
            <CosmosCanvas dark={theme === "dark"} intro={onLogin} />
          </Suspense>
        )}
      </div>
      <div className="cosmos-scrim" aria-hidden="true" />
    </>
  );
}
