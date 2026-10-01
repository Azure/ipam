"""
Notification framework.

``get_notifications()`` runs every registered detector, isolates failures (one
bad detector never breaks the endpoint), and aggregates the results into a
single list. This is the single seam a future remote provider slots into.
"""

import asyncio

from app.logs.logs import ipam_logger as logger
from app.notifications.detectors import DETECTORS, RESOLVERS
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
]

# Upper bound on a single detector so a hung dependency can't stall the endpoint.
DETECTOR_TIMEOUT = 10


def get_resolver(notification_id):
    """Return the resolve handler for a notification id, or None if it has no live remediation."""

    return RESOLVERS.get(notification_id)


async def _run_detector(detector):
    """Run one detector, bounded and error-isolated. Returns a list (possibly empty)."""

    try:
        result = await asyncio.wait_for(detector(), timeout=DETECTOR_TIMEOUT)

        return result or []
    except Exception as e:
        logger.error("Notification detector '{}' failed: {}".format(getattr(detector, "__module__", detector), e))

        return []


async def get_notifications():
    """Aggregate notifications from all registered detectors."""

    results = await asyncio.gather(*(_run_detector(d) for d in DETECTORS))

    notifications = [item for group in results for item in group]

    return NotificationList(notifications=notifications)
