from __future__ import annotations

import re
from pathlib import Path
from threading import Lock
from typing import Any

import pandas as pd

BACKEND_DATA_DIR = Path(__file__).resolve().parents[2] / "data"
ROOT_DATASETS_DIR = Path(__file__).resolve().parents[3] / "datasets"
DATA_DIRECTORIES = [BACKEND_DATA_DIR, ROOT_DATASETS_DIR]
DATA_FILE_CANDIDATES = {
    "employees": ["neurax_employees_v2.xlsx", "neurax_employees_v2.csv", "neurax_employees_dataset.csv"],
    "projects": ["neurax_projects_v2.xlsx", "neurax_projects_v2.csv", "neurax_projects_dataset.csv"],
    "history": ["neurax_project_history_v2.xlsx", "neurax_project_history_v2.csv", "neurax_project_history_dataset.csv"],
    "tools": ["neurax_tools_v2.xlsx", "neurax_tools_v2.csv", "neurax_tools_dataset.csv"],
}
DEFAULT_DATASET_OUTPUT_FILES = {
    "employees": "neurax_employees_v2.csv",
    "projects": "neurax_projects_v2.csv",
    "history": "neurax_project_history_v2.csv",
    "tools": "neurax_tools_v2.csv",
}

_DATA_CACHE: dict[str, list[dict[str, Any]]] = {}
_DATA_SOURCE_PATHS: dict[str, Path] = {}
_CACHE_LOCK = Lock()

SPECIAL_PROFILES = [
{
    "employee_id": "EMP-001",
    "name": "Akshaya Nuthalapati",
    "email": "aksh.ayanuthalapati.0523@gmail.com",
    "role": "Full Stack Developer",
    "skills": "python, react, django, api design, sql, system design, node.js, aws",
    "current_workload_percent": 38,
    "location": "Chennai, India",
    "availability_status": "Available",
    "rating": 9,
},
{
    "employee_id": "EMP-002",
    "name": "G. Karthikeyan",
    "email": "karthikgangaji@gmail.com",
    "role": "Full Stack Developer",
    "skills": "python, react, django, api design, sql, system design, node.js, aws",
    "current_workload_percent": 38,
    "location": "Chennai, India",
    "availability_status": "Available",
    "rating": 9,
},
{
    "employee_id": "EMP-003",
    "name": "Lohitaksh",
    "email": "lohitaksh@neurax.io",
    "role": "Software Engineer",
    "skills": "python, react, django, sql, api design",
    "current_workload_percent": 34,
    "location": "India",
    "availability_status": "Available",
    "rating": 8,
},
]

SPECIAL_NAME_ALIASES = {
    "akshaya": "Akshaya Nuthalapati",
    "g karthikeyan": "G. Karthikeyan",
    "karthikeyan": "G. Karthikeyan",
}


def _normalize_key(key: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9]+", "_", str(key).strip().lower())
    return re.sub(r"_+", "_", normalized).strip("_")


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        canonical_key = _normalize_key(str(key))
        if pd.isna(value):
            normalized[canonical_key] = None
        elif isinstance(value, str):
            normalized[canonical_key] = value.strip()
        elif isinstance(value, float) and value.is_integer():
            normalized[canonical_key] = int(value)
        else:
            normalized[canonical_key] = value
    return normalized


