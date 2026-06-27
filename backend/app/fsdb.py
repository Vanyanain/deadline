"""Firestore backend (Google-native persistence for Cloud Run).

Activated when USE_FIRESTORE=1 and google-cloud-firestore is importable; the
store layer delegates its low-level ops here. Locally (no env var) the app uses
SQLite instead, so this module never loads google.cloud unless asked.

Data model:
  users/{uid}                         -> profile fields + settings map
  users/{uid}/{collection}/{doc_id}   -> tasks | habits | blocks | approvals
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timezone

_client = None
_DEFAULT_SETTINGS = {"daily_report": True, "at_risk_alerts": True}


def available() -> bool:
    if not os.getenv("USE_FIRESTORE"):
        return False
    try:
        import google.cloud.firestore  # noqa: F401
        return True
    except Exception:
        return False


def _db():
    global _client
    if _client is None:
        from google.cloud import firestore
        _client = firestore.Client()  # uses GOOGLE_CLOUD_PROJECT + ADC
    return _client


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _col(uid: str, table: str):
    return _db().collection("users").document(uid).collection(table)


# ---- generic collection ops (mirror store.py seam) --------------------------

def insert(table: str, uid: str, obj: dict) -> dict:
    _col(uid, table).document(obj["id"]).set(obj)
    return obj


def list_(table: str, uid: str) -> list[dict]:
    return [d.to_dict() for d in _col(uid, table).stream()]


def get(table: str, uid: str, obj_id: str) -> dict | None:
    doc = _col(uid, table).document(obj_id).get()
    return doc.to_dict() if doc.exists else None


def delete(table: str, uid: str, obj_id: str) -> bool:
    ref = _col(uid, table).document(obj_id)
    existed = ref.get().exists
    ref.delete()
    return existed


# ---- users ------------------------------------------------------------------

def _sanitize(data: dict) -> dict:
    u = dict(data)
    u.setdefault("settings", dict(_DEFAULT_SETTINGS))
    u.pop("password_hash", None)
    u.pop("security_answer_hash", None)  # never expose the answer hash to clients
    u["has_security_question"] = bool(u.pop("security_question", None))
    return u


def create_user(email, name, password_hash, role="Member", plan="Free Plan",
                security_question=None, security_answer_hash=None) -> dict:
    uid = uuid.uuid4().hex
    doc = {
        "uid": uid, "email": email.lower().strip(), "name": name,
        "password_hash": password_hash, "role": role, "plan": plan,
        "avatar_url": None, "settings": dict(_DEFAULT_SETTINGS),
        "security_question": security_question,
        "security_answer_hash": security_answer_hash, "created": _now(),
    }
    _db().collection("users").document(uid).set(doc)
    return _sanitize(doc)


def set_password(uid: str, password_hash: str) -> bool:
    _db().collection("users").document(uid).update({"password_hash": password_hash})
    return True


def get_user_by_email(email: str) -> dict | None:
    q = _db().collection("users").where("email", "==", email.lower().strip()).limit(1).stream()
    for d in q:
        return d.to_dict()  # includes password_hash for login verification
    return None


def get_user(uid: str) -> dict | None:
    doc = _db().collection("users").document(uid).get()
    return _sanitize(doc.to_dict()) if doc.exists else None


def update_user(uid: str, updates: dict) -> dict | None:
    allowed = {"name", "role", "plan", "avatar_url", "settings"}
    fields = {k: v for k, v in updates.items() if k in allowed}
    if fields:
        _db().collection("users").document(uid).update(fields)
    return get_user(uid)
