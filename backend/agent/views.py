from __future__ import annotations

from datetime import datetime, timedelta
import time

from django.db import OperationalError, transaction
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ActivityLog, EmployeeStatus, TaskBoardProject
from .serializers import (
    AgentReplanSerializer,
    AgentRunSerializer,
    DatasetConfirmSerializer,
    DatasetUploadSerializer,
    ProjectBriefPdfUploadSerializer,
    ProjectBriefConfirmSerializer,
    EmployeeSerializer,
    CustomMissionSerializer,
    OutreachAddSerializer,
    SendAssignmentsSerializer,
    TaskBoardCreateSerializer,
    TaskBoardMemberUpdateSerializer,
)
from .services.agent_service import AgentService
from .services.data_loader import (
    add_project,
    add_employee,
    add_outreach_employee,
    delete_employee,
    delete_outreach_employee,
    delete_outreach_employees_for_project,
    get_datasets,
    update_employee,
)
from .services.email_service import send_assignment_emails, send_outreach_assignment_email, send_outreach_farewell_email
from .services.upload_service import (
    confirm_bulk_rebuild,
    confirm_project_brief_append,
    extract_project_brief_pdf,
    get_upload_status,
    parse_dataset_upload,
    reload_from_database_view,
)


def _sync_employee_statuses() -> list[dict]:
    datasets = get_datasets()
    employees = datasets["employees"]
    ongoing = TaskBoardProject.objects.filter(status="ongoing")

    project_map: dict[str, str] = {}
    workload_delta: dict[str, int] = {}
    for project in ongoing:
        for member in project.team or []:
            member_name = str(member.get("name", "")).strip()
            if not member_name:
                continue
            project_map[member_name] = project.project_name
            workload_delta[member_name] = workload_delta.get(member_name, 0) + 8

    status_payload = []
    active_ids: set[str] = set()
    for employee in employees:
        name = str(employee.get("name", "")).strip()
        if not name:
            continue
        is_assigned = name in project_map
        workload = int(float(employee.get("current_workload_percent", 0) or 0))
        if is_assigned:
            workload = min(100, workload + workload_delta.get(name, 0))
        row = {
            "employee_id": str(employee.get("employee_id", "")),
            "name": name,
            "email": str(employee.get("email", "")),
            "status": "assigned" if is_assigned else "available",
            "current_project": project_map.get(name),
            "workload_percent": workload,
            "source": str(employee.get("source", "imported") or "imported"),
            "is_outreach": bool(employee.get("is_outreach", False)),
            "outreach_project_id": int(employee.get("outreach_project_id", 0) or 0),
            "rate_per_day": employee.get("rate_per_day"),
            "notes": str(employee.get("notes", "") or ""),
        }
        for attempt in range(3):
            try:
                with transaction.atomic():
                    EmployeeStatus.objects.update_or_create(
                        employee_id=row["employee_id"],
                        defaults={
                            "name": row["name"],
                            "email": row["email"],
                            "status": row["status"],
                            "current_project": row["current_project"],
                            "workload_percent": row["workload_percent"],
                            "source": row["source"],
                            "is_outreach": row["is_outreach"],
                            "outreach_project_id": row["outreach_project_id"] or None,
                            "rate_per_day": row["rate_per_day"],
                            "notes": row["notes"],
                        },
                    )
                break
            except OperationalError:
                if attempt == 2:
                    raise
                time.sleep(0.15)
        status_payload.append(row)
        active_ids.add(row["employee_id"])

    if active_ids:
        EmployeeStatus.objects.exclude(employee_id__in=active_ids).delete()
    else:
        EmployeeStatus.objects.all().delete()

    return status_payload


def _sync_employee_statuses_safe() -> list[dict]:
    try:
        return _sync_employee_statuses()
    except OperationalError:
        rows = EmployeeStatus.objects.all()
        return [
            {
                "employee_id": row.employee_id,
                "name": row.name,
                "email": row.email,
                "status": row.status,
                "current_project": row.current_project,
                "workload_percent": row.workload_percent,
                "source": row.source,
                "is_outreach": row.is_outreach,
                "outreach_project_id": row.outreach_project_id,
                "rate_per_day": row.rate_per_day,
                "notes": row.notes,
            }
            for row in rows
        ]


