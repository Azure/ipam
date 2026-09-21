"""
Update detector.

Compares the running Azure IPAM version against the latest published GitHub
release (``github.com/Azure/ipam``) and, when a newer version exists, emits an
informational notification pointing admins at the update guide.

This is link-only guidance (no server-owned remediation): updating a deployment
has several supported paths, so we route the user to the docs rather than
automating it here. Any network / parse failure is swallowed and produces no
notification, so a GitHub outage never breaks the notifications pipeline.
"""

import aiohttp

from app.globals import globals
from app.logs.logs import ipam_logger as logger
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


async def _get_latest_release_tag():
    """Fetch the latest release tag from GitHub. Returns None on any failure (including rate limiting), which simply yields no notification this cycle."""

    try:
        timeout = aiohttp.ClientTimeout(total=5)

        async with aiohttp.ClientSession(timeout=timeout) as session:
            async with session.get(
                GITHUB_LATEST_RELEASE_URL,
                headers={
                    "Accept": "application/vnd.github+json",
                    "User-Agent": "azure-ipam",
                },
            ) as resp:
                if resp.status != 200:
                    logger.warning(
                        "GitHub latest-release lookup returned HTTP {} (no update notification this cycle).".format(resp.status)
                    )
                    return None

                data = await resp.json()
    except Exception as e:
        logger.warning("Failed to fetch latest release from GitHub: {}".format(e))
        return None

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
            message=(
                "Azure IPAM {latest} is available (this deployment is running {current}). "
                "See the update guide for your options and step-by-step instructions.".format(
                    latest=latest_str, current=current_str
                )
            ),
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
