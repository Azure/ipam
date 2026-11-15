"""
Engine secret expiry detector.

Warns everyone as the expiration date recorded for Azure IPAM's client secret
approaches, so anyone who sees it can alert an administrator to rotate it, and
reminds administrators when no expiration date is recorded.

The date comes from the current version of ``ENGINE-SECRET`` in Key Vault, read
as metadata only with the managed identity's existing access. It's only as
accurate as that record, because the secret itself lives on the Engine app
registration. Deployments that don't read the secret from Key Vault get nothing.
"""

import math
import time

from azure.core.exceptions import ClientAuthenticationError, HttpResponseError
from azure.identity.aio import ManagedIdentityCredential
from azure.keyvault.secrets.aio import SecretClient

from app import engine_access
from app.globals import globals
from app.logs.logs import ipam_logger as logger
from app.notifications.models import Notification, NotificationAction

SECRET_NAME = "ENGINE-SECRET"

DAY = 24 * 60 * 60
WARNING_DAYS = 30
CRITICAL_DAYS = 7

# Causes for which the credentials detector is already reporting a problem with the secret itself.
SECRET_CAUSES = {"secret_expired", "secret_invalid", "secret_unresolved", "secret_missing"}

# Key Vault responses that retrying won't change: access denied (role or firewall) or not found.
PERMANENT_STATUSES = {403, 404}

DOCS_URL = "https://azure.github.io/ipam/#"
MAINTENANCE_URL = f"{DOCS_URL}/maintenance/README"
ROTATE_URL = f"{MAINTENANCE_URL}?id=rotate-the-secret"
SET_EXPIRY_URL = f"{MAINTENANCE_URL}?id=set-the-expiration-date"

IMPACT = "Once it expires, Azure resources won't load and address space can't be checked or reserved until it's rotated."

# Why the expiration date can't be read, as last logged, so each reason is logged once.
_unavailable = None


class _Unavailable(Exception):
    """The expiration date can't be read for a reason that retrying won't change."""


def _set_unavailable(reason):
    global _unavailable

    if reason != _unavailable:
        if reason is None:
            logger.info(f"Azure IPAM can read the expiration date of {SECRET_NAME} from Key Vault again.")
        else:
            logger.warning(f"Azure IPAM can't read the expiration date of {SECRET_NAME} from Key Vault, so it can't warn before the secret expires: {reason}")

    _unavailable = reason


async def _read_expires_on():
    """The expiration date (Unix time) of the current version of the secret, or None when it has none."""

    credential = ManagedIdentityCredential(client_id=globals.MANAGED_IDENTITY_ID)
    client = SecretClient(vault_url=globals.KEYVAULT_URL, credential=credential)

    async with credential, client:
        async for properties in client.list_properties_of_secrets():
            if properties.name != SECRET_NAME:
                continue

            if not properties.enabled:
                raise _Unavailable(f"{SECRET_NAME} is disabled.")

            return properties.expires_on.timestamp() if properties.expires_on else None

    raise _Unavailable(f"{SECRET_NAME} wasn't found.")


def _rotate_action():
    return NotificationAction(id="rotate-secret", label="How to rotate the secret", kind="link", href=ROTATE_URL)


def _expiring(expires_on, now):
    remaining = expires_on - now

    if remaining > WARNING_DAYS * DAY:
        return []

    if remaining <= 0:
        days_ago = int(-remaining // DAY)
        ago = "less than a day ago" if days_ago == 0 else f"{days_ago} day{'s' if days_ago > 1 else ''} ago"

        return [
            Notification(
                id="engine-secret-expiry-passed",
                severity="critical",
                audience="all",
                category="Azure Access",
                title="Client secret is past its expiration date",
                message=(
                    f"The expiration date recorded for Azure IPAM's client secret passed {ago}, and Azure IPAM may "
                    "stop reaching Azure at any time. Let an administrator know right away so they can rotate it."
                ),
                dismissible=False,
                data={"expiresOn": expires_on},
                actions=[_rotate_action()],
            )
        ]

    days = math.ceil(remaining / DAY)
    when = "within a day" if days == 1 else f"in {days} days"

    if days > CRITICAL_DAYS:
        return [
            Notification(
                id="engine-secret-expiring",
                severity="warning",
                audience="all",
                category="Azure Access",
                title=f"Client secret expires {when}",
                message=f"Azure IPAM's client secret expires {when}. Let an administrator know so they can rotate it before then. {IMPACT}",
                dismissible=True,
                data={"expiresOn": expires_on},
                actions=[_rotate_action()],
            )
        ]

    return [
        Notification(
            id="engine-secret-expiring-soon",
            severity="critical",
            audience="all",
            category="Azure Access",
            title=f"Client secret expires {when}",
            message=f"Azure IPAM's client secret expires {when}. Let an administrator know right away so they can rotate it. {IMPACT}",
            dismissible=False,
            data={"expiresOn": expires_on},
            actions=[_rotate_action()],
        )
    ]


def _not_set():
    return [
        Notification(
            id="engine-secret-expiry-not-set",
            severity="information",
            audience="admin",
            category="Azure Access",
            title="Client secret expiration date not set",
            message=(
                "Azure IPAM can't provide advance notice before its client secret expires, because no expiration date "
                "is recorded for it. Setting the expiration date allows Azure IPAM to warn users and administrators "
                "ahead of time, so the secret can be rotated before it expires."
            ),
            dismissible=True,
            actions=[
                NotificationAction(id="set-expiry", label="How to set the expiration date", kind="link", href=SET_EXPIRY_URL),
            ],
        )
    ]


async def detect():
    if not (globals.KEYVAULT_URL and globals.MANAGED_IDENTITY_ID):
        return []

    problem = engine_access.current_problem()

    if problem is not None and problem.cause in SECRET_CAUSES:
        return []

    try:
        expires_on = await _read_expires_on()
    except _Unavailable as e:
        _set_unavailable(str(e))
        return []
    except ClientAuthenticationError:
        raise
    except HttpResponseError as e:
        if e.status_code not in PERMANENT_STATUSES:
            raise

        code = getattr(e.error, "code", None) or e.reason
        _set_unavailable(f"Key Vault returned {e.status_code} ({code}).")
        return []

    _set_unavailable(None)

    return _not_set() if expires_on is None else _expiring(expires_on, time.time())
