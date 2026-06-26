import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "./auth";
import ThemeToggle from "./components/ThemeToggle";

const NAV = [
  { to: "/", icon: "dashboard", label: "Today", end: true },
  { to: "/braindump", icon: "neurology", label: "Brain-dump" },
  { to: "/at-risk", icon: "warning", label: "At-Risk" },
  { to: "/calendar", icon: "calendar_month", label: "Calendar" },
  { to: "/habits", icon: "target", label: "Habits" },
  { to: "/coach", icon: "smart_toy", label: "AI Coach" },
];

// On mobile, the bottom bar can't hold every item — show the essentials + profile.
const MOBILE_NAV = [
  { to: "/", icon: "dashboard", label: "Today", end: true },
  { to: "/braindump", icon: "neurology", label: "Dump" },
  { to: "/at-risk", icon: "warning", label: "At-Risk" },
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
  const initial = (user?.name || user?.email || "?").charAt(0).toUpperCase();

  return (
    <div className="bg-background text-on-background min-h-screen flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col h-screen w-64 fixed left-0 top-0 bg-surface border-r border-outline-variant p-unit-md z-40">
        <div className="mb-unit-xl px-unit-md pt-unit-sm">
          <div className="font-headline-md text-headline-md font-black text-primary tracking-tighter">
            Deadline
          </div>
          <div className="text-xs text-on-surface-variant font-medium opacity-60">
            AI-Driven Focus
          </div>
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
          <ThemeToggle />
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
              {user?.plan || "View profile"}
            </div>
          </div>
        </NavLink>
      </aside>

      {/* Main */}
      <div className="flex-1 md:ml-64 min-h-screen pb-16 md:pb-0">
        <Outlet />
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full bg-surface border-t border-outline-variant flex justify-around py-2 z-40">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 ${
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
