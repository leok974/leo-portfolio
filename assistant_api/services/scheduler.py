"""Nightly scheduler service for automated layout optimization."""
from __future__ import annotations
import os
import asyncio
import datetime as dt
import logging
from typing import Optional
from .layout_opt import run_layout_optimize

logger = logging.getLogger(__name__)


def _next_230_local(now: Optional[dt.datetime] = None) -> dt.datetime:
    """
    Calculate next 02:30 local time.

    Args:
        now: Current datetime (defaults to now)

    Returns:
        Next occurrence of 02:30 local time
    """
    if now is None:
        now = dt.datetime.now()

    # Start with today at 02:30
    next_run = now.replace(hour=2, minute=30, second=0, microsecond=0)

    # If we've already passed 02:30 today, move to tomorrow
    if now >= next_run:
        next_run += dt.timedelta(days=1)

    return next_run


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
    Main scheduler loop running at 02:30 daily.

    Weekdays (Mon-Fri) → recruiter preset
    Weekends (Sat-Sun) → hiring_manager preset
    """
    if not os.getenv("SCHEDULER_ENABLED"):
        logger.info("Scheduler disabled (SCHEDULER_ENABLED not set)")
        return

    logger.info("Scheduler started, running daily at 02:30")

    while True:
        try:
            # Calculate next run time
            next_run = _next_230_local()
            await _sleep_until(next_run)

            # Determine preset based on day of week
            weekday = next_run.weekday()  # 0=Mon, 6=Sun
            preset = "recruiter" if weekday < 5 else "hiring_manager"

            logger.info(f"Scheduler executing: {preset} preset (weekday={weekday})")

            # Run optimization
            result = run_layout_optimize({"preset": preset})

            logger.info(f"Scheduler completed: {result.get('status')}")

        except Exception as e:
            logger.error(f"Scheduler error: {e}", exc_info=True)
            # Wait 1 hour before retrying on error
            await asyncio.sleep(3600)
