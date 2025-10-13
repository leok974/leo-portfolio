"""Nightly scheduler service for automated layout optimization."""

from __future__ import annotations

import asyncio
import datetime as dt
import logging
import os
import pathlib
from typing import Optional

import yaml

from .agent_events import log_event
from .layout_opt import run_layout_optimize

logger = logging.getLogger(__name__)
POLICY = pathlib.Path("data/schedule.policy.yml")


def _load_policy() -> dict:
    """Load schedule policy from YAML file."""
    if POLICY.exists():
        try:
            return yaml.safe_load(POLICY.read_text(encoding="utf-8")) or {}
        except Exception as e:
            logger.warning(f"Failed to load policy: {e}")
            return {}
    return {}


def pick_preset_for_day(d: dt.date) -> str:
    """
    Pick optimization preset based on day type.

    Args:
        d: Date to check

    Returns:
        Preset name (recruiter, hiring_manager, creative, or default)
    """
    policy = _load_policy()
    schedule_config = policy.get("schedule", {})
    holidays = set(policy.get("holidays", []) or [])

    # Check if holiday
    day_str = d.strftime("%Y-%m-%d")
    if day_str in holidays:
        return schedule_config.get("holidays", "creative")

    # Check weekday vs weekend
    weekday = d.weekday()  # 0=Mon, 6=Sun
    if weekday < 5:
        return schedule_config.get("weekday", "recruiter")
    else:
        return schedule_config.get("weekend", "hiring_manager")


def _parse_time_local(s: str) -> dt.time:
    """Parse HH:MM time string."""
    h, m = (s or "02:30").split(":")
    return dt.time(hour=int(h), minute=int(m))


def _next_run(now: dt.datetime | None = None) -> dt.datetime:
    """
    Calculate next scheduled run time based on policy.

    Args:
        now: Current datetime (defaults to now)

    Returns:
        Next occurrence of scheduled time
    """
    if now is None:
        now = dt.datetime.now()

    policy = _load_policy()
    time_str = policy.get("schedule", {}).get("nightly_time", "02:30")
    target_time = _parse_time_local(time_str)

    # Set target to today at specified time
    target = now.replace(
        hour=target_time.hour, minute=target_time.minute, second=0, microsecond=0
    )

    # If we've already passed target time today, move to tomorrow
    if now >= target:
        target += dt.timedelta(days=1)

    return target


async def _sleep_until(target: dt.datetime):
    """
    Sleep until target datetime.

    Args:
        target: Target datetime to sleep until
    """
    now = dt.datetime.now()
    delta = (target - now).total_seconds()
    if delta > 0:
        logger.info(f"Scheduler sleeping until {target} ({delta:.0f}s)")
        await asyncio.sleep(delta)


async def scheduler_loop():
    """
    Main scheduler loop running based on policy configuration.

    Reads schedule.policy.yml to determine:
    - Run time (default 02:30)
    - Preset for weekdays/weekends/holidays
    """
    if not os.getenv("SCHEDULER_ENABLED"):
        logger.info("Scheduler disabled (SCHEDULER_ENABLED not set)")
        return

    policy = _load_policy()
    run_time = policy.get("schedule", {}).get("nightly_time", "02:30")
    logger.info(f"Scheduler started, running daily at {run_time}")

    while True:
        try:
            # Calculate next run time
            next_run_time = _next_run()
            await _sleep_until(next_run_time)

            # Determine preset based on day type
            preset = pick_preset_for_day(next_run_time.date())

            logger.info(f"Scheduler executing: {preset} preset")

            # Run optimization
            result = run_layout_optimize({"preset": preset})

            # Log event for audit trail
            log_event(
                "scheduler.optimize",
                {
                    "preset": preset,
                    "summary": result.get("summary"),
                    "status": result.get("status"),
                },
            )

            logger.info(f"Scheduler completed: {result.get('status')}")

        except Exception as e:
            logger.error(f"Scheduler error: {e}", exc_info=True)
            # Wait 1 hour before retrying on error
            await asyncio.sleep(3600)
