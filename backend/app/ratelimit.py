"""In-memory sliding-window rate limiter for abuse-sensitive endpoints.

Per-process (sufficient for a small Cloud Run service); keyed by a caller-
supplied string such as an email or client IP. Raises HTTP 429 when exceeded.

Note: on multi-instance deployments this limits per instance, not globally; a
shared store (Firestore/Redis) would make it global. It still sharply reduces
brute-force throughput.
"""
from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request

_HITS: dict[str, deque] = defaultdict(deque)


def hit(key: str, limit: int, window: int) -> None:
    """Record an attempt for `key`; raise 429 if > `limit` attempts in `window` seconds."""
    now = time.time()
    dq = _HITS[key]
    cutoff = now - window
    while dq and dq[0] < cutoff:
        dq.popleft()
    if len(dq) >= limit:
        retry = int(dq[0] + window - now) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Please try again in {retry} seconds.",
            headers={"Retry-After": str(retry)},
        )
    dq.append(now)
    # Opportunistic cleanup so idle keys don't accumulate forever.
    if len(_HITS) > 5000:
        for k in [k for k, v in _HITS.items() if not v]:
            _HITS.pop(k, None)


def client_ip(request: Request) -> str:
    """Best-effort client IP, honoring Cloud Run's X-Forwarded-For."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"
