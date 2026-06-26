import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { api } from "../api";

const BLOCKS = [
  ["too_big", "It feels too big", "unfold_more"],
  ["unclear_start", "Don't know where to start", "explore"],
  ["vague", "It's vague", "blur_on"],
  ["fear", "Worried I'll do it badly", "sentiment_stressed"],
  ["boring", "It's just boring", "sentiment_dissatisfied"],
];

/** "Unblock" — diagnoses why a task is being avoided and gives the first
 *  5-minute action. Targets executive dysfunction, not just organization. */
export default function UnblockModal({ task, onClose }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function pick(block) {
    setLoading(true);
    try {
      setResult(await api.unblock(task.id, block));
    } catch {
      setResult({ message: "Couldn't reach the coach right now. Try again in a moment.", first_step: "" });
    } finally {
      setLoading(false);
    }
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
        className="bg-surface-container border border-outline-variant/40 rounded-2xl p-unit-lg w-full max-w-lg shadow-2xl"
      >
        <div className="flex items-start justify-between mb-unit-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary">lock_open</span>
            </div>
            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-on-surface leading-tight">
                Feeling stuck?
              </h3>
              <p className="text-label-md text-on-surface-variant">{task.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step 1 — what's the block? */}
        {!result && !loading && (
          <div className="animate-fade-in-up">
            <p className="text-on-surface-variant text-body-md mb-unit-md">
              No judgment — what's making you avoid this?
            </p>
            <div className="flex flex-col gap-2">
              {BLOCKS.map(([key, label, icon]) => (
                <button
                  key={key}
                  onClick={() => pick(key)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline-variant/40 text-on-surface text-body-md hover:bg-surface-container-high hover:border-primary/40 transition-all text-left active:scale-[0.99]"
                >
                  <span className="material-symbols-outlined text-primary">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-on-surface-variant">
            <span className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <span className="text-body-md">Figuring out what's really going on…</span>
          </div>
        )}

        {/* Step 2 — diagnosis + first step */}
        {result && !loading && (
          <div className="animate-fade-in-up">
            {result.block_label && (
              <span className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-label-md font-bold mb-3">
                {result.block_label}
              </span>
            )}
            <p className="text-on-surface text-body-lg leading-relaxed mb-unit-md">{result.message}</p>

            {result.first_step && (
              <div className="bg-primary/5 border border-primary/30 rounded-xl p-unit-md mb-unit-md">
                <div className="flex items-center gap-2 text-primary font-bold text-label-md uppercase tracking-widest mb-1">
                  <span className="material-symbols-outlined text-base">bolt</span>
                  Your first 5 minutes
                </div>
                <p className="text-on-surface text-body-lg leading-relaxed">{result.first_step}</p>
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={() => setResult(null)}
                className="text-label-md text-on-surface-variant font-bold hover:text-on-surface flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Different reason
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2.5 bg-primary text-on-primary-fixed rounded-xl font-bold hover:scale-102 active:scale-95 transition-transform flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-base">play_arrow</span>
                Let's start
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
