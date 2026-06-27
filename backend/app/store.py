"""Persistent agent state: users, tasks, plan, habits, approval queue.

Backed by SQLite (see db.py). Domain objects are stored as JSON blobs so the
agent loop keeps working with plain dicts; users get real columns for auth.
"""
from __future__ import annotations

import json
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Any

from . import db

# Pick a backend: Firestore in production (USE_FIRESTORE=1), else SQLite locally.
try:
    from . import fsdb
    _FS = fsdb.available()
except Exception:
    _FS = False

if not _FS:
    db.init_db()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id() -> str:
    return uuid.uuid4().hex[:8]


# ---- generic collection helpers (delegate to Firestore or SQLite) -----------

def _insert(table: str, uid: str, obj: dict) -> dict:
    if _FS:
        return fsdb.insert(table, uid, obj)
    with db.conn() as c:
        c.execute(
            f"INSERT OR REPLACE INTO {table} (id, uid, data, created) VALUES (?,?,?,?)",
            (obj["id"], uid, json.dumps(obj), obj.get("created", _now())),
        )
    return obj


def _list(table: str, uid: str) -> list[dict]:
    if _FS:
        return fsdb.list_(table, uid)
    with db.conn() as c:
        rows = c.execute(f"SELECT data FROM {table} WHERE uid=?", (uid,)).fetchall()
    return [json.loads(r["data"]) for r in rows]


def _get(table: str, uid: str, obj_id: str) -> dict | None:
    if _FS:
        return fsdb.get(table, uid, obj_id)
    with db.conn() as c:
        row = c.execute(
            f"SELECT data FROM {table} WHERE uid=? AND id=?", (uid, obj_id)
        ).fetchone()
    return json.loads(row["data"]) if row else None


def _delete(table: str, uid: str, obj_id: str) -> bool:
    if _FS:
        return fsdb.delete(table, uid, obj_id)
    with db.conn() as c:
        cur = c.execute(f"DELETE FROM {table} WHERE uid=? AND id=?", (uid, obj_id))
        return cur.rowcount > 0


# ---- users ------------------------------------------------------------------

_DEFAULT_SETTINGS = {"daily_report": True, "at_risk_alerts": True}


def _row_to_user(row) -> dict:
    u = dict(row)
    u["settings"] = json.loads(u["settings"]) if u.get("settings") else dict(_DEFAULT_SETTINGS)
    u.pop("password_hash", None)
    u.pop("security_answer_hash", None)  # never expose the answer hash to clients
    u["has_security_question"] = bool(u.pop("security_question", None))
    return u


def create_user(email: str, name: str, password_hash: str,
                role: str = "Member", plan: str = "Free Plan",
                security_question: str | None = None,
                security_answer_hash: str | None = None) -> dict:
    if _FS:
        return fsdb.create_user(email, name, password_hash, role, plan,
                                security_question, security_answer_hash)
    uid = uuid.uuid4().hex
    with db.conn() as c:
        c.execute(
            "INSERT INTO users (uid, email, name, password_hash, role, plan, settings, "
            "security_question, security_answer_hash, created) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (uid, email.lower().strip(), name, password_hash, role, plan,
             json.dumps(_DEFAULT_SETTINGS), security_question, security_answer_hash, _now()),
        )
        row = c.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    return _row_to_user(row)


def set_password(uid: str, password_hash: str) -> bool:
    if _FS:
        return fsdb.set_password(uid, password_hash)
    with db.conn() as c:
        cur = c.execute("UPDATE users SET password_hash=? WHERE uid=?", (password_hash, uid))
    return cur.rowcount > 0


def get_user_by_email(email: str) -> dict | None:
    """Returns the full row INCLUDING password_hash (for login verification)."""
    if _FS:
        return fsdb.get_user_by_email(email)
    with db.conn() as c:
        row = c.execute("SELECT * FROM users WHERE email=?", (email.lower().strip(),)).fetchone()
    return dict(row) if row else None


def get_user(uid: str) -> dict | None:
    if _FS:
        return fsdb.get_user(uid)
    with db.conn() as c:
        row = c.execute("SELECT * FROM users WHERE uid=?", (uid,)).fetchone()
    return _row_to_user(row) if row else None


