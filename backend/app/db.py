"""SQLite persistence layer for Deadline.

A single file-backed database with one table per collection. Domain rows
(tasks/habits/blocks/approvals) are stored as JSON blobs so the agent code can
keep working with plain dicts; `users` gets real columns for auth + profile.

Set DB_PATH to override the location (defaults to backend/deadline.db).
"""
from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path

_DEFAULT_PATH = Path(__file__).resolve().parents[1] / "deadline.db"
DB_PATH = os.getenv("DB_PATH", str(_DEFAULT_PATH))

_SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    uid           TEXT PRIMARY KEY,
    email         TEXT UNIQUE NOT NULL,
    name          TEXT,
    password_hash TEXT NOT NULL,
    role          TEXT DEFAULT 'Member',
    plan          TEXT DEFAULT 'Free Plan',
    avatar_url    TEXT,
    settings      TEXT,
    created       TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created TEXT
);
CREATE TABLE IF NOT EXISTS habits (
    id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created TEXT
);
CREATE TABLE IF NOT EXISTS blocks (
    id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created TEXT
);
CREATE TABLE IF NOT EXISTS approvals (
    id TEXT PRIMARY KEY, uid TEXT NOT NULL, data TEXT NOT NULL, created TEXT
);
CREATE INDEX IF NOT EXISTS idx_tasks_uid     ON tasks(uid);
CREATE INDEX IF NOT EXISTS idx_habits_uid    ON habits(uid);
CREATE INDEX IF NOT EXISTS idx_blocks_uid    ON blocks(uid);
CREATE INDEX IF NOT EXISTS idx_approvals_uid ON approvals(uid);
"""


@contextmanager
def conn():
    """Yield a connection with Row access; commits on success, closes always."""
    c = sqlite3.connect(DB_PATH, check_same_thread=False)
    c.row_factory = sqlite3.Row
    try:
        yield c
        c.commit()
    finally:
        c.close()


def init_db() -> None:
    with conn() as c:
        c.executescript(_SCHEMA)
