"""
Detector registry.

Each detector is a self-contained module exposing an async ``detect()`` that
returns a list of ``Notification``. To add a notification, add a module here and
register its ``detect`` in ``DETECTORS`` below.
"""

from app.notifications.detectors import platform, registry, update

# Ordered list of local detectors. A future remote provider aggregates into the
# same pipeline (see app.notifications.get_notifications).
DETECTORS = [
    registry.detect,
    platform.detect,
    update.detect,
]

# Map of notification id -> resolve handler, aggregated across detector modules.
# Notifications without an entry have no live remediation (link-only guidance).
RESOLVERS = {
    **registry.RESOLVERS,
}

__all__ = ["DETECTORS", "RESOLVERS"]
