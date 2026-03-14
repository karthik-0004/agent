from __future__ import annotations

from pathlib import Path
from threading import Lock
from typing import Any

import pandas as pd

DATA_DIR = Path(__file__).resolve().parents[2] / "data"
DATA_FILES = {
    "employees": "neurax_employees_dataset.csv",
    "projects": "neurax_projects_dataset.csv",
    "history": "neurax_project_history_dataset.csv",
    "tools": "neurax_tools_dataset.csv",
}

_DATA_CACHE: dict[str, list[dict[str, Any]]] = {}
_CACHE_LOCK = Lock()


def _normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        if pd.isna(value):
            normalized[key] = None
        elif isinstance(value, float) and value.is_integer():
            normalized[key] = int(value)
        else:
            normalized[key] = value
    return normalized


def _load_csv(filename: str) -> list[dict[str, Any]]:
    file_path = DATA_DIR / filename
    dataframe = pd.read_csv(file_path)
    return [_normalize_record(record) for record in dataframe.to_dict(orient="records")]


def preload_data() -> dict[str, list[dict[str, Any]]]:
    with _CACHE_LOCK:
        if _DATA_CACHE:
            return _DATA_CACHE
        for dataset_name, filename in DATA_FILES.items():
            _DATA_CACHE[dataset_name] = _load_csv(filename)
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
