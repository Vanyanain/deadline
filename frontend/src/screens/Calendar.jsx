import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";

const CAT_COLOR = {
  academic: "#7c7ff0", work: "#6366f1", finance: "#e08a1e",
  health: "#3aa676", personal: "#e8773a", admin: "#8b8b9c",
};

function getWeekDays(offset = 0) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - today.getDay() + 1 + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function isToday(d) {
  return isSameDay(d, new Date());
}

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function DeadlineBadge({ deadline }) {
  if (!deadline) return null;
  const hrs = (new Date(deadline) - new Date()) / 36e5;
  if (hrs < 0) return <span className="text-[9px] text-error font-bold">OVERDUE</span>;
  if (hrs < 24) return <span className="text-[9px] text-warning-amber font-bold">TODAY</span>;
  return null;
}

export default function Calendar() {
  const [tasks, setTasks] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.tasks().then(({ tasks }) => setTasks(tasks || [])).catch(() => {});
  }, []);

  const days = getWeekDays(weekOffset);
  const today = new Date();

  const activeTasks = tasks.filter((t) => t.status !== "done");

  function tasksForDay(day) {
    return activeTasks.filter((t) => {
      if (!t.deadline) return false;
      try {
        return isSameDay(new Date(t.deadline), day);
      } catch {
        return false;
      }
    });
  }

  const noDeadline = activeTasks.filter((t) => !t.deadline);

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24">
      <header className="flex items-center justify-between mb-gutter animate-fade-in-up">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
            Weekly Focus
          </h1>
          <p className="text-on-surface-variant font-body-md">
            {days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} –{" "}
            {days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((o) => o - 1)}
            className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-label-md font-bold hover:bg-surface-container-highest transition-colors"
          >
            This week
          </button>
          <button
            onClick={() => setWeekOffset((o) => o + 1)}
            className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </header>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-1 mb-4 animate-fade-in-up">
        {days.map((day, i) => {
          const dayTasks = tasksForDay(day);
          const isT = isToday(day);
          return (
            <div
              key={i}
              className={`rounded-xl border transition-colors ${
                isT
                  ? "border-primary/40 bg-primary/5"
                  : "border-outline-variant/30 bg-surface-container-lowest"
              }`}
            >
              {/* Day header */}
              <div className={`px-2 py-2 text-center border-b ${isT ? "border-primary/30" : "border-outline-variant/20"}`}>
                <div className="text-[10px] text-on-surface-variant uppercase tracking-widest">
                  {DAY_NAMES[i]}
                </div>
                <div className={`text-lg font-bold leading-none mt-0.5 ${isT ? "text-primary" : "text-on-surface"}`}>
                  {day.getDate()}
                </div>
              </div>

              {/* Tasks for this day */}
              <div className="p-1.5 space-y-1 min-h-[80px]">
                {dayTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="w-full text-left rounded-lg px-2 py-1.5 hover:opacity-80 transition-opacity"
                    style={{
                      background: (CAT_COLOR[t.category] || "#c0c1ff") + "20",
                      borderLeft: `2px solid ${CAT_COLOR[t.category] || "#c0c1ff"}`,
                    }}
                  >
                    <div className="text-[11px] font-medium text-on-surface leading-tight line-clamp-2">
                      {t.title}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-on-surface-variant">{t.effort_minutes ?? 60}m</span>
                      <DeadlineBadge deadline={t.deadline} />
                    </div>
                  </button>
                ))}
                {dayTasks.length === 0 && (
                  <div className="h-full flex items-center justify-center">
                    <span className="text-[10px] text-outline/40">—</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task detail popover */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-surface-container border border-outline-variant/40 rounded-2xl p-unit-lg w-full max-w-sm shadow-2xl animate-fade-in-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-unit-md">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold capitalize"
                style={{
                  background: (CAT_COLOR[selected.category] || "#c0c1ff") + "22",
                  color: CAT_COLOR[selected.category] || "#c0c1ff",
                }}
              >
                {selected.category}
              </span>
              <button onClick={() => setSelected(null)} className="text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-base">close</span>
              </button>
            </div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface mb-unit-sm">
              {selected.title}
            </h3>
            {selected.notes && (
              <p className="text-on-surface-variant text-body-md mb-unit-sm">{selected.notes}</p>
            )}
            <div className="space-y-1 text-body-md text-on-surface-variant">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">schedule</span>
                {selected.deadline
                  ? new Date(selected.deadline).toLocaleString(undefined, {
                      weekday: "short", month: "short", day: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    })
                  : "No deadline set"}
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">timer</span>
                ~{selected.effort_minutes ?? 60} minutes of work
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base">flag</span>
                Priority {selected.priority ?? 3} of 5
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No-deadline tasks */}
      {noDeadline.length > 0 && (
        <section className="mt-4">
          <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-sm">
            Unscheduled ({noDeadline.length})
          </h3>
          <div className="flex flex-wrap gap-2">
            {noDeadline.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t)}
                className="px-3 py-1.5 rounded-xl text-label-md border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high transition-colors"
              >
                {t.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {activeTasks.length === 0 && (
        <div className="border border-outline-variant/40 rounded-2xl p-unit-xl text-center text-on-surface-variant">
          No tasks to schedule.{" "}
          <Link to="/braindump" className="text-primary font-bold">
            Brain-dump first
          </Link>
          .
        </div>
      )}
    </main>
  );
}
