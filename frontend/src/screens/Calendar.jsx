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

function getMonthGrid(offset = 0) {
  const base = new Date();
  base.setDate(1);
  base.setMonth(base.getMonth() + offset);
  const year = base.getFullYear();
  const month = base.getMonth();
  const startDow = (new Date(year, month, 1).getDay() + 6) % 7; // Monday-start
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rows = Math.ceil((startDow + daysInMonth) / 7);
  const gridStart = new Date(year, month, 1 - startDow);
  const days = Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });
  return { days, month, year, label: base.toLocaleDateString(undefined, { month: "long", year: "numeric" }) };
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

const CATEGORIES = ["academic", "work", "finance", "health", "personal", "admin"];

function AddTaskModal({ date, onClose, onAdded }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("personal");
  const [priority, setPriority] = useState(3);
  const [effort, setEffort] = useState(60);
  const [time, setTime] = useState("17:00");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim()) return;
    setSaving(true);
    const [h, m] = time.split(":").map(Number);
    const dl = new Date(date);
    dl.setHours(h || 17, m || 0, 0, 0);
    try {
      await api.createTask({
        title: title.trim(),
        deadline: dl.toISOString(),
        priority,
        effort_minutes: effort,
        category,
      });
      onAdded?.();
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-surface-container border border-outline-variant/40 rounded-2xl p-unit-lg w-full max-w-md shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-unit-md">
          <div>
            <h3 className="font-headline-md text-headline-md font-bold text-on-surface leading-tight">
              Add task
            </h3>
            <p className="text-label-md text-primary">
              {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
            </p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder="What needs doing?"
          className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50 mb-unit-md"
        />

        <div className="grid grid-cols-2 gap-unit-sm mb-unit-md">
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>P{p}{p === 1 ? " (Urgent)" : p === 5 ? " (Low)" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            />
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Effort (min)</label>
            <input
              type="number"
              min={5}
              value={effort}
              onChange={(e) => setEffort(Number(e.target.value))}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!title.trim() || saving}
            className="px-5 py-2 bg-primary text-on-primary-fixed rounded-xl font-bold disabled:opacity-50 flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base">add</span> Add task
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const [tasks, setTasks] = useState([]);
  const [view, setView] = useState("month"); // "month" | "week"
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [selected, setSelected] = useState(null);
  const [addDate, setAddDate] = useState(null); // day clicked to add a task

  const loadTasks = () =>
    api.tasks().then(({ tasks }) => setTasks(tasks || [])).catch(() => {});

  useEffect(() => {
    loadTasks();
  }, []);

  const days = getWeekDays(weekOffset);
  const month = getMonthGrid(monthOffset);
  const today = new Date();
  const isMonth = view === "month";

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
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-gutter animate-fade-in-up">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
            {isMonth ? "Monthly Focus" : "Weekly Focus"}
          </h1>
          <p className="text-on-surface-variant font-body-md">
            {isMonth
              ? month.label
              : `${days[0].toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${days[6].toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Week / Month toggle */}
          <div className="flex bg-surface-container-high rounded-xl p-0.5 mr-1">
            {["week", "month"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-label-md font-bold capitalize transition-colors ${
                  view === v ? "bg-primary text-on-primary-fixed" : "text-on-surface-variant hover:text-on-surface"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <button
            onClick={() => (isMonth ? setMonthOffset((o) => o - 1) : setWeekOffset((o) => o - 1))}
            className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          <button
            onClick={() => (isMonth ? setMonthOffset(0) : setWeekOffset(0))}
            className="px-3 py-1.5 rounded-xl bg-surface-container-high text-on-surface text-label-md font-bold hover:bg-surface-container-highest transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => (isMonth ? setMonthOffset((o) => o + 1) : setWeekOffset((o) => o + 1))}
            className="w-9 h-9 rounded-xl bg-surface-container-high text-on-surface flex items-center justify-center hover:bg-surface-container-highest transition-colors"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </header>

      {/* Week grid */}
      {!isMonth && (
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

              {/* Tasks for this day — click empty space to add */}
              <div
                className="p-1.5 space-y-1 min-h-[80px] cursor-pointer group"
                onClick={() => setAddDate(day)}
                title="Click to add a task"
              >
                {dayTasks.map((t) => (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); setSelected(t); }}
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
                    <span className="material-symbols-outlined text-base text-outline/30 group-hover:text-primary transition-colors">add</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* Month grid */}
      {isMonth && (
        <div className="animate-fade-in-up">
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DAY_NAMES.map((d) => (
              <div
                key={d}
                className="text-[10px] text-on-surface-variant uppercase tracking-widest text-center py-1 font-bold"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {month.days.map((day, i) => {
              const dayTasks = tasksForDay(day);
              const inMonth = day.getMonth() === month.month;
              const isT = isToday(day);
              return (
                <div
                  key={i}
                  onClick={() => setAddDate(day)}
                  title="Click to add a task"
                  className={`min-h-[88px] rounded-lg border p-1.5 flex flex-col transition-colors cursor-pointer group hover:border-primary/40 ${
                    isT
                      ? "border-primary/50 bg-primary/5"
                      : "border-outline-variant/30 bg-surface-container-lowest"
                  } ${inMonth ? "" : "opacity-40"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div
                      className={`text-[11px] font-bold leading-none ${
                        isT ? "text-primary" : "text-on-surface"
                      }`}
                    >
                      {day.getDate()}
                    </div>
                    <span className="material-symbols-outlined text-[13px] text-outline/0 group-hover:text-primary transition-colors">add</span>
                  </div>
                  <div className="space-y-0.5 overflow-hidden">
                    {dayTasks.slice(0, 3).map((t) => (
                      <button
                        key={t.id}
                        onClick={(e) => { e.stopPropagation(); setSelected(t); }}
                        className="w-full text-left rounded px-1 py-0.5 text-[10px] font-medium text-on-surface leading-tight truncate hover:opacity-80 transition-opacity"
                        style={{
                          background: (CAT_COLOR[t.category] || "#c0c1ff") + "22",
                          borderLeft: `2px solid ${CAT_COLOR[t.category] || "#c0c1ff"}`,
                        }}
                      >
                        {t.title}
                      </button>
                    ))}
                    {dayTasks.length > 3 && (
                      <div className="text-[9px] text-on-surface-variant pl-1">
                        +{dayTasks.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add task on a clicked day */}
      {addDate && (
        <AddTaskModal date={addDate} onClose={() => setAddDate(null)} onAdded={loadTasks} />
      )}

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
          No tasks scheduled yet — <span className="text-primary font-bold">click any day above</span> to add one, or{" "}
          <Link to="/braindump" className="text-primary font-bold">
            brain-dump
          </Link>{" "}
          a whole list.
        </div>
      )}
    </main>
  );
}