def _taskboard_project_payload(project: TaskBoardProject) -> dict:
    return {
        "id": project.id,
        "project_name": project.project_name,
        "priority": project.priority,
        "deadline_days": project.deadline_days,
        "deadline_date": project.deadline_date,
        "status": project.status,
        "tasks": project.tasks,
        "team": project.team,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
    }


class AgentRunView(APIView):
    def post(self, request):
        serializer = AgentRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datasets = get_datasets()
        employees = [row for row in datasets["employees"] if not bool(row.get("is_outreach"))]
        tools = datasets["tools"]
        history = datasets["history"]

        agent_service = AgentService()
        risk_flags = agent_service.identify_deadline_risk_flags(history)
        plan = agent_service.decompose_tasks(
            serializer.validated_data["project_description"],
            employees,
            tools,
            history,
            serializer.validated_data.get("team_size", 3),
            serializer.validated_data.get("deadline_days", 14),
            serializer.validated_data.get("reshuffle_token", 0),
            serializer.validated_data.get("avoid_conflicts", False),
        )
        analysis = agent_service.analyze_project(
            serializer.validated_data["project_description"],
            serializer.validated_data.get("deadline_days", 14),
        )
        employee_matches = agent_service.match_employees(
            analysis["required_skills"],
            employees,
            analysis["priority"],
            risk_flags,
        )
        employee_workload_update, assignment_counts = agent_service.calculate_workload_update(plan, employees)
        active_assignments = agent_service.build_active_assignment_snapshot(
            employees,
            plan.get("tasks", []),
            int(plan.get("deadline_days", analysis["deadline_days"])),
        )

        payload = {
            **plan,
            "employee_matches": employee_matches,
            "employee_workload_update": employee_workload_update,
            "assignment_counts": assignment_counts,
            "active_assignments": active_assignments,
            "team_conflicts": agent_service.detect_conflicts(plan.get("assigned_team", [])),
        }
        return Response(payload, status=status.HTTP_200_OK)


class CustomMissionView(APIView):
    def post(self, request):
        serializer = CustomMissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        datasets = get_datasets()
        employees = [row for row in datasets["employees"] if not bool(row.get("is_outreach"))]
        tools = datasets["tools"]
        history = datasets["history"]

        service = AgentService()

        if data["action"] == "analyze":
            analysis = service.analyze_custom_mission(
                data["mission_title"],
                data["mission_description"],
                data.get("team_size", 3),
                data.get("deadline_days", 14),
                employees,
                tools,
                history,
            )
            return Response({"analysis": analysis}, status=status.HTTP_200_OK)

        extracted = data.get("extracted") or {}
        plan = service.build_custom_mission_plan(
            data["mission_title"],
            data["mission_description"],
            extracted,
            data.get("team_size", 3),
            data.get("deadline_days", 14),
            employees,
            tools,
            history,
        )

        saved_project = None
        if data.get("save_to_dataset", False):
            saved_project = add_project(
                {
                    "project_name": data["mission_title"],
                    "description": data["mission_description"],
                    "required_skills": ", ".join([str(item) for item in extracted.get("required_skills", [])]),
                    "deadline_days": data.get("deadline_days", 14),
                    "priority": plan.get("priority", "Medium"),
                    "source": "manual",
                }
            )

        return Response(
            {
                "plan": plan,
                "saved_project": saved_project,
            },
            status=status.HTTP_200_OK,
        )


