"""The Deadline agent loop.

sense -> plan -> act -> observe -> replan cycle driven by Gemini function-calling.

- run_agent(): handles user brain-dump.
- chat_agent(): conversational AI coach.
- smart_suggest(): surface hidden at-risk items and priority recommendations.
- tick(): autonomous cycle for Cloud Scheduler.
"""
from __future__ import annotations

import os
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone

from . import store, tools

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

BRAIN_DUMP_SYSTEM = """You are Deadline, an autonomous productivity agent. You do not just remind — you act.

When given a brain-dump:
1. Call read_gmail_deadlines to check for hidden email commitments.
2. Call upsert_tasks to save EVERY commitment as a structured task with title, deadline (ISO or null),
   priority (1=highest..5), effort_minutes, category (academic|work|finance|health|personal|admin).
3. Call get_calendar to check free slots, then call schedule_block for each urgent task (priority ≤ 2).
4. For the highest-priority task, call draft_deliverable with kind=outline to give the user a head start.
5. Reply with a concise plain-language summary: what you found, what you scheduled, what needs attention.

Be decisive. If a deadline is ambiguous, pick a reasonable date. Prioritize ruthlessly."""

COACH_SYSTEM = """You are Deadline, an empathetic AI productivity coach. Your role:
- Help users plan, prioritize, and complete tasks under pressure
- Give concrete, actionable advice — not platitudes
- When the user seems overwhelmed, break the problem into the single next action
- Reference their actual tasks when relevant (provided in context)
- Keep responses focused and under 120 words unless a detailed plan is asked for
- Use a direct, encouraging tone"""


@dataclass
class AgentResult:
    tasks: list[dict] = field(default_factory=list)
    message: str = ""
    approvals: list[dict] = field(default_factory=list)


def _today_context() -> str:
    now = datetime.now(timezone.utc)
    return (f"\n\nThe current date and time is {now:%A, %d %B %Y, %H:%M} UTC. "
            f"Compute ALL deadlines relative to this exact date (never assume a different year). "
            f"Express deadlines in ISO 8601 (e.g. {now:%Y-%m-%d}T18:00:00).")


def _model_with_tools():
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
    return genai.GenerativeModel(
        MODEL, system_instruction=BRAIN_DUMP_SYSTEM + _today_context(),
        tools=[{"function_declarations": tools.TOOL_DECLARATIONS}],
    )


def _model_plain(system: str = ""):
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
    kwargs = {"system_instruction": system + _today_context()} if system else {}
    return genai.GenerativeModel(MODEL, **kwargs)


def _to_plain(obj):
    """Recursively convert Gemini proto args (MapComposite/RepeatedComposite)
    into plain Python dicts/lists so tools and json.dumps work."""
    if isinstance(obj, (str, bytes, int, float, bool)) or obj is None:
        return obj
    if hasattr(obj, "items"):
        return {k: _to_plain(v) for k, v in obj.items()}
    try:
        return [_to_plain(v) for v in obj]
    except TypeError:
        return obj


def _extract_and_save(uid: str, opening: str) -> int:
    """One forced `upsert_tasks` turn — saves every task from the brain-dump in a
    SINGLE Gemini call. We deliberately stop there (instead of looping through
    gmail/calendar/schedule/draft tools) to stay well within the free tier; the
    summary is then composed locally from the saved tasks. Returns #tasks saved.

    The model sometimes emits the upsert call more than once (parallel calls) or
    repeats a task, so we gather every task across all calls and de-dupe by title
    before a single save — otherwise a 3-item dump lands as 6 tasks."""
    model = _model_with_tools()
    chat = model.start_chat()
    resp = chat.send_message(opening, tool_config={
        "function_calling_config": {
            "mode": "ANY", "allowed_function_names": ["upsert_tasks"],
        }
    })
    seen: set[str] = set()
    batch: list[dict] = []
    for p in resp.candidates[0].content.parts:
        fc = getattr(p, "function_call", None)
        if fc and fc.name == "upsert_tasks":
            args = _to_plain(fc.args) if fc.args else {}
            for t in args.get("tasks", []) or []:
                key = (t.get("title") or "").strip().lower()
                if key and key not in seen:
                    seen.add(key)
                    batch.append(t)
    if batch:
        tools.call_tool("upsert_tasks", uid, {"tasks": batch})
    return len(batch)


# ---- Offline / fallback brain-dump parser -----------------------------------
# Keeps the agent useful when Gemini is rate-limited or the key is missing.

import re
from datetime import timedelta

