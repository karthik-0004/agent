from django.urls import path

from .views import AgentReplanView, AgentRunView, EmployeesView, HistoryView, ProjectsView, ToolsView

urlpatterns = [
    path("agent/run/", AgentRunView.as_view(), name="agent-run"),
    path("agent/replan/", AgentReplanView.as_view(), name="agent-replan"),
    path("employees/", EmployeesView.as_view(), name="employees"),
    path("projects/", ProjectsView.as_view(), name="projects"),
    path("tools/", ToolsView.as_view(), name="tools"),
    path("history/", HistoryView.as_view(), name="history"),
]
