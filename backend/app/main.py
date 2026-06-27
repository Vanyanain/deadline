"""Deadline — autonomous deadline agent. FastAPI entrypoint."""
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend/ directory regardless of where uvicorn is run
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

import secrets

from .agent import (
    run_agent, tick, chat_agent, smart_suggest, AgentResult,
    kickstart_task, task_reasoning, reality_check, unblock_task,
)
from .auth import (
    verify_token, verify_token_or_cron,
    hash_password, verify_password, create_access_token,
    verify_google_token, google_configured,
)
from . import store

app = FastAPI(title="Deadline API", version="1.0.0")

origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Built React app, copied to backend/static in the Docker image (single-container deploy).
_STATIC_DIR = Path(__file__).resolve().parents[1] / "static"


# ---------- health -----------------------------------------------------------

@app.get("/")
def root():
    # In production, serve the React app; in API-only/dev mode, a health JSON.
    if (_STATIC_DIR / "index.html").exists():
        return FileResponse(_STATIC_DIR / "index.html")
    return {"service": "deadline", "status": "ok"}


@app.get("/healthz")
def healthz():
    return {"status": "healthy", "time": datetime.now(timezone.utc).isoformat()}


# ---------- auth -------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


def _auth_response(user: dict) -> dict:
    return {"token": create_access_token(user["uid"]), "user": user}


@app.post("/api/auth/register")
def register(req: RegisterRequest):
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if store.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    name = (req.name or email.split("@")[0]).strip()
    user = store.create_user(email, name, hash_password(req.password))
    return _auth_response(user)


@app.post("/api/auth/login")
def login(req: LoginRequest):
    row = store.get_user_by_email(req.email)
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _auth_response(store.get_user(row["uid"]))


class GoogleAuthRequest(BaseModel):
    credential: str


@app.get("/api/auth/config")
def auth_config():
    """Lets the frontend know which providers are available + the public client ID.
    The OAuth client ID is public by design, so it's safe to serve at runtime."""
    return {"google": google_configured(), "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "")}


@app.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest):
    if not google_configured():
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server.")
    info = verify_google_token(req.credential)
    if not info:
        raise HTTPException(status_code=401, detail="Could not verify Google account.")

    row = store.get_user_by_email(info["email"])
    if row:
        user = store.get_user(row["uid"])  # existing account — link by email
    else:
        # OAuth users have no usable password; store a random one.
        user = store.create_user(
            info["email"], info["name"], hash_password(secrets.token_urlsafe(32))
        )
        if info.get("picture"):
            user = store.update_user(user["uid"], {"avatar_url": info["picture"]})
    return _auth_response(user)


@app.get("/api/auth/me")
def me(uid: str = Depends(verify_token)):
    user = store.get_user(uid)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    settings: Optional[dict] = None


