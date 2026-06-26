/** Material 3 theme — colors resolve to CSS variables so light/dark can swap.
 *  Channel triplets live in index.css under :root (light) and .dark (dark). */
const c = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        "on-primary-fixed": c("--on-primary-fixed"), "surface": c("--surface"),
        "on-error-container": c("--on-error-container"), "secondary-fixed-dim": c("--secondary-fixed-dim"),
        "surface-container-lowest": c("--surface-container-lowest"), "inverse-on-surface": c("--inverse-on-surface"),
        "primary": c("--primary"), "surface-container-low": c("--surface-container-low"),
        "on-primary-container": c("--on-primary-container"), "secondary-fixed": c("--secondary-fixed"),
        "primary-fixed": c("--primary-fixed"), "secondary": c("--secondary"), "surface-tint": c("--surface-tint"),
        "outline": c("--outline"), "on-primary-fixed-variant": c("--on-primary-fixed-variant"),
        "surface-container-highest": c("--surface-container-highest"), "background": c("--background"),
        "on-surface": c("--on-surface"), "surface-variant": c("--surface-variant"), "surface-dim": c("--surface-dim"),
        "secondary-container": c("--secondary-container"), "on-secondary": c("--on-secondary"),
        "inverse-primary": c("--inverse-primary"), "tertiary-container": c("--tertiary-container"),
        "on-surface-variant": c("--on-surface-variant"), "surface-container-high": c("--surface-container-high"),
        "error": c("--error"), "surface-container": c("--surface-container"), "surface-bright": c("--surface-bright"),
        "on-primary": c("--on-primary"), "tertiary": c("--tertiary"), "outline-variant": c("--outline-variant"),
        "primary-container": c("--primary-container"), "on-background": c("--on-background"),
        "warning-amber": c("--warning-amber"),
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      spacing: {
        "unit-xs": "4px", "unit-sm": "8px", "unit-md": "16px", "unit-lg": "24px",
        "unit-xl": "40px", "gutter": "24px", "margin-desktop": "48px", "margin-mobile": "16px",
      },
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      fontSize: {
        "label-md": ["12px", { lineHeight: "1", letterSpacing: "0.02em", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "1.5" }],
        "body-lg": ["16px", { lineHeight: "1.6" }],
        "headline-md": ["20px", { lineHeight: "1.4", letterSpacing: "-0.01em", fontWeight: "500" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "600" }],
      },
      scale: { 102: "1.02" },
    },
  },
};
