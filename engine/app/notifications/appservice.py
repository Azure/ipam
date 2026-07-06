"""
Internal Azure App Service / Function App management helpers.

These wrap the deployment's own ``Microsoft.Web/sites`` configuration using the
managed identity (which holds Contributor on the resource group). They are used
by notification detectors (to read state) and notification resolve handlers (to
remediate). There are no public routes here — all mutation happens behind a
notification's server-owned ``resolve`` handler.
"""

import os
import re

import aiohttp
from azure.identity.aio import ManagedIdentityCredential
from azure.mgmt.web.aio import WebSiteManagementClient
from fastapi import HTTPException

from app.globals import globals
from app.logs.logs import ipam_logger as logger


def get_site_context():
    """Resolve the current App Service / Function site (subscription, resource group, name) from the platform environment."""

    site_name = os.environ.get("WEBSITE_SITE_NAME")
    resource_group = os.environ.get("WEBSITE_RESOURCE_GROUP")

    # WEBSITE_OWNER_NAME format: "{subscriptionId}+{resourceGroup}-{region}webspace..."
    owner_name = os.environ.get("WEBSITE_OWNER_NAME", "")
    subscription_id = owner_name.split("+")[0] if "+" in owner_name else None

    if not all((site_name, resource_group, subscription_id)):
        raise HTTPException(
            status_code=500,
            detail="Unable to resolve the App Service site context from the environment."
        )

    return subscription_id, resource_group, site_name


def get_web_client(subscription_id):
    """Create a WebSite management client authenticated as the deployment's managed identity (which holds Contributor on the resource group)."""

    azure_arm_url = 'https://{}'.format(globals.AZURE_ARM_URL)
    azure_arm_scope = '{}/.default'.format(azure_arm_url)

    credential = ManagedIdentityCredential(
        client_id=globals.MANAGED_IDENTITY_ID
    )

    return WebSiteManagementClient(
        credential=credential,
        subscription_id=subscription_id,
        base_url=azure_arm_url,
        credential_scopes=[azure_arm_scope],
        transport=globals.SHARED_TRANSPORT
    )


def is_container():
    """Return True if the deployment is container-based (vs. native code)."""

    return globals.DEPLOYMENT_STACK.endswith("Container")


def parse_image(linux_fx_version):
    """Parse the container registry and full image reference from a LinuxFxVersion value (e.g. 'DOCKER|registry.azureipam.com/ipam:latest')."""

    if not linux_fx_version or "|" not in linux_fx_version:
        return None, None

    prefix, image = linux_fx_version.split("|", 1)

    if prefix.upper() != "DOCKER":
        return None, None

    registry = image.split("/", 1)[0]

    return registry, image


def split_repository_tag(image):
    """Split a full image reference (registry/repository:tag) into (repository, tag)."""

    repo_and_tag = image.split("/", 1)[1] if "/" in image else image

    if ":" in repo_and_tag:
        repository, tag = repo_and_tag.rsplit(":", 1)
    else:
        repository, tag = repo_and_tag, "latest"

    return repository, tag


async def read_current_registry():
    """
    Return the container registry host the deployment currently pulls from, or
    None for native/unknown deployments or if the lookup fails. Safe to call from
    non-request contexts (e.g. notification detectors): never raises.
    """

    if not is_container():
        return None

    try:
        subscription_id, resource_group, site_name = get_site_context()
        client = get_web_client(subscription_id)

        try:
            config = await client.web_apps.get_configuration(resource_group, site_name)
            registry, _ = parse_image(config.linux_fx_version)

            return registry
        finally:
            await client.close()
    except Exception as e:
        logger.error("Failed to read current registry: {}".format(e))

        return None


async def is_image_pullable(registry, repository, tag):
    """Validate that an image can be anonymously pulled from the registry by resolving an anonymous pull token and performing a manifest HEAD."""

    base_url = "https://{}".format(registry)

    try:
        async with aiohttp.ClientSession() as session:
            async with session.get("{}/v2/".format(base_url)) as challenge_resp:
                challenge = challenge_resp.headers.get("WWW-Authenticate", "")

            match = re.search(r'realm="(?P<realm>[^"]+)",service="(?P<service>[^"]+)"', challenge)

            if not match:
                return False

            token_params = {
                "service": match.group("service"),
                "scope": "repository:{}:pull".format(repository)
            }

            async with session.get(match.group("realm"), params=token_params) as token_resp:
                if token_resp.status != 200:
                    return False

                token = (await token_resp.json()).get("access_token")

            if not token:
                return False

            headers = {
                "Authorization": "Bearer {}".format(token),
                "Accept": "application/vnd.docker.distribution.manifest.v2+json, application/vnd.oci.image.index.v1+json"
            }

            async with session.head("{}/v2/{}/manifests/{}".format(base_url, repository, tag), headers=headers) as manifest_resp:
                return manifest_resp.status == 200
    except Exception as e:
        logger.error("Image pull validation failed: {}".format(e))
        return False


async def apply_linux_fx_version(subscription_id, resource_group, site_name, linux_fx_version):
    """Background task: set the container image reference, which triggers a restart to pull from the new registry."""

    client = get_web_client(subscription_id)

    try:
        config = await client.web_apps.get_configuration(resource_group, site_name)
        config.linux_fx_version = linux_fx_version
        await client.web_apps.update_configuration(resource_group, site_name, config)
    except Exception as e:
        logger.error("Failed to update container image reference: {}".format(e))
    finally:
        await client.close()
