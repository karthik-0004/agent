from __future__ import annotations

import os
import smtplib
from datetime import datetime, timedelta
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any

SPECIAL_RECIPIENT_OVERRIDES = {
    "akshaya nuthalapati": "aksh.ayanuthalapati.0523@gmail.com",
    "akshaya": "aksh.ayanuthalapati.0523@gmail.com",
}


def _resolve_recipient_email(member: dict[str, Any]) -> str:
    name = str(member.get("name", "")).strip().lower()
    if name in SPECIAL_RECIPIENT_OVERRIDES:
        return SPECIAL_RECIPIENT_OVERRIDES[name]
    return str(member.get("email", "")).strip()


def send_assignment_emails(payload: dict[str, Any]) -> dict[str, Any]:
    project_name = payload.get("project_name", "Neurax Project")
    priority = payload.get("priority", "Medium")
    deadline_days = int(payload.get("deadline_days", 1))
    tasks = payload.get("tasks", [])
    team = list(payload.get("team", []))

    # Sender = manager's Gmail account
    sender_email = os.getenv("EMAIL_HOST_USER")
    sender_password = os.getenv("EMAIL_HOST_PASSWORD")
    smtp_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", 587))
    smtp_ssl_port = int(os.getenv("EMAIL_SSL_PORT", 465))
    use_tls = os.getenv("EMAIL_USE_TLS", "True") == "True"

    deadline_date = (
        datetime.now() + timedelta(days=deadline_days)
    ).strftime("%d %b %Y")

    teammates = "\n".join([
        f"   • {member.get('name', 'Unknown')} — {member.get('role', 'Contributor')}" for member in team
    ])

    task_list = "\n".join([
        f"   • {task.get('name', 'Task')} — {task.get('duration', 1)} days"
        for task in tasks
    ])

    if not task_list:
        task_list = "   • Task details available in Neurax Dashboard"

    deduped_team = []
    seen_emails: set[str] = set()
    for member in team:
        resolved_email = _resolve_recipient_email(member)
        if not resolved_email:
            continue
        if resolved_email in seen_emails:
            continue
        seen_emails.add(resolved_email)
        row = dict(member)
        row["email"] = resolved_email
        deduped_team.append(row)
    team = deduped_team

    results: list[dict[str, Any]] = []

    def send_with_starttls() -> None:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            if use_tls:
                server.starttls()
                server.ehlo()
            server.login(sender_email, sender_password)
            for member in team:
                recipient_email = _resolve_recipient_email(member)
                first_name = str(member.get("name", "Teammate")).split()[0].replace(".", "")

                message = MIMEMultipart("alternative")
                message["Subject"] = f"🚀 Project Assignment — {project_name} | Neurax"
                message["From"] = f"Neurax Taskifier <{sender_email}>"
                message["To"] = recipient_email

                body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        NEURAX TASK ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi {first_name},

You have been officially assigned to a new project.

📌 PROJECT
   Name     : {project_name}
   Priority : {priority}
   Deadline : {deadline_days} days from today ({deadline_date})

👥 YOUR TEAM
{teammates}

📋 YOUR TASKS
{task_list}

⚠️  IMPORTANT
   Complete all deliverables before the deadline.
   Late submissions trigger automatic reassignment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sent by Neurax Taskifier
On behalf of your Manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                message.attach(MIMEText(body, "plain", "utf-8"))
                server.sendmail(sender_email, recipient_email, message.as_string())
                results.append({
                    "email": recipient_email,
                    "status": "success",
                })

    def send_with_ssl() -> None:
        with smtplib.SMTP_SSL(smtp_host, smtp_ssl_port, timeout=30) as server:
            server.ehlo()
            server.login(sender_email, sender_password)
            for member in team:
                recipient_email = _resolve_recipient_email(member)
                first_name = str(member.get("name", "Teammate")).split()[0].replace(".", "")

                message = MIMEMultipart("alternative")
                message["Subject"] = f"🚀 Project Assignment — {project_name} | Neurax"
                message["From"] = f"Neurax Taskifier <{sender_email}>"
                message["To"] = recipient_email

                body = f"""
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        NEURAX TASK ASSIGNMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Hi {first_name},

You have been officially assigned to a new project.

📌 PROJECT
   Name     : {project_name}
   Priority : {priority}
   Deadline : {deadline_days} days from today ({deadline_date})

👥 YOUR TEAM
{teammates}

📋 YOUR TASKS
{task_list}

⚠️  IMPORTANT
   Complete all deliverables before the deadline.
   Late submissions trigger automatic reassignment.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sent by Neurax Taskifier
On behalf of your Manager
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"""
                message.attach(MIMEText(body, "plain", "utf-8"))
                server.sendmail(sender_email, recipient_email, message.as_string())
                results.append({
                    "email": recipient_email,
                    "status": "success",
                })

    try:
        send_with_starttls()

    except smtplib.SMTPAuthenticationError as auth_error:
        return {
            "sent": 0,
            "failed": len(team),
            "error": (
                "Authentication failed - check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env. "
                f"SMTP said: {auth_error}"
            ),
            "results": [
                {"email": member.get("email", "unknown"), "status": "failed", "error": str(auth_error)}
                for member in team
            ],
        }

    except Exception as error:
        # Retry with SMTP SSL in case local network blocks STARTTLS negotiation.
        try:
            results.clear()
            send_with_ssl()
        except smtplib.SMTPAuthenticationError as auth_error:
            return {
                "sent": 0,
                "failed": len(team),
                "error": (
                    "Authentication failed - check EMAIL_HOST_USER and EMAIL_HOST_PASSWORD in .env. "
                    f"SMTP said: {auth_error}"
                ),
                "results": [
                    {"email": member.get("email", "unknown"), "status": "failed", "error": str(auth_error)}
                    for member in team
                ],
            }
        except Exception as ssl_error:
            return {
                "sent": 0,
                "failed": len(team),
                "error": f"STARTTLS error: {error} | SSL error: {ssl_error}",
                "results": [
                    {"email": member.get("email", "unknown"), "status": "failed", "error": str(ssl_error)}
                    for member in team
                ],
            }

    return {
        "sent": len(results),
        "failed": 0,
        "results": results,
    }