class AgentReplanView(APIView):
    def post(self, request):
        serializer = AgentReplanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datasets = get_datasets()
        agent_service = AgentService()
        adjusted_employees = agent_service.apply_completed_tasks_context(
            [row for row in datasets["employees"] if not bool(row.get("is_outreach"))],
            serializer.validated_data["completed_tasks"],
        )
        plan = agent_service.decompose_tasks(
            serializer.validated_data["remaining_description"],
            adjusted_employees,
            datasets["tools"],
            datasets["history"],
            team_size=3,
        )
        analysis = agent_service.analyze_project(serializer.validated_data["remaining_description"])
        risk_flags = agent_service.identify_deadline_risk_flags(datasets["history"])
        employee_matches = agent_service.match_employees(
            analysis["required_skills"],
            adjusted_employees,
            analysis["priority"],
            risk_flags,
        )
        employee_workload_update, assignment_counts = agent_service.calculate_workload_update(plan, adjusted_employees)
        active_assignments = agent_service.build_active_assignment_snapshot(
            adjusted_employees,
            plan.get("tasks", []),
            int(plan.get("deadline_days", analysis["deadline_days"])),
        )

        payload = {
            **plan,
            "employee_matches": employee_matches,
            "employee_workload_update": employee_workload_update,
            "assignment_counts": assignment_counts,
            "active_assignments": active_assignments,
        }
        return Response(payload, status=status.HTTP_200_OK)


class DatasetView(APIView):
    dataset_key = ""

    def get(self, request):
        datasets = get_datasets()
        return Response(datasets[self.dataset_key], status=status.HTTP_200_OK)


class EmployeesView(DatasetView):
    dataset_key = "employees"

    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = add_employee(serializer.validated_data)
        _sync_employee_statuses_safe()
        return Response(created, status=status.HTTP_201_CREATED)


class EmployeesAddView(APIView):
    def post(self, request):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        created = add_employee(serializer.validated_data)
        _sync_employee_statuses_safe()
        return Response(created, status=status.HTTP_201_CREATED)


class EmployeesAddOutreachView(APIView):
    def post(self, request):
        serializer = OutreachAddSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        try:
            project = TaskBoardProject.objects.get(id=payload["project_id"], status="ongoing")
        except TaskBoardProject.DoesNotExist:
            return Response({"error": "Active project not found"}, status=status.HTTP_404_NOT_FOUND)

        team = list(project.team or [])
        if any(bool(member.get("is_outreach")) and str(member.get("email", "")).lower() == payload["email"].lower() for member in team):
            return Response({"error": "This outreach expert is already in the project"}, status=status.HTTP_400_BAD_REQUEST)

        for row in get_datasets()["employees"]:
            if bool(row.get("is_outreach")) and str(row.get("email", "")).lower() == payload["email"].lower():
                return Response({"error": "Outreach expert already assigned to another project"}, status=status.HTTP_400_BAD_REQUEST)

        created = add_outreach_employee(
            {
                "name": payload["name"],
                "role": payload["role"],
                "email": payload["email"],
                "skills": payload.get("skills", ""),
                "current_workload_percent": 60,
                "location": "External",
                "availability_status": "Assigned",
                "rating": 7,
                "is_outreach": True,
                "outreach_project_id": project.id,
                "rate_per_day": payload.get("rate_per_day"),
                "notes": payload.get("notes", ""),
                "source": "outreach",
            }
        )

        outreach_member = {
            "employee_id": created["employee_id"],
            "name": created["name"],
            "email": created["email"],
            "role": created["role"],
            "current_workload_percent": created.get("current_workload_percent", 60),
            "is_outreach": True,
            "source": "outreach",
            "outreach_project_id": project.id,
        }
        if not any(str(member.get("name", "")).lower() == created["name"].lower() for member in team):
            team.append(outreach_member)
            project.team = team
            project.save(update_fields=["team", "updated_at"])

        _sync_employee_statuses_safe()

        deadline_date = project.deadline_date or (datetime.utcnow() + timedelta(days=project.deadline_days)).strftime("%d %b %Y")
        send_outreach_assignment_email(
            {
                "name": created["name"],
                "email": created["email"],
                "role": created["role"],
                "project_name": project.project_name,
                "deadline_days": project.deadline_days,
                "deadline_date": deadline_date,
                "team_members": team,
            }
        )

        _log_activity(
            "outreach_added",
            f"Outreach expert added to {project.project_name}",
            created["name"],
            {"project_id": project.id, "employee_id": created["employee_id"]},
        )

        return Response(
            {
                "employee": created,
                "project": _taskboard_project_payload(project),
            },
            status=status.HTTP_201_CREATED,
        )


