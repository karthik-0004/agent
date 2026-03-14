from __future__ import annotations

import json
import importlib
import os
import re
from collections import defaultdict
from typing import Any


class AgentService:
    MODEL_NAME = "gpt-4o"

    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.client = None
        if self.api_key and self.api_key != "your_key_here":
            try:
                openai_module = importlib.import_module("openai")
                self.client = openai_module.OpenAI(api_key=self.api_key)
            except Exception:
                self.client = None

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

    def calculate_performance_rating(self, employee: dict[str, Any]) -> int:
        skills = self._split_keywords(employee.get("skills"))
        workload = float(employee.get("current_workload_percent", 0) or 0)
        capacity = max(0.0, 100.0 - workload)
        raw_score = (len(skills) * 1.2) + (capacity * 0.08)
        return max(1, min(10, int(round(raw_score))))

    def identify_deadline_risk_flags(self, history: list[dict[str, Any]]) -> set[str]:
        flagged_names: set[str] = set()
        late_terms = {"late", "delayed", "overdue", "missed", "behind"}

        for record in history:
            record_text = " ".join(str(value).lower() for value in record.values() if value is not None)
            if not any(term in record_text for term in late_terms):
                continue
            owner_field = (
                record.get("owner")
                or record.get("employee_name")
                or record.get("assignee")
                or record.get("team_member")
                or ""
            )
            for candidate in re.split(r"[,/|]", str(owner_field)):
                cleaned = candidate.strip()
                if cleaned:
                    flagged_names.add(cleaned)

        return flagged_names

    def score_employee(
        self,
        employee: dict[str, Any],
        required_skill_set: set[str],
        project_priority: str,
        risk_flags: set[str],
    ) -> tuple[float, list[str], float, int, bool]:
        employee_skills = set(self._split_keywords(employee.get("skills")))
        matched_skills = sorted(required_skill_set.intersection(employee_skills))
        workload = float(employee.get("current_workload_percent", 0) or 0)
        capacity = max(0.0, 100.0 - workload)
        rating = self.calculate_performance_rating(employee)
        is_risky = str(employee.get("name")) in risk_flags

        score = (len(matched_skills) * 22) + (capacity * 0.7) + (rating * 3)
        if project_priority.lower() == "high" and is_risky:
            score -= 22

        return score, matched_skills, capacity, rating, is_risky

    def match_employees(
        self,
        required_skills: list[str],
        employees: list[dict[str, Any]],
        project_priority: str = "Medium",
        risk_flags: set[str] | None = None,
    ) -> list[dict[str, Any]]:
        ranked: list[dict[str, Any]] = []
        required_skill_set = {skill.lower() for skill in required_skills}
        risk_flags = risk_flags or set()

        for employee in employees:
            score, matched, capacity, rating, is_risky = self.score_employee(
                employee,
                required_skill_set,
                project_priority,
                risk_flags,
            )
            ranked.append(
                {
                    "name": employee.get("name"),
                    "role": employee.get("role"),
                    "matched_skills": matched,
                    "available_capacity": round(capacity, 2),
                    "performance_rating": rating,
                    "deadline_risk": is_risky,
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

    def recommend_tools_for_task(
        self,
        required_skills: list[str],
        task_description: str,
        tools: list[dict[str, Any]],
    ) -> list[dict[str, str]]:
        description_tokens = set(self._split_keywords(task_description))
        required_skill_set = {skill.lower() for skill in required_skills}
        recommendations: list[tuple[int, dict[str, str]]] = []

        for tool in tools:
            supported = set(self._split_keywords(tool.get("supported_skills")))
            purpose = set(self._split_keywords(tool.get("purpose_keywords")))
            overlap = sorted((required_skill_set | description_tokens).intersection(supported | purpose))
            if not overlap:
                continue
            score = len(overlap)
            recommendations.append(
                (
                    score,
                    {
                        "name": str(tool.get("name", "Unknown Tool")),
                        "category": str(tool.get("category", "General")),
                        "reason": f"Matched: {', '.join(overlap[:4])}",
                    },
                )
            )

        ordered = sorted(recommendations, key=lambda item: (-item[0], item[1]["name"]))
        return [payload for _, payload in ordered[:3]]

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
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        risk_flags = self.identify_deadline_risk_flags(history)
        ranked_employees = self.match_employees(
            project_meta["required_skills"],
            employees,
            project_meta["priority"],
            risk_flags,
        )
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
            task_priority = "High" if index == 1 and project_meta["priority"] == "High" else "Medium" if index < 3 else "Low"
            task_tools = relevant_tools[max(0, index - 1): index + 2] or relevant_tools[:2]
            tasks.append(
                {
                    "name": name,
                    "description": description,
                    "assignees": top_assignees[max(0, index - 2): index + 1] or top_assignees[:2],
                    "tools": task_tools,
                    "priority": task_priority,
                    "duration": max(2, round(project_meta["deadline_days"] / 4)),
                    "tool_recommendations": self.recommend_tools_for_task(
                        project_meta["required_skills"],
                        description,
                        tools,
                    ),
                }
            )

        return {
            "project_name": project_name,
            "priority": project_meta["priority"],
            "deadline_days": project_meta["deadline_days"],
            "reasoning": "Fallback planner used because OpenAI credentials were unavailable or the model response could not be parsed.",
            "tasks": tasks,
        }

    def _task_priority_value(self, priority: str) -> int:
        mapping = {"high": 3, "medium": 2, "low": 1}
        return mapping.get(str(priority).lower(), 1)

    def _normalize_priority(self, value: str | None, default_value: str) -> str:
        normalized = str(value or "").strip().lower()
        if normalized in {"high", "medium", "low"}:
            return normalized.capitalize()
        return default_value

    def enforce_assignment_rules(
        self,
        plan: dict[str, Any],
        required_skills: list[str],
        employees: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> tuple[list[dict[str, Any]], list[str]]:
        alerts: list[str] = []
        risk_flags = self.identify_deadline_risk_flags(history)
        ranked = self.match_employees(required_skills, employees, plan.get("priority", "Medium"), risk_flags)
        rank_lookup = {str(item["name"]): item for item in ranked}

        adjusted_tasks: list[dict[str, Any]] = []
        per_task_budget = max(1, int(plan.get("deadline_days", 14) / max(1, len(plan.get("tasks", [])))))

        for task in plan.get("tasks", []):
            task_copy = dict(task)
            task_priority = self._normalize_priority(task_copy.get("priority"), plan.get("priority", "Medium"))
            task_copy["priority"] = task_priority
            assignees = list(task_copy.get("assignees", []))

            if not assignees and ranked:
                assignees = [ranked[0]["name"]]

            if task_priority == "High":
                assignees = [
                    name
                    for name in assignees
                    if not rank_lookup.get(str(name), {}).get("deadline_risk")
                ]
                if not assignees:
                    fallback = next((row["name"] for row in ranked if not row.get("deadline_risk")), None)
                    if fallback:
                        assignees = [fallback]
                        alerts.append(
                            f"Risk-aware reassignment: '{task_copy.get('name')}' moved to {fallback} due to deadline risk flag."
                        )

            if int(task_copy.get("duration", 1)) > per_task_budget:
                candidates = [row for row in ranked if row["name"] not in assignees]
                if candidates:
                    replacement = candidates[0]["name"]
                    dropped = assignees[0] if assignees else "unassigned"
                    assignees = [replacement]
                    alerts.append(
                        f"Deadline reassignment: '{task_copy.get('name')}' exceeded budget and was reassigned from {dropped} to {replacement}."
                    )

            task_copy["assignees"] = assignees
            adjusted_tasks.append(task_copy)

        return adjusted_tasks, alerts

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
            "Use the employee workloads to avoid over-allocation, choose relevant tools, and keep the plan realistic. "
            "Every task MUST include priority as High, Medium, or Low based on deadline urgency, skill complexity, and business impact. "
            "Return ONLY JSON and no markdown.\n\n"
            f"Project request:\n{project_description}\n\n"
            f"Parsed project metadata:\n{json.dumps(project_meta, indent=2)}"
        )

        if not self.client:
            base_plan = self._fallback_plan(project_description, project_meta, employees, tools, history)
            tasks, alerts = self.enforce_assignment_rules(base_plan, project_meta["required_skills"], employees, history)
            base_plan["tasks"] = tasks
            base_plan["alerts"] = alerts
            return base_plan

        try:
            response = self.client.chat.completions.create(
                model=self.MODEL_NAME,
                max_tokens=4000,
                temperature=0.2,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = response.choices[0].message.content or "{}"
            plan = self._extract_json(content)
        except Exception:
            base_plan = self._fallback_plan(project_description, project_meta, employees, tools, history)
            tasks, alerts = self.enforce_assignment_rules(base_plan, project_meta["required_skills"], employees, history)
            base_plan["tasks"] = tasks
            base_plan["alerts"] = alerts
            return base_plan

        plan["priority"] = plan.get("priority", project_meta["priority"])
        plan["deadline_days"] = int(plan.get("deadline_days", project_meta["deadline_days"]))
        plan["tasks"] = [
            {
                "name": str(task.get("name", "Unnamed Task")),
                "description": str(task.get("description", "")),
                "assignees": list(task.get("assignees", [])),
                "tools": list(task.get("tools", [])),
                "priority": self._normalize_priority(task.get("priority"), project_meta["priority"]),
                "duration": int(task.get("duration", 1)),
                "tool_recommendations": self.recommend_tools_for_task(
                    project_meta["required_skills"],
                    str(task.get("description", "")),
                    tools,
                ),
            }
            for task in plan.get("tasks", [])
        ]
        plan["tasks"], plan_alerts = self.enforce_assignment_rules(
            plan,
            project_meta["required_skills"],
            employees,
            history,
        )
        plan["alerts"] = plan_alerts
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

    def build_active_assignment_snapshot(
        self,
        employees: list[dict[str, Any]],
        tasks: list[dict[str, Any]],
        project_deadline_days: int,
    ) -> dict[str, list[dict[str, Any]]]:
        assigned_map: dict[str, dict[str, Any]] = {}

        for task in tasks:
            for assignee in task.get("assignees", []) or []:
                if assignee in assigned_map:
                    continue
                assigned_map[assignee] = {
                    "employee_name": assignee,
                    "task_name": task.get("name"),
                    "priority": task.get("priority", "Low"),
                    "estimated_deadline_days": min(project_deadline_days, int(task.get("duration", 1))),
                }

        available = []
        for employee in employees:
            name = str(employee.get("name"))
            if name in assigned_map:
                continue
            available.append(
                {
                    "employee_name": name,
                    "role": employee.get("role"),
                    "current_workload_percent": employee.get("current_workload_percent", 0),
                }
            )

        return {
            "currently_assigned": list(assigned_map.values()),
            "available": available,
        }

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
