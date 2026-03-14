from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from io import BytesIO
from threading import Lock
from typing import Any

import pandas as pd

from .agent_service import AgentService
from .data_loader import (
    force_reload,
    get_datasets,
    get_special_employee_names,
    replace_all_datasets,
)

try:
    import pdfplumber  # type: ignore[import-not-found]
except Exception:
    pdfplumber = None

MAX_FILE_SIZE = 50 * 1024 * 1024
MAX_ROWS = 10_000

SUPPORTED_FORMATS = {".csv", ".xlsx", ".xls", ".tsv", ".pdf", ".txt", ".json"}

DATASET_FIELDS = {
    "employees": ["name", "role", "skills", "current_workload_percent", "experience_years", "email", "location", "rating", "employee_id", "source"],
    "projects": ["project_name", "description", "required_skills", "deadline_days", "priority", "source"],
    "tools": ["name", "category", "purpose_keywords", "supported_skills", "source"],
    "history": ["project_name", "outcome", "tools_used", "team_members", "duration_days", "source"],
}

COLUMN_MAP = {
    "employees": {
        "name": {"name", "employee_name", "full_name", "staff_name"},
        "role": {"role", "designation", "position", "job_title"},
        "skills": {"skills", "skill_set", "expertise", "tech_stack"},
        "current_workload_percent": {"current_workload_percent", "workload", "utilization", "workload_percent"},
        "experience_years": {"experience_years", "experience", "years", "exp"},
        "email": {"email", "email_address", "contact_email", "mail"},
        "location": {"location", "city", "office", "base_location"},
        "employee_id": {"employee_id", "emp_id", "id"},
    },
    "projects": {
        "project_name": {"project_name", "name", "title"},
        "description": {"description", "desc", "details", "overview"},
        "required_skills": {"required_skills", "skills_needed", "tech_stack", "skills"},
        "deadline_days": {"deadline_days", "deadline", "duration", "days"},
        "priority": {"priority", "urgency", "importance"},
    },
    "tools": {
        "name": {"tool_name", "name", "tool"},
        "category": {"tool_type", "category", "type"},
        "purpose_keywords": {"purpose", "purpose_keywords", "description", "use_case"},
        "supported_skills": {"supported_skills", "skills", "compatible_with"},
    },
    "history": {
        "project_name": {"project_name", "name"},
        "outcome": {"success_score", "outcome", "result", "status"},
        "tools_used": {"key_skills", "tools_used", "tech_stack"},
        "team_members": {"team_size", "members", "team_count"},
        "duration_days": {"completion_days", "duration_days", "days_taken"},
    },
}

_PENDING_UPLOADS: dict[str, dict[str, Any]] = {}
_LAST_STATUS: dict[str, Any] = {
    "state": "idle",
    "sync_token": 0,
    "updated_at": None,
    "summary": {},
}
_UPLOAD_LOCK = Lock()


@dataclass
class UploadPreview:
    dataset: str
    file_name: str
    file_format: str
    rows: int
    mapped_fields: list[str]
    skills_separator: str
    auto_generated_fields: list[str]
    preview: list[dict[str, Any]]


def _slug(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "_", value.strip().lower())
    return re.sub(r"_+", "_", normalized).strip("_")


def _as_str(value: Any, fallback: str = "") -> str:
    if value is None:
        return fallback
    text = str(value).strip()
    return text if text else fallback


def _as_int(value: Any, fallback: int = 0) -> int:
    try:
        return int(float(value))
    except Exception:
        return fallback


def _normalize_name(name: str) -> str:
    return re.sub(r"\s+", " ", _as_str(name)).strip()


def _guess_separator(raw_values: list[str]) -> str:
    sample = " ".join(raw_values[:30]).lower()
    if ";" in sample:
        return "semicolon"
    if "|" in sample:
        return "pipe"
    if "," in sample:
        return "comma"
    return "space"