def update_user(uid: str, updates: dict) -> dict | None:
    if _FS:
        return fsdb.update_user(uid, updates)
    allowed = {"name", "role", "plan", "avatar_url", "settings"}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if not fields:
        return get_user(uid)
    if "settings" in fields and isinstance(fields["settings"], dict):
        fields["settings"] = json.dumps(fields["settings"])
    sets = ", ".join(f"{k}=?" for k in fields)
    with db.conn() as c:
        c.execute(f"UPDATE users SET {sets} WHERE uid=?", (*fields.values(), uid))
    return get_user(uid)


# ---- tasks ------------------------------------------------------------------

def upsert_tasks(uid: str, tasks: list[dict]) -> list[dict]:
    for t in tasks:
        t.setdefault("id", _new_id())
        t.setdefault("status", "todo")
        t.setdefault("created", _now())
        _insert("tasks", uid, t)
    return tasks


def get_tasks(uid: str) -> list[dict]:
    return _list("tasks", uid)


def update_task(uid: str, task_id: str, updates: dict) -> dict | None:
    t = _get("tasks", uid, task_id)
    if not t:
        return None
    t.update({**updates, "updated": _now()})
    _insert("tasks", uid, t)
    return t


def delete_task(uid: str, task_id: str) -> bool:
    return _delete("tasks", uid, task_id)


def mark_status(uid: str, task_id: str, status: str) -> None:
    update_task(uid, task_id, {"status": status})


# ---- calendar / blocks ------------------------------------------------------

def get_calendar(uid: str, start: str, end: str) -> dict:
    return {"start": start, "end": end, "blocks": _list("blocks", uid)}


def add_block(uid: str, task_id: str, start: str, minutes: int) -> dict:
    block = {"id": _new_id(), "task_id": task_id, "start": start,
             "minutes": minutes, "created": _now()}
    return _insert("blocks", uid, block)


# ---- approval queue (human-in-the-loop gate) --------------------------------

def enqueue_approval(uid: str, payload: dict) -> dict:
    item = {"id": _new_id(), "created": _now(), "status": "pending", **payload}
    return _insert("approvals", uid, item)


def list_approvals(uid: str, status: str = "pending") -> list[dict]:
    return [a for a in _list("approvals", uid) if a.get("status") == status]


def resolve_approval(uid: str, approval_id: str, decision: str) -> dict | None:
    a = _get("approvals", uid, approval_id)
    if not a:
        return None
    a["status"] = decision
    a["resolved"] = _now()
    _insert("approvals", uid, a)
    return a


# ---- habits -----------------------------------------------------------------

def list_habits(uid: str) -> list[dict]:
    return _list("habits", uid)


def upsert_habit(uid: str, habit: dict) -> dict:
    habit.setdefault("id", _new_id())
    habit.setdefault("checks", [])
    habit.setdefault("created", _now())
    return _insert("habits", uid, habit)


def check_habit(uid: str, habit_id: str, date_str: str | None = None) -> dict | None:
    today = date_str or date.today().isoformat()
    h = _get("habits", uid, habit_id)
    if not h:
        return None
    checks = h.setdefault("checks", [])
    if today not in checks:
        checks.append(today)
        _insert("habits", uid, h)
    return h


def delete_habit(uid: str, habit_id: str) -> bool:
    return _delete("habits", uid, habit_id)


def compute_streak(checks: list[str], today_str: str | None = None) -> int:
    if not checks:
        return 0
    check_set = set(checks)
    try:
        today = date.fromisoformat(today_str) if today_str else date.today()
    except ValueError:
        today = date.today()
    streak = 0
    cur = today
    # allow streak to count from yesterday if not yet checked today
    if today.isoformat() not in check_set:
        cur = today - timedelta(days=1)
    while cur.isoformat() in check_set:
        streak += 1
        cur -= timedelta(days=1)
    return streak


# ---- replan -----------------------------------------------------------------

def replan(uid: str, reason: str) -> dict:
    tasks = [t for t in get_tasks(uid) if t.get("status") != "done"]
    tasks.sort(key=lambda t: (t.get("priority", 5), t.get("deadline") or "9999"))
    return {"reason": reason, "ordered_task_ids": [t["id"] for t in tasks],
            "deferred": [t["id"] for t in tasks if t.get("priority", 5) >= 4]}
