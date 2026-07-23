"""
Platform detector.

Flags deployments still running on the legacy Docker Compose App Service model
(``DEPLOYMENT_STACK == "LegacyCompose"``). Microsoft is retiring Docker Compose
support for Azure App Service on March 31, 2027, so these deployments must
migrate to the modern single-container model to keep operating and receiving
updates.

This is link-only guidance (no server-owned remediation): migration is a scripted,
multi-step process (see ``migrate/migrate.ps1``) that runs from the operator's
workstation, so we route the user to the migration guide rather than automating
it from inside the running app.
"""

from app.globals import globals
from app.notifications.models import (
    Notification,
    NotificationAction,
)

# DEPLOYMENT_STACK value for the legacy Docker Compose App Service model.
LEGACY_STACK = "LegacyCompose"

# Hard retirement date for Docker Compose support on Azure App Service.
RETIREMENT_DATE = "March 31, 2027"

# Step-by-step migration guide (auto-discovery + manual override methods).
MIGRATION_DOCS_URL = "https://azure.github.io/ipam/#/migration/README"


async def detect():
    if globals.DEPLOYMENT_STACK != LEGACY_STACK:
        return []

    return [
        Notification(
            id="platform-migration",
            severity="critical",
            audience="all",
            category="Deployment",
            title="Migrate off the legacy Docker Compose platform",
            message=(
                "This deployment is running on the legacy Docker Compose App Service "
                "model, which Microsoft is retiring on {retirement}. Migrate to the "
                "modern single-container deployment to keep receiving Azure IPAM "
                "updates and avoid disruption.".format(retirement=RETIREMENT_DATE)
            ),
            dismissible=False,
            data={"currentStack": LEGACY_STACK, "retirementDate": RETIREMENT_DATE},
            actions=[
                NotificationAction(
                    id="migration-guide",
                    label="View migration guide",
                    kind="link",
                    href=MIGRATION_DOCS_URL,
                ),
            ],
        )
    ]