def _split_skills(value: Any) -> list[str]:
    text = _as_str(value)
    if not text:
        return []
    parts = re.split(r"[;,|\s]+", text)
    cleaned = []
    seen: set[str] = set()
    for part in parts:
        token = part.strip().lower()
        if not token or token in seen:
            continue
        seen.add(token)
        cleaned.append(token)
    return cleaned


def _email_from_name(name: str) -> str:
    parts = [p for p in re.split(r"\s+", name.replace(".", " ")) if p]
    if not parts:
        return "employee@neurax.io"
    if len(parts) == 1:
        return f"{_slug(parts[0]).replace('_', '.')}@neurax.io"
    return f"{_slug(parts[0]).replace('_', '.')}.{_slug(parts[-1]).replace('_', '.')}@neurax.io"


def _load_frame(file_name: str, content: bytes) -> tuple[pd.DataFrame, str]:
    suffix = "." + file_name.lower().split(".")[-1] if "." in file_name else ""
    if suffix not in SUPPORTED_FORMATS:
        raise ValueError(f"Unsupported format: {suffix}")

    if suffix == ".csv":
        try:
            return pd.read_csv(BytesIO(content)), "CSV"
        except Exception:
            return pd.read_csv(BytesIO(content), engine="python", sep=None), "CSV"
    if suffix == ".tsv":
        return pd.read_csv(BytesIO(content), sep="\t"), "TSV"
    if suffix in {".xlsx", ".xls"}:
        return pd.read_excel(BytesIO(content)), suffix.replace(".", "").upper()
    if suffix == ".json":
        data = json.loads(content.decode("utf-8", errors="ignore"))
        if isinstance(data, dict):
            for value in data.values():
                if isinstance(value, list):
                    data = value
                    break
        if not isinstance(data, list):
            raise ValueError("JSON must contain an array of objects")
        return pd.DataFrame(data), "JSON"
    if suffix == ".txt":
        text = content.decode("utf-8", errors="ignore")
        lines = [line for line in text.splitlines() if line.strip()]
        if not lines:
            return pd.DataFrame(), "TXT"
        header = re.split(r"\t|\||,", lines[0])
        if len(header) > 1:
            rows = [re.split(r"\t|\||,", line) for line in lines[1:]]
            return pd.DataFrame(rows, columns=[h.strip() for h in header]), "TXT"
        return pd.read_csv(BytesIO(content), engine="python", sep=None), "TXT"
    if suffix == ".pdf":
        if not pdfplumber:
            raise ValueError("pdfplumber is required to parse PDF files")
        tables: list[list[list[str]]] = []
        with pdfplumber.open(BytesIO(content)) as pdf:
            for page in pdf.pages:
                extracted = page.extract_tables() or []
                for table in extracted:
                    if table:
                        tables.append(table)
        if not tables:
            raise ValueError("No tables detected in PDF")
        rows = tables[0]
        header = [str(col or "").strip() for col in rows[0]]
        return pd.DataFrame(rows[1:], columns=header), "PDF"

    raise ValueError("Unsupported format")


def _map_columns(dataset: str, row: dict[str, Any]) -> tuple[dict[str, Any], list[str]]:
    source_row = {_slug(str(key)): value for key, value in row.items()}
    mapping = COLUMN_MAP[dataset]
    mapped: dict[str, Any] = {}
    mapped_fields: list[str] = []

    for target_field, aliases in mapping.items():
        value = None
        for alias in aliases:
            if alias in source_row:
                value = source_row[alias]
                break
        if value is not None:
            mapped[target_field] = value
            mapped_fields.append(target_field)

    return mapped, mapped_fields


