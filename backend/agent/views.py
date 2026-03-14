from __future__ import annotations

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import AgentReplanSerializer, AgentRunSerializer
from .services.agent_service import AgentService
from .services.data_loader import get_datasets


class AgentRunView(APIView):
    def post(self, request):
        serializer = AgentRunSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        datasets = get_datasets()
        employees = datasets["employees"]
        tools = datasets["tools"]
        history = datasets["history"]

        agent_service = AgentService()
        plan = agent_service.decompose_tasks(
            serializer.validated_data["project_description"],
            employees,
            tools,
            history,
        )
        analysis = agent_service.analyze_project(serializer.validated_data["project_description"])
        employee_matches = agent_service.match_employees(analysis["required_skills"], employees)
        employee_workload_update, assignment_counts = agent_service.calculate_workload_update(plan, employees)

        payload = {
            **plan,
            "employee_matches": employee_matches,
            "employee_workload_update": employee_workload_update,
            "assignment_counts": assignment_counts,
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
        )
        analysis = agent_service.analyze_project(serializer.validated_data["remaining_description"])
        employee_matches = agent_service.match_employees(analysis["required_skills"], adjusted_employees)
        employee_workload_update, assignment_counts = agent_service.calculate_workload_update(plan, adjusted_employees)

        payload = {
            **plan,
            "employee_matches": employee_matches,
            "employee_workload_update": employee_workload_update,
            "assignment_counts": assignment_counts,
        }
        return Response(payload, status=status.HTTP_200_OK)


class DatasetView(APIView):
    dataset_key = ""

    def get(self, request):
        datasets = get_datasets()
        return Response(datasets[self.dataset_key], status=status.HTTP_200_OK)


class EmployeesView(DatasetView):
    dataset_key = "employees"


class ProjectsView(DatasetView):
    dataset_key = "projects"


class ToolsView(DatasetView):
    dataset_key = "tools"


class HistoryView(DatasetView):
    dataset_key = "history"