_CAT_KEYWORDS = {
    "academic": ["assignment", "homework", "study", "exam", "essay", "lecture", "quiz",
                 "thesis", "paper", "course", "class", "cs ", "lab", "revise"],
    "finance": ["bill", "pay", "rent", "invoice", "budget", "tax", "payment",
                "subscription", "renew", "fee", "refund"],
    "health": ["dentist", "doctor", "gym", "workout", "appointment", "medic",
               "therapy", "checkup", "vaccine", "run"],
    "work": ["presentation", "slides", "client", "meeting", "project", "internship",
             "application", "report", "deck", "email", "interview", "standup", "deploy", "demo"],
    "personal": ["groceries", "buy", "clean", "call", "laundry", "shop", "cook",
                 "family", "mom", "dad", "gift", "book"],
    "admin": ["submit", "form", "register", "renew", "sign", "apply", "schedule", "file"],
}
_WEEKDAYS = {"monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
             "friday": 4, "saturday": 5, "sunday": 6}
_MONTHS = {"january": 1, "february": 2, "march": 3, "april": 4, "may": 5, "june": 6,
           "july": 7, "august": 8, "september": 9, "october": 10, "november": 11, "december": 12}


def _guess_category(t: str) -> str:
    tl = t.lower()
    for cat, kws in _CAT_KEYWORDS.items():
        if any(k in tl for k in kws):
            return cat
    return "personal"


def _guess_deadline(t: str, now: datetime) -> str | None:
    tl = t.lower()
    hour, minute = 23, 59
    m = re.search(r"(\d{1,2})\s*(am|pm)", tl)
    if m:
        hour = int(m.group(1)) % 12 + (12 if m.group(2) == "pm" else 0)
        minute = 0

    target = None
    if "tonight" in tl or "today" in tl:
        target = now
    elif "tomorrow" in tl:
        target = now + timedelta(days=1)
    elif "weekend" in tl:
        target = now + timedelta(days=(5 - now.weekday()) % 7 or 7)  # next Saturday
    elif "next week" in tl:
        target = now + timedelta(days=7)
    elif "this week" in tl:
        target = now + timedelta(days=3)
    elif "end of month" in tl or "month end" in tl:
        nxt = (now.replace(day=28) + timedelta(days=4))
        target = nxt - timedelta(days=nxt.day)
    if target is None:
        for name, idx in _WEEKDAYS.items():
            if name in tl:
                target = now + timedelta(days=(idx - now.weekday()) % 7 or 7)
                break
    if target is None:
        m2 = (re.search(r"(" + "|".join(_MONTHS) + r")\s+(\d{1,2})", tl)
              or re.search(r"(\d{1,2})\s+(" + "|".join(_MONTHS) + r")", tl))
        if m2:
            g1, g2 = m2.group(1), m2.group(2)
            month = _MONTHS.get(g1) or _MONTHS.get(g2)
            day = int(g2 if g1 in _MONTHS else g1)
            year = now.year + (1 if month < now.month else 0)
            try:
                target = now.replace(year=year, month=month, day=day)
            except ValueError:
                target = None
    if target is None:
        return None
    return target.replace(hour=hour, minute=minute, second=0, microsecond=0).isoformat()


def _guess_priority(t: str, deadline: str | None, now: datetime) -> int:
    tl = t.lower()
    if any(w in tl for w in ["urgent", "asap", "tonight", "immediately", "critical"]):
        return 1
    if deadline:
        hrs = (datetime.fromisoformat(deadline) - now).total_seconds() / 3600
        if hrs <= 24:
            return 1
        if hrs <= 72:
            return 2
        if hrs <= 168:
            return 3
    if any(w in tl for w in ["someday", "eventually", "sometime"]):
        return 4
    return 3


def _guess_effort(t: str) -> int:
    tl = t.lower()
    if any(w in tl for w in ["call", "email", "pay", "buy", "submit", "renew", "register"]):
        return 20
    if any(w in tl for w in ["assignment", "presentation", "project", "report", "essay", "thesis"]):
        return 120
    return 60


_DEADLINE_PHRASES = re.compile(
    r"\b(due|by|before|on|until|till)\b.*$"
    r"|\b(today|tonight|tomorrow|this week|this weekend|next week|end of month|month end)\b"
    r"|\b(mon|tues|wednes|thurs|fri|satur|sun)day\b"
    r"|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}\b"
    r"|\d{1,2}\s*(am|pm)\b",
    re.IGNORECASE,
)


def _clean_title(raw: str) -> str:
    """Strip trailing deadline phrases so titles read cleanly."""
    title = _DEADLINE_PHRASES.sub("", raw).strip(" \t-,.")
    title = re.sub(r"\s{2,}", " ", title)
    if not title:
        title = raw.strip(" \t-,.")
    return (title[0].upper() + title[1:])[:120]


