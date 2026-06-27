# ⏳ Deadline — The Last-Minute Life Saver

**An AI-powered productivity companion that doesn't just remind you — it plans, prioritizes, and acts before your deadlines slip.**

Students, professionals, and entrepreneurs miss assignments, bills, meetings, and interviews because traditional reminders are passive and easy to ignore. **Deadline** is an autonomous agent that turns a chaotic brain-dump into a prioritized, scheduled plan — and proactively flags what's about to slip.

---

## ✨ Key Features

- **🧠 Brain-dump → structured plan.** Type or *speak* everything on your plate. The Gemini-powered agent extracts every commitment as a structured task (deadline, priority, effort, category) using function-calling.
- **🎯 Intelligent prioritization.** Tasks are ranked by urgency and deadline into a clean "Active Priority" focus view.
- **📊 Command-center dashboard.** Personalized greeting, live stats (due today, overdue, this week, completion rate), and an at-a-glance prioritized list.
- **⚠️ Proactive at-risk detection.** An autonomous "agent check" scans your plan for slippage and drafts consequence-management messages (e.g. a deadline-extension email) — held in a **human-in-the-loop approval queue** so nothing sends without your OK.
- **💬 AI productivity coach.** A conversational coach with full context of your tasks ("What should I focus on right now?").
- **🗓️ Weekly calendar + habit tracking** with streaks.
- **🔐 Real auth** — email/password (hashed) and **Google Sign-In**.
- **🌗 Polished light & dark themes** with a one-click toggle.
- **🛟 Always-on resilience.** If the AI is unavailable or rate-limited, a deterministic offline parser keeps brain-dump fully functional — the app never breaks during a demo.

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
  main.py    — FastAPI routes (auth, tasks, brain-dump, chat, approvals, habits)
  agent.py   — Gemini agent loop + offline heuristic fallback
  tools.py   — function-calling tool registry
  auth.py    — JWT + password hashing + Google token verification
  store.py   — persistence API (delegates to SQLite or Firestore)
  db.py / fsdb.py — SQLite and Firestore backends
frontend/src/
  screens/   — Today, BrainDump, AtRisk, Calendar, Habits, AICoach, Profile, Login
  auth.jsx   — auth context;  theme.js — light/dark theme
```

---

## 📦 Deploy to Google Cloud Run

See [`DEPLOY.md`](DEPLOY.md) for the full guide. In short: the backend serves the built React app from a single container, deployed with `gcloud run deploy`, with `USE_FIRESTORE=1` for persistence.

---


