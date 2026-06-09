"""Minimal SMTP email sending.

Uses the stdlib smtplib in a worker thread (no extra dependency). When SMTP is
not configured, logs the message instead of sending — handy in development.
"""

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("skillbench.email")


def _send_sync(to: str, subject: str, body: str) -> None:
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email. Returns True if dispatched, False if SMTP is unconfigured."""
    if not settings.smtp_host:
        logger.info("SMTP not configured; would send to %s: %s\n%s", to, subject, body)
        return False
    try:
        await asyncio.to_thread(_send_sync, to, subject, body)
        return True
    except Exception:  # noqa: BLE001 - log and report failure to caller
        logger.exception("Failed to send email to %s", to)
        return False
