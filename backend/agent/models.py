from django.db import models


class TaskBoardProject(models.Model):
    project_name = models.CharField(max_length=255)
    priority = models.CharField(max_length=20, default="Medium")
    deadline_days = models.IntegerField(default=14)
    deadline_date = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(max_length=20, default="ongoing")
    tasks = models.JSONField(default=list, blank=True)
    team = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-created_at"]


class EmployeeStatus(models.Model):
    employee_id = models.CharField(max_length=64, unique=True)
    name = models.CharField(max_length=255)
    email = models.EmailField(blank=True, default="")
    status = models.CharField(max_length=20, default="available")
    current_project = models.CharField(max_length=255, blank=True, null=True)
    workload_percent = models.IntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
