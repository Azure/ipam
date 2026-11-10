"""
Detector registry.

Each detector is a self-contained module exposing an async ``detect()`` that
returns a list of ``Notification``. To add a notification, add a module here and
register it in ``DETECTORS`` below with how long its result stays current.

A detector must raise when it can't complete its check, rather than return an
empty list, so the framework can keep its last known result instead of hiding a
notification that is still true.
"""

from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field

from app import engine_access
from app.notifications.detectors import credentials, platform, registry, update


@dataclass(frozen=True)
class Detector:
    """A detector and how often it may run."""

    name: str
    detect: Callable[[], Awaitable[list]]
    # Seconds a successful result is reused before the detector runs again. 0 runs it on every request.
    max_age: float
    # Minimum seconds between runs, which also applies to forced refreshes and to retries after a failure.
    min_interval: float
    # Notification id -> resolve handler, for the notifications this detector can remediate.
    resolvers: dict = field(default_factory=dict)
    # For a detector that reports on data gathered elsewhere: when that data was observed (Unix time), or None.
    observed_on: Callable[[], float | None] | None = None


# Ordered list of local detectors. A future remote provider aggregates into the
# same pipeline (see app.notifications.get_notifications).
DETECTORS = [
    # Reads what the engine's own sign-ins and Resource Graph queries have recorded. No calls of its own.
    Detector("credentials", credentials.detect, max_age=0, min_interval=0, observed_on=engine_access.observed_on),
    # Reads the site configuration from Azure Resource Manager. Changing the image restarts the app.
    Detector("registry", registry.detect, max_age=15 * 60, min_interval=15, resolvers=registry.RESOLVERS),
    # Reads environment variables only.
    Detector("platform", platform.detect, max_age=0, min_interval=0),
    # Calls GitHub anonymously, whose limit may be shared with other apps on the same outbound IP address.
    Detector("update", update.detect, max_age=60 * 60, min_interval=5 * 60),
]

__all__ = ["DETECTORS", "Detector"]
