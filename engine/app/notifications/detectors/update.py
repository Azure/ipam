"""
Update detector.

Compares the running Azure IPAM version against the latest published GitHub
release (``github.com/Azure/ipam``) and, when a newer version exists, emits an
informational notification pointing admins at the update guide.

This is link-only guidance (no server-owned remediation): updating a deployment
has several supported paths, so we route the user to the docs rather than
automating it here. A failed lookup raises, so the notification framework keeps
the last known result and a GitHub outage never breaks the notifications pipeline.
"""

import time

import aiohttp

from app.globals import globals
from app.notifications.errors import RetryAfter
from app.notifications.models import (
    Notification,
    NotificationAction,
)

# GitHub "latest release" endpoint; ``tag_name`` corresponds to the version.
GITHUB_LATEST_RELEASE_URL = "https://api.github.com/repos/Azure/ipam/releases/latest"

# Update guidance (options + step-by-step instructions).
UPDATE_DOCS_URL = "https://azure.github.io/ipam/#/update/README"


def _parse_version(text):
    """Parse a ``x.y.z`` version (optionally ``v``-prefixed) into a tuple of ints, or None if it can't be parsed."""

    if not text:
        return None

    numbers = []

    for part in text.strip().lstrip("vV").split("."):
        digits = ""

        for char in part:
            if char.isdigit():
                digits += char
            else:
                break

        if not digits:
            break

        numbers.append(int(digits))

    return tuple(numbers) if numbers else None


def _is_newer(latest, current):
    """True if ``latest`` is a newer version than ``current`` (length-normalized tuple compare)."""

    length = max(len(latest), len(current))
    latest_padded = latest + (0,) * (length - len(latest))
    current_padded = current + (0,) * (length - len(current))

    return latest_padded > current_padded


def _rate_limit_wait(resp):
    """
    Seconds GitHub has asked callers to wait, or None if the response isn't a rate limit.

    GitHub sends ``retry-after`` for secondary limits and ``x-ratelimit-reset`` (Unix
    time) once the primary limit is used up, and asks callers not to retry before then.
    """

    if resp.status not in (403, 429):
        return None

    retry_after = resp.headers.get("retry-after")

    if retry_after and retry_after.isdigit():
        return int(retry_after)

    if resp.headers.get("x-ratelimit-remaining") == "0":
        reset = resp.headers.get("x-ratelimit-reset")

        if reset and reset.isdigit():
            return max(0, int(reset) - int(time.time()))

    # GitHub's guidance for a rate limit without either header is to wait at least a minute.
    return 60 if resp.status == 429 else None


async def _get_latest_release_tag():
    """
    Fetch the latest release tag from GitHub.

    Raises when the lookup fails, so the notification framework keeps the last
    known result. Raises ``RetryAfter`` when GitHub is rate limiting, so it isn't
    asked again until GitHub says it may be.
    """

    timeout = aiohttp.ClientTimeout(total=5)

    async with aiohttp.ClientSession(timeout=timeout) as session:
        async with session.get(
            GITHUB_LATEST_RELEASE_URL,
            headers={
                "Accept": "application/vnd.github+json",
                "User-Agent": "azure-ipam",
            },
        ) as resp:
            wait = _rate_limit_wait(resp)

            if wait is not None:
                raise RetryAfter(wait, f"GitHub is rate limiting release lookups (HTTP {resp.status}).")

            if resp.status != 200:
                raise RuntimeError(f"GitHub latest-release lookup returned HTTP {resp.status}.")

            data = await resp.json()

    return data.get("tag_name")


async def detect():
    current = _parse_version(globals.IPAM_VERSION)

    if current is None:
        return []

    tag = await _get_latest_release_tag()
    latest = _parse_version(tag)

    if latest is None or not _is_newer(latest, current):
        return []

    latest_str = tag.strip().lstrip("vV")
    current_str = globals.IPAM_VERSION

    return [
        Notification(
            id="update-available",
            severity="information",
            audience="all",
            category="Update",
            title="A new version of Azure IPAM is available",
            message=f"""
                Azure IPAM {latest_str} is available (this deployment is running {current_str}). See the update
                guide for your options and step-by-step instructions.
            """,
            dismissible=True,
            data={"currentVersion": current_str, "latestVersion": latest_str},
            actions=[
                NotificationAction(
                    id="update-guide",
                    label="View update guide",
                    kind="link",
                    href=UPDATE_DOCS_URL,
                ),
            ],
        )
    ]
