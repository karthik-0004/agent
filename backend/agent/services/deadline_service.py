from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from agent.models import ActivityLog, SubTask


def _first_name(value: str) -> str:
    cleaned = str(value or "").strip()
    if not cleaned:
        return "Teammate"
    return cleaned.split(" ")[0].replace(".", "")


def _send_email(subject: str, body: str, recipients: list[str]) -> None:
    unique = [mail for mail in dict.fromkeys(recipients) if mail]
    if not unique:
        return
    message = EmailMessage(
        subject=subject,
        body=body,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        to=unique,
    )
    message.send(fail_silently=True)


def _manager_email() -> str:
    return str(getattr(settings, "EMAIL_HOST_USER", "")).strip()


def _log(activity_type: str, title: str, detail: str, meta: dict[str, Any] | None = None) -> None:
    ActivityLog.objects.create(
        activity_type=activity_type,
        title=title,
        detail=detail,
        meta=meta or {},
    )


def _send_due_tomorrow_reminder(task: SubTask) -> None:
    subject = f"⚠️ Reminder — {task.task_name} due tomorrow | Neurax"
    body = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "   NEURAX SUB-TASK REMINDER\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Hi {_first_name(task.assigned_to_name)},\n\n"
        "Your assigned sub-task is due tomorrow.\n\n"
        f"📌 PROJECT   : {task.project.project_name}\n"
        f"📋 TASK      : {task.task_name}\n"
        f"📅 TASK DUE  : {task.sub_task_deadline_date}\n"
        "⚠️ STATUS    : Due Tomorrow\n\n"
        "Please complete this task on time and update the dashboard.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Sent by Neurax Taskifier\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )
    _send_email(subject, body, [task.assigned_to_email])
    _log(
        "task_reminder",
        f"Reminder sent to {task.assigned_to_name}",
        f"{task.task_name} due tomorrow",
        {"task_id": task.id, "project": task.project.project_name},
    )


def _send_due_today_alert(task: SubTask) -> None:
    subject = f"🔥 Due Today — {task.task_name} | Neurax"
    manager = _manager_email()
    body = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "   NEURAX URGENT TASK ALERT\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Task is due today.\n\n"
        f"📌 PROJECT   : {task.project.project_name}\n"
        f"📋 TASK      : {task.task_name}\n"
        f"👤 ASSIGNEE  : {task.assigned_to_name}\n"
        f"📅 TASK DUE  : {task.sub_task_deadline_date}\n"
        "🔥 STATUS    : Due Today\n\n"
        "Please finish or reassign immediately.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Neurax Taskifier\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )
    _send_email(subject, body, [task.assigned_to_email, manager])
    _log(
        "task_due_today",
        f"Urgent reminder for {task.task_name}",
        f"{task.assigned_to_name} · {task.project.project_name}",
        {"task_id": task.id, "project": task.project.project_name},
    )


def _send_overdue_employee_alert(task: SubTask) -> None:
    subject = f"⚠️ Sub-Task Overdue Alert — {task.task_name} | Neurax"
    body = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "     NEURAX TASK OVERDUE ALERT\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        f"Hi {_first_name(task.assigned_to_name)},\n\n"
        "Your assigned sub-task has exceeded its deadline\n"
        "and is now marked as OVERDUE.\n\n"
        f"📌 PROJECT   : {task.project.project_name}\n"
        f"📋 TASK      : {task.task_name}\n"
        f"📅 TASK DUE  : {task.sub_task_deadline_date}\n"
        "🔴 STATUS    : Overdue\n\n"
        "Please complete this task immediately and mark\n"
        "it as done in the Neurax dashboard.\n\n"
        "Continued delay may result in task reassignment.\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Sent by Neurax Taskifier\n"
        "On behalf of your Manager\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )
    _send_email(subject, body, [task.assigned_to_email])


def _send_overdue_manager_alert(task: SubTask) -> None:
    subject = f"🚨 Manager Alert — {task.assigned_to_name} missed sub-task deadline"
    manager = _manager_email()
    body = (
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "     NEURAX MANAGER ALERT\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n"
        "Hi Manager,\n\n"
        "A team member has missed their sub-task deadline.\n\n"
        f"📌 PROJECT    : {task.project.project_name}\n"
        f"📋 TASK       : {task.task_name}\n"
        f"👤 ASSIGNED TO: {task.assigned_to_name}\n"
        f"📧 EMAIL      : {task.assigned_to_email}\n"
        f"📅 TASK DUE   : {task.sub_task_deadline_date}\n"
        "🔴 STATUS     : Overdue\n\n"
        "Recommended Actions:\n"
        "  → Reassign this task to another available member\n"
        "  → Extend the sub-task deadline\n"
        f"  → Follow up with {task.assigned_to_name} directly\n\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        "Neurax Taskifier — Automated Alert\n"
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
    )
    _send_email(subject, body, [manager])


def check_all_subtask_deadlines() -> dict[str, int]:
    today = timezone.localdate()
    scanned = 0
    reminders = 0
    urgents = 0
    overdue = 0

    rows = SubTask.objects.select_related("project", "assigned_to").all()
    for task in rows:
        scanned += 1
        if task.status == SubTask.STATUS_COMPLETED or not task.sub_task_deadline_date:
            continue

        due_date = task.sub_task_deadline_date
        if today > due_date:
            if not task.alert_sent:
                task.status = SubTask.STATUS_OVERDUE
                _send_overdue_employee_alert(task)
                _send_overdue_manager_alert(task)
                task.alert_sent = True
                task.save(update_fields=["status", "alert_sent", "updated_at"])
                overdue += 1
                _log(
                    "task_overdue",
                    f"Sub-task \"{task.task_name}\" overdue",
                    f"{task.assigned_to_name} · {task.project.project_name}",
                    {"task_id": task.id, "project": task.project.project_name},
                )
            continue

        if due_date == today:
            if not task.reminder_sent:
                _send_due_today_alert(task)
                task.reminder_sent = True
                task.status = SubTask.STATUS_IN_PROGRESS
                task.save(update_fields=["status", "reminder_sent", "updated_at"])
                urgents += 1
            continue

        if due_date == (today + timedelta(days=1)):
            if not task.reminder_sent:
                _send_due_tomorrow_reminder(task)
                task.reminder_sent = True
                task.status = SubTask.STATUS_IN_PROGRESS
                task.save(update_fields=["status", "reminder_sent", "updated_at"])
                reminders += 1

    return {
        "scanned": scanned,
        "reminders": reminders,
        "urgents": urgents,
        "overdue": overdue,
    }
