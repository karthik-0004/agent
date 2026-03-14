from rest_framework import serializers


class AgentRunSerializer(serializers.Serializer):
    project_description = serializers.CharField()


class AgentReplanSerializer(serializers.Serializer):
    completed_tasks = serializers.ListField(child=serializers.DictField(), allow_empty=True)
    remaining_description = serializers.CharField()


class DatasetListSerializer(serializers.Serializer):
    items = serializers.ListField(child=serializers.DictField())