def _heuristic_parse(text: str, uid: str) -> list[dict]:
    """Split a brain-dump into structured tasks without an LLM."""
    now = datetime.now(timezone.utc)
    items = [s.strip(" \t-•*.,") for s in re.split(r"[\n;,]+|\band\b", text) if s.strip(" \t-•*.,")]
    parsed = []
    for raw in items:
        if len(raw) < 3:
            continue
        deadline = _guess_deadline(raw, now)
        parsed.append({
            "title": _clean_title(raw),
            "deadline": deadline,
            "priority": _guess_priority(raw, deadline, now),
            "effort_minutes": _guess_effort(raw),
            "category": _guess_category(raw),
            "status": "todo",
        })
    if parsed:
        store.upsert_tasks(uid, parsed)
    return store.get_tasks(uid)


def _offline_summary(tasks: list[dict], reason: str) -> str:
    n = len(tasks)
    return (f"Organized {n} task{'s' if n != 1 else ''} using quick-parse "
            f"(AI {reason}). I sorted them by urgency — review priorities on the Today screen.")


def _brain_dump_summary(tasks: list[dict], added: int) -> str:
    """Compose the brain-dump confirmation locally (no extra Gemini call)."""
    if added <= 0:
        return "Everything's already captured — nothing new to add."
    now = datetime.now(timezone.utc)

    def _soonest(t):
        dl = t.get("deadline")
        try:
            return (datetime.fromisoformat(dl) - now).total_seconds() if dl else 9e18
        except Exception:
            return 9e18

    top = min(tasks, key=lambda t: (t.get("priority", 3), _soonest(t))) if tasks else None
    msg = f"Organized {added} task{'s' if added != 1 else ''} and sorted them by urgency."
    if top:
        msg += f' Top priority: "{top.get("title")}".'
    return msg + " Review them on the Today screen."


async def run_agent(text: str, uid: str) -> AgentResult:
    if not os.getenv("GEMINI_API_KEY"):
        tasks = _heuristic_parse(text, uid)
        return AgentResult(tasks=tasks, message=_offline_summary(tasks, reason="no API key"))

    before = len(store.get_tasks(uid))
    try:
        _extract_and_save(uid, f"Brain-dump from the user:\n\n{text}\n\nProcess this now.")
    except Exception as e:
        # Gemini unavailable / rate-limited → keep the app fully functional.
        saved = store.get_tasks(uid)
        if len(saved) > before:
            return AgentResult(
                tasks=saved,
                message=f"Organized {len(saved) - before} task(s). Review them on the Today screen.",
                approvals=store.list_approvals(uid),
            )
        err = str(e).lower()
        reason = "rate limit reached" if ("429" in err or "quota" in err) else "AI temporarily unavailable"
        tasks = _heuristic_parse(text, uid)
        return AgentResult(tasks=tasks, message=_offline_summary(tasks, reason=reason))

    tasks = store.get_tasks(uid)
    if len(tasks) == before:
        # Model returned nothing usable — fall back to the offline parser so a
        # brain-dump never comes back empty.
        tasks = _heuristic_parse(text, uid)
    return AgentResult(
        tasks=tasks,
        message=_brain_dump_summary(tasks, len(tasks) - before),
        approvals=store.list_approvals(uid),
    )


def _find_task(uid: str, task_id: str) -> dict | None:
    for t in store.get_tasks(uid):
        if t.get("id") == task_id:
            return t
    return None


# ---- Kickstart: draft the actual deliverable so the user can just START ------

_KICKSTART_KIND = {
    "academic": "outline", "work": "email", "finance": "checklist",
    "health": "checklist", "personal": "steps", "admin": "email",
}


def _kickstart_fallback(task: dict, kind: str) -> str:
    title = task.get("title", "this task")
    if kind == "email":
        return (f"Subject: Regarding {title}\n\n"
                f"Hi [name],\n\n"
                f"I'm writing about {title}. [State your purpose in one sentence.]\n\n"
                f"[Add the key detail, question, or request here.]\n\n"
                f"Thank you for your time,\n[Your name]")
    if kind == "outline":
        return (f"Outline — {title}\n\n"
                f"1. Introduction — frame the problem and your goal.\n"
                f"2. Main point A — [your strongest argument/section].\n"
                f"3. Main point B — [supporting evidence/detail].\n"
                f"4. Main point C — [analysis or example].\n"
                f"5. Conclusion — recap + the takeaway.\n\n"
                f"▶ First action: spend 15 minutes filling in section 1.")
    if kind == "checklist":
        return (f"**Checklist — {title}**\n\n"
                f"- [ ] Gather what you need (details, login, amount, documents)\n"
                f"- [ ] Do the core action\n"
                f"- [ ] Confirm it's done (receipt / confirmation)\n"
                f"- [ ] Record the date completed\n\n"
                f"Tick the first box now — it takes 2 minutes.")
    return (f"How to finish: {title}\n\n"
            f"Step 1 — Break it into the smallest possible first action.\n"
            f"Step 2 — Do that one action right now (5 minutes).\n"
            f"Step 3 — Keep going while you have momentum.\n\n"
            f"▶ Starting is the hard part. Just do Step 1.")