def _send_single_email(subject: str, body: str, recipient_email: str) -> dict[str, Any]:
    sender_email = os.getenv("EMAIL_HOST_USER")
    sender_password = os.getenv("EMAIL_HOST_PASSWORD")
    smtp_host = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("EMAIL_PORT", 587))
    smtp_ssl_port = int(os.getenv("EMAIL_SSL_PORT", 465))
    use_tls = os.getenv("EMAIL_USE_TLS", "True") == "True"

    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = f"Neurax Taskifier <{sender_email}>"
    message["To"] = recipient_email
    message.attach(MIMEText(body, "plain", "utf-8"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=30) as server:
            server.ehlo()
            if use_tls:
                server.starttls()
                server.ehlo()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, recipient_email, message.as_string())
        return {"email": recipient_email, "status": "success"}
    except Exception as primary_error:
        try:
            with smtplib.SMTP_SSL(smtp_host, smtp_ssl_port, timeout=30) as server:
                server.ehlo()
                server.login(sender_email, sender_password)
                server.sendmail(sender_email, recipient_email, message.as_string())
            return {"email": recipient_email, "status": "success"}
        except Exception as ssl_error:
            return {
                "email": recipient_email,
                "status": "failed",
                "error": f"STARTTLS error: {primary_error} | SSL error: {ssl_error}",
            }


def send_outreach_assignment_email(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name", "Expert"))
    first_name = name.split()[0].replace(".", "")
    recipient_email = str(payload.get("email", "")).strip()
    project_name = str(payload.get("project_name", "Neurax Project"))
    role = str(payload.get("role", "Outreach Expert"))
    deadline_days = int(payload.get("deadline_days", 1))
    deadline_date = str(payload.get("deadline_date", ""))
    team_members = payload.get("team_members", [])

    teammates = "\n".join(
        [f"   • {member.get('name', 'Unknown')} — {member.get('role', 'Contributor')}" for member in team_members]
    ) or "   • Team details available in dashboard"

    body = f"""
Hi {first_name},

You have been engaged as an Outreach Expert
for the following project:

📌 PROJECT    : {project_name}
🎯 YOUR ROLE  : {role}
📅 DEADLINE   : {deadline_days} days from today ({deadline_date})

👥 YOUR TEAM
{teammates}

📋 SCOPE OF WORK
   Please coordinate with the team lead
   for your specific deliverables.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Note: This is a temporary engagement.
Your access ends when the project completes.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sent by Neurax Taskifier
On behalf of your Manager
"""

    return _send_single_email(
        f"🌐 Project Assignment — {project_name} | Neurax",
        body,
        recipient_email,
    )


def send_outreach_farewell_email(payload: dict[str, Any]) -> dict[str, Any]:
    name = str(payload.get("name", "Expert"))
    first_name = name.split()[0].replace(".", "")
    recipient_email = str(payload.get("email", "")).strip()
    project_name = str(payload.get("project_name", "Neurax Project"))

    body = f"""
Hi {first_name},

Your engagement on {project_name} has been
successfully completed.

Thank you for your contribution!

Your temporary profile has been removed
from the Neurax system.

Best regards,
Neurax Taskifier
"""

    return _send_single_email(
        f"✅ Project Completed — Engagement Ended | Neurax",
        body,
        recipient_email,
    )
