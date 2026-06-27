"""Tool registry for the Deadline agent."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from . import store

TOOL_DECLARATIONS: list[dict] = [
    {
        "name": "read_gmail_deadlines",
        "description": "Scan the user's recent email for hidden commitments and deadlines.",
        "parameters": {"type": "object", "properties": {
            "lookback_days": {"type": "integer", "description": "How many days back to scan."}
        }, "required": ["lookback_days"]},
    },
    {
        "name": "get_calendar",
        "description": "Read the user's calendar for a date range.",
        "parameters": {"type": "object", "properties": {
            "start": {"type": "string", "description": "ISO date."},
            "end": {"type": "string", "description": "ISO date."},
        }, "required": ["start", "end"]},
    },
    {
        "name": "schedule_block",
        "description": "Write a focused work block onto the calendar for a specific task.",
        "parameters": {"type": "object", "properties": {
            "task_id": {"type": "string"},
            "start": {"type": "string", "description": "ISO datetime."},
            "minutes": {"type": "integer"},
        }, "required": ["task_id", "start", "minutes"]},
    },
    {
        "name": "upsert_tasks",
        "description": "Save structured tasks extracted from the brain-dump into the user's task list.",
        "parameters": {
            "type": "object",
            "properties": {
                "tasks": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "deadline": {"type": "string", "description": "ISO datetime or null"},
                            "priority": {"type": "integer", "description": "1=highest, 5=lowest"},
                            "effort_minutes": {"type": "integer"},
                            "category": {"type": "string",
                                         "description": "academic|work|finance|health|personal|admin"},
                            "notes": {"type": "string"},
                        },
                        "required": ["title", "priority", "category"],
                    },
                }
            },
            "required": ["tasks"],
        },
    },
    {
        "name": "draft_deliverable",
        "description": "Produce a first draft of the work product for a task (essay, email, code, outline).",
        "parameters": {"type": "object", "properties": {
            "task_id": {"type": "string"},
            "task_title": {"type": "string"},
            "kind": {"type": "string", "description": "essay | email | code | outline | other"},
        }, "required": ["task_id", "kind"]},
    },
    {
        "name": "draft_message",
        "description": "Draft a consequence-management message when a deadline is at risk. "
                       "Goes to the approval queue; NEVER sent without explicit user approval.",
        "parameters": {"type": "object", "properties": {
            "task_id": {"type": "string"},
            "task_title": {"type": "string"},
            "recipient_role": {"type": "string", "description": "professor, manager, client, etc."},
            "intent": {"type": "string",
                       "description": "extension | reschedule | heads_up | decline"},
        }, "required": ["task_id", "intent"]},
    },
    {
        "name": "replan_week",
        "description": "Regenerate the schedule for remaining tasks given current reality.",
        "parameters": {"type": "object", "properties": {
            "reason": {"type": "string"}
        }, "required": ["reason"]},
    },
]


def _seeded_emails() -> list[dict]:
    today = datetime.now(timezone.utc).date()
    return [
        {"from": "library@srm.edu", "subject": "Loan reminder",
         "body": f"Book 'Designing Data-Intensive Applications' due {today + timedelta(days=2)}."},
        {"from": "events@devfest.in", "subject": "DevFest ticket",
         "body": f"Rs 500 payment due {today + timedelta(days=4)} or seat released."},
        {"from": "noreply@scholarships.gov", "subject": "Application window",
         "body": f"Merit scholarship form closes {today + timedelta(days=3)}."},
    ]


def read_gmail_deadlines(uid: str, lookback_days: int = 7) -> dict:
    return {"candidate_tasks": _seeded_emails()}


def get_calendar(uid: str, start: str, end: str) -> dict:
    return store.get_calendar(uid, start, end)


def schedule_block(uid: str, task_id: str, start: str, minutes: int) -> dict:
    return store.add_block(uid, task_id, start, minutes)


def upsert_tasks_tool(uid: str, tasks: list[dict]) -> dict:
    for t in tasks:
        for k in ("priority", "effort_minutes"):
            if t.get(k) is not None:
                try:
                    t[k] = int(t[k])
                except (TypeError, ValueError):
                    t.pop(k, None)
        if t.get("deadline") in ("", "null", "None"):
            t["deadline"] = None
    saved = store.upsert_tasks(uid, tasks)
    return {"saved": len(saved), "task_ids": [t["id"] for t in saved]}


# Small in-process cache so identical prompts (re-opening Kickstart, re-running
# Reality Check on unchanged tasks, etc.) don't spend a fresh API call. The key
# is the prompt itself, so any change in inputs naturally misses the cache.
import hashlib
import time as _time

_GEN_CACHE: dict[str, tuple[float, str]] = {}
_GEN_CACHE_TTL = 900   # 15 minutes
_GEN_CACHE_MAX = 200


def _gemini_generate(prompt: str, use_cache: bool = True) -> str:
    key = hashlib.sha256(prompt.encode("utf-8")).hexdigest()
    if use_cache:
        hit = _GEN_CACHE.get(key)
        if hit and (_time.time() - hit[0]) < _GEN_CACHE_TTL:
            return hit[1]
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
    model = genai.GenerativeModel(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    resp = model.generate_content(prompt)
    text = resp.text or ""
    if text:
        if len(_GEN_CACHE) >= _GEN_CACHE_MAX:
            _GEN_CACHE.clear()
        _GEN_CACHE[key] = (_time.time(), text)
    return text


def draft_deliverable(uid: str, task_id: str, kind: str, task_title: str = "") -> dict:
    if not os.getenv("GEMINI_API_KEY"):
        draft_text = f"[Set GEMINI_API_KEY to generate a real {kind} for '{task_title or task_id}']"
    else:
        try:
            prompt = (
                f"You are a productivity assistant. Write a ready-to-use first draft for this task:\n"
                f"Task: {task_title or task_id}\nType: {kind}\n\n"
                f"Rules:\n"
                f"- essay/outline: write 3-5 bullet-point sections with a 2-sentence intro\n"
                f"- email: write a complete ready-to-send email, professional and concise\n"
                f"- code: write a working stub with type hints and comments\n"
                f"- other: write the most useful starting artifact you can\n"
                f"Be concrete and actionable. Return only the draft, no preamble."
            )
            draft_text = _gemini_generate(prompt)
        except Exception as e:
            draft_text = f"[Draft generation failed: {e}]"

    item = store.enqueue_approval(uid, {
        "type": "deliverable", "task_id": task_id, "kind": kind,
        "task_title": task_title or task_id, "draft": draft_text,
    })
    return {"task_id": task_id, "kind": kind, "draft": draft_text, "approval_id": item["id"]}


def draft_message(uid: str, task_id: str, intent: str,
                  recipient_role: str = "stakeholder", task_title: str = "") -> dict:
    if os.getenv("GEMINI_API_KEY"):
        try:
            intent_phrases = {
                "extension": "requesting a deadline extension",
                "reschedule": "rescheduling a meeting/deliverable",
                "heads_up": "giving a proactive heads-up about a potential delay",
                "decline": "politely declining the commitment",
            }
            prompt = (
                f"Write a professional email from a student/professional to their {recipient_role} "
                f"{intent_phrases.get(intent, intent)} regarding: '{task_title or task_id}'. "
                f"Be polite, brief (under 150 words), specific, and end with a clear ask. "
                f"Return only the email text with Subject: line."
            )
            draft_text = _gemini_generate(prompt)
        except Exception:
            draft_text = f"[{intent} message to {recipient_role} re '{task_title or task_id}']"
    else:
        draft_text = f"[{intent} message to your {recipient_role} re '{task_title or task_id}']"

    item = store.enqueue_approval(uid, {
        "type": "message", "task_id": task_id, "task_title": task_title or task_id,
        "intent": intent, "recipient_role": recipient_role, "draft": draft_text,
    })
    return {"queued_for_approval": True, "approval_id": item["id"]}


def replan_week(uid: str, reason: str) -> dict:
    return store.replan(uid, reason)


REGISTRY: dict[str, Callable[..., dict]] = {
    "read_gmail_deadlines": read_gmail_deadlines,
    "get_calendar": get_calendar,
    "schedule_block": schedule_block,
    "upsert_tasks": upsert_tasks_tool,
    "draft_deliverable": draft_deliverable,
    "draft_message": draft_message,
    "replan_week": replan_week,
}


def call_tool(name: str, uid: str, args: dict[str, Any]) -> dict:
    if name not in REGISTRY:
        return {"error": f"unknown tool {name}"}
    try:
        return REGISTRY[name](uid=uid, **args)
    except TypeError as e:
        return {"error": f"bad args for {name}: {e}"}