def kickstart_task(uid: str, task_id: str, kind: str | None = None,
                   fresh: bool = False) -> dict | None:
    task = _find_task(uid, task_id)
    if not task:
        return None
    kind = kind or _KICKSTART_KIND.get(task.get("category", "personal"), "steps")
    if not os.getenv("GEMINI_API_KEY"):
        return {"kind": kind, "draft": _kickstart_fallback(task, kind), "ai": False}
    _kind_rule = {
        "outline": "an outline — 4-6 labelled sections, each with a one-line prompt of what goes in it",
        "email": "ONE complete, ready-to-send email with a Subject line",
        "checklist": "a checklist of 4-6 concrete items, each on its own line starting with '- [ ] ' (a GitHub-style task list)",
        "steps": "3-5 concrete next actions, smallest first",
    }
    want = _kind_rule.get(kind, _kind_rule["steps"])
    try:
        prompt = (
            "You help someone STOP procrastinating by giving them a real head start on a task.\n"
            f"Task: {task.get('title')}\n"
            f"Category: {task.get('category', 'personal')}\n"
            f"Deadline: {task.get('deadline') or 'none'}\n\n"
            f"Produce ONLY {want}, specific to THIS task.\n"
            "Output just that one thing — do NOT include any other format, no preamble, "
            "and no heading that names the format (e.g. don't write 'Outline' or 'Email')."
        )
        draft = tools._gemini_generate(prompt, use_cache=not fresh).strip()
        return {"kind": kind, "draft": draft or _kickstart_fallback(task, kind), "ai": bool(draft)}
    except Exception:
        return {"kind": kind, "draft": _kickstart_fallback(task, kind), "ai": False}


# ---- "Why now?" decision support --------------------------------------------

