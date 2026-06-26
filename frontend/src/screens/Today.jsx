import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";

const CAT_COLOR = {
  academic: "#7c7ff0",
  work: "#6366f1",
  finance: "#e08a1e",
  health: "#3aa676",
  personal: "#e8773a",
  admin: "#8b8b9c",
};

const PRI_LABEL = { 1: "P1", 2: "P2", 3: "P3", 4: "P4", 5: "P5" };
const PRI_COLOR = {
  1: "bg-error/20 text-error",
  2: "bg-warning-amber/20 text-warning-amber",
  3: "bg-primary/20 text-primary",
  4: "bg-outline/20 text-outline",
  5: "bg-outline/10 text-outline",
};

function fmtDeadline(d) {
  if (!d) return "No deadline";
  try {
    const dt = new Date(d);
    const hrs = (dt - new Date()) / 36e5;
    if (hrs < 0) return "Overdue";
    if (hrs < 3) return `Due in ${Math.round(hrs * 60)}min`;
    if (hrs < 24) return `Due in ${Math.round(hrs)}h`;
    const days = Math.round(hrs / 24);
    if (days === 1) return "Due tomorrow";
    return `Due ${dt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  } catch {
    return d;
  }
}

function deadlineClass(d) {
  if (!d) return "text-on-surface-variant";
  try {
    const hrs = (new Date(d) - new Date()) / 36e5;
    if (hrs < 0) return "text-error font-bold";
    if (hrs < 24) return "text-warning-amber font-bold";
    return "text-on-surface-variant";
  } catch {
    return "text-on-surface-variant";
  }
}

function EditModal({ task, onClose, onSave }) {
  const [form, setForm] = useState({
    title: task.title || "",
    priority: task.priority || 3,
    effort_minutes: task.effort_minutes || 60,
    deadline: task.deadline ? task.deadline.slice(0, 16) : "",
    category: task.category || "personal",
    notes: task.notes || "",
  });

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-surface-container border border-outline-variant/40 rounded-2xl p-unit-lg w-full max-w-lg space-y-unit-md shadow-2xl animate-fade-in-up">
        <div className="flex items-center justify-between">
          <h3 className="font-headline-md text-headline-md font-bold text-on-surface">Edit task</h3>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <input
          className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="Task title"
        />

        <div className="grid grid-cols-2 gap-unit-sm">
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Priority</label>
            <select
              value={form.priority}
              onChange={(e) => set("priority", Number(e.target.value))}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  P{p} {p === 1 ? "(Urgent)" : p === 5 ? "(Low)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Category</label>
            <select
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            >
              {["academic", "work", "finance", "health", "personal", "admin"].map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-unit-sm">
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Deadline</label>
            <input
              type="datetime-local"
              value={form.deadline}
              onChange={(e) => set("deadline", e.target.value)}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            />
          </div>
          <div>
            <label className="text-label-md text-on-surface-variant block mb-1">Effort (min)</label>
            <input
              type="number"
              min={5}
              value={form.effort_minutes}
              onChange={(e) => set("effort_minutes", Number(e.target.value))}
              className="w-full bg-surface-container-high rounded-xl px-3 py-2 text-on-surface focus:outline-none"
            />
          </div>
        </div>

        <textarea
          rows={2}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          placeholder="Notes (optional)"
          className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-on-surface placeholder:text-outline resize-none focus:outline-none"
        />

        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-xl text-on-surface-variant hover:bg-surface-container-high">
            Cancel
          </button>
          <button
            onClick={() => onSave({ ...form, deadline: form.deadline ? new Date(form.deadline).toISOString() : null })}
            className="px-5 py-2 bg-primary text-on-primary-fixed rounded-xl font-bold hover:bg-primary/90"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, tone, delay }) {
  const tones = {
    primary: "text-primary bg-primary/10",
    error: "text-error bg-error/10",
    amber: "text-warning-amber bg-warning-amber/10",
    tertiary: "text-tertiary bg-tertiary/10",
  };
  return (
    <div
      className="card-lift animate-fade-in-up bg-surface-container-low border border-outline-variant/40 rounded-2xl p-unit-md flex items-center gap-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <span className="material-symbols-outlined">{icon}</span>
      </div>
      <div className="min-w-0">
        <div className="text-headline-md font-bold text-on-surface leading-none">{value}</div>
        <div className="text-label-md text-on-surface-variant mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

export default function Today() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [err, setErr] = useState("");
  const [editTask, setEditTask] = useState(null);
  const [suggest, setSuggest] = useState(null);

  const loadTasks = useCallback(() => {
    api.tasks().then(({ tasks }) => setTasks(tasks || [])).catch(() => setErr("Couldn't load tasks."));
  }, []);

  useEffect(() => {
    loadTasks();
    api.suggest().then(setSuggest).catch(() => {});
  }, [loadTasks]);

  async function toggleDone(t) {
    const next = t.status === "done" ? "todo" : "done";
    setTasks((ts) => ts.map((x) => (x.id === t.id ? { ...x, status: next } : x)));
    try {
      await api.updateTask(t.id, { status: next });
    } catch {
      loadTasks();
    }
  }

  async function deleteTask(id) {
    setTasks((ts) => ts.filter((x) => x.id !== id));
    try {
      await api.deleteTask(id);
    } catch {
      loadTasks();
    }
  }

  async function saveEdit(updates) {
    setEditTask(null);
    try {
      await api.updateTask(editTask.id, updates);
      loadTasks();
    } catch {
      setErr("Couldn't save changes.");
    }
  }

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const sorted = [...active].sort((a, b) => (a.priority ?? 5) - (b.priority ?? 5));
  const hero = sorted[0];
  const rest = sorted.slice(1);

  // ---- live dashboard stats ----
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  const in7d = new Date(now.getTime() + 7 * 24 * 36e5);
  const withDeadline = active.filter((t) => t.deadline);
  const dueToday = withDeadline.filter((t) => new Date(t.deadline) <= endOfToday).length;
  const overdue = withDeadline.filter((t) => new Date(t.deadline) < now).length;
  const dueWeek = withDeadline.filter((t) => new Date(t.deadline) <= in7d).length;
  const completionRate = tasks.length ? Math.round((done.length / tasks.length) * 100) : 0;

  const hour = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = (user?.name || "").split(" ")[0];

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24">
      {editTask && (
        <EditModal task={editTask} onClose={() => setEditTask(null)} onSave={saveEdit} />
      )}

      <header className="flex items-end justify-between mb-gutter gap-4 animate-fade-in-up">
        <div>
          <p className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">
            {greeting}
            {firstName && <>, <span className="text-gradient">{firstName}</span></>}
          </h1>
          <p className="text-on-surface-variant font-body-md mt-1">
            {active.length === 0
              ? "Your plate is clear. Time to plan ahead."
              : `You have ${active.length} open task${active.length > 1 ? "s" : ""}${
                  overdue > 0 ? ` · ${overdue} overdue` : ""
                }.`}
          </p>
        </div>
        <Link
          to="/braindump"
          className="bg-primary text-on-primary-fixed font-bold px-5 py-3 rounded-xl flex items-center gap-2 hover:scale-102 active:scale-95 transition-transform shrink-0 shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-xl">add</span> New tasks
        </Link>
      </header>

      {/* Stats strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-unit-md mb-gutter">
        <StatCard icon="today" label="Due today" value={dueToday} tone="primary" delay={0} />
        <StatCard icon="warning" label="Overdue" value={overdue} tone="error" delay={60} />
        <StatCard icon="calendar_month" label="Due this week" value={dueWeek} tone="amber" delay={120} />
        <StatCard icon="task_alt" label="Completion" value={`${completionRate}%`} tone="tertiary" delay={180} />
      </section>

      {err && <p className="text-error mb-unit-md">{err}</p>}

      {/* AI tip */}
      {suggest?.ai_tip && (
        <div className="mb-gutter bg-surface-container-low border border-primary/20 rounded-2xl p-unit-md flex items-start gap-3">
          <span className="material-symbols-outlined text-primary shrink-0 mt-0.5">auto_awesome</span>
          <p className="text-on-surface-variant text-body-md">{suggest.ai_tip}</p>
        </div>
      )}

      {/* At-risk banners */}
      {suggest?.suggestions?.filter((s) => s.type === "at_risk" || s.type === "overdue").map((s) => (
        <div
          key={s.task_id}
          className={`mb-unit-sm rounded-xl px-unit-md py-unit-sm flex items-center gap-3 ${
            s.type === "overdue"
              ? "bg-error/10 border border-error/30 text-error"
              : "bg-warning-amber/10 border border-warning-amber/30 text-warning-amber"
          }`}
        >
          <span className="material-symbols-outlined">{s.icon}</span>
          <div>
            <span className="font-bold">{s.title}</span>
            <span className="ml-2 opacity-70">{s.body}</span>
          </div>
        </div>
      ))}

      {hero && (
        <section className="animate-fade-in-up bg-gradient-to-br from-primary/15 to-surface-container-low border border-primary/20 rounded-2xl p-unit-lg mb-gutter relative overflow-hidden">
          <div className="absolute top-0 right-0 w-72 h-72 bg-primary/10 rounded-full blur-[100px] -mr-24 -mt-24 pointer-events-none animate-pulse-slow" />
          <div className="relative">
            <div className="flex items-start justify-between">
              <span className="text-label-md uppercase tracking-widest text-primary font-bold">
                Active priority
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleDone(hero)}
                  className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30 transition-colors"
                  title="Mark done"
                >
                  <span className="material-symbols-outlined text-base">check</span>
                </button>
                <button
                  onClick={() => setEditTask(hero)}
                  className="w-8 h-8 rounded-full bg-surface-container-high text-on-surface-variant flex items-center justify-center hover:bg-surface-container-highest transition-colors"
                  title="Edit"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                </button>
              </div>
            </div>
            <h2 className="font-headline-lg text-headline-lg font-bold text-on-surface mt-2">
              {hero.title}
            </h2>
            {hero.notes && (
              <p className="text-on-surface-variant text-body-md mt-1 opacity-70">{hero.notes}</p>
            )}
            <div className="flex flex-wrap items-center gap-4 mt-4 text-on-surface-variant text-body-md">
              <span className={`flex items-center gap-1 ${deadlineClass(hero.deadline)}`}>
                <span className="material-symbols-outlined text-base">schedule</span>
                {fmtDeadline(hero.deadline)}
              </span>
              {hero.effort_minutes != null && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">timer</span>~
                  {hero.effort_minutes} min
                </span>
              )}
              <span
                className="px-2 py-0.5 rounded-md text-xs font-bold capitalize"
                style={{
                  background: (CAT_COLOR[hero.category] || "#c0c1ff") + "22",
                  color: CAT_COLOR[hero.category] || "#c0c1ff",
                }}
              >
                {hero.category}
              </span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-bold ${PRI_COLOR[hero.priority] || PRI_COLOR[3]}`}>
                {PRI_LABEL[hero.priority] || "P3"}
              </span>
            </div>
          </div>
        </section>
      )}

      <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-md">
        Prioritized
      </h3>
      <div className="flex flex-col gap-unit-sm">
        {rest.map((t) => (
          <article
            key={t.id}
            className="card-lift bg-surface-container-low border border-outline-variant/30 border-l-[3px] rounded-xl px-unit-md py-unit-md flex items-center justify-between group"
            style={{ borderLeftColor: CAT_COLOR[t.category] || "#c0c1ff" }}
          >
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button
                onClick={() => toggleDone(t)}
                className="shrink-0 w-5 h-5 rounded border-2 border-outline-variant/50 flex items-center justify-center hover:border-primary transition-colors"
              >
                {t.status === "done" && (
                  <span className="material-symbols-outlined text-sm text-primary">check</span>
                )}
              </button>
              <div className="min-w-0">
                <div className="font-medium text-on-surface truncate">{t.title}</div>
                <div className="text-label-md text-on-surface-variant mt-0.5 capitalize">
                  {t.category} · ~{t.effort_minutes ?? "?"} min
                  {t.notes && <span className="ml-2 opacity-50 truncate"> · {t.notes}</span>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span className={`text-label-md whitespace-nowrap ${deadlineClass(t.deadline)}`}>
                {fmtDeadline(t.deadline)}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${PRI_COLOR[t.priority] || PRI_COLOR[3]}`}>
                {PRI_LABEL[t.priority] || "P3"}
              </span>
              <button
                onClick={() => setEditTask(t)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant hover:bg-surface-container-high transition-all"
                title="Edit"
              >
                <span className="material-symbols-outlined text-sm">edit</span>
              </button>
              <button
                onClick={() => deleteTask(t.id)}
                className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg flex items-center justify-center text-error/70 hover:bg-error/10 transition-all"
                title="Delete"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
              </button>
            </div>
          </article>
        ))}

        {sorted.length === 0 && !err && (
          <div className="border border-outline-variant/40 rounded-2xl p-unit-xl text-center text-on-surface-variant">
            Nothing planned yet.{" "}
            <Link to="/braindump" className="text-primary font-bold">
              Brain-dump your tasks
            </Link>{" "}
            to begin.
          </div>
        )}
      </div>

      {done.length > 0 && (
        <section className="mt-gutter">
          <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-md">
            Completed ({done.length})
          </h3>
          <div className="flex flex-col gap-unit-sm">
            {done.map((t) => (
              <div
                key={t.id}
                className="bg-surface-container-lowest rounded-xl px-unit-md py-unit-sm flex items-center justify-between opacity-50"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleDone(t)}
                    className="w-5 h-5 rounded border-2 border-primary/50 bg-primary/20 flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-sm text-primary">check</span>
                  </button>
                  <span className="line-through text-on-surface-variant text-body-md">{t.title}</span>
                </div>
                <button
                  onClick={() => deleteTask(t.id)}
                  className="text-error/50 hover:text-error transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
