import { useTheme } from "../theme";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      onClick={toggle}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className={`flex items-center justify-center w-9 h-9 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors ${className}`}
    >
      <span className="material-symbols-outlined text-xl">
        {isDark ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
