from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from typing import Any

from anthropic import Anthropic


class AgentService:
    MODEL_NAME = "claude-sonnet-4-20250514"

    def __init__(self) -> None:
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.client = Anthropic(api_key=self.api_key) if self.api_key and self.api_key != "your_key_here" else None

    @staticmethod
    def _split_keywords(value: str | None) -> list[str]:
        if not value:
            return []
        return [item.strip().lower() for item in re.split(r"[,/|]", str(value)) if item.strip()]

    def analyze_project(self, project_description: str) -> dict[str, Any]:
        priority_match = re.search(r"\b(high|medium|low)\b", project_description, re.IGNORECASE)
        deadline_match = re.search(r"(\d+)\s*(?:day|days|week|weeks)", project_description, re.IGNORECASE)

        skill_candidates = set(re.findall(r"[A-Za-z][A-Za-z0-9+.#\-]{2,}", project_description))
        normalized_skills = sorted({token.lower() for token in skill_candidates if token.lower() not in {"with", "that", "this", "from", "days", "week", "weeks", "high", "medium", "low"}})

        deadline_days = 14
        if deadline_match:
            amount = int(deadline_match.group(1))
            unit = deadline_match.group(0).lower()
            deadline_days = amount * 7 if "week" in unit else amount

        return {
            "required_skills": normalized_skills[:12],
            "deadline_days": deadline_days,
            "priority": priority_match.group(1).capitalize() if priority_match else "Medium",
        }

    def match_employees(self, required_skills: list[str], employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
        ranked: list[dict[str, Any]] = []
        required_skill_set = {skill.lower() for skill in required_skills}

        for employee in employees:
            employee_skills = self._split_keywords(employee.get("skills"))
            matched = sorted(required_skill_set.intersection(employee_skills))
            workload = float(employee.get("current_workload_percent", 0) or 0)
            capacity = max(0.0, 100.0 - workload)
            score = (len(matched) * 20) + (capacity * 0.6)
            ranked.append(
                {
                    "name": employee.get("name"),
                    "role": employee.get("role"),
                    "matched_skills": matched,
                    "available_capacity": round(capacity, 2),
                    "score": round(score, 2),
                }
            )

        return sorted(ranked, key=lambda item: item["score"], reverse=True)

    def select_tools(self, required_skills: list[str], tools: list[dict[str, Any]]) -> list[str]:
        selected: list[tuple[int, str]] = []
        required_skill_set = {skill.lower() for skill in required_skills}

        for tool in tools:
            keywords = set(self._split_keywords(tool.get("purpose_keywords")))
            keywords.update(self._split_keywords(tool.get("supported_skills")))
            overlap = len(required_skill_set.intersection(keywords))
            if overlap:
                selected.append((overlap, str(tool.get("name"))))

        ordered = sorted(selected, key=lambda item: (-item[0], item[1]))
        return [name for _, name in ordered[:6]]

    def _extract_json(self, content: str) -> dict[str, Any]:
        cleaned = content.strip()
        cleaned = re.sub(r"^```json", "", cleaned)
        cleaned = re.sub(r"^```", "", cleaned)
        cleaned = re.sub(r"```$", "", cleaned)
        return json.loads(cleaned.strip())

    def _fallback_plan(
        self,
        project_description: str,
        project_meta: dict[str, Any],
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        ranked_employees = self.match_employees(project_meta["required_skills"], employees)
        relevant_tools = self.select_tools(project_meta["required_skills"], tools)
        project_name = project_description.split(".")[0][:60].strip() or "Neurax Initiative"
        top_assignees = [employee["name"] for employee in ranked_employees[:3]]

        task_templates = [
            ("Discovery and architecture", "Break down the scope, dependencies, and delivery sequence."),
            ("Implementation sprint", "Build the core solution and integrate required systems."),
            ("Validation and launch", "Test the workflow, document risks, and prepare rollout assets."),
        ]

        tasks = []
        for index, (name, description) in enumerate(task_templates, start=1):
            tasks.append(
                {
                    "name": name,
                    "description": description,
                    "assignees": top_assignees[max(0, index - 2): index + 1] or top_assignees[:2],
                    "tools": relevant_tools[max(0, index - 1): index + 2] or relevant_tools[:2],
                    "duration": max(2, round(project_meta["deadline_days"] / 4)),
                }
            )

        return {
            "project_name": project_name,
            "priority": project_meta["priority"],
            "deadline_days": project_meta["deadline_days"],
            "reasoning": "Fallback planner used because Anthropic credentials were unavailable or the model response could not be parsed.",
            "tasks": tasks,
        }

    def decompose_tasks(
        self,
        project_description: str,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        project_meta = self.analyze_project(project_description)
        system_prompt = (
            "You are Neurax's autonomous workflow orchestrator. Use the complete datasets below to generate an execution plan. "
            "Return ONLY raw JSON with the exact schema requested.\n\n"
            f"Employees dataset:\n{json.dumps(employees, indent=2)}\n\n"
            f"Tools dataset:\n{json.dumps(tools, indent=2)}\n\n"
            f"Project history dataset:\n{json.dumps(history, indent=2)}\n"
        )
        user_prompt = (
            "Analyze the following project request and produce a plan using the exact JSON schema. "
            "Use the employee workloads to avoid over-allocation, choose relevant tools, and keep the plan realistic.\n\n"
            f"Project request:\n{project_description}\n\n"
            f"Parsed project metadata:\n{json.dumps(project_meta, indent=2)}"
        )

        if not self.client:
            return self._fallback_plan(project_description, project_meta, employees, tools)

        try:
            response = self.client.messages.create(
                model=self.MODEL_NAME,
                max_tokens=4000,
                temperature=0.2,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
            )
            text_blocks = [block.text for block in response.content if getattr(block, "type", "") == "text"]
            plan = self._extract_json("\n".join(text_blocks))
        except Exception:
            return self._fallback_plan(project_description, project_meta, employees, tools)

        plan["priority"] = plan.get("priority", project_meta["priority"])
        plan["deadline_days"] = int(plan.get("deadline_days", project_meta["deadline_days"]))
        plan["tasks"] = [
            {
                "name": str(task.get("name", "Unnamed Task")),
                "description": str(task.get("description", "")),
                "assignees": list(task.get("assignees", [])),
                "tools": list(task.get("tools", [])),
                "duration": int(task.get("duration", 1)),
            }
            for task in plan.get("tasks", [])
        ]
        return plan

    def calculate_workload_update(
        self,
        plan: dict[str, Any],
        employees: list[dict[str, Any]],
    ) -> tuple[dict[str, int], dict[str, int]]:
        base_workloads = {
            str(employee.get("name")): int(float(employee.get("current_workload_percent", 0) or 0))
            for employee in employees
        }
        assignment_counts: dict[str, int] = defaultdict(int)
        updated_workloads = dict(base_workloads)

        for task in plan.get("tasks", []):
            assignees = task.get("assignees", []) or []
            if not assignees:
                continue
            task_load = max(6, min(24, int(task.get("duration", 1)) * 3))
            per_assignee_load = max(3, round(task_load / len(assignees)))
            for assignee in assignees:
                if assignee not in updated_workloads:
                    continue
                assignment_counts[assignee] += 1
                updated_workloads[assignee] = min(100, updated_workloads[assignee] + per_assignee_load)

        return updated_workloads, dict(assignment_counts)

    def apply_completed_tasks_context(
        self,
        employees: list[dict[str, Any]],
        completed_tasks: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        adjusted_employees = [dict(employee) for employee in employees]
        workload_reduction: dict[str, int] = defaultdict(int)

        for task in completed_tasks:
            assignees = task.get("assignees", []) or []
            if not assignees:
                continue
            reduction = max(4, min(18, int(task.get("duration", 1)) * 2))
            per_assignee = max(2, round(reduction / len(assignees)))
            for assignee in assignees:
                workload_reduction[assignee] += per_assignee

        for employee in adjusted_employees:
            name = str(employee.get("name"))
            current = int(float(employee.get("current_workload_percent", 0) or 0))
            employee["current_workload_percent"] = max(0, current - workload_reduction.get(name, 0))

        return adjusted_employees
