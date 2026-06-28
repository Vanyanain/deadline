import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import { useCosmos } from "./cosmos";
import ThemeToggle from "./components/ThemeToggle";

const NAV = [
  { to: "/", icon: "dashboard", label: "Today", end: true },
  { to: "/braindump", icon: "neurology", label: "Brain-dump" },
  { to: "/reality-check", icon: "balance", label: "Reality Check" },
  { to: "/at-risk", icon: "warning", label: "At-Risk" },
  { to: "/calendar", icon: "calendar_month", label: "Calendar" },
  { to: "/habits", icon: "target", label: "Habits" },
  { to: "/coach", icon: "smart_toy", label: "AI Coach" },
];

// Mobile bottom bar — every screen reachable (horizontally scrollable) + profile.
const MOBILE_NAV = [
  { to: "/", icon: "dashboard", label: "Today", end: true },
  { to: "/braindump", icon: "neurology", label: "Dump" },
  { to: "/reality-check", icon: "balance", label: "Reality" },
  { to: "/at-risk", icon: "warning", label: "At-Risk" },
  { to: "/calendar", icon: "calendar_month", label: "Calendar" },
  { to: "/habits", icon: "target", label: "Habits" },
  { to: "/coach", icon: "smart_toy", label: "Coach" },
  { to: "/profile", icon: "account_circle", label: "Profile" },
];

function Item({ to, icon, label, end }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `group flex items-center gap-unit-md px-unit-md py-unit-sm rounded-xl transition-colors ${
          isActive
            ? "bg-primary/15 text-primary"
            : "text-on-surface-variant hover:bg-surface-container-high"
        }`
      }
    >
      <span className="material-symbols-outlined text-xl group-hover:text-primary transition-colors">
        {icon}
      </span>
      <span className="text-body-md">{label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const { on: cosmosOn, toggle: toggleCosmos } = useCosmos();
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar_collapsed") === "1"; } catch { return false; }
  });
  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem("sidebar_collapsed", next ? "1" : "0"); } catch {}
      return next;
    });

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside
        className={`hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant p-unit-md z-40 transition-transform duration-300 ${
          collapsed ? "md:-translate-x-full" : ""
        }`}
      >
        <div className="mb-unit-xl px-unit-md pt-unit-sm flex items-start justify-between gap-2">
          <div>
            <div className="font-headline-md text-headline-md font-black text-primary tracking-tighter">
              Deadline
            </div>
            <div className="text-xs text-on-surface-variant font-medium opacity-60">
              AI-Driven Focus
            </div>
          </div>
          <button
            onClick={toggle}
            title="Hide sidebar"
            aria-label="Hide sidebar"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors shrink-0"
          >
            <span className="material-symbols-outlined text-xl">chevron_left</span>
          </button>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Item key={n.to} {...n} />
          ))}
        </nav>
        <div className="mt-auto flex items-center justify-between px-unit-md pt-unit-md">
          <span className="text-[10px] uppercase tracking-widest text-on-surface-variant/60 font-bold">
            Theme
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleCosmos}
              title={cosmosOn ? "Cosmos background: on" : "Cosmos background: off"}
              aria-label="Toggle cosmos background"
              className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors hover:bg-surface-container-high ${
                cosmosOn ? "text-primary" : "text-on-surface-variant"
              }`}
            >
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </button>
            <ThemeToggle />
          </div>
        </div>
        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `pt-unit-md mt-unit-sm border-t border-outline-variant/30 flex items-center gap-unit-md px-unit-md rounded-xl transition-colors ${
              isActive ? "text-primary" : "hover:bg-surface-container-high"
            }`
          }
        >
          <div className="w-9 h-9 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-xs overflow-hidden shrink-0">
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              initial
            )}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-on-surface truncate">
              {user?.name || "Account"}
            </div>
            <div className="text-[10px] text-on-surface-variant truncate">
              {user?.email || "View profile"}
            </div>
          </div>
        </NavLink>
      </aside>

      {/* Desktop: floating button to bring the sidebar back when hidden */}
      {collapsed && (
        <button
          onClick={toggle}
          title="Show sidebar"
          aria-label="Show sidebar"
          className="hidden md:flex fixed top-3 left-3 z-50 w-10 h-10 rounded-xl bg-surface-container-high border border-outline-variant/40 items-center justify-center text-on-surface-variant hover:text-primary shadow-lg transition-colors"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
      )}

      {/* Main */}
      <div
        className={`flex-1 min-h-screen pb-16 md:pb-0 transition-all duration-300 ${
          collapsed ? "md:ml-0" : "md:ml-64"
        }`}
      >
        <Outlet />
      </div>

      {/* Mobile bottom nav — scrolls horizontally so every screen is reachable */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant flex overflow-x-auto py-2 z-40">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-4 shrink-0 ${
                isActive ? "text-primary" : "text-on-surface-variant"
              }`
            }
          >
            <span className="material-symbols-outlined text-xl">{n.icon}</span>
            <span className="text-[10px]">{n.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
