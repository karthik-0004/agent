from __future__ import annotations

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

_DATA_CACHE: dict[str, list[dict[str, Any]]] = {}
_CACHE_LOCK = Lock()


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        if pd.isna(value):
            normalized[key] = None
        elif isinstance(value, str):
            normalized[key] = value.strip()
        elif isinstance(value, float) and value.is_integer():
            normalized[key] = int(value)
        else:
            normalized[key] = value
    return normalized


def _resolve_dataset_file(dataset_name: str) -> Path:
    for data_dir in DATA_DIRECTORIES:
        for candidate in DATA_FILE_CANDIDATES[dataset_name]:
            candidate_path = data_dir / candidate
            if candidate_path.exists():
                return candidate_path
    raise FileNotFoundError(
        f"No dataset file found for '{dataset_name}'. Expected one of: {', '.join(DATA_FILE_CANDIDATES[dataset_name])}"
    )


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
                return _load_dataset(candidate_path)
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
        return _DATA_CACHE


def get_datasets() -> dict[str, list[dict[str, Any]]]:
    return preload_data()


def get_employees() -> list[dict[str, Any]]:
    return get_datasets()["employees"]


def get_projects() -> list[dict[str, Any]]:
    return get_datasets()["projects"]


def get_tools() -> list[dict[str, Any]]:
    return get_datasets()["tools"]


def get_history() -> list[dict[str, Any]]:
    return get_datasets()["history"]
