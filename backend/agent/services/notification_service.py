from __future__ import annotations

from agent.models import EmployeeAccount, EmployeeNotification


def create_notification(employee: EmployeeAccount, notification_type: str, message: str) -> EmployeeNotification:
    return EmployeeNotification.objects.create(
        employee=employee,
        notification_type=notification_type,
        message=message,
    )


def create_notification_by_employee_id(employee_id: str, notification_type: str, message: str) -> EmployeeNotification | None:
    try:
        employee = EmployeeAccount.objects.get(employee_id=employee_id)
    except EmployeeAccount.DoesNotExist:
        return None
    return create_notification(employee, notification_type, message)