def _apply_defaults(dataset: str, row: dict[str, Any], employee_seed: int) -> tuple[dict[str, Any], list[str]]:
    generated: list[str] = []
    record = dict(row)

    if dataset == "employees":
        record["name"] = _normalize_name(_as_str(record.get("name")))
        skills = _split_skills(record.get("skills"))
        record["skills"] = ", ".join(skills)

        if not _as_str(record.get("email")):
            record["email"] = _email_from_name(record.get("name", ""))
            generated.append("email")

        if not _as_str(record.get("location")):
            record["location"] = "Remote"
            generated.append("location")

        exp_years = _as_int(record.get("experience_years"), 0)
        if not _as_str(record.get("employee_id")):
            record["employee_id"] = f"EMP-{employee_seed:03d}"
            generated.append("employee_id")

        workload = _as_int(record.get("current_workload_percent"), -1)
        if workload < 0:
            record["current_workload_percent"] = 30
            generated.append("current_workload_percent")
        else:
            record["current_workload_percent"] = max(0, min(100, workload))

        if _as_int(record.get("rating"), 0) <= 0:
            rating = min(10, round((len(skills) * 1.2) + (exp_years * 0.5), 1))
            record["rating"] = int(max(1, round(rating)))
            generated.append("rating")

        record["experience_years"] = exp_years
        record["source"] = "imported"

    if dataset == "projects":
        if not _as_str(record.get("priority")):
            record["priority"] = "Medium"
            generated.append("priority")
        if _as_int(record.get("deadline_days"), 0) <= 0:
            record["deadline_days"] = 30
            generated.append("deadline_days")
        record["required_skills"] = ", ".join(_split_skills(record.get("required_skills")))
        record["source"] = "imported"

    if dataset == "tools":
        record["supported_skills"] = ", ".join(_split_skills(record.get("supported_skills")))
        record["source"] = "imported"

    if dataset == "history":
        outcome_raw = _as_str(record.get("outcome"), "").lower()
        try:
            score = float(outcome_raw)
            if score >= 0.9:
                record["outcome"] = "Excellent"
            elif score >= 0.7:
                record["outcome"] = "Good"
            else:
                record["outcome"] = "Needs Improvement"
            generated.append("outcome")
        except Exception:
            if not outcome_raw:
                record["outcome"] = "Needs Improvement"
                generated.append("outcome")
            else:
                record["outcome"] = _as_str(record.get("outcome"))
        record["source"] = "imported"

    return record, generated


def parse_dataset_upload(dataset: str, file_name: str, content: bytes) -> dict[str, Any]:
    if dataset not in DATASET_FIELDS:
        raise ValueError("Invalid dataset key")
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("File too large. Max size is 50MB")

    frame, format_name = _load_frame(file_name, content)
    if frame.empty:
        raise ValueError("No rows found in uploaded file")

    if len(frame.index) > MAX_ROWS:
        raise ValueError("Row limit exceeded. Max rows is 10,000")

    rows = frame.fillna("").to_dict(orient="records")
    parsed: list[dict[str, Any]] = []
    all_mapped: set[str] = set()
    all_generated: set[str] = set()

    datasets = get_datasets()
    employee_seed = len(datasets.get("employees", [])) + 1

    for row in rows:
        mapped, mapped_fields = _map_columns(dataset, row)
        all_mapped.update(mapped_fields)
        processed, generated_fields = _apply_defaults(dataset, mapped, employee_seed)
        all_generated.update(generated_fields)
        employee_seed += 1
        parsed.append(processed)

    skills_separator = "n/a"
    if dataset in {"employees", "projects", "tools", "history"}:
        candidates = []
        skill_key = {
            "employees": "skills",
            "projects": "required_skills",
            "tools": "supported_skills",
            "history": "tools_used",
        }[dataset]
        for row in parsed[:50]:
            value = _as_str(row.get(skill_key))
            if value:
                candidates.append(value)
        if candidates:
            skills_separator = _guess_separator(candidates)

    preview_rows = parsed[:10]
    with _UPLOAD_LOCK:
        _PENDING_UPLOADS[dataset] = {
            "file_name": file_name,
            "format": format_name,
            "rows": parsed,
            "mapped_fields": sorted(all_mapped),
            "generated_fields": sorted(all_generated),
            "skills_separator": skills_separator,
        }

    preview = UploadPreview(
        dataset=dataset,
        file_name=file_name,
        file_format=format_name,
        rows=len(parsed),
        mapped_fields=sorted(all_mapped),
        skills_separator=skills_separator,
        auto_generated_fields=sorted(all_generated),
        preview=preview_rows,
    )
    return preview.__dict__


