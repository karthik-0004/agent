from __future__ import annotations

import os
from threading import Lock

from apscheduler.schedulers.background import BackgroundScheduler

from .deadline_service import check_all_subtask_deadlines

_scheduler: BackgroundScheduler | None = None
_lock = Lock()


def _run_daily_deadline_check() -> None:
    result = check_all_subtask_deadlines()
    print(f"[Neurax Scheduler] Deadline check completed: {result}")


def start_scheduler() -> None:
    global _scheduler
    with _lock:
        if _scheduler is not None:
            return

        # Prevent duplicate schedulers from Django autoreload process.
        run_main = os.environ.get("RUN_MAIN")
        if run_main not in {"true", "True", None}:
            return

        scheduler = BackgroundScheduler(timezone="UTC")
        scheduler.add_job(
            _run_daily_deadline_check,
            trigger="cron",
            hour=9,
            minute=0,
            id="subtask_deadline_daily_check",
            replace_existing=True,
        )
        scheduler.start()
        _scheduler = scheduler
        print("[Neurax Scheduler] APScheduler started with daily 09:00 deadline check.")
