import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

const SUGGESTIONS = [
  "Submit the CS assignment by tomorrow 11pm",
  "Pay electricity bill before end of month",
  "Prepare slides for Friday's presentation",
  "Email professor about project extension",
  "Buy groceries and meal prep Sunday",
  "Renew gym membership — expires in 3 days",
  "Apply for summer internship — deadline June 30",
  "Schedule dentist appointment this week",
];

const CAT_COLOR = {
  academic: "#7c7ff0", work: "#6366f1", finance: "#e08a1e",
  health: "#3aa676", personal: "#e8773a", admin: "#8b8b9c",
};

export default function BrainDump() {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Click to speak…");
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const nav = useNavigate();

  function toggleVoice() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setVoiceStatus("Voice not supported in this browser."); return; }
    if (recording) { setRecording(false); return; }
    const rec = new SR();
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = false;
    rec.onstart = () => { setRecording(true); setVoiceStatus("Listening…"); };
    rec.onend = () => { setRecording(false); setVoiceStatus("Click to speak…"); };
    rec.onresult = (e) => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(" ");
      setText((t) => (t ? t + " " : "") + transcript);
    };
    rec.start();
  }

  async function organize() {
    if (!text.trim()) return;
    setBusy(true);
    setErr("");
    setResult(null);
    try {
      const res = await api.braindump(text);
      setResult(res);
    } catch {
      setErr("Couldn't reach the agent. Is the backend running?");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    const activeTasks = result.tasks.filter((t) => t.status !== "done");
    return (
      <main className="relative w-full min-h-screen flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop pb-24">
        <div className="w-full max-w-[800px] space-y-unit-lg animate-fade-in-up">
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-primary block mb-3">task_alt</span>
            <h1 className="font-headline-lg text-headline-lg font-bold text-on-surface">Plan locked in.</h1>
            <p className="text-on-surface-variant font-body-lg mt-2">{result.message}</p>
          </div>

          <div className="bg-surface-container-low border border-outline-variant/40 rounded-2xl p-unit-lg space-y-unit-sm">
            <h2 className="text-label-md uppercase tracking-widest text-on-surface-variant font-bold mb-unit-md">
              Extracted & prioritized ({activeTasks.length} tasks)
            </h2>
            {activeTasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 py-unit-sm border-b border-outline-variant/20 last:border-0"
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ background: CAT_COLOR[t.category] || "#c0c1ff" }}
                />
                <div className="flex-1">
                  <span className="text-on-surface font-medium">{t.title}</span>
                  {t.notes && <span className="text-on-surface-variant text-label-md ml-2">· {t.notes}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-label-md text-primary font-bold">P{t.priority}</span>
                  {t.deadline && (
                    <span className="text-label-md text-on-surface-variant">
                      {new Date(t.deadline).toLocaleDateString(undefined, {
                        month: "short", day: "numeric",
                      })}
                    </span>
                  )}
                  <span
                    className="px-2 py-0.5 rounded text-[10px] font-bold capitalize"
                    style={{ background: (CAT_COLOR[t.category] || "#c0c1ff") + "22", color: CAT_COLOR[t.category] || "#c0c1ff" }}
                  >
                    {t.category}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <Link
              to="/"
              className="bg-primary text-on-primary-fixed font-bold px-6 py-3 rounded-xl hover:scale-102 active:scale-95 transition-transform flex items-center gap-2"
            >
              <span className="material-symbols-outlined">dashboard</span> View today's plan
            </Link>
            <button
              onClick={() => { setResult(null); setText(""); }}
              className="bg-surface-container-high text-on-surface font-bold px-6 py-3 rounded-xl hover:bg-surface-container-highest transition-colors"
            >
              Add more tasks
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative w-full min-h-screen flex flex-col items-center justify-center px-margin-mobile md:px-margin-desktop overflow-hidden pb-24">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-20">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-container/20 rounded-full blur-[120px] animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary-container/10 rounded-full blur-[120px] animate-pulse-slow" style={{ animationDelay: "2s" }} />
      </div>

      <div className="relative w-full max-w-[800px] z-10 flex flex-col items-center gap-unit-lg animate-fade-in-up">
        <div className="text-center space-y-unit-sm mb-unit-md">
          <h1 className="font-headline-lg text-headline-lg font-bold tracking-tight">
            Clear your <span className="text-gradient">mind</span>.
          </h1>
          <p className="text-on-surface-variant font-body-lg">
            Type or speak everything on your plate. The AI agent organizes, prioritizes, and schedules it.
          </p>
        </div>

        <div className="relative w-full bg-surface-container-low border border-outline-variant rounded-3xl p-unit-lg brain-dump-shadow">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && e.metaKey) organize(); }}
            className="w-full h-48 bg-transparent border-none text-on-surface placeholder:text-outline font-body-lg resize-none focus:ring-0 focus:outline-none"
            placeholder="Tell me everything on your plate — assignments, meetings, bills, errands…"
          />
          {err && <p className="text-error text-label-md mb-unit-sm">{err}</p>}
          <div className="flex justify-between items-center mt-unit-md pt-unit-md border-t border-outline-variant/30">
            <div className="flex items-center gap-unit-md">
              <button
                onClick={toggleVoice}
                className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${
                  recording
                    ? "bg-error/20 text-error animate-pulse"
                    : "bg-surface-container-highest text-primary hover:scale-105"
                }`}
              >
                <span className="material-symbols-outlined">{recording ? "stop" : "mic"}</span>
              </button>
              <span className={`text-label-md ${recording ? "text-secondary" : "text-outline"}`}>
                {voiceStatus}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-outline hidden md:block">⌘↵ to submit</span>
              <button
                onClick={organize}
                disabled={!text.trim() || busy}
                className="px-unit-lg py-unit-sm bg-primary text-on-primary-fixed rounded-xl font-headline-md font-bold hover:scale-102 active:scale-95 transition-transform disabled:opacity-50 disabled:scale-100 flex items-center gap-2"
              >
                {busy ? (
                  <>
                    <span className="w-4 h-4 border-2 border-on-primary-fixed/30 border-t-on-primary-fixed rounded-full animate-spin" />
                    Organizing…
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">auto_awesome</span>
                    Organize
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full">
          <p className="text-label-md text-on-surface-variant mb-unit-sm">Quick add:</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-unit-sm">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setText((t) => (t ? t + "\n" : "") + s)}
                className="bg-surface-container-lowest border border-outline-variant/30 p-unit-sm rounded-xl text-on-surface-variant text-label-md hover:bg-surface-variant/50 transition-all text-left line-clamp-2"
              >
                "{s}"
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
