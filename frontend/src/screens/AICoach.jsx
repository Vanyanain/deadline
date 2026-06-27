import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import Markdown from "../components/Markdown";

const QUICK_PROMPTS = [
  "What should I focus on right now?",
  "I'm overwhelmed — help me prioritize",
  "I have 30 minutes free, what should I do?",
  "How do I ask for a deadline extension?",
  "I keep procrastinating on my top task. Help.",
  "Build me a study schedule for this week",
];

function Message({ msg }) {
  const isUser = msg.role === "user";
  return (
    <div className={`flex items-end gap-3 animate-fade-in-up ${isUser ? "flex-row-reverse" : ""}`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
        </div>
      )}
      <div
        className={`max-w-[80%] px-4 py-3 rounded-2xl text-body-md leading-relaxed ${
          isUser
            ? "bg-primary text-on-primary-fixed rounded-br-sm whitespace-pre-wrap"
            : "bg-surface-container-low border border-outline-variant/30 text-on-surface rounded-bl-sm"
        }`}
      >
        {isUser ? msg.content : <Markdown>{msg.content}</Markdown>}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
        <span className="material-symbols-outlined text-primary text-base">smart_toy</span>
      </div>
      <div className="bg-surface-container-low border border-outline-variant/30 px-4 py-3 rounded-2xl rounded-bl-sm">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AICoach() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hey! I'm your AI productivity coach. I can see your tasks and help you plan, prioritize, and push through when you're stuck.\n\nWhat's on your mind?",
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const recogRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  // Stop any speech when leaving the screen.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function speak(text) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    window.speechSynthesis.speak(u);
  }

  function toggleVoice() {
    setVoiceOn((v) => {
      if (v) window.speechSynthesis?.cancel();
      return !v;
    });
  }

  function toggleListen() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    if (listening) {
      recogRef.current?.stop();
      return;
    }
    const rec = new SR();
    rec.lang = "en-US";
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onresult = (e) => {
      const t = Array.from(e.results).map((r) => r[0].transcript).join(" ");
      setInput(t);
      setTimeout(() => send(t), 150); // hands-free: auto-send dictation
    };
    recogRef.current = rec;
    rec.start();
  }

  async function send(text) {
    const msg = (text || input).trim();
    if (!msg || busy) return;
    setInput("");

    const userMsg = { role: "user", content: msg };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);

    const history = messages
      .filter((m) => m.role !== "assistant" || m !== messages[0])
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const { reply } = await api.chat(msg, history);
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
      if (voiceOn) speak(reply);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          content: "I hit an error reaching the backend. Is it running?",
        },
      ]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <main className="flex flex-col h-screen md:h-auto md:min-h-screen pb-16 md:pb-0">
      {/* Header */}
      <header className="shrink-0 px-unit-lg py-unit-md border-b border-outline-variant/30 bg-surface flex items-center gap-3 sticky top-0 z-10">
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
          <span className="material-symbols-outlined text-primary">smart_toy</span>
        </div>
        <div>
          <h1 className="font-bold text-on-surface leading-none">Deadline AI Coach</h1>
          <p className="text-label-md text-primary">Online · has context of your tasks</p>
        </div>
        <button
          onClick={toggleVoice}
          title={voiceOn ? "Voice replies: on" : "Voice replies: off"}
          aria-label="Toggle voice replies"
          className={`ml-auto w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
            voiceOn ? "bg-primary/15 text-primary" : "text-on-surface-variant hover:bg-surface-container-high"
          }`}
        >
          <span className="material-symbols-outlined">{voiceOn ? "volume_up" : "volume_off"}</span>
        </button>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-unit-lg py-unit-lg space-y-unit-md md:max-w-3xl md:mx-auto md:w-full">
        {messages.map((m, i) => (
          <Message key={i} msg={m} />
        ))}
        {busy && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts — show only at start */}
      {messages.length <= 1 && !busy && (
        <div className="px-unit-lg pb-unit-md md:max-w-3xl md:mx-auto md:w-full">
          <p className="text-label-md text-on-surface-variant mb-2">Quick questions:</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="text-left px-3 py-2.5 rounded-xl border border-outline-variant/30 text-label-md text-on-surface-variant hover:bg-surface-container-high hover:border-primary/30 transition-all leading-snug"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-unit-lg py-unit-md border-t border-outline-variant/30 bg-surface sticky bottom-0 md:static">
        <div className="md:max-w-3xl md:mx-auto flex gap-3 items-end">
          <button
            onClick={toggleListen}
            title="Speak your question"
            aria-label="Voice input"
            className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all shrink-0 ${
              listening
                ? "bg-error/20 text-error animate-pulse"
                : "bg-surface-container-high text-on-surface-variant hover:text-primary"
            }`}
          >
            <span className="material-symbols-outlined text-xl">{listening ? "stop" : "mic"}</span>
          </button>
          <div className="flex-1 bg-surface-container-low border border-outline-variant/40 rounded-2xl px-4 py-3 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything about your tasks, schedule, or productivity…"
              className="w-full bg-transparent text-on-surface placeholder:text-outline text-body-md resize-none focus:outline-none max-h-32"
              style={{ fieldSizing: "content" }}
            />
          </div>
          <button
            onClick={() => send()}
            disabled={!input.trim() || busy}
            className="w-11 h-11 rounded-xl bg-primary text-on-primary-fixed flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-40 shrink-0"
          >
            <span className="material-symbols-outlined text-xl">send</span>
          </button>
        </div>
        <p className="text-[10px] text-outline text-center mt-1 hidden md:block">
          Enter to send · Shift+Enter for new line
        </p>
      </div>
    </main>
  );
}