class EmployeeDetailView(APIView):
    def put(self, request, employee_id: str):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_employee(employee_id, serializer.validated_data)
        if not updated:
            return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)
        _sync_employee_statuses_safe()
        return Response(updated, status=status.HTTP_200_OK)

    def delete(self, request, employee_id: str):
        deleted = delete_employee(employee_id)
        if not deleted:
            return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)
        _sync_employee_statuses_safe()
        return Response({"status": "deleted"}, status=status.HTTP_200_OK)


class ProjectsView(DatasetView):
    dataset_key = "projects"


class ToolsView(DatasetView):
    dataset_key = "tools"


class HistoryView(DatasetView):
    dataset_key = "history"


class DatasetUploadView(APIView):
    dataset_key = ""

    def post(self, request):
        serializer = DatasetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        upload = serializer.validated_data["file"]
        try:
            parsed = parse_dataset_upload(
                self.dataset_key,
                upload.name,
                upload.read(),
            )
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(parsed, status=status.HTTP_200_OK)


class EmployeesDatasetUploadView(DatasetUploadView):
    dataset_key = "employees"


class ProjectsDatasetUploadView(DatasetUploadView):
    dataset_key = "projects"


class ToolsDatasetUploadView(DatasetUploadView):
    dataset_key = "tools"


class HistoryDatasetUploadView(DatasetUploadView):
    dataset_key = "history"


class DatasetConfirmView(APIView):
    def post(self, request):
        serializer = DatasetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("confirm", True):
            return Response({"status": "cancelled"}, status=status.HTTP_200_OK)
        summary = confirm_bulk_rebuild()
        return Response(summary, status=status.HTTP_200_OK)


class DatasetStatusView(APIView):
    def get(self, request):
        return Response(get_upload_status(), status=status.HTTP_200_OK)


class DatasetReloadView(APIView):
    def post(self, request):
        payload = reload_from_database_view()
        return Response(payload, status=status.HTTP_200_OK)


class ProjectBriefPdfUploadView(APIView):
    def post(self, request):
        serializer = ProjectBriefPdfUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        uploaded = serializer.validated_data["file"]
        try:
            payload = extract_project_brief_pdf(uploaded.name, uploaded.read())
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload, status=status.HTTP_200_OK)


class ProjectBriefPdfConfirmView(APIView):
    def post(self, request):
        serializer = ProjectBriefConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            payload = confirm_project_brief_append(data["token"], data.get("records") or None)
        except ValueError as error:
            return Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(payload, status=status.HTTP_200_OK)


class SendAssignmentsView(APIView):
    def post(self, request):
        serializer = SendAssignmentsSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = send_assignment_emails(serializer.validated_data)
        return Response(result, status=status.HTTP_200_OK)


class TaskBoardListView(APIView):
    def get(self, request):
        projects = TaskBoardProject.objects.all()
        return Response([_taskboard_project_payload(project) for project in projects], status=status.HTTP_200_OK)


class TaskBoardCreateView(APIView):
    def post(self, request):
        serializer = TaskBoardCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        project = TaskBoardProject.objects.create(
            project_name=data["project_name"],
            priority=data.get("priority", "Medium"),
            deadline_days=int(data.get("deadline_days", 14)),
            deadline_date=data.get("deadline_date", "")
            or (datetime.utcnow() + timedelta(days=int(data.get("deadline_days", 14)))).strftime("%d %b %Y"),
            status=data.get("status", "ongoing"),
            tasks=data.get("tasks", []),
            team=data.get("team", []),
        )
        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_201_CREATED)


