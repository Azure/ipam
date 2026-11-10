"""
Engine credentials detector.

Reports when Azure IPAM can't reach Azure as itself: its client secret has
expired, isn't valid or isn't configured, Conditional Access blocks it, it has
lost its Reader role, or it can't reach Azure at all.

It makes no calls of its own. It reads what ``app.engine_access`` has recorded
from the engine's real sign-ins and Resource Graph queries, which the
reservation job alone makes every minute. A deleted or disabled app registration
isn't reported here, because nobody can sign in to Azure IPAM to see it; those
are logged and returned in error responses instead.
"""

from app import engine_access
from app.notifications.models import Notification, NotificationAction

DOCS_URL = "https://azure.github.io/ipam/#"
TROUBLESHOOTING_URL = f"{DOCS_URL}/troubleshooting/README"
ROTATE_URL = f"{DOCS_URL}/maintenance/README?id=rotate-the-secret"
REASON = "Until it's fixed, Azure resources won't load and address space can't be checked or reserved."

# cause -> (notification id, title, message, troubleshooting anchor, [extra links])
_NOTIFICATIONS = {
    "secret_expired": (
        "engine-secret-expired",
        "Azure IPAM's client secret has expired",
        f"Azure IPAM can't sign in to Azure because its client secret has expired. An administrator needs to rotate it. {REASON}",
        "aadsts7000222-engine-secret-expired",
        [("rotate-secret", "How to rotate the secret", ROTATE_URL)],
    ),
    "secret_invalid": (
        "engine-secret-invalid",
        "Azure IPAM's client secret isn't valid",
        f"Azure IPAM can't sign in to Azure because the client secret it's using isn't valid. An administrator needs to check it. {REASON}",
        "aadsts7000215-engine-secret-invalid",
        [],
    ),
    "secret_unresolved": (
        "engine-secret-not-configured",
        "Azure IPAM's client secret isn't configured",
        f"Azure IPAM can't sign in to Azure because the Key Vault reference for its client secret couldn't be resolved. {REASON}",
        "key-vault-reference-not-resolved-app-service",
        [],
    ),
    "secret_missing": (
        "engine-secret-not-configured",
        "Azure IPAM's client secret isn't configured",
        f"Azure IPAM can't sign in to Azure because its client secret isn't configured. {REASON}",
        None,
        [],
    ),
    "blocked_conditional_access": (
        "engine-blocked-conditional-access",
        "Conditional Access is blocking Azure IPAM",
        f"A Conditional Access policy is blocking Azure IPAM from signing in to Azure. An administrator needs to review the policy. {REASON}",
        "aadsts53003-engine-blocked-by-conditional-access",
        [],
    ),
    "no_azure_access": (
        "engine-no-azure-access",
        "Azure IPAM doesn't have access to Azure",
        f"Azure IPAM doesn't have permission to read Azure resources. An administrator needs to restore its Reader role. {REASON}",
        "access-denied-engine-reader-role",
        [],
    ),
    "entra_unreachable": (
        "engine-azure-unreachable",
        "Azure IPAM can't reach Azure",
        f"Azure IPAM hasn't been able to reach Microsoft Entra ID for several minutes. {REASON}",
        "timeouts-reaching-azure-network",
        [],
    ),
    "arm_unreachable": (
        "engine-azure-unreachable",
        "Azure IPAM can't reach Azure",
        f"Azure IPAM hasn't been able to reach Azure Resource Manager for several minutes. {REASON}",
        "timeouts-reaching-azure-network",
        [],
    ),
    "sign_in_failed": (
        "engine-sign-in-failed",
        "Azure IPAM can't sign in to Azure",
        f"Azure IPAM can't sign in to Azure. {REASON}",
        None,
        [],
    ),
}


async def detect():
    problem = engine_access.current_problem_logged()

    if problem is None or problem.cause not in _NOTIFICATIONS:
        return []

    notification_id, title, message, anchor, extra_links = _NOTIFICATIONS[problem.cause]

    if problem.code:
        message = f"{message} (Error {problem.code})"

    troubleshooting = f"{TROUBLESHOOTING_URL}?id={anchor}" if anchor else TROUBLESHOOTING_URL

    actions = [
        NotificationAction(id="troubleshoot", label="View troubleshooting steps", kind="link", href=troubleshooting),
        *(NotificationAction(id=link_id, label=label, kind="link", href=href) for link_id, label, href in extra_links),
    ]

    return [
        Notification(
            id=notification_id,
            severity="critical",
            audience="all",
            category="Azure Access",
            title=title,
            message=message,
            dismissible=False,
            data={"cause": problem.cause, "code": problem.code} if problem.code else {"cause": problem.cause},
            actions=actions,
        )
    ]
