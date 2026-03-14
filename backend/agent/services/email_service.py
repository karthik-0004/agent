from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from email.message import EmailMessage as MimeEmailMessage
import smtplib
import ssl
from typing import Any

import certifi
from django.conf import settings


@dataclass
class EmailResult:
    email: str
    status: str
    error: str | None = None


def _priority_badge(priority: str) -> str:
    normalized = str(priority or "").strip().lower()
    if normalized == "high":
        return "🔴 High"
    if normalized == "medium":
        return "🟡 Medium"
    return "🟢 Low"


def _first_name(name: str) -> str:
    cleaned = str(name or "").strip()
    if not cleaned:
        return "Teammate"
    return cleaned.split(" ")[0].replace(".", "")


def _build_team_lines(team: list[dict[str, Any]]) -> str:
    return "\n".join(
        f"   • {member.get('name', 'Unknown')} — {member.get('role', 'Contributor')}"
        for member in team
    )


def _build_task_lines(tasks: list[dict[str, Any]]) -> str:
    if not tasks:
        return "   • Task details are available in Neurax Dashboard"
    return "\n".join(
        f"   • {task.get('name', 'Task')}: {task.get('description', '')} — {task.get('duration', 1)} days"
        for task in tasks
    )


def compose_assignment_email(payload: dict[str, Any], recipient: dict[str, Any]) -> tuple[str, str]:
    project_name = payload.get("project_name", "Neurax Project")
    priority_badge = _priority_badge(payload.get("priority", "Low"))
    deadline_days = int(payload.get("deadline_days", 1))
    deadline_date = payload.get("deadline_date") or (datetime.utcnow() + timedelta(days=deadline_days)).strftime("%d %b %Y")

    subject = f"🚀 Project Assignment — {project_name} | Neurax Taskifier"

    body = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "        NEURAX TASK ASSIGNMENT\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Hi {_first_name(recipient.get('name', 'Teammate'))},\n\n"
        "You have been officially assigned to a new project.\n"
        "Here are your full assignment details:\n\n"
        "📌 PROJECT\n"
        f"   Name     : {project_name}\n"
        f"   Priority : {priority_badge}\n"
        f"   Deadline : {deadline_days} days from today ({deadline_date})\n\n"
        "👥 YOUR TEAM\n"
        "   You will be working alongside:\n"
        f"{_build_team_lines(payload.get('team', []))}\n\n"
        "📋 YOUR TASKS\n"
        f"{_build_task_lines(payload.get('tasks', []))}\n\n"
        "⚠️  IMPORTANT\n"
        "   Please ensure all deliverables are submitted\n"
        "   before the deadline. Late submissions will\n"
        "   trigger automatic task reassignment.\n\n"
        "   Log into Neurax Dashboard for full details.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Sent by Neurax Taskifier\n"
        "Automated notification on behalf of your Manager\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )

    return subject, body


def send_assignment_emails(payload: dict[str, Any]) -> dict[str, Any]:
    team = payload.get("team", [])
    results: list[dict[str, Any]] = []
    sent = 0
    failed = 0

    from_email = getattr(settings, "EMAIL_HOST_USER", "")

    def is_certificate_error(error: Exception) -> bool:
        message = str(error).lower()
        return "certificate_verify_failed" in message or "ssl" in message and "certificate" in message

    def send_message(recipient_email: str, subject: str, body: str, insecure_tls: bool = False) -> None:
        host = getattr(settings, "EMAIL_HOST", "smtp.gmail.com")
        port = int(getattr(settings, "EMAIL_PORT", 587))
        username = getattr(settings, "EMAIL_HOST_USER", "")
        password = getattr(settings, "EMAIL_HOST_PASSWORD", "")
        use_tls = bool(getattr(settings, "EMAIL_USE_TLS", True))
        timeout = int(getattr(settings, "EMAIL_TIMEOUT", 30))

        context = ssl.create_default_context(cafile=certifi.where())
        if insecure_tls:
            context = ssl._create_unverified_context()

        message = MimeEmailMessage()
        message["Subject"] = subject
        message["From"] = from_email or username
        message["To"] = recipient_email
        message.set_content(body)

        with smtplib.SMTP(host, port, timeout=timeout) as server:
            server.ehlo()
            if use_tls:
                server.starttls(context=context)
                server.ehlo()
            if username and password:
                server.login(username, password)
            server.send_message(message)

    for member in team:
        subject, body = compose_assignment_email(payload, member)
        recipient_email = member.get("email", "")
        try:
            send_message(recipient_email, subject, body)
            results.append({"email": recipient_email, "status": "success"})
            sent += 1
        except Exception as error:
            allow_insecure = bool(getattr(settings, "EMAIL_ALLOW_INSECURE_TLS", False))
            if allow_insecure and is_certificate_error(error):
                try:
                    send_message(recipient_email, subject, body, insecure_tls=True)
                    results.append({"email": recipient_email, "status": "success"})
                    sent += 1
                    continue
                except Exception as retry_error:
                    results.append({"email": recipient_email, "status": "failed", "error": str(retry_error)})
                    failed += 1
                    continue

            results.append({"email": recipient_email, "status": "failed", "error": str(error)})
            failed += 1

    return {
        "sent": sent,
        "failed": failed,
        "results": results,
    }