def _why_fallback(task: dict) -> str:
    p = task.get("priority", 3)
    dl = task.get("deadline")
    stake = "Clearing it frees up mental space for everything else."
    if dl:
        try:
            hrs = (datetime.fromisoformat(dl.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
                   - datetime.now(timezone.utc)).total_seconds() / 3600
            if hrs < 0:
                stake = "It's already overdue — every hour adds late penalties or lost trust."
            elif hrs < 24:
                stake = f"Only ~{int(hrs)}h left; miss this window and it's gone."
            elif hrs < 72:
                stake = f"~{max(1, int(hrs // 24))} day(s) out — start now and you avoid a last-minute scramble."
            else:
                stake = "There's lead time, but a small start now compounds and removes the dread."
        except Exception:
            pass
    label = {1: "your top priority", 2: "high priority"}.get(p, f"a P{p} task")
    return f"This is {label}. {stake}"


def task_reasoning(uid: str, task_id: str) -> dict | None:
    task = _find_task(uid, task_id)
    if not task:
        return None
    if not os.getenv("GEMINI_API_KEY"):
        return {"reasoning": _why_fallback(task), "ai": False}
    try:
        prompt = (
            "In exactly 2 short, direct sentences, tell the user why they should do this task "
            "NOW and what's concretely at stake if they skip it. No platitudes.\n"
            f"Task: {task.get('title')} | priority {task.get('priority', 3)} | "
            f"deadline {task.get('deadline') or 'none'}."
        )
        text = tools._gemini_generate(prompt)
        return {"reasoning": (text or "").strip() or _why_fallback(task), "ai": bool(text)}
    except Exception:
        return {"reasoning": _why_fallback(task), "ai": False}


# ---- Unblock: diagnose procrastination and give the first 5-minute step -----

_BLOCK_DESC = {
    "too_big": "it feels too big or overwhelming",
    "vague": "it's vague — they're not sure what it actually involves",
    "unclear_start": "they don't know where to start",
    "fear": "they're afraid of doing it badly / perfectionism",
    "boring": "it's boring and they just don't feel like it",
}
_BLOCK_LABEL = {
    "too_big": "It feels too big",
    "vague": "It's vague",
    "unclear_start": "Don't know where to start",
    "fear": "Worried I'll do it badly",
    "boring": "It's just boring",
}


def _unblock_fallback(task: dict, block: str) -> dict:
    title = task.get("title", "this")
    table = {
        "too_big": (
            "Big tasks freeze us because the brain can't see the finish line. You don't have to do the whole thing — just the next inch.",
            f'Open whatever you\'ll work in and add ONE rough bullet toward "{title}". You\'re allowed to stop there.',
        ),
        "vague": (
            "Vague tasks are almost impossible to start — there's nothing concrete to grab onto. Let's make it real first.",
            f'Write one sentence: "Done looks like ___" for "{title}". That sentence is your whole job right now.',
        ),
        "unclear_start": (
            "Not knowing step one is the most common reason a task stalls — that's not laziness, it's a missing entry point.",
            f'Spend 5 minutes listing the 3 sub-steps "{title}" would take. Just the list — don\'t do them yet.',
        ),
        "fear": (
            "That's perfectionism wearing a procrastination mask. Your job right now is a BAD first version, not a good one.",
            f'Set a 5-minute timer and make the worst possible draft of "{title}". You can fix a bad draft — you can\'t fix a blank page.',
        ),
        "boring": (
            "Boring tasks run on momentum, not motivation. Make it tiny and time-boxed and the resistance drops.",
            f'Do just 5 minutes of "{title}" with a timer running. When it rings, you have full permission to stop.',
        ),
    }
    msg, step = table.get(block, table["unclear_start"])
    return {"message": msg, "first_step": step}


def unblock_task(uid: str, task_id: str, block: str) -> dict | None:
    task = _find_task(uid, task_id)
    if not task:
        return None
    block = block if block in _BLOCK_DESC else "unclear_start"
    label = _BLOCK_LABEL[block]
    if os.getenv("GEMINI_API_KEY"):
        try:
            prompt = (
                "You're a warm, no-nonsense coach who deeply understands procrastination and "
                "executive dysfunction. The user keeps avoiding this task:\n"
                f'  "{task.get("title")}"\n'
                f"Their block: {_BLOCK_DESC[block]}.\n"
                "Reply in EXACTLY two lines, nothing else:\n"
                "REFRAME: <2 sentences naming what's really going on and reframing it — warm, direct, no platitudes>\n"
                "STEP: <one concrete action they can finish in under 5 minutes, specific to THIS task>"
            )
            text = tools._gemini_generate(prompt)
            msg = step = None
            for line in text.splitlines():
                s = line.strip()
                if s.upper().startswith("REFRAME:"):
                    msg = s.split(":", 1)[1].strip()
                elif s.upper().startswith("STEP:"):
                    step = s.split(":", 1)[1].strip()
            if msg and step:
                return {"block": block, "block_label": label, "message": msg,
                        "first_step": step, "ai": True}
        except Exception:
            pass
    return {"block": block, "block_label": label, **_unblock_fallback(task, block), "ai": False}


# ---- Reality Check: the honest capacity + triage engine ---------------------
# The signature feature. Most tools optimistically schedule everything; this
# does the brutal math and decides what to DO, DEFER, and DROP.

PRODUCTIVE_HOURS_PER_DAY = 4.0  # realistic discretionary focus time, not 24h
REALITY_HORIZON_DAYS = 7


def _parse_deadline(s: str | None):
    if not s:
        return None
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None


def _fmt_due(dt, now) -> str:
    hrs = (dt - now).total_seconds() / 3600
    if hrs < 0:
        return "overdue"
    if hrs < 24:
        return f"in {max(1, int(hrs))}h"
    days = int(hrs // 24)
    return "tomorrow" if days == 1 else f"in {days}d"


def _reality_reason(bucket: str, t: dict, dt, now) -> str:
    p = t.get("priority", 3)
    eff = t.get("effort_minutes") or 60
    due = _fmt_due(dt, now)
    if bucket == "do_now":
        return f"~{eff} min, due {due}. It fits your time — get it done."
    if bucket == "defer":
        return f"P{p} and won't fit before it's due ({due}). Too important to drop — buy time with an extension."
    return f"P{p}, lowest priority and over capacity. Delegate it, simplify it, or let it go."


def _slim_task(t: dict, bucket: str, dt, now) -> dict:
    return {
        "id": t.get("id"), "title": t.get("title"), "priority": t.get("priority", 3),
        "category": t.get("category", "personal"), "effort_minutes": t.get("effort_minutes"),
        "deadline": t.get("deadline"), "reason": _reality_reason(bucket, t, dt, now),
    }


def reality_check(uid: str) -> dict:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(days=REALITY_HORIZON_DAYS)
    active = [t for t in store.get_tasks(uid) if t.get("status") != "done"]

    dated = []
    for t in active:
        dt = _parse_deadline(t.get("deadline"))
        if dt and dt <= horizon:
            dated.append((t, dt))

    if not dated:
        return {
            "verdict": "clear",
            "headline": "Nothing due in the next 7 days.",
            "hours_needed": 0, "hours_available": 0, "horizon_days": REALITY_HORIZON_DAYS,
            "summary": "You're clear for the week — no deadlines bearing down. Brain-dump what's next to stay ahead of it.",
            "buckets": {"do_now": [], "defer": [], "drop": []}, "ai": False,
        }

    productive_ratio = PRODUCTIVE_HOURS_PER_DAY / 24.0
    window_end = max(dt for _, dt in dated)
    days_span = max(1, math.ceil((window_end - now).total_seconds() / 86400))

    # Earliest-deadline-first feasibility: each task must finish before ITS OWN
    # deadline given ~4 focus hours/day and the tasks queued ahead of it.
    ordered = sorted(dated, key=lambda x: (x[1], x[0].get("priority", 3)))
    do_now, defer, drop = [], [], []
    clock = now
    for t, dt in ordered:
        eff_h = (t.get("effort_minutes") or 60) / 60.0
        avail_h = max(0.0, (dt - clock).total_seconds() / 3600.0) * productive_ratio
        if eff_h <= avail_h + 1e-6:
            do_now.append(_slim_task(t, "do_now", dt, now))
            clock += timedelta(hours=eff_h / productive_ratio)  # consume focus time
        elif t.get("priority", 3) <= 2:
            defer.append(_slim_task(t, "defer", dt, now))
        else:
            drop.append(_slim_task(t, "drop", dt, now))

    needed = round(sum((t.get("effort_minutes") or 60) for t, _ in dated) / 60.0, 1)
    scheduled = round(sum((d["effort_minutes"] or 60) for d in do_now) / 60.0, 1)
    at_risk = round(max(0.0, needed - scheduled), 1)
    n_risk = len(defer) + len(drop)

    if at_risk <= 0.01:
        verdict = "on_track"
    elif at_risk <= 0.3 * needed:
        verdict = "tight"
    else:
        verdict = "overcommitted"

    if verdict == "on_track":
        headline = f"All {len(do_now)} tasks fit — about {needed}h of work, and the time to do it."
    else:
        headline = f"{n_risk} task(s) won't fit in time — ~{at_risk}h of work has nowhere to go."

    summaries = {
        "overcommitted": f"Hard truth: ~{at_risk}h of work can't fit before its deadline at ~{PRODUCTIVE_HOURS_PER_DAY:.0f} focus hours a day. You can't do it all — defer what matters, drop what doesn't.",
        "tight": f"It's tight — ~{scheduled}h fits but ~{at_risk}h is at risk. Guard your focus time and move now.",
        "on_track": f"You're clear to execute: ~{needed}h of work and the time to do it. Here's the order.",
    }
    summary = summaries.get(verdict, "")
    ai_used = False
    if os.getenv("GEMINI_API_KEY"):
        try:
            prompt = (
                "Write a punchy, honest 2-sentence reality check for someone's workload. "
                "Direct, a little tough-love, not preachy. No lists, no preamble.\n"
                f"Verdict: {verdict}. ~{needed}h of work is due soon; about ~{scheduled}h realistically "
                f"fits and ~{at_risk}h risks being missed."
            )
            txt = tools._gemini_generate(prompt).strip()
            if txt:
                summary, ai_used = txt, True
        except Exception:
            pass

    return {
        "verdict": verdict,
        "headline": headline,
        "hours_needed": needed, "hours_available": scheduled,
        "hours_scheduled": scheduled, "hours_at_risk": at_risk,
        "horizon_days": days_span,
        "summary": summary,
        "buckets": {"do_now": do_now, "defer": defer, "drop": drop},
        "ai": ai_used,
    }


def _due_phrase(h: float) -> str:
    if h >= 1e8:
        return "no deadline"
    if h < 0:
        return "overdue"
    if h < 24:
        return "due today"
    if h < 48:
        return "due tomorrow"
    return f"due in {int(h / 24)} days"


def _coach_fallback(message: str, uid: str) -> str:
    """A genuinely useful offline coach — used whenever Gemini is missing or
    rate-limited, so the AI Coach always answers using the user's real tasks."""
    msg = (message or "").lower()
    tasks = [t for t in store.get_tasks(uid) if t.get("status") != "done"]
    now = datetime.now(timezone.utc)

    def hrs(t):
        dl = t.get("deadline")
        if not dl:
            return 1e9
        try:
            d = datetime.fromisoformat(str(dl).replace("Z", "+00:00"))
            if d.tzinfo is None:
                d = d.replace(tzinfo=timezone.utc)
            return (d - now).total_seconds() / 3600
        except Exception:
            return 1e9

    def title(t):
        return t.get("title", "(untitled)")

    if not tasks:
        return ("You're all clear — no open tasks right now. Add what's on your plate on the "
                "**Brain-dump** screen and I'll help you prioritize and start.")

    ranked = sorted(tasks, key=lambda t: (t.get("priority", 3), hrs(t)))
    top = ranked[0]
    overdue = [t for t in tasks if hrs(t) < 0]
    today = [t for t in tasks if 0 <= hrs(t) <= 24]

    if "extension" in msg or ("email" in msg and any(w in msg for w in ("deadline", "professor", "manager", "boss"))):
        return ("Here's a clean way to ask for more time:\n\n"
                f"**Subject:** Quick request — {title(top)}\n\n"
                "Hi [name],\n\n"
                f"I'm working on {title(top)} and want to deliver it properly. Could I have until [new date]? "
                "I've already made progress on [part done], and the extra time would let me [finish well].\n\n"
                "Thank you for understanding,\n[Your name]\n\n"
                "_Tip: ask early, propose a specific new date, and show the progress you've already made._")

    if "overwhelm" in msg or "prioriti" in msg or "too much" in msg:
        out = ["When it feels like too much, do one thing at a time. Here's your order:"]
        for i, t in enumerate(ranked[:3], 1):
            out.append(f"{i}. **{title(t)}** — {_due_phrase(hrs(t))}")
        out.append(f"\nStart with **{title(top)}** for the next 25 minutes. Everything else can wait until it's done.")
        return "\n".join(out)

    if "30 min" in msg or "quick" in msg or ("time" in msg and "free" in msg) or "short" in msg:
        quick = min(tasks, key=lambda t: t.get("effort_minutes", 60))
        return (f"With a short window, knock out **{title(quick)}** (~{quick.get('effort_minutes', 60)} min). "
                "Small wins build momentum. If it's bigger than your window, just do the first step — open it and write one line.")

    if any(w in msg for w in ("procrastinat", "stuck", "avoid", "can't start", "cant start")):
        return (f"You're avoiding **{title(top)}** — totally normal when a task feels big or fuzzy. "
                "Shrink it: forget the whole thing and do just the first 5-minute step (open the file, write the title, list 3 bullets). "
                "Starting is the hard part — momentum does the rest. Try the **Kickstart** button on it for an instant first draft.")

    if any(w in msg for w in ("schedule", "plan", "study", "this week", "organize")):
        out = ["Here's a simple plan — most urgent first:"]
        for t in ranked[:6]:
            out.append(f"- **{title(t)}** — {_due_phrase(hrs(t))} (~{t.get('effort_minutes', 60)} min)")
        out.append("\nBlock focused time for the top two today, then batch the rest by deadline.")
        return "\n".join(out)

    # Default: "what should I focus on?" and anything else.
    parts = []
    if overdue:
        parts.append(f"⚠️ You have **{len(overdue)} overdue** — clear **{title(overdue[0])}** first.")
    elif today:
        parts.append(f"You have **{len(today)} due today** — start with **{title(today[0])}**.")
    parts.append(f"Right now, focus on **{title(top)}** ({_due_phrase(hrs(top))}). Give it one uninterrupted 25-minute block, then check back and I'll point you to the next one.")
    return " ".join(parts)


def chat_agent(message: str, uid: str, history: list[dict]) -> str:
    """Conversational AI coach. Returns the agent's reply text.
    Falls back to a heuristic coach (still task-aware) whenever Gemini is
    missing or rate-limited, so the coach never goes dark."""
    if not os.getenv("GEMINI_API_KEY"):
        return _coach_fallback(message, uid)

    try:
        tasks = store.get_tasks(uid)
        active = [t for t in tasks if t.get("status") != "done"]
        task_ctx = ""
        if active:
            lines = []
            for t in active[:8]:
                dl = t.get("deadline", "no deadline")
                lines.append(f"- [{t.get('category','?')}] {t['title']} (priority {t.get('priority',3)}, due {dl})")
            task_ctx = "\nUser's current tasks:\n" + "\n".join(lines)

        model = _model_plain(COACH_SYSTEM + task_ctx)
        # Convert history to SDK format
        chat_history = []
        for h in history[-10:]:  # keep last 10 turns
            role = "user" if h.get("role") == "user" else "model"
            chat_history.append({"role": role, "parts": [h.get("content", "")]})
        chat = model.start_chat(history=chat_history)
        resp = chat.send_message(message)
        return resp.text or _coach_fallback(message, uid)
    except Exception:
        # Rate-limited or any failure → still answer with the task-aware coach.
        return _coach_fallback(message, uid)


def smart_suggest(uid: str) -> dict:
    """Surface AI-powered insights: at-risk tasks, scheduling gaps, productivity tips."""
    tasks = store.get_tasks(uid)
    active = [t for t in tasks if t.get("status") != "done"]
    done_count = len([t for t in tasks if t.get("status") == "done"])

    now = datetime.now(timezone.utc)
    at_risk = []
    overdue = []
    for t in active:
        if not t.get("deadline"):
            continue
        try:
            dl = datetime.fromisoformat(t["deadline"].replace("Z", "+00:00"))
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            continue
        hours_left = (dl - now).total_seconds() / 3600
        needed = t.get("effort_minutes", 60) / 60
        if hours_left < 0:
            overdue.append(t)
        elif hours_left < needed * 2:
            at_risk.append(t)

    suggestions = []

    if overdue:
        for t in overdue[:3]:
            suggestions.append({
                "type": "overdue",
                "icon": "error",
                "color": "error",
                "title": f"Overdue: {t['title']}",
                "body": "This task is past its deadline. Decide: do it now, reschedule, or drop it.",
                "task_id": t["id"],
            })

    if at_risk:
        for t in at_risk[:3]:
            suggestions.append({
                "type": "at_risk",
                "icon": "warning",
                "color": "warning",
                "title": f"At risk: {t['title']}",
                "body": f"Only {int((datetime.fromisoformat(t['deadline'].replace('Z','+00:00')).replace(tzinfo=timezone.utc) - now).total_seconds() / 3600)}h left but ~{t.get('effort_minutes', 60)} min of work needed.",
                "task_id": t["id"],
            })

    if not active:
        suggestions.append({
            "type": "empty",
            "icon": "celebration",
            "color": "primary",
            "title": "Nothing on your plate!",
            "body": "Use Brain-dump to add your next commitments.",
            "task_id": None,
        })
    elif done_count > 0:
        pct = int(done_count / len(tasks) * 100)
        suggestions.append({
            "type": "progress",
            "icon": "trending_up",
            "color": "secondary",
            "title": f"{pct}% complete this session",
            "body": f"{done_count} of {len(tasks)} tasks done. Keep the momentum!",
            "task_id": None,
        })

    if not os.getenv("GEMINI_API_KEY") or not active:
        return {"suggestions": suggestions, "ai_tip": None}

    try:
        top = sorted(active, key=lambda t: (t.get("priority", 5), t.get("deadline") or "9999"))[:3]
        task_summary = "; ".join(f"{t['title']} (p{t.get('priority',3)})" for t in top)
        model = _model_plain()
        prompt = (
            f"Give ONE sharp, specific productivity tip (2 sentences max) for someone "
            f"whose top pending tasks are: {task_summary}. "
            f"Focus on what to do RIGHT NOW. No platitudes."
        )
        resp = model.generate_content(prompt)
        ai_tip = resp.text.strip() if resp.text else None
    except Exception:
        ai_tip = None

    return {"suggestions": suggestions, "ai_tip": ai_tip}


def tick(uid: str) -> dict:
    """OBSERVE -> REPLAN: flag at-risk tasks and draft an action for the most urgent.
    Runs fully offline (template drafts) so the agent check always surfaces real
    risk and prepares reviewable actions — even when Gemini is rate-limited."""
    now = datetime.now(timezone.utc)
    tasks = store.get_tasks(uid)
    scored = []
    for t in tasks:
        if t.get("status") == "done" or not t.get("deadline"):
            continue
        try:
            dl = datetime.fromisoformat(t["deadline"].replace("Z", "+00:00"))
            if dl.tzinfo is None:
                dl = dl.replace(tzinfo=timezone.utc)
        except (ValueError, AttributeError):
            continue
        hours_left = (dl - now).total_seconds() / 3600
        needed = t.get("effort_minutes", 60) / 60
        prio = t.get("priority", 3)
        risky = (
            hours_left < 0                          # overdue
            or hours_left < needed * 2              # not enough time left to do it
            or hours_left <= 24                     # due within a day
            or (prio <= 2 and hours_left <= 48)     # high priority & due within two days
        )
        if risky:
            scored.append((hours_left, prio, t))

    scored.sort(key=lambda x: (x[0], x[1]))         # most urgent first
    at_risk = [t for _, _, t in scored]
    actions = {"at_risk": [t["id"] for t in at_risk], "drafted": [], "replanned": False}
    if not at_risk:
        return actions

    store.replan(uid, reason=f"{len(at_risk)} task(s) at risk on tick")
    actions["replanned"] = True
    already = {a.get("task_id") for a in store.list_approvals(uid)}
    for _, _, t in scored[:3]:                       # prepare actions for the 3 most urgent
        if t["id"] in already:                       # don't pile up duplicate drafts
            continue
        cat = t.get("category", "personal")
        if cat in ("academic", "work"):
            role = "professor" if cat == "academic" else "manager"
            res = tools.draft_message(uid, task_id=t["id"], task_title=t.get("title", ""),
                                      intent="extension", recipient_role=role)
        else:
            # Solo tasks (finance/health/personal/admin): a head-start beats an email.
            res = tools.draft_deliverable(uid, task_id=t["id"], kind="checklist",
                                          task_title=t.get("title", ""))
        actions["drafted"].append(res.get("approval_id"))
    return actions
