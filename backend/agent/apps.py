from django.apps import AppConfig


class AgentConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "agent"

    def ready(self):
        from .services.agent_service import AgentService
        from .services.data_loader import preload_data

        datasets = preload_data()
        AgentService.rebuild_system_prompt(
            datasets.get("employees", []),
            datasets.get("tools", []),
            datasets.get("history", []),
        )
