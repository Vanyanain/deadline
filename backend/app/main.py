"""Deadline — autonomous deadline agent. FastAPI entrypoint."""
import os
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv

# Load .env from the backend/ directory regardless of where uvicorn is run
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

import secrets

from .agent import (
    run_agent, tick, chat_agent, smart_suggest, AgentResult,
    kickstart_task, task_reasoning, reality_check, unblock_task,
)
from .auth import (
    verify_token, verify_token_or_cron,
    hash_password, verify_password, create_access_token,
    verify_google_token, verify_google_access_token, google_configured,
)
from . import store
from . import ratelimit

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
    email: str = Field(max_length=254)
    password: str = Field(min_length=6, max_length=200)
    name: Optional[str] = Field(default=None, max_length=80)
    security_question: Optional[str] = Field(default=None, max_length=200)
    security_answer: Optional[str] = Field(default=None, max_length=200)


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=200)


def _norm_answer(a: str) -> str:
    """Normalise a security answer so casing/whitespace don't matter."""
    return " ".join((a or "").strip().lower().split())


def _auth_response(user: dict) -> dict:
    return {"token": create_access_token(user["uid"]), "user": user}


@app.post("/api/auth/register")
def register(req: RegisterRequest, request: Request):
    ratelimit.hit(f"register:{ratelimit.client_ip(request)}", limit=8, window=600)
    email = req.email.lower().strip()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email required")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    if store.get_user_by_email(email):
        raise HTTPException(status_code=409, detail="An account with this email already exists")
    name = (req.name or email.split("@")[0]).strip()
    q = (req.security_question or "").strip() or None
    ans_hash = None
    if q and req.security_answer and req.security_answer.strip():
        ans_hash = hash_password(_norm_answer(req.security_answer))
    user = store.create_user(email, name, hash_password(req.password),
                             security_question=q, security_answer_hash=ans_hash)
    return _auth_response(user)


class SecurityQuestionRequest(BaseModel):
    email: str = Field(max_length=254)


@app.post("/api/auth/security-question")
def security_question(req: SecurityQuestionRequest, request: Request):
    ratelimit.hit(f"secq:{ratelimit.client_ip(request)}", limit=20, window=600)
    """Return the account's security question (if any) so the user can answer it.
    Always 200 — a null question covers both 'no account' and 'none set' so we
    don't reveal which emails exist."""
    row = store.get_user_by_email(req.email)
    q = row.get("security_question") if row else None
    return {"question": q or None}


class ResetPasswordRequest(BaseModel):
    email: str = Field(max_length=254)
    answer: str = Field(max_length=200)
    new_password: str = Field(min_length=6, max_length=200)


@app.post("/api/auth/reset-password")
def reset_password(req: ResetPasswordRequest, request: Request):
    # Throttle answer-guessing per account and per IP.
    email_key = req.email.lower().strip()
    ratelimit.hit(f"reset:{email_key}", limit=6, window=600)
    ratelimit.hit(f"reset-ip:{ratelimit.client_ip(request)}", limit=15, window=600)
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    row = store.get_user_by_email(req.email)
    ans_hash = row.get("security_answer_hash") if row else None
    if not row or not ans_hash:
        raise HTTPException(status_code=400, detail="No security question is set for this account.")
    if not verify_password(_norm_answer(req.answer), ans_hash):
        raise HTTPException(status_code=401, detail="That answer doesn't match. Try again.")
    store.set_password(row["uid"], hash_password(req.new_password))
    return {"ok": True}


@app.post("/api/auth/login")
def login(req: LoginRequest, request: Request):
    # Throttle credential-stuffing per account and per IP.
    ratelimit.hit(f"login:{req.email.lower().strip()}", limit=8, window=300)
    ratelimit.hit(f"login-ip:{ratelimit.client_ip(request)}", limit=40, window=300)
    row = store.get_user_by_email(req.email)
    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _auth_response(store.get_user(row["uid"]))


class GoogleAuthRequest(BaseModel):
    credential: Optional[str] = Field(default=None, max_length=8000)   # ID token (rendered button)
    access_token: Optional[str] = Field(default=None, max_length=4000)  # OAuth token (popup flow)


@app.get("/api/auth/config")
def auth_config():
    """Lets the frontend know which providers are available + the public client ID.
    The OAuth client ID is public by design, so it's safe to serve at runtime."""
    return {"google": google_configured(), "google_client_id": os.getenv("GOOGLE_CLIENT_ID", "")}