def _string(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    return str(value).strip()


def _int(value: Any, fallback: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return fallback


def _slug_email_part(value: str) -> str:
    lowered = value.strip().lower()
    lowered = re.sub(r"[^a-z0-9]+", ".", lowered)
    lowered = re.sub(r"\.+", ".", lowered).strip(".")
    return lowered or "employee"


def _email_from_name(name: str) -> str:
    name = name.strip()
    if not name:
        return "employee@neurax.io"
    parts = [part for part in re.split(r"\s+", name.replace(".", " ")) if part]
    if len(parts) == 1:
        return f"{_slug_email_part(parts[0])}@neurax.io"
    return f"{_slug_email_part(parts[0])}.{_slug_email_part(parts[-1])}@neurax.io"


def _canonicalize_employee(record: dict[str, Any]) -> dict[str, Any]:
    employee_name = _string(record.get("name") or record.get("employee_name"))
    normalized_name = re.sub(r"[^a-z0-9]+", " ", employee_name.lower()).strip()
    employee_name = SPECIAL_NAME_ALIASES.get(normalized_name, employee_name)
    email_value = _string(record.get("email") or record.get("email_address"))
    if not email_value:
        if employee_name.lower() == "akshaya nuthalapati":
            email_value = "aksh.ayanuthalapati.0523@gmail.com"
        else:
            email_value = _email_from_name(employee_name)

    rating_value = _int(record.get("rating") or record.get("performance_score") or 0)
    if rating_value <= 0:
        rating_value = 7

    return {
        **record,
        "employee_id": _string(record.get("employee_id") or record.get("id") or record.get("emp_id")),
        "name": employee_name,
        "email": email_value,
        "role": _string(record.get("role") or record.get("job_title")),
        "location": _string(record.get("location") or record.get("office") or "N/A"),
        "skills": _string(record.get("skills") or record.get("skill_set") or ""),
        "current_workload_percent": _int(record.get("current_workload_percent") or record.get("workload_percent") or 0),
        "availability_status": _string(record.get("availability_status") or "Available"),
        "rating": max(1, min(10, rating_value)),
        "source": _string(record.get("source") or "imported"),
        "is_outreach": bool(record.get("is_outreach", False)),
        "outreach_project_id": _int(record.get("outreach_project_id") or 0),
        "rate_per_day": float(record.get("rate_per_day") or 0) if _string(record.get("rate_per_day")) else None,
        "notes": _string(record.get("notes") or ""),
    }


def _canonicalize_project(record: dict[str, Any]) -> dict[str, Any]:
    priority_value = _string(record.get("priority") or "Medium")
    if priority_value.lower() == "critical":
        priority_value = "High"

    return {
        **record,
        "project_id": _string(record.get("project_id") or record.get("id")),
        "project_name": _string(record.get("project_name") or record.get("name") or "Unnamed Project"),
        "description": _string(record.get("description") or ""),
        "required_skills": _string(record.get("required_skills") or record.get("skills") or ""),
        "deadline_days": _int(record.get("deadline_days") or 14),
        "priority": priority_value.capitalize() if priority_value else "Medium",
        "status": _string(record.get("status") or "Open"),
        "source": _string(record.get("source") or "imported"),
    }


def _canonicalize_tool(record: dict[str, Any]) -> dict[str, Any]:
    return {
        **record,
        "tool_id": _string(record.get("tool_id") or record.get("id")),
        "name": _string(record.get("name") or record.get("tool_name") or "Unnamed Tool"),
        "category": _string(record.get("category") or record.get("tool_type") or "General"),
        "purpose_keywords": _string(record.get("purpose_keywords") or record.get("purpose") or ""),
        "supported_skills": _string(record.get("supported_skills") or record.get("supported_languages") or ""),
        "source": _string(record.get("source") or "imported"),
    }


def _canonicalize_history(record: dict[str, Any]) -> dict[str, Any]:
    outcome = _string(record.get("outcomes") or record.get("outcome") or "Unknown")
    outcome_badge = "Successful"
    if any(term in outcome.lower() for term in ["partial", "mixed"]):
        outcome_badge = "Partial"
    if any(term in outcome.lower() for term in ["failed", "fail", "unsuccessful"]):
        outcome_badge = "Failed"

    return {
        **record,
        "history_id": _string(record.get("history_id") or record.get("id")),
        "project_id": _string(record.get("project_id") or ""),
        "project_name": _string(record.get("project_name") or "Past Project"),
        "summary": _string(record.get("lessons_learned") or record.get("summary") or ""),
        "team_members": _string(record.get("team_members") or ""),
        "tools_used": _string(record.get("tools_used") or ""),
        "outcome": outcome_badge,
        "on_time": bool(record.get("on_time", False)),
        "planned_days": _int(record.get("planned_days") or 0),
        "duration_days": _int(record.get("duration_days") or 0),
        "source": _string(record.get("source") or "imported"),
    }


def _canonicalize_dataset(dataset_name: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if dataset_name == "employees":
        return [_canonicalize_employee(record) for record in records if _canonicalize_employee(record).get("name")]
    if dataset_name == "projects":
        return [_canonicalize_project(record) for record in records if _canonicalize_project(record).get("project_name")]
    if dataset_name == "tools":
        return [_canonicalize_tool(record) for record in records if _canonicalize_tool(record).get("name")]
    if dataset_name == "history":
        return [_canonicalize_history(record) for record in records if _canonicalize_history(record).get("project_name")]
    return records


def _ensure_special_records(employees: list[dict[str, Any]]) -> list[dict[str, Any]]:
    special_names = {_string(profile.get("name")).lower() for profile in SPECIAL_PROFILES}
    by_name = {
        _string(employee.get("name")).lower(): _canonicalize_employee(employee)
        for employee in employees
        if _string(employee.get("name"))
    }

    special_records = []
    for profile in SPECIAL_PROFILES:
        profile_name = _string(profile.get("name")).lower()
        existing = by_name.get(profile_name)
        if existing:
            merged = dict(_canonicalize_employee(profile))
            merged.update(existing)
            # Keep canonical id and required pinned email for Akshaya.
            merged["employee_id"] = profile["employee_id"]
            merged["source"] = "manual"
            if profile_name == "akshaya nuthalapati":
                merged["email"] = "aksh.ayanuthalapati.0523@gmail.com"
            special_records.append(merged)
        else:
            special = _canonicalize_employee(profile)
            special["source"] = "manual"
            special_records.append(special)

    non_special = []
    seen_names: set[str] = set()
    for employee in employees:
        name = _string(employee.get("name")).lower()
        if name in special_names:
            continue
        if name in seen_names:
            continue
        seen_names.add(name)
        if not _string(employee.get("source")):
            employee["source"] = "imported"
        non_special.append(employee)

    ordered = [*special_records, *non_special]
    for index, employee in enumerate(ordered, start=1):
        if _string(employee.get("name")).lower() in special_names:
            profile = next(
                (item for item in SPECIAL_PROFILES if _string(item.get("name")).lower() == _string(employee.get("name")).lower()),
                None,
            )
            if profile:
                employee["employee_id"] = profile["employee_id"]
            continue
        employee_id = _string(employee.get("employee_id"))
        if not employee_id or employee_id == "EMP-001":
            employee["employee_id"] = f"EMP-{index:03d}"
    return ordered


def _clear_cache() -> None:
    _DATA_CACHE.clear()
    _DATA_SOURCE_PATHS.clear()


def reload_data() -> dict[str, list[dict[str, Any]]]:
    with _CACHE_LOCK:
        _clear_cache()
    return preload_data()


def force_reload() -> dict[str, list[dict[str, Any]]]:
    return reload_data()


def _load_dataset(file_path: Path) -> list[dict[str, Any]]:
    if file_path.suffix.lower() in {".xlsx", ".xls"}:
        dataframe = pd.read_excel(file_path)
    else:
        try:
            dataframe = pd.read_csv(file_path)
        except Exception:
            dataframe = pd.read_csv(file_path, engine="python", on_bad_lines="skip")
    return [_normalize_record(record) for record in dataframe.to_dict(orient="records")]


def _load_first_available_dataset(dataset_name: str) -> list[dict[str, Any]]:
    errors: list[str] = []
    for data_dir in DATA_DIRECTORIES:
        for candidate in DATA_FILE_CANDIDATES[dataset_name]:
            candidate_path = data_dir / candidate
            if not candidate_path.exists():
                continue
            try:
                loaded = _load_dataset(candidate_path)
                _DATA_SOURCE_PATHS[dataset_name] = candidate_path
                return _canonicalize_dataset(dataset_name, loaded)
            except Exception as error:
                errors.append(f"{candidate_path.name}: {error}")
                continue

    if errors:
        raise ValueError(
            f"Failed to load dataset '{dataset_name}'. Tried files with errors: {' | '.join(errors)}"
        )

    raise FileNotFoundError(
        f"No dataset file found for '{dataset_name}'. Expected one of: {', '.join(DATA_FILE_CANDIDATES[dataset_name])}"
    )


def preload_data() -> dict[str, list[dict[str, Any]]]:
    with _CACHE_LOCK:
        if _DATA_CACHE:
            return _DATA_CACHE
        for dataset_name in DATA_FILE_CANDIDATES:
            _DATA_CACHE[dataset_name] = _load_first_available_dataset(dataset_name)
        _DATA_CACHE["employees"] = _ensure_special_records(_DATA_CACHE.get("employees", []))
        return _DATA_CACHE


def get_datasets() -> dict[str, list[dict[str, Any]]]:
    return preload_data()


def get_employees() -> list[dict[str, Any]]:
    return get_datasets()["employees"]


def get_projects() -> list[dict[str, Any]]:
    return get_datasets()["projects"]


def add_project(payload: dict[str, Any]) -> dict[str, Any]:
    projects = get_projects()
    new_record = _canonicalize_project(payload)
    new_record["source"] = _string(payload.get("source") or "manual")
    projects.append(new_record)
    persist_dataset("projects", projects)
    with _CACHE_LOCK:
        _DATA_CACHE["projects"] = projects
    return new_record


def get_tools() -> list[dict[str, Any]]:
    return get_datasets()["tools"]


def get_history() -> list[dict[str, Any]]:
    return get_datasets()["history"]


def _employees_output_path() -> Path:
    source = _DATA_SOURCE_PATHS.get("employees")
    if source and source.exists():
        return source
    return BACKEND_DATA_DIR / "neurax_employees_v2.csv"


def _dataset_output_path(dataset_name: str) -> Path:
    source = _DATA_SOURCE_PATHS.get(dataset_name)
    if source and source.exists():
        return source
    return BACKEND_DATA_DIR / DEFAULT_DATASET_OUTPUT_FILES[dataset_name]


def _persist_employees() -> None:
    output_path = _employees_output_path()
    dataframe = pd.DataFrame(get_employees())
    if output_path.suffix.lower() in {".xlsx", ".xls"}:
        dataframe.to_excel(output_path, index=False)
    else:
        dataframe.to_csv(output_path, index=False)


def persist_dataset(dataset_name: str, records: list[dict[str, Any]]) -> None:
    output_path = _dataset_output_path(dataset_name)
    dataframe = pd.DataFrame(records)
    if output_path.suffix.lower() in {".xlsx", ".xls"}:
        dataframe.to_excel(output_path, index=False)
    else:
        dataframe.to_csv(output_path, index=False)


def _next_employee_id() -> str:
    employees = get_employees()
    max_index = 0
    for employee in employees:
        match = re.search(r"(\d+)$", _string(employee.get("employee_id"), ""))
        if match:
            max_index = max(max_index, int(match.group(1)))
    return f"EMP-{max_index + 1:03d}"


def replace_dataset(dataset_name: str, records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    canonical = _canonicalize_dataset(dataset_name, records)
    if dataset_name == "employees":
        canonical = _ensure_special_records(canonical)
    with _CACHE_LOCK:
        _DATA_CACHE[dataset_name] = canonical
    persist_dataset(dataset_name, canonical)
    return canonical


def replace_all_datasets(payload: dict[str, list[dict[str, Any]]]) -> dict[str, list[dict[str, Any]]]:
    replaced: dict[str, list[dict[str, Any]]] = {}
    for dataset_name in DATA_FILE_CANDIDATES:
        replaced[dataset_name] = replace_dataset(dataset_name, payload.get(dataset_name, []))
    return replaced


def add_employee(payload: dict[str, Any]) -> dict[str, Any]:
    employees = get_employees()
    new_record = _canonicalize_employee(payload)
    new_record["source"] = "manual"
    new_record["is_outreach"] = False
    new_record["outreach_project_id"] = 0
    if not new_record.get("employee_id"):
        new_record["employee_id"] = _next_employee_id()
    if not new_record.get("availability_status"):
        new_record["availability_status"] = "Available"
    employees.append(new_record)
    employees[:] = _ensure_special_records(employees)
    _persist_employees()
    with _CACHE_LOCK:
        _DATA_CACHE["employees"] = employees
    return new_record


def update_employee(employee_id: str, payload: dict[str, Any]) -> dict[str, Any] | None:
    employees = get_employees()
    for index, employee in enumerate(employees):
        if _string(employee.get("employee_id")) != employee_id:
            continue
        merged = dict(employee)
        merged.update(payload)
        canonical = _canonicalize_employee(merged)
        canonical["employee_id"] = employee_id
        canonical["source"] = "manual"
        employees[index] = canonical
        employees[:] = _ensure_special_records(employees)
        _persist_employees()
        with _CACHE_LOCK:
            _DATA_CACHE["employees"] = employees
        return canonical
    return None


def delete_employee(employee_id: str) -> bool:
    employees = get_employees()
    original_count = len(employees)
    employees[:] = [employee for employee in employees if _string(employee.get("employee_id")) != employee_id]
    if len(employees) == original_count:
        return False
    employees[:] = _ensure_special_records(employees)
    _persist_employees()
    with _CACHE_LOCK:
        _DATA_CACHE["employees"] = employees
    return True


def get_special_employee_names() -> set[str]:
    return {_string(profile.get("name")) for profile in SPECIAL_PROFILES}


def add_outreach_employee(payload: dict[str, Any]) -> dict[str, Any]:
    employees = get_employees()
    new_record = _canonicalize_employee(payload)
    new_record["source"] = "outreach"
    new_record["is_outreach"] = True
    new_record["availability_status"] = "Assigned"
    if not new_record.get("employee_id"):
        new_record["employee_id"] = _next_employee_id()
    employees.append(new_record)
    employees[:] = _ensure_special_records(employees)
    _persist_employees()
    with _CACHE_LOCK:
        _DATA_CACHE["employees"] = employees
    return new_record


def delete_outreach_employee(employee_id: str, outreach_project_id: int | None = None) -> dict[str, Any] | None:
    employees = get_employees()
    removed: dict[str, Any] | None = None
    retained: list[dict[str, Any]] = []

    for employee in employees:
        is_match = _string(employee.get("employee_id")) == _string(employee_id)
        if not is_match:
            retained.append(employee)
            continue
        if not bool(employee.get("is_outreach")):
            retained.append(employee)
            continue
        if outreach_project_id is not None and _int(employee.get("outreach_project_id")) != outreach_project_id:
            retained.append(employee)
            continue
        removed = dict(employee)

    if not removed:
        return None

    retained[:] = _ensure_special_records(retained)
    employees[:] = retained
    _persist_employees()
    with _CACHE_LOCK:
        _DATA_CACHE["employees"] = employees
    return removed


def delete_outreach_employees_for_project(project_id: int) -> list[dict[str, Any]]:
    employees = get_employees()
    removed: list[dict[str, Any]] = []
    retained: list[dict[str, Any]] = []

    for employee in employees:
        if bool(employee.get("is_outreach")) and _int(employee.get("outreach_project_id")) == int(project_id):
            removed.append(dict(employee))
            continue
        retained.append(employee)

    if not removed:
        return []

    retained[:] = _ensure_special_records(retained)
    employees[:] = retained
    _persist_employees()
    with _CACHE_LOCK:
        _DATA_CACHE["employees"] = employees
    return removed
