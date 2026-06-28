"""Auth: password hashing (PBKDF2, stdlib) + JWT sessions (PyJWT).

verify_token() is the FastAPI dependency that turns a Bearer token into a uid.
A CRON_SECRET header is also accepted so Cloud Scheduler can hit /tick.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Header, HTTPException

JWT_SECRET = os.getenv("JWT_SECRET", "dev-insecure-secret-change-me")
JWT_ALG = "HS256"
JWT_TTL_DAYS = int(os.getenv("JWT_TTL_DAYS", "30"))

_PBKDF2_ROUNDS = 200_000


# ---- password hashing -------------------------------------------------------

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), _PBKDF2_ROUNDS)
    return f"pbkdf2_sha256${_PBKDF2_ROUNDS}${salt}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, rounds, salt, expected = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), int(rounds))
        return hmac.compare_digest(dk.hex(), expected)
    except (ValueError, AttributeError):
        return False


# ---- JWT --------------------------------------------------------------------

def create_access_token(uid: str) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": uid, "iat": now, "exp": now + timedelta(days=JWT_TTL_DAYS)}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def decode_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        return payload.get("sub")
    except jwt.PyJWTError:
        return None


# ---- FastAPI dependencies ---------------------------------------------------

async def verify_token(authorization: str | None = Header(default=None)) -> str:
    """Returns the user's uid from a valid Bearer token, else 401."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    uid = decode_token(authorization.split(" ", 1)[1])
    if not uid:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return uid


async def verify_token_or_cron(
    authorization: str | None = Header(default=None),
    x_cron_secret: str | None = Header(default=None),
) -> str:
    """Like verify_token but also accepts a CRON_SECRET header for scheduled runs."""
    expected = os.getenv("CRON_SECRET")
    if expected and x_cron_secret and hmac.compare_digest(x_cron_secret, expected):
        return os.getenv("CRON_UID", "demo-user")
    return await verify_token(authorization)


# ---- Google Sign-In ---------------------------------------------------------

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")


def google_configured() -> bool:
    return bool(GOOGLE_CLIENT_ID)


def verify_google_token(credential: str) -> dict | None:
    """Verify a Google Identity Services ID token; return profile info or None."""
    if not GOOGLE_CLIENT_ID:
        return None
    try:
        from google.oauth2 import id_token
        from google.auth.transport import requests as grequests

        info = id_token.verify_oauth2_token(
            credential, grequests.Request(), GOOGLE_CLIENT_ID
        )
        email = info.get("email")
        if not email:
            return None
        return {
            "sub": info.get("sub"),
            "email": email,
            "name": info.get("name") or email.split("@")[0],
            "picture": info.get("picture"),
            "email_verified": info.get("email_verified", False),
        }
    except Exception:
        return None


def verify_google_access_token(access_token: str) -> dict | None:
    """Verify a Google OAuth access token by calling the userinfo endpoint.
    Used by the popup token flow (custom button) — no client secret required."""
    try:
        import json
        import urllib.request
        req = urllib.request.Request(
            "https://www.googleapis.com/oauth2/v3/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            info = json.loads(resp.read().decode())
        email = info.get("email")
        if not email:
            return None
        return {
            "sub": info.get("sub"),
            "email": email,
            "name": info.get("name") or email.split("@")[0],
            "picture": info.get("picture"),
            "email_verified": info.get("email_verified", False),
        }
    except Exception:
        return None
