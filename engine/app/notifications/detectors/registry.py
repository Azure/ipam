"""
Registry detector.

A deployment pulls from exactly one registry, so this single detector inspects
the current registry and emits the appropriate notification:

* Legacy public registry (``azureipam.azurecr.io``) -> **critical**: the public
  registry has moved and the deployment must migrate to keep receiving updates.
* Development registry (``azureipamdev.azurecr.io``) -> **warning**: a reminder
  that the deployment is on a pre-release/testing registry and should be pointed
  back at the official one.

Both remediate the same way (repoint to the official registry via the existing
admin-gated service endpoint, which restarts the app to pull the new image).
Native deployments, the official registry, and private customer ACRs produce no
notification.
"""

from fastapi import HTTPException

from app.logs.logs import ipam_logger as logger
from app.notifications.appservice import (
    apply_linux_fx_version,
    get_site_context,
    get_web_client,
    is_image_pullable,
    parse_image,
    read_current_registry,
    split_repository_tag,
)
from app.notifications.models import (
    Notification,
    NotificationAction,
    NotificationActionResult,
)

# Official Azure IPAM public registry (migration target).
OFFICIAL_REGISTRY = "registry.azureipam.com"

# Legacy public registry customers must migrate off of.
LEGACY_REGISTRY = "azureipam.azurecr.io"

# Development/testing registry customers should switch back off of.
DEV_REGISTRY = "azureipamdev.azurecr.io"

DOCS_URL = "https://azure.github.io/ipam/#/update/README"


def _actions(notification_id):
    """The shared remediation: a server-owned resolve, plus a doc link."""

    return [
        NotificationAction(
            id="migrate",
            label="Switch",
            kind="resolve",
            method="POST",
            href="/api/notifications/{}/resolve".format(notification_id),
            causesRestart=True,
            requiresAdmin=True,
        ),
        NotificationAction(
            id="learn",
            label="Learn more",
            kind="link",
            href=DOCS_URL,
        ),
    ]


async def detect():
    registry = await read_current_registry()

    if registry == LEGACY_REGISTRY:
        return [
            Notification(
                id="registry-migration",
                severity="critical",
                audience="all",
                category="Deployment",
                title="Azure IPAM container registry has moved",
                message=(
                    "This deployment still pulls container images from the legacy "
                    "registry ({legacy}). Migrate to the current official registry "
                    "({official}) to keep receiving Azure IPAM updates.".format(
                        legacy=registry, official=OFFICIAL_REGISTRY
                    )
                ),
                dismissible=False,
                data={"currentRegistry": registry, "targetRegistry": OFFICIAL_REGISTRY},
                actions=_actions("registry-migration"),
            )
        ]

    if registry == DEV_REGISTRY:
        return [
            Notification(
                id="registry-dev",
                severity="warning",
                audience="all",
                category="Deployment",
                title="This deployment is using a development registry",
                message=(
                    "This deployment is pulling container images from the Azure IPAM "
                    "development registry ({dev}). If you were testing a pre-release "
                    "build, switch back to the official registry ({official}) to stay "
                    "on supported updates.".format(dev=registry, official=OFFICIAL_REGISTRY)
                ),
                dismissible=True,
                data={"currentRegistry": registry, "targetRegistry": OFFICIAL_REGISTRY},
                actions=_actions("registry-dev"),
            )
        ]

    return []


async def resolve(background_tasks):
    """
    Repoint the deployment at the official registry and restart to pull the image.

    The endpoint has already confirmed this notification is active (so the
    deployment is on a remediable registry). Pre-validates the target image is
    pullable before applying, so a bad target can't leave the app unable to start.
    """

    subscription_id, resource_group, site_name = get_site_context()
    client = get_web_client(subscription_id)

    try:
        config = await client.web_apps.get_configuration(resource_group, site_name)
        current_registry, current_image = parse_image(config.linux_fx_version)

        if not current_image:
            raise HTTPException(
                status_code=409,
                detail="Unable to determine the current container image reference."
            )

        new_linux_fx_version = config.linux_fx_version.replace(current_registry, OFFICIAL_REGISTRY, 1)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to read service configuration: {}".format(e))
        raise HTTPException(status_code=500, detail="Failed to read the service configuration.")
    finally:
        await client.close()

    # Pre-validate the target image is pullable BEFORE changing anything.
    repository, tag = split_repository_tag(current_image)

    if not await is_image_pullable(OFFICIAL_REGISTRY, repository, tag):
        raise HTTPException(
            status_code=502,
            detail="The image '{}/{}:{}' could not be validated for pull from the official registry; no changes were made.".format(
                OFFICIAL_REGISTRY, repository, tag
            )
        )

    background_tasks.add_task(
        apply_linux_fx_version,
        subscription_id,
        resource_group,
        site_name,
        new_linux_fx_version
    )

    return NotificationActionResult(
        status="accepted",
        detail="Registry migration accepted. The service will restart to pull images from '{}'.".format(OFFICIAL_REGISTRY)
    )


# Notification ids this module can remediate live -> the resolve handler.
RESOLVERS = {
    "registry-migration": resolve,
    "registry-dev": resolve,
}
