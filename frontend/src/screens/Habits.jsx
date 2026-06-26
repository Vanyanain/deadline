import { useEffect, useState } from "react";
import { api } from "../api";

const PRESET_HABITS = [
  { name: "Deep work (2h)", icon: "work", color: "#8083ff" },
  { name: "Exercise", icon: "fitness_center", color: "#7ee0a0" },
  { name: "Read 30 min", icon: "menu_book", color: "#ffb783" },
  { name: "No social media", icon: "block", color: "#F59E0B" },
  { name: "Journal", icon: "edit_note", color: "#c0c1ff" },
  { name: "Sleep by 11pm", icon: "bedtime", color: "#908fa0" },
];

function Ring({ pct, color = "#c0c1ff", checked = false }) {
  const r = 28, c = 2 * Math.PI * r;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72">
      <circle cx="36" cy="36" r={r} fill="none" stroke="rgb(var(--surface-variant))" strokeWidth="6" />
      <circle
        cx="36" cy="36" r={r}
        fill="none"
        stroke={checked ? color : color + "80"}
        strokeWidth="6"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 0.6s ease" }}
      />
      {checked && (
        <text x="36" y="41" textAnchor="middle" fill={color} fontSize="16" fontWeight="700">
          ✓
        </text>
      )}
    </svg>
  );
}

