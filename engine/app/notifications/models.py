"""
Notification framework models.

A *notification* is a fact about the deployment that a human, an IaC pipeline,
or the Azure IPAM UI can read and act on. The shape is deliberately serializable
and self-describing so an API-only consumer gets everything it needs without the
UI, while the UI can override presentation by the stable ``id``.

The same shape is intended to be produced by future *remote* notification
providers (a hosted feed fetched periodically). For security, remotely-authored
notifications will be constrained to informational / link actions only; only
local (in-code) detectors may emit actionable ``api`` remediations.
"""

from typing import Literal, Optional

from pydantic import BaseModel

Severity = Literal["critical", "warning", "information"]
Audience = Literal["all", "admin"]
ActionKind = Literal["resolve", "link", "navigate"]


class NotificationAction(BaseModel):
    """
    A single action a consumer can take for a notification.

    * ``resolve``  — a server-owned remediation. The client POSTs to ``href``
                     (``method`` = POST) to trigger it; the backend holds all the
                     logic. ``causesRestart`` tells the UI to raise the restart
                     gate, and ``requiresAdmin`` (also enforced server-side) lets
                     the UI disable the control early for non-admins.
    * ``link``     — an external reference (documentation / manual remediation).
    * ``navigate`` — an in-app route (UI convenience only).
    """

    id: str
    label: str
    kind: ActionKind

    # resolve / link
    method: Optional[str] = None
    href: Optional[str] = None
    causesRestart: Optional[bool] = None
    requiresAdmin: Optional[bool] = None

    # navigate
    to: Optional[str] = None


class Notification(BaseModel):
    """A single, self-describing notification about the deployment."""

    id: str
    severity: Severity
    audience: Audience = "all"
    category: str
    title: str
    message: str
    dismissible: bool = True
    data: Optional[dict] = None
    actions: list[NotificationAction] = []


class NotificationList(BaseModel):
    """Envelope returned by ``GET /api/notifications``."""

    notifications: list[Notification] = []


class NotificationActionResult(BaseModel):
    """Acknowledgement that a notification remediation has been accepted."""

    status: str
    detail: str
