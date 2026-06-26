import { useRef } from "react";

const reducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** A card that tilts in 3D toward the cursor. Ref-based (no re-render). */
export default function TiltCard({ children, className = "", max = 8, style, ...props }) {
  const ref = useRef(null);

  function onMove(e) {
    if (reducedMotion()) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`;
  }

  function reset() {
    if (ref.current) ref.current.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ transition: "transform .25s ease-out", transformStyle: "preserve-3d", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
