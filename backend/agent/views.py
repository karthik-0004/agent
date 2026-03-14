from __future__ import annotations

from datetime import datetime, timedelta
import time

from django.db import OperationalError, transaction
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import EmployeeStatus, TaskBoardProject
from .serializers import (
    AgentReplanSerializer,
    AgentRunSerializer,
    EmployeeSerializer,
    SendAssignmentsSerializer,
    TaskBoardCreateSerializer,
    TaskBoardMemberUpdateSerializer,
)
from .services.agent_service import AgentService
from .services.data_loader import add_employee, delete_employee, get_datasets, update_employee
from .services.email_service import send_assignment_emails


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
                        },
                    )
                break
            except OperationalError:
                if attempt == 2:
                    raise
                time.sleep(0.15)
        status_payload.append(row)

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
        employees = datasets["employees"]
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
            serializer.validated_data.get("reshuffle_token", 0),
            serializer.validated_data.get("avoid_conflicts", False),
        )
        analysis = agent_service.analyze_project(serializer.validated_data["project_description"])
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


class AgentReplanView(APIView):
    def post(self, request):
        serializer = AgentReplanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datasets = get_datasets()
        agent_service = AgentService()
        adjusted_employees = agent_service.apply_completed_tasks_context(
            datasets["employees"],
            serializer.validated_data["completed_tasks"],
        )
        plan = agent_service.decompose_tasks(
            serializer.validated_data["remaining_description"],
            adjusted_employees,
            datasets["tools"],
            datasets["history"],
            3,
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
        project.team = [member for member in (project.team or []) if str(member.get("name")) != member_name]
        project.save(update_fields=["team", "updated_at"])
        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_200_OK)


class TaskBoardCompleteView(APIView):
    def patch(self, request, project_id: int):
        try:
            project = TaskBoardProject.objects.get(id=project_id)
        except TaskBoardProject.DoesNotExist:
            return Response({"error": "Project not found"}, status=status.HTTP_404_NOT_FOUND)

        project.status = "completed"
        project.save(update_fields=["status", "updated_at"])
        _sync_employee_statuses_safe()
        return Response(_taskboard_project_payload(project), status=status.HTTP_200_OK)


class EmployeeStatusView(APIView):
    def get(self, request):
        rows = _sync_employee_statuses_safe()
        return Response(rows, status=status.HTTP_200_OK)
