"""
Notification framework.

``get_notifications()`` runs each registered detector at most once per its
maximum age and serves the stored result in between, isolates failures (one bad
detector never breaks the endpoint), and aggregates the results into a single
list. This is the single seam a future remote provider slots into.

Results are held in memory for each engine process, so a restart starts afresh.
When a detector fails or times out, its last successful result is kept until a
retry succeeds, so a transient error never hides a notification that is still
true. A detector that has never succeeded contributes nothing.
"""

import asyncio
import time
from dataclasses import dataclass, field

from app.logs.logs import ipam_logger as logger
from app.notifications.detectors import DETECTORS
from app.notifications.errors import RetryAfter
from app.notifications.models import (
    Notification,
    NotificationAction,
    NotificationActionResult,
    NotificationList,
)

__all__ = [
    "Notification",
    "NotificationAction",
    "NotificationActionResult",
    "NotificationList",
    "get_notifications",
    "get_resolver",
    "is_active",
    "recheck",
]

# Upper bound on a single detector so a hung dependency can't stall the endpoint.
DETECTOR_TIMEOUT = 10


@dataclass
class _DetectorState:
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)
    # Last successful result, and when it was produced (wall clock, for checkedOn).
    result: list[Notification] | None = None
    checked_on: float | None = None
    # Monotonic times of the last success and the earliest next run.
    succeeded_at: float | None = None
    next_run_at: float = 0.0


_states = {detector.name: _DetectorState() for detector in DETECTORS}

# Notification id -> (owning detector, resolve handler). Notifications without an
# entry have no live remediation (link-only guidance).
_resolvers = {
    notification_id: (detector, resolver)
    for detector in DETECTORS
    for notification_id, resolver in detector.resolvers.items()
}


def get_resolver(notification_id):
    """Return the resolve handler for a notification id, or None if it has no live remediation."""

    entry = _resolvers.get(notification_id)

    return entry[1] if entry else None


def _is_fresh(detector, state, now):
    return state.succeeded_at is not None and (now - state.succeeded_at) < detector.max_age


async def _run(detector, state):
    """Run one detector, bounded by a timeout. Caller must hold the detector's lock. Returns True on success."""

    now = time.monotonic()

    try:
        result = await asyncio.wait_for(detector.detect(), timeout=DETECTOR_TIMEOUT)
    except RetryAfter as e:
        state.next_run_at = now + max(detector.min_interval, e.seconds)
        logger.warning(f"Notification detector '{detector.name}' will retry in {int(state.next_run_at - now)}s: {e}")

        return False
    except Exception as e:
        state.next_run_at = now + detector.min_interval
        logger.error(f"Notification detector '{detector.name}' failed: {e!r}")

        return False

    state.result = result or []
    state.checked_on = detector.observed_on() if detector.observed_on else time.time()
    state.succeeded_at = time.monotonic()
    state.next_run_at = now + detector.min_interval

    return True


async def _refresh(detector, force):
    """Bring one detector's stored result up to date, unless it is still fresh or ran too recently."""

    state = _states[detector.name]

    # Fresh results are read without the lock; a run replaces them wholesale.
    if not force and _is_fresh(detector, state, time.monotonic()):
        return

    async with state.lock:
        now = time.monotonic()

        # Another request may have run the detector while this one waited for the lock.
        if not force and _is_fresh(detector, state, now):
            return

        if now < state.next_run_at:
            return

        await _run(detector, state)


async def get_notifications(force=False):
    """
    Aggregate notifications from all registered detectors.

    With ``force``, every detector runs again unless it ran within its minimum
    interval. ``checkedOn`` is when the oldest included result was produced.
    """

    await asyncio.gather(*(_refresh(detector, force) for detector in DETECTORS))

    states = [_states[detector.name] for detector in DETECTORS]
    succeeded = [state for state in states if state.checked_on is not None]

    return NotificationList(
        notifications=[item for state in succeeded for item in state.result],
        checkedOn=min((state.checked_on for state in succeeded), default=None),
    )


async def recheck(detector_name):
    """
    Run a detector now, ignoring its stored result and minimum interval, after a
    change that affects what it reports. Never raises: a failed run keeps the
    previous result, as it would on a scheduled run.
    """

    detector = next(detector for detector in DETECTORS if detector.name == detector_name)
    state = _states[detector.name]

    async with state.lock:
        await _run(detector, state)


async def is_active(notification_id):
    """
    Run the detector that reports ``notification_id`` now, ignoring its stored
    result and minimum interval, and return whether the notification is active.
    A failed run counts as not active, so a remediation never acts on stale state.
    """

    entry = _resolvers.get(notification_id)

    if entry is None:
        return False

    detector = entry[0]
    state = _states[detector.name]

    async with state.lock:
        if not await _run(detector, state):
            return False

        return any(item.id == notification_id for item in state.result)