@app.patch("/api/auth/profile")
def update_profile(req: ProfileUpdate, uid: str = Depends(verify_token)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    user = store.update_user(uid, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


# ---------- brain-dump -------------------------------------------------------

class BrainDumpRequest(BaseModel):
    text: str


class BrainDumpResponse(BaseModel):
    tasks: list[dict]
    message: str


@app.post("/api/braindump", response_model=BrainDumpResponse)
async def braindump(req: BrainDumpRequest, uid: str = Depends(verify_token)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Empty input")
    result: AgentResult = await run_agent(req.text, uid)
    return BrainDumpResponse(tasks=result.tasks, message=result.message)


# ---------- tasks ------------------------------------------------------------

@app.get("/api/tasks")
def get_tasks(uid: str = Depends(verify_token)):
    return {"tasks": store.get_tasks(uid)}


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = None
    deadline: Optional[str] = None
    effort_minutes: Optional[int] = None
    category: Optional[str] = None
    notes: Optional[str] = None


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: str, req: TaskUpdateRequest, uid: str = Depends(verify_token)):
    updates = {k: v for k, v in req.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    task = store.update_task(uid, task_id, updates)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"task": task}


@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, uid: str = Depends(verify_token)):
    ok = store.delete_task(uid, task_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"deleted": task_id}


# ---------- Kickstart + Why-now (AI action helpers) --------------------------

class KickstartRequest(BaseModel):
    kind: Optional[str] = None  # outline | email | checklist | steps


@app.post("/api/tasks/{task_id}/kickstart")
def kickstart(task_id: str, req: KickstartRequest, uid: str = Depends(verify_token)):
    res = kickstart_task(uid, task_id, req.kind)
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res


@app.get("/api/tasks/{task_id}/why")
def why_now(task_id: str, uid: str = Depends(verify_token)):
    res = task_reasoning(uid, task_id)
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res


@app.get("/api/reality-check")
def reality_check_endpoint(uid: str = Depends(verify_token)):
    return reality_check(uid)


class UnblockRequest(BaseModel):
    block: Optional[str] = None  # too_big | vague | unclear_start | fear | boring


@app.post("/api/tasks/{task_id}/unblock")
def unblock(task_id: str, req: UnblockRequest, uid: str = Depends(verify_token)):
    res = unblock_task(uid, task_id, req.block or "unclear_start")
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res


# ---------- approvals --------------------------------------------------------

class ResolveRequest(BaseModel):
    decision: str  # "approved" | "rejected"


@app.get("/api/approvals")
def approvals(uid: str = Depends(verify_token)):
    return {"approvals": store.list_approvals(uid)}


@app.post("/api/approvals/{approval_id}")
def resolve(approval_id: str, req: ResolveRequest, uid: str = Depends(verify_token)):
    if req.decision not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="decision must be approved or rejected")
    item = store.resolve_approval(uid, approval_id, req.decision)
    if not item:
        raise HTTPException(status_code=404, detail="approval not found")
    return {"item": item, "sent": req.decision == "approved"}


# ---------- AI coach chat ----------------------------------------------------

class ChatMessage(BaseModel):
    message: str
    history: list[dict] = []


@app.post("/api/chat")
def coach_chat(req: ChatMessage, uid: str = Depends(verify_token)):
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Empty message")
    reply = chat_agent(req.message, uid, req.history)
    return {"reply": reply}


# ---------- smart suggestions ------------------------------------------------

@app.get("/api/suggest")
def suggest(uid: str = Depends(verify_token)):
    return smart_suggest(uid)


# ---------- habits -----------------------------------------------------------

class HabitCreate(BaseModel):
    name: str
    icon: str = "check_circle"
    color: str = "#c0c1ff"
    target_days: list[str] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]


@app.get("/api/habits")
def get_habits(uid: str = Depends(verify_token)):
    habits = store.list_habits(uid)
    result = []
    for h in habits:
        streak = store.compute_streak(h.get("checks", []))
        result.append({**h, "streak": streak})
    return {"habits": result}


@app.post("/api/habits")
def create_habit(req: HabitCreate, uid: str = Depends(verify_token)):
    habit = store.upsert_habit(uid, {
        "name": req.name, "icon": req.icon, "color": req.color,
        "target_days": req.target_days,
    })
    return {"habit": {**habit, "streak": 0}}


class HabitCheckRequest(BaseModel):
    date: Optional[str] = None  # client's local YYYY-MM-DD; defaults to server today


@app.post("/api/habits/{habit_id}/check")
def check_habit(
    habit_id: str,
    req: Optional[HabitCheckRequest] = None,
    uid: str = Depends(verify_token),
):
    habit = store.check_habit(uid, habit_id, req.date if req else None)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    return {"habit": {**habit, "streak": store.compute_streak(habit.get("checks", []), req.date if req else None)}}


@app.delete("/api/habits/{habit_id}")
def delete_habit(habit_id: str, uid: str = Depends(verify_token)):
    ok = store.delete_habit(uid, habit_id)
    return {"deleted": habit_id, "ok": ok}


# ---------- autonomous tick --------------------------------------------------

@app.post("/tick")
def tick_endpoint(uid: str = Depends(verify_token_or_cron)):
    """Cloud Scheduler hits this. Accepts either user auth or a CRON_SECRET header."""
    return tick(uid)


# ---------- serve the built React app (single-container production) -----------
# Registered LAST so it only catches paths no API route claimed. Any unknown
# path returns index.html so client-side routes (e.g. /reality-check) work on refresh.

if _STATIC_DIR.exists():
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        candidate = (_STATIC_DIR / full_path).resolve()
        if str(candidate).startswith(str(_STATIC_DIR.resolve())) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_STATIC_DIR / "index.html")
