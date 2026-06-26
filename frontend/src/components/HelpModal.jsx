import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const STEPS = [
  ["neurology", "Brain-dump everything", "Type or speak what's on your plate — the AI turns it into structured, prioritized tasks."],
  ["balance", "Run a Reality Check", "See the honest math: can you actually finish in time, and what to do / defer / drop."],
  ["bolt", "Get unstuck & take action", "Stuck? Hit Kickstart (AI drafts it) or “I'm stuck” to get the first 5-minute step."],
];

const FEATURES = [
  ["dashboard", "Today", "Your prioritized plan. Tap the stat cards to filter; Kickstart, Unblock, or check off any task.", "/"],
  ["neurology", "Brain-dump", "Dump everything in your head — the AI organizes and prioritizes it for you.", "/braindump"],
  ["balance", "Reality Check", "The honest capacity check: a verdict plus a Do-now / Defer / Drop triage plan.", "/reality-check"],
  ["warning", "At-Risk", "The agent scans for slipping deadlines and drafts the rescue (like extension emails).", "/at-risk"],
  ["calendar_month", "Calendar", "See your deadlines across the week or the whole month.", "/calendar"],
  ["target", "Habits", "Build daily habits and streaks the agent learns from.", "/habits"],
  ["smart_toy", "AI Coach", "Chat — or talk out loud — to your productivity coach about anything.", "/coach"],
];

export default function HelpModal({ onClose }) {
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function go(to) {
    navigate(to);
    onClose();
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-surface-container border border-outline-variant/40 rounded-2xl w-full max-w-2xl shadow-2xl max-h-[88vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between p-unit-lg pb-unit-md border-b border-outline-variant/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary">help</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface leading-tight">
                Quick guide
              </h3>
              <p className="text-label-md text-on-surface-variant">Find your way around Deadline</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto p-unit-lg space-y-unit-lg">
          {/* Getting started */}
          <section>
            <h4 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-md">
              Getting started
            </h4>
            <div className="space-y-3">
              {STEPS.map(([icon, title, desc], i) => (
                <div key={title} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-primary text-on-primary-fixed flex items-center justify-center font-bold text-label-md shrink-0">
                    {i + 1}
                  </div>
                  <div>
                    <div className="font-bold text-on-surface flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-primary">{icon}</span>
                      {title}
                    </div>
                    <p className="text-on-surface-variant text-body-md mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Toolkit */}
          <section>
            <h4 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-md">
              Your toolkit — tap to open
            </h4>
            <div className="flex flex-col gap-2">
              {FEATURES.map(([icon, name, desc, to]) => (
                <button
                  key={name}
                  onClick={() => go(to)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant/40 hover:bg-surface-container-high hover:border-primary/40 transition-all text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary">{icon}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-on-surface">{name}</div>
                    <div className="text-label-md text-on-surface-variant">{desc}</div>
                  </div>
                  <span className="material-symbols-outlined text-on-surface-variant/50 group-hover:text-primary transition-colors">
                    chevron_right
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Pro tips */}
          <section className="bg-primary/5 border border-primary/20 rounded-xl p-unit-md">
            <div className="flex items-center gap-2 text-primary font-bold mb-2">
              <span className="material-symbols-outlined text-base">auto_awesome</span>
              Pro tips
            </div>
            <ul className="text-on-surface-variant text-body-md space-y-1.5 list-disc pl-5">
              <li><b className="text-on-surface">Kickstart</b> drafts the actual deliverable (essay, email, checklist) so you can just start.</li>
              <li><b className="text-on-surface">I'm stuck</b> diagnoses why you're avoiding a task and hands you the first tiny step.</li>
              <li>In <b className="text-on-surface">AI Coach</b>, tap the speaker to hear replies and the mic to talk hands-free.</li>
            </ul>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}
