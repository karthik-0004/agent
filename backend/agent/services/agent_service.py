from __future__ import annotations

import json
import importlib
import os
import random
import re
from collections import defaultdict
from typing import Any


class AgentService:
    MODEL_NAME = "gpt-4o"
    SPECIAL_USERS = {
        "Akshaya Nuthalapati": "aksh.ayanuthalapati.0523@gmail.com",
        "G. Karthikeyan": "karthikgangaji@gmail.com",
        "Lohitaksh": "lohitaksh@neurax.io",
    }
    _SYSTEM_PROMPT_CACHE = ""
    _SYSTEM_PROMPT_META = {"employees": 0, "tools": 0, "history": 0}
    ROLE_DOMAIN_MAP = {
        "backend": {"backend"},
        "frontend": {"frontend"},
        "ai": {"ai_ml"},
        "data": {"data"},
        "devops": {"devops"},
        "product": {"product"},
        "fullstack": {"backend", "frontend"},
    }

    def __init__(self) -> None:
        self.api_key = os.getenv("OPENAI_API_KEY", "")
        self.client = None
        if self.api_key and self.api_key != "your_key_here":
            try:
                openai_module = importlib.import_module("openai")
                self.client = openai_module.OpenAI(api_key=self.api_key)
            except Exception:
                self.client = None

    @classmethod
    def rebuild_system_prompt(
        cls,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> dict[str, int]:
        cls._SYSTEM_PROMPT_CACHE = (
            "You are Neurax's autonomous workflow orchestrator. Use the complete datasets below to generate an execution plan. "
            "Return ONLY raw JSON with the exact schema requested.\n\n"
            "STRICT RULES:\n"
            "1) Assign each task only to employees whose role directly matches that task's nature.\n"
            "2) Never assign frontend tasks to backend developers, and never backend tasks to frontend developers.\n"
            "3) An employee can be assigned only if the task's required skills are present in that employee's skills list.\n"
            "4) Task names must be project-specific; avoid generic titles.\n"
            "5) Tool recommendations must align with skills of the assigned employee(s).\n"
            "6) Task durations must be proportional to manager deadline.\n"
            "7) Priorities must be reasoned per task by dependency and business impact.\n"
            "8) Every task, assignment, and tool must be traceable to the project request text.\n\n"
            f"Employees dataset:\n{json.dumps(employees, indent=2)}\n\n"
            f"Tools dataset:\n{json.dumps(tools, indent=2)}\n\n"
            f"Project history dataset:\n{json.dumps(history, indent=2)}\n"
        )
        cls._SYSTEM_PROMPT_META = {
            "employees": len(employees),
            "tools": len(tools),
            "history": len(history),
        }
        return dict(cls._SYSTEM_PROMPT_META)

    @classmethod
    def ensure_system_prompt(
        cls,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> str:
        if not cls._SYSTEM_PROMPT_CACHE:
            cls.rebuild_system_prompt(employees, tools, history)
        return cls._SYSTEM_PROMPT_CACHE

    @staticmethod
    def _split_keywords(value: str | None) -> list[str]:
        if not value:
            return []
        return [item.strip().lower() for item in re.split(r"[;,/|]", str(value)) if item.strip()]

    def _skill_token_set(self, value: str | None) -> set[str]:
        base = self._split_keywords(value)
        tokens: set[str] = set()
        for item in base:
            tokenized = self._tokenize_text(item)
            if tokenized:
                tokens.update(tokenized)
            else:
                tokens.add(item.lower())
        return tokens

    @staticmethod
    def _tokenize_text(value: str | None) -> set[str]:
        if not value:
            return set()
        return {token.lower() for token in re.findall(r"[a-zA-Z][a-zA-Z0-9+.#\-]{1,}", str(value))}

    def _infer_domains(self, text: str | None, skills: set[str] | None = None) -> set[str]:
        tokens = self._tokenize_text(text)
        if skills:
            tokens = tokens.union({skill.lower() for skill in skills})
        domains: set[str] = set()

        if tokens.intersection({"backend", "api", "django", "node", "sql", "database", "microservice", "server"}):
            domains.add("backend")
        if tokens.intersection({"frontend", "react", "ui", "ux", "css", "html", "javascript", "typescript", "web"}):
            domains.add("frontend")
        if tokens.intersection({"ai", "ml", "machine", "learning", "llm", "langchain", "model", "nlp", "pytorch", "tensorflow"}):
            domains.add("ai_ml")
        if tokens.intersection({"data", "analytics", "analysis", "pandas", "etl", "warehouse", "bi", "reporting"}):
            domains.add("data")
        if tokens.intersection({"devops", "docker", "kubernetes", "k8s", "deployment", "infrastructure", "terraform", "aws", "azure", "gcp", "cicd"}):
            domains.add("devops")
        if tokens.intersection({"product", "requirements", "roadmap", "planning", "stakeholder", "insights", "analysis"}):
            domains.add("product")

        return domains

    def _role_domains(self, role: str | None) -> set[str]:
        role_lower = str(role or "").lower()
        if "full stack" in role_lower or "fullstack" in role_lower:
            return self.ROLE_DOMAIN_MAP["fullstack"]
        if "backend" in role_lower:
            return self.ROLE_DOMAIN_MAP["backend"]
        if "frontend" in role_lower or "ui" in role_lower:
            return self.ROLE_DOMAIN_MAP["frontend"]
        if "ai" in role_lower or "ml" in role_lower:
            return self.ROLE_DOMAIN_MAP["ai"]
        if "data" in role_lower:
            return self.ROLE_DOMAIN_MAP["data"]
        if "devops" in role_lower or "sre" in role_lower:
            return self.ROLE_DOMAIN_MAP["devops"]
        if "product" in role_lower or "analyst" in role_lower:
            return self.ROLE_DOMAIN_MAP["product"]
        return set()

    def _is_role_compatible(self, role: str | None, task_domains: set[str]) -> bool:
        if not task_domains:
            return True
        role_domains = self._role_domains(role)
        if not role_domains:
            return False
        return bool(role_domains.intersection(task_domains))

    def _is_special_user(self, name: str) -> bool:
        return str(name) in self.SPECIAL_USERS

    def _get_active_assignment_map(self) -> dict[str, str]:
        try:
            from agent.models import TaskBoardProject

            mapping: dict[str, str] = {}
            ongoing = TaskBoardProject.objects.filter(status="ongoing")
            for project in ongoing:
                for member in project.team or []:
                    member_name = str(member.get("name", "")).strip()
                    if member_name:
                        mapping[member_name] = project.project_name
            return mapping
        except Exception:
            return {}

    def _choose_special_user(
        self,
        employees: list[dict[str, Any]],
        reshuffle_token: int,
        avoid_conflicts: bool,
    ) -> dict[str, Any] | None:
        by_name = {str(employee.get("name")): employee for employee in employees}
        existing_specials = [name for name in self.SPECIAL_USERS if name in by_name]
        if not existing_specials:
            return None

        assignment_map = self._get_active_assignment_map()
        available_specials = [
            name
            for name in existing_specials
            if str(by_name[name].get("availability_status", "Available")).lower() == "available"
            and name not in assignment_map
        ]

        if available_specials:
            # Rotation among available special members.
            selected_name = available_specials[reshuffle_token % len(available_specials)]
            return by_name[selected_name]

        if avoid_conflicts:
            return None

        # If all are assigned and conflicts are allowed, rotate among all specials.
        selected_name = existing_specials[reshuffle_token % len(existing_specials)]
        return by_name[selected_name]

    def analyze_project(self, project_description: str, manager_deadline_days: int | None = None) -> dict[str, Any]:
        priority_match = re.search(r"\b(high|medium|low)\b", project_description, re.IGNORECASE)
        deadline_match = re.search(r"(\d+)\s*(?:day|days|week|weeks)", project_description, re.IGNORECASE)

        skill_candidates = set(re.findall(r"[A-Za-z][A-Za-z0-9+.#\-]{2,}", project_description))
        normalized_skills = sorted({token.lower() for token in skill_candidates if token.lower() not in {"with", "that", "this", "from", "days", "week", "weeks", "high", "medium", "low"}})

        deadline_days = 14
        if manager_deadline_days is not None:
            deadline_days = max(1, int(manager_deadline_days))
        elif deadline_match:
            amount = int(deadline_match.group(1))
            unit = deadline_match.group(0).lower()
            deadline_days = amount * 7 if "week" in unit else amount

        return {
            "required_skills": normalized_skills[:12],
            "deadline_days": deadline_days,
            "priority": priority_match.group(1).capitalize() if priority_match else "Medium",
        }

    def calculate_performance_rating(self, employee: dict[str, Any]) -> int:
        explicit_rating = employee.get("rating")
        try:
            if explicit_rating is not None:
                return max(1, min(10, int(float(explicit_rating))))
        except Exception:
            pass

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
        task_domains: set[str] | None = None,
    ) -> tuple[float, list[str], float, int, bool]:
        employee_skills = self._skill_token_set(employee.get("skills"))
        matched_skills = sorted(required_skill_set.intersection(employee_skills))
        workload = float(employee.get("current_workload_percent", 0) or 0)
        capacity = max(0.0, 100.0 - workload)
        rating = self.calculate_performance_rating(employee)
        is_risky = str(employee.get("name")) in risk_flags
        role_fit = self._is_role_compatible(employee.get("role"), task_domains or set())

        if task_domains and not role_fit:
            return -9999.0, matched_skills, capacity, rating, is_risky

        # Role fit is primary; skill/capacity/rating remain secondary.
        role_weight = 220 if role_fit else 0

        score = role_weight + (len(matched_skills) * 18) + (capacity * 0.6) + (rating * 2.5)
        if project_priority.lower() == "high" and is_risky:
            score -= 22

        return score, matched_skills, capacity, rating, is_risky

    def match_employees(
        self,
        required_skills: list[str],
        employees: list[dict[str, Any]],
        project_priority: str = "Medium",
        risk_flags: set[str] | None = None,
        reshuffle_token: int = 0,
        avoid_conflicts: bool = False,
    ) -> list[dict[str, Any]]:
        ranked: list[dict[str, Any]] = []
        required_skill_set: set[str] = set()
        for skill in required_skills:
            tokens = self._tokenize_text(skill)
            if tokens:
                required_skill_set.update(tokens)
            else:
                required_skill_set.add(str(skill).lower())
        risk_flags = risk_flags or set()
        task_domains = self._infer_domains(" ".join(required_skills), required_skill_set)

        selected_special = self._choose_special_user(employees, reshuffle_token, avoid_conflicts)
        selected_special_name = str(selected_special.get("name")) if selected_special else ""
        assignment_map = self._get_active_assignment_map()

        pinned_row: dict[str, Any] | None = None
        for employee in employees:
            employee_name = str(employee.get("name"))
            if self._is_special_user(employee_name):
                if employee_name != selected_special_name:
                    continue
                pinned_row = {
                    "name": employee.get("name"),
                    "role": employee.get("role"),
                    "email": employee.get("email"),
                    "matched_skills": [],
                    "available_capacity": round(max(0.0, 100.0 - float(employee.get("current_workload_percent", 0) or 0)), 2),
                    "performance_rating": self.calculate_performance_rating(employee),
                    "deadline_risk": False,
                    "score": 9999.0,
                }
                continue

            if avoid_conflicts and employee_name in assignment_map:
                continue

            if task_domains and not self._is_role_compatible(employee.get("role"), task_domains):
                continue

            score, matched, capacity, rating, is_risky = self.score_employee(
                employee,
                required_skill_set,
                project_priority,
                risk_flags,
                task_domains,
            )
            row = {
                "name": employee.get("name"),
                "role": employee.get("role"),
                "email": employee.get("email"),
                "matched_skills": matched,
                "available_capacity": round(capacity, 2),
                "performance_rating": rating,
                "deadline_risk": is_risky,
                "score": round(score, 2),
            }
            ranked.append(row)

        ranked = sorted(ranked, key=lambda item: item["score"], reverse=True)

        # Exactly one special user may be pinned to slot 0.
        if pinned_row:
            return [pinned_row, *ranked]

        return ranked

    def _sample_best_matches(
        self,
        ranked: list[dict[str, Any]],
        count: int,
        reshuffle_token: int,
    ) -> list[dict[str, Any]]:
        if count <= 0:
            return []

        if len(ranked) <= count:
            return ranked

        candidate_pool = ranked[: max(count + 3, min(18, len(ranked)))]
        rng = random.Random(reshuffle_token)
        sampled = rng.sample(candidate_pool, k=count)
        sampled_sorted = sorted(sampled, key=lambda item: item.get("score", 0), reverse=True)
        return sampled_sorted

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
        assigned_employee_skills: list[str] | None = None,
    ) -> list[dict[str, str]]:
        description_tokens = set(self._split_keywords(task_description))
        required_skill_set = {skill.lower() for skill in required_skills}
        employee_skill_set = set()
        for skill in assigned_employee_skills or []:
            employee_skill_set.update(self._tokenize_text(skill) or {str(skill).lower()})
        recommendations: list[tuple[int, dict[str, str]]] = []

        for tool in tools:
            supported = set(self._split_keywords(tool.get("supported_skills")))
            purpose = set(self._split_keywords(tool.get("purpose_keywords")))
            if employee_skill_set and not employee_skill_set.intersection(supported | purpose):
                continue
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

    def _refresh_task_tool_recommendations(
        self,
        tasks: list[dict[str, Any]],
        employees: list[dict[str, Any]],
        required_skills: list[str],
        tools: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        employee_map = {str(employee.get("name")): employee for employee in employees}
        refreshed: list[dict[str, Any]] = []
        for task in tasks:
            task_copy = dict(task)
            first_assignee = (task_copy.get("assignees") or [None])[0]
            assignee_skills = sorted(self._skill_token_set(employee_map.get(str(first_assignee), {}).get("skills")))
            task_copy["tool_recommendations"] = self.recommend_tools_for_task(
                required_skills,
                str(task_copy.get("description", "")) + " " + str(task_copy.get("name", "")),
                tools,
                assignee_skills,
            )
            refreshed.append(task_copy)
        return refreshed

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
        reshuffle_token: int = 0,
        avoid_conflicts: bool = False,
    ) -> dict[str, Any]:
        risk_flags = self.identify_deadline_risk_flags(history)
        ranked_employees = self.match_employees(
            project_meta["required_skills"],
            employees,
            project_meta["priority"],
            risk_flags,
            reshuffle_token,
            avoid_conflicts,
        )
        relevant_tools = self.select_tools(project_meta["required_skills"], tools)
        project_name = project_description.split(".")[0][:60].strip() or "Neurax Initiative"
        top_assignees = [employee["name"] for employee in ranked_employees[:3]]
        special_candidates = [name for name in top_assignees if self._is_special_user(name)]
        if special_candidates:
            pinned_name = special_candidates[0]
            top_assignees = [pinned_name] + [name for name in top_assignees if name != pinned_name]

        dominant_domains = self._infer_domains(project_description, set(project_meta["required_skills"]))
        if "frontend" in dominant_domains:
            task_templates = [
                (f"Design {project_name} UI flows", "Define component layouts, screens, and user interactions."),
                (f"Implement {project_name} frontend", "Build responsive React views and interaction handlers."),
                (f"Validate {project_name} user journeys", "Run UX acceptance checks and polish release quality."),
            ]
        elif "backend" in dominant_domains:
            task_templates = [
                (f"Model {project_name} backend APIs", "Define service contracts, schemas, and endpoint behavior."),
                (f"Build {project_name} server workflows", "Implement backend logic, integrations, and persistence."),
                (f"Harden {project_name} backend release", "Test reliability, performance, and deployment readiness."),
            ]
        elif "ai_ml" in dominant_domains:
            task_templates = [
                (f"Define {project_name} AI objectives", "Convert problem statement into measurable model goals."),
                (f"Build {project_name} model pipeline", "Implement prompts/models, evaluation, and orchestration."),
                (f"Validate {project_name} AI quality", "Benchmark outcomes, guardrails, and rollout criteria."),
            ]
        else:
            task_templates = [
                (f"Scope {project_name} delivery", "Break down requirements, dependencies, and milestones."),
                (f"Execute {project_name} implementation", "Build the core solution and integrate required systems."),
                (f"Launch {project_name} with QA", "Test the workflow, document risks, and prepare rollout assets."),
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
                    "tool_recommendations": [],
                }
            )

        return {
            "project_name": project_name,
            "priority": project_meta["priority"],
            "deadline_days": project_meta["deadline_days"],
            "reasoning": "Fallback planner used because OpenAI credentials were unavailable or the model response could not be parsed.",
            "tasks": self._refresh_task_tool_recommendations(tasks, employees, project_meta["required_skills"], tools),
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
        eligible_team: list[str] | None = None,
    ) -> tuple[list[dict[str, Any]], list[str]]:
        alerts: list[str] = []
        risk_flags = self.identify_deadline_risk_flags(history)
        ranked = self.match_employees(required_skills, employees, plan.get("priority", "Medium"), risk_flags)
        rank_lookup = {str(item["name"]): item for item in ranked}
        employee_map = {str(employee.get("name")): employee for employee in employees}
        eligible_set = set(eligible_team or [])

        adjusted_tasks: list[dict[str, Any]] = []
        per_task_budget = max(1, int(plan.get("deadline_days", 14) / max(1, len(plan.get("tasks", [])))))

        for task in plan.get("tasks", []):
            task_copy = dict(task)
            task_priority = self._normalize_priority(task_copy.get("priority"), plan.get("priority", "Medium"))
            task_copy["priority"] = task_priority
            assignees = list(task_copy.get("assignees", []))
            task_text = f"{task_copy.get('name', '')} {task_copy.get('description', '')}"
            task_tokens = self._tokenize_text(task_text)
            task_domains = self._infer_domains(task_text, task_tokens)

            if eligible_set:
                assignees = [name for name in assignees if name in eligible_set]

            # Hard boundary: role compatibility is mandatory.
            if task_domains:
                assignees = [
                    name for name in assignees
                    if self._is_role_compatible(employee_map.get(str(name), {}).get("role"), task_domains)
                ]

            # Skills list is contract: assignee must have overlap with task tokens.
            if task_tokens:
                assignees = [
                    name for name in assignees
                    if self._skill_token_set(employee_map.get(str(name), {}).get("skills")).intersection(task_tokens)
                ]

            if not assignees and ranked:
                for candidate in ranked:
                    candidate_name = candidate["name"]
                    if eligible_set and candidate_name not in eligible_set:
                        continue
                    candidate_role = employee_map.get(candidate_name, {}).get("role")
                    if task_domains and not self._is_role_compatible(candidate_role, task_domains):
                        continue
                    candidate_skills = self._skill_token_set(employee_map.get(candidate_name, {}).get("skills"))
                    if task_tokens and not candidate_skills.intersection(task_tokens):
                        continue
                    assignees = [candidate_name]
                    break

            if task_priority == "High":
                assignees = [
                    name
                    for name in assignees
                    if not rank_lookup.get(str(name), {}).get("deadline_risk")
                ]
                if not assignees:
                    fallback = next(
                        (
                            row["name"]
                            for row in ranked
                            if not row.get("deadline_risk") and (not eligible_set or row["name"] in eligible_set)
                        ),
                        None,
                    )
                    if fallback:
                        assignees = [fallback]
                        alerts.append(
                            f"Risk-aware reassignment: '{task_copy.get('name')}' moved to {fallback} due to deadline risk flag."
                        )

            if int(task_copy.get("duration", 1)) > per_task_budget:
                candidates = [
                    row
                    for row in ranked
                    if row["name"] not in assignees and (not eligible_set or row["name"] in eligible_set)
                ]
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

    def select_assigned_team(
        self,
        required_skills: list[str],
        employees: list[dict[str, Any]],
        history: list[dict[str, Any]],
        project_priority: str,
        team_size: int,
        reshuffle_token: int = 0,
        avoid_conflicts: bool = False,
    ) -> list[dict[str, Any]]:
        risk_flags = self.identify_deadline_risk_flags(history)
        ranked = self.match_employees(
            required_skills,
            employees,
            project_priority,
            risk_flags,
            reshuffle_token,
            avoid_conflicts,
        )

        pinned = next((row for row in ranked if self._is_special_user(str(row.get("name")))), None)
        others = [row for row in ranked if not self._is_special_user(str(row.get("name")))]
        remaining_slots = max(0, team_size - 1)

        chosen = []
        if pinned:
            chosen.append(pinned)

        if team_size == 1:
            chosen = chosen[:1]
        else:
            chosen.extend(self._sample_best_matches(others, remaining_slots, reshuffle_token))

        chosen = chosen[:team_size]

        employee_map = {str(employee.get("name")): employee for employee in employees}
        payload = []
        for row in chosen:
            employee = employee_map.get(str(row.get("name")), {})
            payload.append(
                {
                    "name": row.get("name"),
                    "email": row.get("email") or employee.get("email"),
                    "role": row.get("role") or employee.get("role"),
                    "availability_status": employee.get("availability_status", "Available"),
                    "current_workload_percent": employee.get("current_workload_percent", 0),
                    "performance_rating": row.get("performance_rating", self.calculate_performance_rating(employee)),
                }
            )

        if payload and not self._is_special_user(str(payload[0].get("name"))):
            special_employee = self._choose_special_user(employees, reshuffle_token, avoid_conflicts)
            if special_employee:
                payload.insert(
                    0,
                    {
                        "name": special_employee.get("name"),
                        "email": special_employee.get("email"),
                        "role": special_employee.get("role"),
                        "availability_status": special_employee.get("availability_status", "Available"),
                        "current_workload_percent": special_employee.get("current_workload_percent", 0),
                        "performance_rating": int(special_employee.get("rating", 9)),
                    },
                )
                payload = payload[:team_size]

        if not payload:
            special_employee = self._choose_special_user(employees, reshuffle_token, avoid_conflicts)
            if special_employee and team_size > 0:
                payload = [
                    {
                        "name": special_employee.get("name"),
                        "email": special_employee.get("email"),
                        "role": special_employee.get("role"),
                        "availability_status": special_employee.get("availability_status", "Available"),
                        "current_workload_percent": special_employee.get("current_workload_percent", 0),
                        "performance_rating": int(special_employee.get("rating", 9)),
                    }
                ]

        if payload:
            first_special = next((member for member in payload if self._is_special_user(str(member.get("name")))), None)
            if first_special:
                payload = [first_special] + [member for member in payload if member is not first_special and not self._is_special_user(str(member.get("name")))]
            else:
                payload = [member for member in payload if not self._is_special_user(str(member.get("name")))]
            payload = payload[:team_size]

        return payload

    def decompose_tasks(
        self,
        project_description: str,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
        team_size: int = 3,
        deadline_days: int | None = None,
        reshuffle_token: int = 0,
        avoid_conflicts: bool = False,
    ) -> dict[str, Any]:
        project_meta = self.analyze_project(project_description, deadline_days)
        system_prompt = self.ensure_system_prompt(employees, tools, history)
        user_prompt = (
            "Analyze the following project request and produce a plan using the exact JSON schema. "
            "Use the employee workloads to avoid over-allocation, choose relevant tools, and keep the plan realistic. "
            "STRICT: assign each task only to role-compatible employees. Never cross-assign backend/frontend roles. "
            "STRICT: only assign work if required skills appear in assignee skills lists. "
            "STRICT: task names must be specific to this request, not generic templates. "
            "STRICT: tools must align with assigned employee skills. "
            "STRICT: task durations must be proportional to manager deadline. "
            "Every task MUST include priority as High, Medium, or Low based on dependency and business impact. "
            "Return ONLY JSON and no markdown.\n\n"
            f"Project request:\n{project_description}\n\n"
            f"Parsed project metadata:\n{json.dumps(project_meta, indent=2)}"
        )

        if not self.client:
            base_plan = self._fallback_plan(
                project_description,
                project_meta,
                employees,
                tools,
                history,
                reshuffle_token,
                avoid_conflicts,
            )
            assigned_team = self.select_assigned_team(
                project_meta["required_skills"],
                employees,
                history,
                project_meta["priority"],
                team_size,
                reshuffle_token,
                avoid_conflicts,
            )
            tasks, alerts = self.enforce_assignment_rules(
                base_plan,
                project_meta["required_skills"],
                employees,
                history,
                [member["name"] for member in assigned_team],
            )
            base_plan["tasks"] = tasks
            base_plan["tasks"] = self._refresh_task_tool_recommendations(
                base_plan["tasks"],
                employees,
                project_meta["required_skills"],
                tools,
            )
            base_plan["alerts"] = alerts
            base_plan["assigned_team"] = assigned_team
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
            base_plan = self._fallback_plan(
                project_description,
                project_meta,
                employees,
                tools,
                history,
                reshuffle_token,
                avoid_conflicts,
            )
            assigned_team = self.select_assigned_team(
                project_meta["required_skills"],
                employees,
                history,
                project_meta["priority"],
                team_size,
                reshuffle_token,
                avoid_conflicts,
            )
            tasks, alerts = self.enforce_assignment_rules(
                base_plan,
                project_meta["required_skills"],
                employees,
                history,
                [member["name"] for member in assigned_team],
            )
            base_plan["tasks"] = tasks
            base_plan["tasks"] = self._refresh_task_tool_recommendations(
                base_plan["tasks"],
                employees,
                project_meta["required_skills"],
                tools,
            )
            base_plan["alerts"] = alerts
            base_plan["assigned_team"] = assigned_team
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
        assigned_team = self.select_assigned_team(
            project_meta["required_skills"],
            employees,
            history,
            plan.get("priority", project_meta["priority"]),
            team_size,
            reshuffle_token,
            avoid_conflicts,
        )
        plan["tasks"], plan_alerts = self.enforce_assignment_rules(
            plan,
            project_meta["required_skills"],
            employees,
            history,
            [member["name"] for member in assigned_team],
        )
        plan["tasks"] = self._refresh_task_tool_recommendations(
            plan["tasks"],
            employees,
            project_meta["required_skills"],
            tools,
        )
        plan["alerts"] = plan_alerts
        plan["assigned_team"] = assigned_team
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

    def detect_conflicts(self, assigned_team: list[dict[str, Any]]) -> list[dict[str, str]]:
        assignment_map = self._get_active_assignment_map()
        conflicts: list[dict[str, str]] = []
        for member in assigned_team:
            name = str(member.get("name", ""))
            if not name:
                continue
            current_project = assignment_map.get(name)
            if not current_project:
                continue
            conflicts.append(
                {
                    "name": name,
                    "project_name": current_project,
                }
            )
        return conflicts

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

    def _complexity_level(self, deadline_days: int, skill_count: int) -> str:
        if deadline_days <= 10 or skill_count >= 8:
            return "High"
        if deadline_days <= 21 or skill_count >= 5:
            return "Medium"
        return "Low"

    def _role_names_from_domains(self, domains: set[str]) -> list[str]:
        role_map = {
            "backend": "Backend Developer",
            "frontend": "Frontend Developer",
            "ai_ml": "AI Engineer",
            "data": "Data Scientist",
            "devops": "DevOps Engineer",
            "product": "Product Analyst",
        }
        return [role_map[domain] for domain in domains if domain in role_map]

    def _fallback_custom_analysis(
        self,
        mission_title: str,
        mission_description: str,
        deadline_days: int,
        tools: list[dict[str, Any]],
    ) -> dict[str, Any]:
        text = f"{mission_title} {mission_description}"
        tokens = sorted(self._tokenize_text(text))
        skills = [token for token in tokens if token not in {"project", "build", "system", "team", "delivery", "mission"}][:12]
        if not skills:
            skills = ["python", "api", "testing"]
        domains = self._infer_domains(text, set(skills))
        roles = self._role_names_from_domains(domains) or ["Full Stack Developer"]
        return {
            "required_skills": skills,
            "required_roles": roles,
            "recommended_tools": self.select_tools(skills, tools),
            "complexity": self._complexity_level(deadline_days, len(skills)),
            "key_risks": [
                "Timeline risk due to delivery dependencies",
                "Role coverage risk if specialist availability is limited",
            ],
        }

    def analyze_custom_mission(
        self,
        mission_title: str,
        mission_description: str,
        team_size: int,
        deadline_days: int,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        fallback = self._fallback_custom_analysis(mission_title, mission_description, deadline_days, tools)
        analysis = dict(fallback)

        if self.client:
            prompt = (
                "Extract structured planning signals for a new software mission. Return ONLY JSON with keys: "
                "required_skills (array), required_roles (array), recommended_tools (array), complexity (Low|Medium|High), key_risks (array). "
                "Rules: keep skills specific and technical; roles must align to mission requirements; complexity must reflect scope and deadline.\n\n"
                f"Mission title: {mission_title}\n"
                f"Mission description: {mission_description}\n"
                f"Deadline days: {deadline_days}\n"
                f"Known tools dataset:\n{json.dumps(tools, indent=2)}"
            )
            try:
                response = self.client.chat.completions.create(
                    model=self.MODEL_NAME,
                    max_tokens=1000,
                    temperature=0.1,
                    messages=[
                        {"role": "system", "content": "You are a strict mission analysis engine. Return only valid JSON."},
                        {"role": "user", "content": prompt},
                    ],
                )
                parsed = self._extract_json(response.choices[0].message.content or "{}")
                if isinstance(parsed, dict):
                    analysis["required_skills"] = [str(item).lower() for item in parsed.get("required_skills", analysis["required_skills"])][:16]
                    analysis["required_roles"] = [str(item) for item in parsed.get("required_roles", analysis["required_roles"])][:8]
                    analysis["recommended_tools"] = [str(item) for item in parsed.get("recommended_tools", analysis["recommended_tools"])][:8]
                    analysis["complexity"] = str(parsed.get("complexity", analysis["complexity"]))
                    analysis["key_risks"] = [str(item) for item in parsed.get("key_risks", analysis["key_risks"])][:8]
            except Exception:
                pass

        risk_flags = self.identify_deadline_risk_flags(history)
        ranked = self.match_employees(
            analysis.get("required_skills", []),
            employees,
            "High" if analysis.get("complexity", "Medium").lower() == "high" else "Medium",
            risk_flags,
            reshuffle_token=0,
            avoid_conflicts=False,
        )
        top_matches = []
        for row in ranked[: max(5, team_size)]:
            pct = int(max(40, min(99, round(float(row.get("score", 0)) / 3))))
            top_matches.append(
                {
                    "name": row.get("name"),
                    "role": row.get("role"),
                    "email": row.get("email"),
                    "match_percentage": pct,
                    "matched_skills": row.get("matched_skills", []),
                }
            )

        return {
            **analysis,
            "top_matches": top_matches,
            "team_size": team_size,
            "deadline_days": deadline_days,
        }

    def build_custom_mission_plan(
        self,
        mission_title: str,
        mission_description: str,
        extracted: dict[str, Any],
        team_size: int,
        deadline_days: int,
        employees: list[dict[str, Any]],
        tools: list[dict[str, Any]],
        history: list[dict[str, Any]],
    ) -> dict[str, Any]:
        required_skills = [str(skill).lower() for skill in extracted.get("required_skills", [])]
        required_roles = [str(role) for role in extracted.get("required_roles", [])]
        enrichment = (
            f"Mission title: {mission_title}\n"
            f"Mission description: {mission_description}\n"
            f"Required skills (from stage 1): {', '.join(required_skills)}\n"
            f"Required roles (from stage 1): {', '.join(required_roles)}\n"
            "Strictly enforce role-task compatibility and skills contract."
        )
        plan = self.decompose_tasks(
            enrichment,
            employees,
            tools,
            history,
            team_size=team_size,
            deadline_days=deadline_days,
            reshuffle_token=0,
            avoid_conflicts=False,
        )
        plan["project_name"] = mission_title
        plan["deadline_days"] = deadline_days
        plan["is_custom_mission"] = True
        plan["analysis"] = extracted
        return plan
