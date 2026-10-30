"""Transactional email through Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email)."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

log = logging.getLogger("careeros.email")


class EmailUnavailable(RuntimeError):
    pass


def enabled() -> bool:
    return bool(get_settings().resend_api_key)


# Tests swap this for a fake transport.
transport: httpx.BaseTransport | None = None


def send(to: str, subject: str, text: str, html: str) -> None:
    s = get_settings()
    if not s.resend_api_key:
        raise EmailUnavailable("Email isn't set up.")
    with httpx.Client(timeout=15, transport=transport) as c:
        r = c.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {s.resend_api_key}"},
            json={"from": s.email_from, "to": [to], "subject": subject, "text": text, "html": html},
        )
    if r.status_code >= 400:
        # Never include the code or address in logs beyond what's needed to debug.
        log.warning("resend failed: %s %s", r.status_code, r.text[:200])
        raise EmailUnavailable("The email couldn't be sent.")


def send_reset_code(to: str, name: str, code: str) -> None:
    first = (name or "there").split(" ")[0]
    text = (
        f"Hi {first},\n\nYour CareerOS password reset code is {code}\n\n"
        "It expires in 10 minutes. If you didn't ask for this, ignore this email; your password stays the same.\n"
    )
    html = (
        f"<p>Hi {first},</p><p>Your CareerOS password reset code is:</p>"
        f'<p style="font-size:28px;font-weight:700;letter-spacing:6px;margin:16px 0">{code}</p>'
        "<p>It expires in 10 minutes. If you didn't ask for this, ignore this email; your password stays the same.</p>"
    )
    send(to, f"{code} is your CareerOS reset code", text, html)