class TaskBoardAddMemberView(APIView):
    def patch(self, request, project_id: int):
        serializer = TaskBoardMemberUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            project = TaskBoardProject.objects.get(id=project_id)
        except TaskBoardProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        member = serializer.validated_data["member"]
        team = list(project.team or [])
        if not any(str(item.get("name")) == str(member.get("name")) for item in team):
            team.append(member)
        project.team = team
        project.save(update_fields=["team", "updated_at"])
        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_200_OK)


class TaskBoardRemoveMemberView(APIView):
    def patch(self, request, project_id: int):
        serializer = TaskBoardMemberUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            project = TaskBoardProject.objects.get(id=project_id)
        except TaskBoardProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        member_name = str(serializer.validated_data["member"].get("name", ""))
        member_payload = next(
            (member for member in (project.team or []) if str(member.get("name")) == member_name),
            None,
        )
        project.team = [member for member in (project.team or []) if str(member.get("name")) != member_name]
        project.save(update_fields=["team", "updated_at"])

        if member_payload and bool(member_payload.get("is_outreach")):
            employee_id = str(member_payload.get("employee_id") or "")
            if employee_id:
                delete_outreach_employee(employee_id, outreach_project_id=project.id)
            _log_activity(
                "outreach_removed",
                f"Outreach expert removed from {project.project_name}",
                member_name,
                {"project_id": project.id},
            )

        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_200_OK)


class TaskBoardCompleteView(APIView):
    def patch(self, request, project_id: int):
        try:
            project = TaskBoardProject.objects.get(id=project_id)
        except TaskBoardProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        outreach_members = [member for member in (project.team or []) if bool(member.get("is_outreach"))]
        for member in outreach_members:
            send_outreach_farewell_email(
                {
                    "name": member.get("name", ""),
                    "email": member.get("email", ""),
                    "project_name": project.project_name,
                }
            )

        removed = delete_outreach_employees_for_project(project.id)
        for row in removed:
            _log_activity(
                "outreach_auto_removed",
                "Outreach profile removed after project completion",
                str(row.get("name", "")),
                {"project_id": project.id, "employee_id": row.get("employee_id")},
            )

        project.status = "completed"
        project.save(update_fields=["status", "updated_at"])
        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_200_OK)


class EmployeeStatusView(APIView):
    def get(self, request):
        rows = _sync_employee_statuses_safe()
        return Response(rows, status=status.HTTP_200_OK)


# ── helpers ──────────────────────────────────────────────────────────────────

def _log_activity(activity_type: str, title: str, detail: str = "", meta: dict | None = None) -> None:
    try:
        ActivityLog.objects.create(
            activity_type=activity_type,
            title=title,
            detail=detail,
            meta=meta or {},
        )
    except Exception:
        pass


def _human_time_ago(dt) -> str:
    now = timezone.now()
    delta = now - dt
    seconds = int(delta.total_seconds())
    if seconds < 60:
        return f"{seconds}s ago"
    if seconds < 3600:
        return f"{seconds // 60}m ago"
    if seconds < 86400:
        return f"{seconds // 3600}h ago"
    return f"{delta.days}d ago"


