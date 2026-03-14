from django.urls import path

from .views import (
    AgentReplanView,
    AgentRunView,
    EmployeeDetailView,
    EmployeesView,
    HistoryView,
    ProjectsView,
    SendAssignmentsView,
    ToolsView,
)

urlpatterns = [
    path("agent/run/", AgentRunView.as_view(), name="agent-run"),
    path("agent/replan/", AgentReplanView.as_view(), name="agent-replan"),
    path("agent/send-assignments/", SendAssignmentsView.as_view(), name="agent-send-assignments"),
    path("employees/", EmployeesView.as_view(), name="employees"),
    path("employees/<str:employee_id>/", EmployeeDetailView.as_view(), name="employee-detail"),
    path("projects/", ProjectsView.as_view(), name="projects"),
    path("tools/", ToolsView.as_view(), name="tools"),
    path("history/", HistoryView.as_view(), name="history"),
]
