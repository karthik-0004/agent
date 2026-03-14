from rest_framework import serializers


class AgentRunSerializer(serializers.Serializer):
    project_description = serializers.CharField()
    team_size = serializers.IntegerField(min_value=1, max_value=5, required=False, default=3)
    reshuffle_token = serializers.IntegerField(required=False, default=0)
    avoid_conflicts = serializers.BooleanField(required=False, default=False)


class AgentReplanSerializer(serializers.Serializer):
    completed_tasks = serializers.ListField(child=serializers.DictField(), allow_empty=True)
    remaining_description = serializers.CharField()


class DatasetListSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField())


class EmployeeSerializer(serializers.Serializer):
    employee_id = serializers.CharField(required=False, allow_blank=True)
    name = serializers.CharField()
    email = serializers.EmailField(required=False, allow_blank=True)
    role = serializers.CharField()
    location = serializers.CharField(required=False, allow_blank=True, default="N/A")
    skills = serializers.CharField(required=False, allow_blank=True, default="")
    current_workload_percent = serializers.IntegerField(min_value=0, max_value=100, required=False, default=0)
    availability_status = serializers.CharField(required=False, allow_blank=True, default="Available")
    rating = serializers.IntegerField(min_value=1, max_value=10, required=False, default=7)


class AssignmentTaskSerializer(serializers.Serializer):
    name = serializers.CharField()
    description = serializers.CharField(required=False, allow_blank=True, default="")
    duration = serializers.IntegerField(min_value=1)


class AssignmentMemberSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    role = serializers.CharField()


class SendAssignmentsSerializer(serializers.Serializer):
    project_name = serializers.CharField()
    priority = serializers.CharField()
    deadline_days = serializers.IntegerField(min_value=1)
    deadline_date = serializers.CharField()
    tasks = AssignmentTaskSerializer(many=True, required=False)
    team = AssignmentMemberSerializer(many=True)


class TaskBoardCreateSerializer(serializers.Serializer):
    project_name = serializers.CharField()
    priority = serializers.CharField(required=False, default="Medium")
    deadline_days = serializers.IntegerField(required=False, default=14)
    deadline_date = serializers.CharField(required=False, allow_blank=True, default="")
    tasks = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    team = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    status = serializers.CharField(required=False, default="ongoing")


class TaskBoardMemberUpdateSerializer(serializers.Serializer):
    member = serializers.DictField(required=True)


class TaskBoardConflictDecisionSerializer(serializers.Serializer):
    project_name = serializers.CharField(required=False, allow_blank=True)
    conflicts = serializers.ListField(child=serializers.DictField(), required=False, default=list)
