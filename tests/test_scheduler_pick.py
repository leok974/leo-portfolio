"""Test scheduler next run time calculation."""
import pytest
import datetime as dt
from assistant_api.services.scheduler import _next_230_local


def test_next_230_before_target():
    """Test calculating next 02:30 when current time is before 02:30."""
    now = dt.datetime(2024, 1, 15, 1, 0, 0)  # 01:00 AM
    next_run = _next_230_local(now)
    
    # Should be today at 02:30
    assert next_run.year == 2024
    assert next_run.month == 1
    assert next_run.day == 15
    assert next_run.hour == 2
    assert next_run.minute == 30


def test_next_230_after_target():
    """Test calculating next 02:30 when current time is after 02:30."""
    now = dt.datetime(2024, 1, 15, 3, 0, 0)  # 03:00 AM
    next_run = _next_230_local(now)
    
    # Should be tomorrow at 02:30
    assert next_run.year == 2024
    assert next_run.month == 1
    assert next_run.day == 16
    assert next_run.hour == 2
    assert next_run.minute == 30


def test_next_230_at_target():
    """Test calculating next 02:30 when current time is exactly 02:30."""
    now = dt.datetime(2024, 1, 15, 2, 30, 0)  # 02:30 AM
    next_run = _next_230_local(now)
    
    # Should be tomorrow at 02:30 (since we're at the exact time)
    assert next_run.year == 2024
    assert next_run.month == 1
    assert next_run.day == 16
    assert next_run.hour == 2
    assert next_run.minute == 30
