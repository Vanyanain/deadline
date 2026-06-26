import { useEffect, useState } from "react";
import { api } from "../api";

const INTENT_COPY = {
  extension: "draft a deadline-extension request",
  reschedule: "draft a reschedule note",
  heads_up: "draft a heads-up to a stakeholder",
  decline: "draft a polite decline",
};

const TYPE_ICON = {
  message: "mail",
  deliverable: "edit_document",
};

const TYPE_LABEL = {
  message: "Message draft",
  deliverable: "Deliverable draft",
};

export default function AtRisk() {
  const [approvals, setApprovals] = useState([]);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({});

  async function load() {
    try {
      const { approvals } = await api.approvals();
      setApprovals(approvals);
    } catch {
      setStatus("Couldn't reach the agent.");
    }
  }

  useEffect(() => { load(); }, []);

  async function runTick() {
    setBusy(true);
    setStatus("Agent scanning your plan for slippage…");
    try {
      const res = await api.tick();
      const n = res.at_risk?.length || 0;
      setStatus(
        n
          ? `Agent flagged ${n} at-risk task${n > 1 ? "s" : ""} and prepared actions for review.`
          : "Nothing at risk right now. You're on track!"
      );
      await load();
    } catch {
      setStatus("Tick failed — is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id, decision) {
    await api.resolve(id, decision);
    setApprovals((prev) => prev.filter((a) => a.id !== id));
    setStatus(decision === "approved" ? "Action approved and sent!" : "Action dismissed.");
  }

  function toggleExpand(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }));
  }

  return (
    <main className="p-unit-lg md:p-margin-desktop pb-24">
      <header className="flex items-start justify-between mb-gutter max-w-4xl mx-auto animate-fade-in-up">
        <div>
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight text-on-surface">
            Urgent Focus Required
          </h1>
          <p className="text-on-surface-variant font-body-md">
            The agent monitors your plan and acts before deadlines slip.
          </p>
        </div>
        <button
          onClick={runTick}
          disabled={busy}
          className="bg-primary hover:bg-primary/90 text-on-primary-fixed font-bold px-6 py-3 rounded-xl transition-all hover:scale-102 active:scale-95 flex items-center gap-2 disabled:opacity-50"
        >
          <span className={`material-symbols-outlined text-xl ${busy ? "animate-spin" : ""}`}>
            {busy ? "progress_activity" : "bolt"}
          </span>
          {busy ? "Scanning…" : "Run agent check"}
        </button>
      </header>

      {status && (
        <p className="max-w-4xl mx-auto text-on-surface-variant text-body-md mb-unit-md bg-surface-container-low border border-outline-variant/30 rounded-xl px-unit-md py-unit-sm">
          {status}
        </p>
      )}

      <div className="max-w-4xl mx-auto space-y-gutter">
        {approvals.length === 0 && (
          <div className="border border-outline-variant/40 rounded-2xl p-unit-xl text-center text-on-surface-variant">
            <span className="material-symbols-outlined text-4xl text-primary/60 mb-2 block">
              check_circle
            </span>
            <p className="font-medium">No actions awaiting review.</p>
            <p className="text-label-md mt-1">
              Run an agent check to scan for at-risk deadlines.
            </p>
          </div>
        )}

        {approvals.map((a) => (
          <article
            key={a.id}
            className="card-lift animate-fade-in-up bg-surface-container-low border border-warning-amber/30 rounded-2xl p-unit-lg warning-glow relative overflow-hidden hover:border-warning-amber/60"
          >
            <div className="absolute top-0 right-0 w-64 h-64 bg-warning-amber/5 rounded-full blur-[100px] -mr-32 -mt-32 pointer-events-none" />
            <div className="relative flex items-start gap-unit-md">
              <div className="bg-warning-amber/10 p-4 rounded-2xl shrink-0">
                <span className="material-symbols-outlined text-warning-amber text-4xl">
                  {TYPE_ICON[a.type] || "warning"}
                </span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <span className="px-2 py-1 bg-warning-amber/20 text-warning-amber text-[10px] font-bold uppercase tracking-widest rounded-md">
                    {TYPE_LABEL[a.type] || "At Risk"}
                  </span>
                  <span className="px-2 py-1 bg-surface-container-high text-on-surface-variant text-[10px] uppercase tracking-widest rounded-md font-bold">
                    {a.intent || a.kind}
                  </span>
                  <span className="text-xs text-on-surface-variant opacity-60">
                    awaiting your approval
                  </span>
                </div>

                <h2 className="font-headline-md text-headline-md font-bold mb-2 text-on-surface">
                  "{a.task_title || a.task_id}"
                </h2>

                {a.type === "message" ? (
                  <p className="text-on-surface-variant text-body-lg leading-relaxed mb-4">
                    The agent will{" "}
                    <span className="text-warning-amber font-bold">
                      {INTENT_COPY[a.intent] || a.intent}
                    </span>{" "}
                    to your {a.recipient_role}. Review the draft before it sends.
                  </p>
                ) : (
                  <p className="text-on-surface-variant text-body-lg leading-relaxed mb-4">
                    The agent drafted a{" "}
                    <span className="text-warning-amber font-bold">{a.kind}</span> to give you a
                    head start. Review and use it.
                  </p>
                )}

                {/* Collapsible draft */}
                <div className="mb-6">
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="flex items-center gap-2 text-label-md text-primary font-bold mb-2 hover:opacity-80"
                  >
                    <span className="material-symbols-outlined text-base">
                      {expanded[a.id] ? "expand_less" : "expand_more"}
                    </span>
                    {expanded[a.id] ? "Hide draft" : "View draft"}
                  </button>
                  {expanded[a.id] && (
                    <div className="bg-surface-container border border-outline-variant/30 rounded-xl p-unit-md text-on-surface-variant text-body-md whitespace-pre-wrap">
                      {a.draft}
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => resolve(a.id, "approved")}
                    className="bg-primary hover:bg-primary/90 text-on-primary-fixed font-bold px-6 py-3 rounded-xl transition-all hover:scale-102 active:scale-95 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-xl">
                      {a.type === "message" ? "send" : "check"}
                    </span>
                    {a.type === "message" ? "Approve & send" : "Use this draft"}
                  </button>
                  <button
                    onClick={() => resolve(a.id, "rejected")}
                    className="bg-surface-container-high hover:bg-surface-variant text-on-surface font-bold px-6 py-3 rounded-xl transition-all active:scale-95"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
