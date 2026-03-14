from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AgentReplanSerializer, AgentRunSerializer, EmployeeSerializer, SendAssignmentsSerializer
from .services.agent_service import AgentService
from .services.data_loader import add_employee, delete_employee, get_datasets, update_employee
from .services.email_service import send_assignment_emails


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
        return Response(created, status=status.HTTP_201_CREATED)


class EmployeeDetailView(APIView):
    def put(self, request, employee_id: str):
        serializer = EmployeeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        updated = update_employee(employee_id, serializer.validated_data)
        if not updated:
            return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)
        return Response(updated, status=status.HTTP_200_OK)

    def delete(self, request, employee_id: str):
        deleted = delete_employee(employee_id)
        if not deleted:
            return Response({"error": "Employee not found"}, status=status.HTTP_404_NOT_FOUND)
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
