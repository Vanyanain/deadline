import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import { api } from "../api";
import KickstartModal from "../components/KickstartModal";

const VERDICT = {
  overcommitted: { label: "Overcommitted", icon: "warning", ring: "border-error/40",
    bar: "bg-error", text: "text-error", chip: "bg-error/15 text-error" },
  tight: { label: "Tight", icon: "schedule", ring: "border-warning-amber/40",
    bar: "bg-warning-amber", text: "text-warning-amber", chip: "bg-warning-amber/15 text-warning-amber" },
  on_track: { label: "On Track", icon: "check_circle", ring: "border-primary/40",
    bar: "bg-primary", text: "text-primary", chip: "bg-primary/15 text-primary" },
  clear: { label: "All Clear", icon: "verified", ring: "border-outline-variant/40",
    bar: "bg-primary", text: "text-primary", chip: "bg-primary/15 text-primary" },
};

const CAT_COLOR = {
  academic: "#7c7ff0", work: "#6366f1", finance: "#e08a1e",
  health: "#3aa676", personal: "#e8773a", admin: "#8b8b9c",
};

function TriageCard({ task, bucket, onKickstart, onRemoved }) {
  const [gone, setGone] = useState(false);

  async function remove() {
    setGone(true);
    try { await api.deleteTask(task.id); onRemoved?.(); } catch {}
  }
  if (gone) return null;

  const action =
    bucket === "defer"
      ? { label: "Draft extension", icon: "mail", run: () => onKickstart(task, "email") }
      : bucket === "drop"
      ? { label: "Remove", icon: "delete", run: remove, danger: true }
      : { label: "Kickstart", icon: "bolt", run: () => onKickstart(task, null) };

  return (
    <div className="bg-surface-container-low border border-outline-variant/30 border-l-[3px] rounded-xl p-unit-md"
      style={{ borderLeftColor: CAT_COLOR[task.category] || "#c0c1ff" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-on-surface">{task.title}</div>
          <div className="text-label-md text-on-surface-variant capitalize mt-0.5">
            {task.category} · ~{task.effort_minutes ?? "?"} min · P{task.priority}
          </div>
          <div className="text-body-md text-on-surface-variant mt-2 flex gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary mt-0.5 shrink-0">
              subdirectory_arrow_right
            </span>
            <span>{task.reason}</span>
          </div>
        </div>
        <button
          onClick={action.run}
          className={`shrink-0 px-3 py-2 rounded-lg text-label-md font-bold flex items-center gap-1 transition-all active:scale-95 ${
            action.danger
              ? "bg-error/15 text-error hover:bg-error/25"
              : "bg-primary text-on-primary-fixed hover:scale-102"
          }`}
        >
          <span className="material-symbols-outlined text-base">{action.icon}</span>
          {action.label}
        </button>
      </div>
    </div>
  );
}

function Bucket({ title, icon, color, items, bucket, onKickstart, onRemoved }) {
  if (!items?.length) return null;
  return (
    <section className="animate-fade-in-up">
      <h3 className={`text-label-md uppercase tracking-widest font-bold mb-unit-sm flex items-center gap-2 ${color}`}>
        <span className="material-symbols-outlined text-base">{icon}</span>
        {title} · {items.length}
      </h3>
      <div className="flex flex-col gap-unit-sm">
        {items.map((t) => (
          <TriageCard key={t.id} task={t} bucket={bucket} onKickstart={onKickstart} onRemoved={onRemoved} />
        ))}
      </div>
    </section>
  );
}

export default function RealityCheck() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [kickstart, setKickstart] = useState(null); // { task, kind }
  const onKickstart = (task, kind) => setKickstart({ task, kind });

  const run = useCallback(() => {
    setLoading(true);
    api.realityCheck().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  useEffect(() => { run(); }, [run]);

  const v = VERDICT[data?.verdict] || VERDICT.clear;
  const needed = data?.hours_needed || 0;
  const fits = data?.hours_scheduled ?? data?.hours_available ?? 0;
  const risk = data?.hours_at_risk ?? Math.max(0, +(needed - fits).toFixed(1));
  const fitsPct = needed > 0 ? (fits / needed) * 100 : 100;
  const riskPct = needed > 0 ? (risk / needed) * 100 : 0;

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24 max-w-4xl mx-auto">
      <AnimatePresence>
        {kickstart && (
          <KickstartModal
            key="rc-kickstart"
            task={kickstart.task}
            initialKind={kickstart.kind}
            onClose={() => setKickstart(null)}
          />
        )}
      </AnimatePresence>

      <header className="flex items-start justify-between mb-gutter gap-4 animate-fade-in-up">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">
            Reality <span className="text-gradient">Check</span>
          </h1>
          <p className="text-on-surface-variant font-body-md">
            Can you actually finish everything on time? Here's the honest math.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="bg-surface-container-high text-on-surface font-bold px-4 py-2.5 rounded-xl flex items-center gap-2 hover:bg-surface-container-highest transition-colors shrink-0 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-base ${loading ? "animate-spin" : ""}`}>
            {loading ? "progress_activity" : "refresh"}
          </span>
          Re-run
        </button>
      </header>

      {loading && !data && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <span className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {data && (
        <>
          {/* Verdict hero */}
          <section className={`rounded-2xl border ${v.ring} bg-surface-container-low p-unit-lg mb-gutter animate-fade-in-up`}>
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-12 h-12 rounded-xl ${v.chip} flex items-center justify-center`}>
                <span className="material-symbols-outlined text-2xl">{v.icon}</span>
              </div>
              <div>
                <div className={`text-headline-md font-black ${v.text} leading-none`}>{v.label}</div>
                <div className="text-label-md text-on-surface-variant mt-1">{data.headline}</div>
              </div>
            </div>

            {data.verdict !== "clear" && (
              <div className="mt-4">
                <div className="flex justify-between text-label-md text-on-surface-variant mb-1">
                  <span>Fits in time: <b className="text-on-surface">{fits}h</b></span>
                  <span>At risk: <b className={risk > 0 ? "text-error" : "text-on-surface"}>{risk}h</b></span>
                </div>
                <div className="w-full bg-surface-container-highest rounded-full h-3 overflow-hidden flex">
                  <div className="bg-primary h-3 transition-all duration-700" style={{ width: `${fitsPct}%` }} />
                  <div className="bg-error h-3 transition-all duration-700" style={{ width: `${riskPct}%` }} />
                </div>
                {risk > 0 && (
                  <p className="text-error text-label-md font-bold mt-1.5">
                    ⚠ {risk}h won't fit before its deadline — something has to give.
                  </p>
                )}
              </div>
            )}

            <p className="text-on-surface text-body-lg mt-4 leading-relaxed">{data.summary}</p>
            {data.ai && (
              <p className="text-label-md text-primary mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                Analysis by Gemini
              </p>
            )}
          </section>

          {/* The plan */}
          {data.verdict !== "clear" ? (
            <div className="space-y-gutter">
              <Bucket title="Do now" icon="bolt" color="text-primary"
                items={data.buckets.do_now} bucket="do_now" onKickstart={onKickstart} onRemoved={run} />
              <Bucket title="Defer — get an extension" icon="schedule" color="text-warning-amber"
                items={data.buckets.defer} bucket="defer" onKickstart={onKickstart} onRemoved={run} />
              <Bucket title="Drop or delegate" icon="block" color="text-error"
                items={data.buckets.drop} bucket="drop" onKickstart={onKickstart} onRemoved={run} />
            </div>
          ) : (
            <div className="border border-outline-variant/40 rounded-2xl p-unit-xl text-center text-on-surface-variant">
              Nothing due soon.{" "}
              <Link to="/braindump" className="text-primary font-bold">Brain-dump your tasks</Link>{" "}
              and run this again.
            </div>
          )}
        </>
      )}
    </main>
  );
}