@app.post("/api/auth/google")
def google_auth(req: GoogleAuthRequest):
    if not google_configured():
        raise HTTPException(status_code=503, detail="Google sign-in is not configured on the server.")
    info = None
    if req.access_token:
        info = verify_google_access_token(req.access_token)
    elif req.credential:
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
    name: Optional[str] = Field(default=None, max_length=80)
    avatar_url: Optional[str] = None
    settings: Optional[dict] = None


_ALLOWED_SETTINGS = {"daily_report", "at_risk_alerts"}
_MAX_AVATAR_LEN = 1_500_000  # ~1.1 MB image encoded as base64


@app.patch("/api/auth/profile")
def update_profile(req: ProfileUpdate, uid: str = Depends(verify_token)):
    updates: dict = {}
    if req.name is not None:
        updates["name"] = req.name.strip()[:80]
    if req.avatar_url is not None:
        av = req.avatar_url
        if av and not av.startswith("data:image/"):
            raise HTTPException(status_code=400, detail="Avatar must be an uploaded image.")
        if len(av) > _MAX_AVATAR_LEN:
            raise HTTPException(status_code=400, detail="Image is too large — please choose a smaller photo.")
        updates["avatar_url"] = av
    if req.settings is not None:
        # Only known boolean toggles are accepted — never arbitrary blobs.
        updates["settings"] = {k: bool(v) for k, v in req.settings.items() if k in _ALLOWED_SETTINGS}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    user = store.update_user(uid, updates)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {"user": user}


# ---------- brain-dump -------------------------------------------------------

class BrainDumpRequest(BaseModel):
    text: str = Field(min_length=1, max_length=6000)


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


class TaskCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    deadline: Optional[str] = Field(default=None, max_length=40)
    priority: int = Field(default=3, ge=1, le=5)
    effort_minutes: int = Field(default=60, ge=0, le=100000)
    category: str = Field(default="personal", max_length=40)
    notes: Optional[str] = Field(default=None, max_length=4000)


@app.post("/api/tasks")
def create_task(req: TaskCreateRequest, uid: str = Depends(verify_token)):
    if not req.title.strip():
        raise HTTPException(status_code=400, detail="Title required")
    saved = store.upsert_tasks(uid, [{
        "title": req.title.strip(),
        "deadline": req.deadline,
        "priority": req.priority,
        "effort_minutes": req.effort_minutes,
        "category": req.category,
        "notes": req.notes,
        "status": "todo",
    }])
    return {"task": saved[0]}


class TaskUpdateRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=300)
    status: Optional[str] = Field(default=None, max_length=20)
    priority: Optional[int] = Field(default=None, ge=1, le=5)
    deadline: Optional[str] = Field(default=None, max_length=40)
    effort_minutes: Optional[int] = Field(default=None, ge=0, le=100000)
    category: Optional[str] = Field(default=None, max_length=40)
    notes: Optional[str] = Field(default=None, max_length=4000)


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
    kind: Optional[str] = Field(default=None, max_length=20)  # outline | email | checklist | steps
    fresh: bool = False         # true = bypass cache (the Regenerate button)


@app.post("/api/tasks/{task_id}/kickstart")
def kickstart(task_id: str, req: KickstartRequest, uid: str = Depends(verify_token)):
    res = kickstart_task(uid, task_id, req.kind, fresh=req.fresh)
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
    block: Optional[str] = Field(default=None, max_length=40)  # too_big | vague | unclear_start | fear | boring


@app.post("/api/tasks/{task_id}/unblock")
def unblock(task_id: str, req: UnblockRequest, uid: str = Depends(verify_token)):
    res = unblock_task(uid, task_id, req.block or "unclear_start")
    if not res:
        raise HTTPException(status_code=404, detail="Task not found")
    return res


# ---------- approvals --------------------------------------------------------

class ResolveRequest(BaseModel):
    decision: str = Field(max_length=20)  # "approved" | "rejected"


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
    message: str = Field(min_length=1, max_length=4000)
    history: list[dict] = Field(default=[], max_length=50)


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
    name: str = Field(min_length=1, max_length=120)
    icon: str = Field(default="check_circle", max_length=40)
    color: str = Field(default="#c0c1ff", max_length=20)
    target_days: list[str] = Field(default=["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"], max_length=7)


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
    date: Optional[str] = Field(default=None, max_length=10)  # client's local YYYY-MM-DD


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