def _preserve_manual_employees(incoming: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    existing = get_datasets().get("employees", [])
    special_names = get_special_employee_names()

    preserved_manual = [
        row for row in existing
        if _as_str(row.get("source")).lower() == "manual" or _as_str(row.get("name")) in special_names
    ]
    preserved_names = {_normalize_name(_as_str(row.get("name"))).lower() for row in preserved_manual if _as_str(row.get("name"))}

    merged = list(preserved_manual)
    skipped = 0
    for row in incoming:
        name = _normalize_name(_as_str(row.get("name"))).lower()
        if not name:
            continue
        if name in preserved_names:
            skipped += 1
            continue
        merged.append(row)

    return merged, skipped


def confirm_bulk_rebuild() -> dict[str, Any]:
    with _UPLOAD_LOCK:
        pending = dict(_PENDING_UPLOADS)

    datasets = get_datasets()
    incoming = {
        "employees": pending.get("employees", {}).get("rows", datasets.get("employees", [])),
        "projects": pending.get("projects", {}).get("rows", datasets.get("projects", [])),
        "tools": pending.get("tools", {}).get("rows", datasets.get("tools", [])),
        "history": pending.get("history", {}).get("rows", datasets.get("history", [])),
    }

    merged_employees, duplicates_skipped = _preserve_manual_employees(incoming["employees"])
    incoming["employees"] = merged_employees

    replaced = replace_all_datasets(incoming)
    force_reload()

    prompt_meta = AgentService.rebuild_system_prompt(
        replaced.get("employees", []),
        replaced.get("tools", []),
        replaced.get("history", []),
    )

    manual_count = sum(1 for row in replaced.get("employees", []) if _as_str(row.get("source")).lower() == "manual")
    imported_count = sum(1 for row in replaced.get("employees", []) if _as_str(row.get("source")).lower() == "imported")

    summary = {
        "state": "complete",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "sync_token": int(datetime.utcnow().timestamp()),
        "imported_records": {
            "employees": imported_count,
            "projects": len(replaced.get("projects", [])),
            "tools": len(replaced.get("tools", [])),
            "history": len(replaced.get("history", [])),
        },
        "manual_records_preserved": manual_count,
        "duplicates_skipped": duplicates_skipped,
        "errors": 0,
        "prompt": prompt_meta,
        "steps": {
            "parse": "done",
            "clear": "done",
            "save": "done",
            "cache": "done",
            "prompt": "done",
            "sync": "done",
        },
    }

    with _UPLOAD_LOCK:
        _PENDING_UPLOADS.clear()
        _LAST_STATUS.update(summary)

    return summary


def reload_from_database_view() -> dict[str, Any]:
    datasets = force_reload()
    prompt_meta = AgentService.rebuild_system_prompt(
        datasets.get("employees", []),
        datasets.get("tools", []),
        datasets.get("history", []),
    )
    status = {
        "state": "reloaded",
        "updated_at": datetime.utcnow().isoformat() + "Z",
        "sync_token": int(datetime.utcnow().timestamp()),
        "summary": {
            "employees": len(datasets.get("employees", [])),
            "projects": len(datasets.get("projects", [])),
            "tools": len(datasets.get("tools", [])),
            "history": len(datasets.get("history", [])),
        },
        "prompt": prompt_meta,
    }
    with _UPLOAD_LOCK:
        _LAST_STATUS.update(status)
    return status


def get_upload_status() -> dict[str, Any]:
    with _UPLOAD_LOCK:
        pending_meta = {
            dataset: {
                "file_name": payload.get("file_name"),
                "format": payload.get("format"),
                "rows": len(payload.get("rows", [])),
            }
            for dataset, payload in _PENDING_UPLOADS.items()
        }
        return {
            **_LAST_STATUS,
            "pending": pending_meta,
        }