export default function Habits() {
  const [habits, setHabits] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("check_circle");
  const [newColor, setNewColor] = useState("#c0c1ff");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const todayStr = new Date().toISOString().slice(0, 10);

  async function loadHabits() {
    try {
      const { habits } = await api.habits();
      setHabits(habits || []);
    } catch {
      setErr("Couldn't load habits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadHabits(); }, []);

  async function checkHabit(id) {
    try {
      const { habit } = await api.checkHabit(id);
      setHabits((hs) => hs.map((h) => (h.id === id ? { ...h, ...habit } : h)));
    } catch {
      setErr("Couldn't check habit.");
    }
  }

  async function deleteHabit(id) {
    setHabits((hs) => hs.filter((h) => h.id !== id));
    try { await api.deleteHabit(id); } catch {}
  }

  async function addHabit(preset = null) {
    const name = preset ? preset.name : newName.trim();
    if (!name) return;
    const icon = preset ? preset.icon : newIcon;
    const color = preset ? preset.color : newColor;
    try {
      const { habit } = await api.createHabit({ name, icon, color });
      setHabits((hs) => [...hs, { ...habit, streak: 0 }]);
      setNewName("");
      setShowCreate(false);
    } catch {
      setErr("Couldn't create habit.");
    }
  }

  if (loading) {
    return (
      <main className="p-unit-lg md:p-margin-desktop pb-24 flex items-center justify-center min-h-[60vh]">
        <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </main>
    );
  }

  const checkedToday = habits.filter((h) => h.checks?.includes(todayStr)).length;
  const pctToday = habits.length ? checkedToday / habits.length : 0;

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24">
      <header className="flex items-start justify-between mb-gutter">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
            Goals & Habits
          </h1>
          <p className="text-on-surface-variant font-body-md">
            Track daily habits. Build streaks. The agent learns your patterns.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="bg-primary text-on-primary-fixed font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 hover:scale-102 active:scale-95 transition-transform"
        >
          <span className="material-symbols-outlined text-base">add</span>
          Add habit
        </button>
      </header>

      {err && <p className="text-error mb-unit-md text-body-md">{err}</p>}

      {/* Today's progress bar */}
      {habits.length > 0 && (
        <section className="mb-gutter bg-surface-container-low border border-outline-variant/40 rounded-2xl p-unit-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold">
              Today's progress
            </h3>
            <span className="text-primary font-bold text-headline-md">
              {checkedToday}/{habits.length}
            </span>
          </div>
          <div className="w-full bg-surface-variant rounded-full h-3 overflow-hidden">
            <div
              className="bg-primary h-3 rounded-full transition-all duration-700"
              style={{ width: `${pctToday * 100}%` }}
            />
          </div>
          {pctToday === 1 && (
            <p className="text-primary font-bold text-body-md mt-2">
              🎯 Perfect day! All habits done.
            </p>
          )}
        </section>
      )}

      {/* Create form */}
      {showCreate && (
        <section className="mb-gutter bg-surface-container-low border border-primary/20 rounded-2xl p-unit-lg space-y-unit-md">
          <h3 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold">
            New habit
          </h3>

          <div className="flex gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Habit name…"
              className="flex-1 bg-surface-container-high rounded-xl px-4 py-3 text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/50"
              onKeyDown={(e) => e.key === "Enter" && addHabit()}
            />
            <input
              type="color"
              value={newColor}
              onChange={(e) => setNewColor(e.target.value)}
              className="w-12 h-12 rounded-xl cursor-pointer border border-outline-variant/30 bg-transparent"
              title="Choose color"
            />
            <button
              onClick={() => addHabit()}
              disabled={!newName.trim()}
              className="bg-primary text-on-primary-fixed font-bold px-4 py-2 rounded-xl disabled:opacity-50"
            >
              Add
            </button>
          </div>

          <div>
            <p className="text-label-md text-on-surface-variant mb-2">Or pick a preset:</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PRESET_HABITS.filter(
                (p) => !habits.find((h) => h.name === p.name)
              ).map((p) => (
                <button
                  key={p.name}
                  onClick={() => addHabit(p)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-outline-variant/30 text-on-surface-variant text-label-md hover:bg-surface-container-high transition-colors text-left"
                >
                  <span className="material-symbols-outlined text-base" style={{ color: p.color }}>
                    {p.icon}
                  </span>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Habit cards */}
      {habits.length === 0 ? (
        <div className="border border-outline-variant/40 rounded-2xl p-unit-xl text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-4xl text-primary/40 block mb-2">
            target
          </span>
          <p>No habits yet. Add one to start building streaks.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-gutter">
          {habits.map((h) => {
            const checked = h.checks?.includes(todayStr) || false;
            const streak = h.streak || 0;
            const totalDays = h.checks?.length || 0;
            const pct = Math.min(1, streak / 30);

            return (
              <div
                key={h.id}
                className={`bg-surface-container-low border rounded-2xl p-unit-lg relative group transition-all duration-300 ${
                  checked ? "border-primary/30" : "border-outline-variant/40"
                }`}
              >
                <button
                  onClick={() => deleteHabit(h.id)}
                  className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-error/50 hover:text-error transition-all"
                  title="Delete habit"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                </button>

                <div className="flex items-center gap-unit-md mb-unit-md">
                  <div className="relative">
                    <Ring pct={pct} color={h.color || "#c0c1ff"} checked={checked} />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span
                        className="material-symbols-outlined text-xl"
                        style={{ color: h.color || "#c0c1ff" }}
                      >
                        {h.icon || "check_circle"}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="font-bold text-on-surface">{h.name}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="material-symbols-outlined text-base text-warning-amber">
                        local_fire_department
                      </span>
                      <span className="font-bold text-warning-amber">{streak}</span>
                      <span className="text-label-md text-on-surface-variant">day streak</span>
                    </div>
                    <div className="text-label-md text-on-surface-variant mt-0.5">
                      {totalDays} total days
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => !checked && checkHabit(h.id)}
                  disabled={checked}
                  className={`w-full py-2.5 rounded-xl font-bold text-body-md transition-all active:scale-95 flex items-center justify-center gap-2 ${
                    checked
                      ? "bg-primary/10 text-primary cursor-default"
                      : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-base">
                    {checked ? "check_circle" : "radio_button_unchecked"}
                  </span>
                  {checked ? "Done today!" : "Mark done"}
                </button>

                {/* Last 7 days mini-calendar */}
                <div className="flex gap-1 mt-unit-sm justify-center">
                  {Array.from({ length: 7 }, (_, i) => {
                    const d = new Date();
                    d.setDate(d.getDate() - 6 + i);
                    const ds = d.toISOString().slice(0, 10);
                    const done = h.checks?.includes(ds) || false;
                    const isT = ds === todayStr;
                    return (
                      <div
                        key={i}
                        title={ds}
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                          done
                            ? "border-2"
                            : "bg-surface-container-high text-on-surface-variant/40"
                        } ${isT ? "ring-1 ring-primary/50" : ""}`}
                        style={
                          done
                            ? {
                                background: (h.color || "#c0c1ff") + "30",
                                borderColor: h.color || "#c0c1ff",
                                color: h.color || "#c0c1ff",
                              }
                            : {}
                        }
                      >
                        {d.getDate()}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
