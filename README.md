# ⏳ Deadline — The Last-Minute Life Saver

**An AI-powered productivity companion that doesn't just remind you — it plans, prioritizes, and acts before your deadlines slip.**

Students, professionals, and entrepreneurs miss assignments, bills, meetings, and interviews because traditional reminders are passive and easy to ignore. **Deadline** is an autonomous agent that turns a chaotic brain-dump into a prioritized, scheduled plan — and proactively flags what's about to slip.

---

## ✨ Key Features

### Plan & prioritize
- **🧠 Brain-dump → structured plan.** Type or *speak* everything on your plate. The Gemini-powered agent extracts every commitment as a structured task (deadline, priority, effort, category) using function-calling.
- **🎯 Intelligent prioritization.** Tasks are ranked by urgency and deadline into a clean "Active Priority" focus view.
- **📊 Command-center dashboard.** Personalized greeting, live stats (due today, overdue, this week, completion rate), and an at-a-glance prioritized list.
- **🗓️ Monthly calendar.** Opens on the month view; click any day to add a task (with time, priority, effort, and category) — and stack several tasks on a single day without reopening the form.
- **🔁 Habit tracking** with daily check-ins and streaks.

### Beat procrastination — the signature trio
- **⚖️ Reality Check.** An honest verdict on whether your workload actually fits the time you have: it weighs hours *needed* against hours *available* and tells you exactly what's at risk.
- **⚡ Kickstart.** Generates a ready-to-use head start for any task — an outline, a complete email, a tickable checklist, or concrete first steps — so you never face a blank page. Each format is produced cleanly on its own, and can be regenerated or copied.
- **🧩 Unblock ("I'm stuck").** Names *why* you're avoiding a task and hands you one tiny, 5-minute first action to break the freeze.
- **❓ Why now?** One-tap reasoning on why a task matters right now and what's concretely at stake if you skip it.

### AI coach & resilience
- **💬 AI productivity coach** with full context of your tasks ("What should I focus on right now?") — plus **voice**: speak your question with the mic and hear the reply read back.
- **⚠️ Proactive at-risk detection.** An autonomous "agent check" scans your plan for slippage and drafts consequence-management messages (e.g. a deadline-extension email) — held in a **human-in-the-loop approval queue** so nothing sends without your OK.
- **✍️ Formatted AI output.** Every AI response renders as clean Markdown — headings, bold, lists, and **interactive checkboxes you can tick** — instead of raw text.
- **🛟 Always-on resilience.** If the AI is rate-limited or unavailable, a deterministic offline parser keeps brain-dump fully functional and on-demand features fall back to smart templates — the app never breaks. Repeat AI calls are cached to stay light on usage.

### Accounts & polish
- **🔐 Real auth** — email/password (hashed) and **Google Sign-In**, plus **password recovery** via a security question set at sign-up (answers are stored hashed and matched case-insensitively).
- **👤 Profiles** — editable name and uploadable profile photo, with an in-app help guide for new users.
- **🌗 Polished light & dark themes** with a one-click toggle — every screen, chart, and control adapts for crisp contrast in both.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, React Router, Tailwind CSS (Material 3 tokens) |
| Backend | Python, FastAPI, Uvicorn |
| AI | **Google Gemini** (`gemini-2.5-flash-lite`) with function-calling |
| Auth | JWT + PBKDF2, **Google Identity Services** |
| Database | SQLite (local) · **Google Firestore** (production) |
| Deploy | **Google Cloud Run** |

### 🔵 Google Technologies Utilized
- **Gemini API** — agentic task extraction, the AI coach, and smart suggestions
- **Google Sign-In (Identity Services)** — one-tap authentication
- **Firestore** — managed, serverless persistence in production
- **Google Cloud Run** — containerized, publicly accessible deployment

---

## 🚀 Run locally

**Backend** (terminal 1):
```bash
cd backend
pip install -r requirements.txt
echo "GEMINI_API_KEY=your_key_here" >> .env   # optional — app works without it
uvicorn app.main:app --reload --port 8080
```

**Frontend** (terminal 2):
```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Create an account, then hit **Brain-dump** and type your week.

### Environment variables
| Variable | Where | Purpose |
|----------|-------|---------|
| `GEMINI_API_KEY` | backend/.env | Enables the AI agent (falls back to offline parser if unset) |
| `GEMINI_MODEL` | backend/.env | Defaults to `gemini-2.5-flash-lite` |
| `GOOGLE_CLIENT_ID` | backend/.env | Verifies Google Sign-In tokens |
| `VITE_GOOGLE_CLIENT_ID` | frontend/.env | Renders the Google button (same value) |
| `JWT_SECRET` | backend/.env | Signs login sessions |
| `USE_FIRESTORE` | backend/.env | Set to `1` to use Firestore instead of SQLite |

---

## 🏗️ Architecture

```
backend/app/
  main.py    — FastAPI routes (auth + recovery, tasks, brain-dump, kickstart,
               why-now, unblock, reality-check, chat, approvals, habits)
  agent.py   — Gemini agent loop, signature features, offline heuristic fallback
  tools.py   — function-calling tool registry + cached text generation
  auth.py    — JWT + password hashing + Google token verification
  store.py   — persistence API (delegates to SQLite or Firestore)
  db.py / fsdb.py — SQLite and Firestore backends
frontend/src/
  screens/   — Today, BrainDump, RealityCheck, AtRisk, Calendar, Habits, AICoach, Profile, Login
  components/ — KickstartModal, Markdown, ThemeToggle, …
  auth.jsx   — auth context;  theme.js — light/dark theme
```

---

## 📦 Deploy to Google Cloud Run

See [`DEPLOY.md`](DEPLOY.md) for the full guide. In short: the backend serves the built React app from a single container, deployed with `gcloud run deploy`, with `USE_FIRESTORE=1` for persistence.

---


