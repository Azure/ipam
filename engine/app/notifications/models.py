"""
Notification framework models.

A *notification* is a fact about the deployment that a human, an IaC pipeline,
or the Azure IPAM UI can read and act on. The shape is deliberately serializable
and self-describing so an API-only consumer gets everything it needs without the
UI, while the UI can override presentation by the stable ``id``.

The same shape is intended to be produced by future *remote* notification
providers (a hosted feed fetched periodically). For security, remotely-authored
notifications will be constrained to informational / link actions only; only
local (in-code) detectors may emit actionable ``resolve`` remediations.

A notification with an ``admin`` audience is only returned to callers who hold
``notifications/read/all``.
"""

import re
from typing import Literal

from pydantic import BaseModel, field_validator

Severity = Literal["critical", "warning", "information"]
Audience = Literal["all", "admin"]
ActionKind = Literal["resolve", "link", "navigate"]

# A blank line, possibly holding indentation, separates paragraphs.
_PARAGRAPH_BREAK = re.compile(r"\n\s*\n")


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

    # Fields that don't apply to an action's kind are null.
    # resolve / link
    method: str | None = None
    href: str | None = None
    causesRestart: bool = False
    requiresAdmin: bool = False

    # navigate
    to: str | None = None


class Notification(BaseModel):
    """A single, self-describing notification about the deployment."""

    id: str
    severity: Severity
    audience: Audience = "all"
    category: str
    title: str
    message: str
    dismissible: bool = True
    data: dict | None = None
    actions: list[NotificationAction] = []

    # Detectors write every message as a triple-quoted string and every title as a single-line string (see
    # "Notification Detectors" in the Conventions documentation). The title is collapsed onto one line and each
    # paragraph of the message is joined into one, so source line breaks and indentation never reach the reader.
    # A blank line separates paragraphs. (A comment rather than the docstring, which is published as the schema.)
    @field_validator("title")
    @classmethod
    def _single_line(cls, value: str) -> str:
        return " ".join(value.split())

    @field_validator("message")
    @classmethod
    def _paragraphs(cls, value: str) -> str:
        paragraphs = (" ".join(paragraph.split()) for paragraph in _PARAGRAPH_BREAK.split(value))

        return "\n\n".join(paragraph for paragraph in paragraphs if paragraph)


class NotificationList(BaseModel):
    """Envelope returned by ``GET /api/notifications``."""

    notifications: list[Notification] = []
    # Unix time (seconds) the oldest included result was produced. Null when no detector has succeeded yet.
    checkedOn: float | None = None


class NotificationActionResult(BaseModel):
    """Acknowledgement that a notification remediation has been accepted."""

    status: str
    detail: str