def _build_analytics_payload(period: str = "7d") -> dict:
    days = 30 if period == "30d" else 7
    now = timezone.now()
    since = now - timedelta(days=days)

    all_projects = list(TaskBoardProject.objects.all())
    ongoing = [p for p in all_projects if p.status == "ongoing"]
    completed = [p for p in all_projects if p.status == "completed"]
    overdue = [p for p in ongoing if p.deadline_days <= 0]

    # top stats
    top_stats = {
        "total_projects": len(all_projects),
        "ongoing_projects": len(ongoing),
        "completed_projects": len(completed),
        "overdue_projects": len(overdue),
    }

    # status distribution donut
    status_distribution = [
        {"name": "Ongoing", "value": len(ongoing)},
        {"name": "Completed", "value": len(completed)},
        {"name": "Overdue", "value": len(overdue)},
    ]

    # team utilisation bar (from EmployeeStatus)
    statuses = list(EmployeeStatus.objects.all())
    team_utilization = [
        {"name": row.name.split()[0] if row.name else "Unknown", "workload_percent": row.workload_percent}
        for row in statuses
        if not row.is_outreach
    ][:30]

    # task completion trend (projects completed per day over period)
    trend_map: dict[str, int] = {}
    for i in range(days):
        day = (now - timedelta(days=days - 1 - i)).strftime("%d %b")
        trend_map[day] = 0
    for project in completed:
        day_str = project.updated_at.strftime("%d %b")
        if day_str in trend_map:
            trend_map[day_str] += 1
    task_completion_trend = [{"date": d, "completed": v} for d, v in trend_map.items()]

    # priority breakdown
    priority_breakdown = [
        {
            "label": "High",
            "high": sum(1 for p in all_projects if p.priority == "High"),
            "medium": 0,
            "low": 0,
        },
        {
            "label": "Medium",
            "high": 0,
            "medium": sum(1 for p in all_projects if p.priority == "Medium"),
            "low": 0,
        },
        {
            "label": "Low",
            "high": 0,
            "medium": 0,
            "low": sum(1 for p in all_projects if p.priority == "Low"),
        },
    ]

    # secondary stats
    datasets = get_datasets()
    employees_list = [row for row in datasets.get("employees", []) if not bool(row.get("is_outreach"))]
    tools_list = datasets.get("tools", [])
    available_count = sum(1 for row in statuses if row.status == "available" and not row.is_outreach)
    avg_rating = 0.0
    if employees_list:
        ratings = [float(e.get("performance_rating", 0) or 0) for e in employees_list]
        avg_rating = round(sum(ratings) / len(ratings), 1) if ratings else 0.0

    secondary_stats = {
        "total_employees": len(employees_list),
        "available_now": available_count,
        "avg_team_rating": avg_rating,
        "tools_in_use": len(tools_list),
    }

    # leaderboard (from EmployeeStatus + employee dataset)
    emp_map = {str(e.get("name", "")).strip(): e for e in employees_list}
    leaderboard = []
    for row in statuses:
        if row.is_outreach:
            continue
        emp = emp_map.get(row.name, {})
        leaderboard.append({
            "name": row.name,
            "rating": float(emp.get("performance_rating", 0) or 0),
            "projects": int(emp.get("completed_projects", 0) or 0),
            "on_time": int(emp.get("on_time_delivery_rate", 0) or 0),
            "status": row.status,
        })
    leaderboard.sort(key=lambda r: r["rating"], reverse=True)

    # project health
    project_health = []
    for project in ongoing[:20]:
        total_days = max(1, project.deadline_days)
        elapsed = max(0, total_days - project.deadline_days)
        progress = min(100, round(elapsed / total_days * 100))
        if project.deadline_days <= 2:
            health = "Critical"
        elif project.deadline_days <= 5:
            health = "At Risk"
        else:
            health = "On Track"
        project_health.append({
            "project_name": project.project_name,
            "team": [m.get("name", "") for m in (project.team or [])],
            "deadline_days": project.deadline_days,
            "progress": progress,
            "health": health,
        })

    return {
        "top_stats": top_stats,
        "charts": {
            "status_distribution": status_distribution,
            "team_utilization": team_utilization,
            "task_completion_trend": task_completion_trend,
            "priority_breakdown": priority_breakdown,
        },
        "secondary_stats": secondary_stats,
        "leaderboard": leaderboard,
        "project_health": project_health,
    }


# ── analytics views ───────────────────────────────────────────────────────────

class AnalyticsView(APIView):
    def get(self, request):
        period = request.query_params.get("period", "7d")
        payload = _build_analytics_payload(period)
        return Response(payload, status=status.HTTP_200_OK)


class ActivitiesView(APIView):
    def get(self, request):
        logs = ActivityLog.objects.all()[:50]
        data = [
            {
                "id": log.id,
                "activity_type": log.activity_type,
                "title": log.title,
                "detail": log.detail,
                "time_ago": _human_time_ago(log.created_at),
            }
            for log in logs
        ]
        return Response(data, status=status.HTTP_200_OK)
