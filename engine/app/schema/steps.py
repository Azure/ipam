"""
Ordered registry of convergence steps.

A *convergence* step brings the data from one schema version to the next. Steps
run **only on the production slot** (see ``app.schema.convergence``), after a
swap, so they never mutate the shared database while the previous version is
still live in production. Staging never converges.

Each step declares whether it is **breaking**:

* ``breaking = False`` (additive) — only adds fields/documents. Older code (e.g.
  the previous release still in the other slot, or after a swap-back) keeps
  working, so ``minReadable`` is NOT raised.
* ``breaking = True`` — removes/reshapes data such that older code can no longer
  read it. Applying it raises ``minReadable`` to this step's version, which makes
  the startup compatibility gate refuse to run any code older than this step.

Version 1 is the **baseline**: it brings an unversioned (pre-v4) database up to
the v4 shape, folding in every fixup that historically lived in ``upgrade_db()``.
Pre-v4 builds are not slot-aware, so this one is allowed to be destructive; it is
marked breaking so genuinely ancient code can't run against a v4 database.

Every step's ``apply`` MUST be idempotent (guard with ``NOT IS_DEFINED(...)`` /
read-before-write) so a re-run is a harmless no-op.
"""

import copy
import uuid
from dataclasses import dataclass
from typing import Awaitable, Callable

from azure.cosmos.exceptions import CosmosResourceNotFoundError
from fastapi.encoders import jsonable_encoder

from app.globals import globals
from app.logs.logs import ipam_logger as logger
from app.schema.control import _container
from app.routers.common.helper import cosmos_query, cosmos_replace, cosmos_upsert


@dataclass(frozen=True)
class ConvergenceStep:
    version: int
    name: str
    breaking: bool
    apply: Callable[[], Awaitable[None]]


async def _baseline_v4():
    """
    Pre-v4 -> v4 catch-up. Consolidates every historical ``upgrade_db()`` fixup
    so that a customer jumping from a very old version lands on the current shape
    in one shot. All operations are guarded/idempotent, so this is also a no-op
    against a brand-new (empty) database.
    """

    container = _container()
    tenant_id = globals.TENANT_ID

    # Legacy "spaces" singleton -> individual space documents.
    try:
        spaces_query = await container.read_item("spaces", partition_key="spaces")

        for space in spaces_query['spaces']:
            if 'vnets' in space:
                del space['vnets']

            new_space = {
                "id": uuid.uuid4(),
                "type": "space",
                "tenant_id": tenant_id,
                **space
            }

            await cosmos_upsert(jsonable_encoder(new_space))

        await container.delete_item("spaces", partition_key="spaces")

        logger.warning('Spaces database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing spaces to convert...')

    # Legacy "users" singleton -> individual user documents.
    try:
        users_query = await container.read_item("users", partition_key="users")

        for user in users_query['users']:
            new_user = {
                "id": uuid.uuid4(),
                "type": "user",
                "tenant_id": tenant_id,
                "data": user
            }

            await cosmos_upsert(jsonable_encoder(new_user))

        await container.delete_item("users", partition_key="users")

        logger.warning('Users database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing users to convert...')

    # Legacy "admins" singleton -> single admin document with exclusions.
    try:
        admins_query = await container.read_item("admins", partition_key="admins")

        admin_data = {
            "id": uuid.uuid4(),
            "type": "admin",
            "tenant_id": tenant_id,
            "admins": admins_query['admins'],
            "exclusions": []
        }

        await cosmos_upsert(jsonable_encoder(admin_data))

        await container.delete_item("admins", partition_key="admins")

        logger.warning('Admins database conversion complete!')
    except CosmosResourceNotFoundError:
        logger.info('No existing admins to convert...')

    # Backfill user objects missing 'darkMode' / 'views'.
    user_fixup_query = await cosmos_query("SELECT * FROM c WHERE (c.type = 'user' AND (NOT IS_DEFINED(c['data']['darkMode']) OR NOT IS_DEFINED(c['data']['views'])))", tenant_id)

    if user_fixup_query:
        for user in user_fixup_query:
            user_data = copy.deepcopy(user)

            if 'darkMode' not in user_data['data']:
                user_data['data']['darkMode'] = False

            if 'views' not in user_data['data']:
                user_data['data']['views'] = {}

            await cosmos_replace(user, user_data)

        logger.warning('User object patching complete!')
    else:
        logger.info("No existing user objects to patch...")

    # Backfill admin entries missing a 'type' discriminator.
    admin_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN admin IN c.admins WHERE (c.type = 'admin' AND NOT IS_DEFINED(admin.type))", tenant_id)

    if admin_fixup_query:
        admin_data = copy.deepcopy(admin_fixup_query[0])

        for i, admin in enumerate(admin_data['admins']):
            if 'type' not in admin:
                admin_data['admins'][i] = {
                    "type": "User",
                    "name": admin['name'],
                    "email": admin['email'],
                    "id": admin['id']
                }

        await cosmos_replace(admin_fixup_query[0], admin_data)

        logger.warning('Admin object patching complete!')
    else:
        logger.info("No existing admin objects to patch...")

    # Backfill reservations missing the settled-on/by fields.
    resv_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN resv in block.resv WHERE (c.type = 'space' AND NOT IS_DEFINED(resv.settledOn))", tenant_id)

    if resv_fixup_query:
        for space in resv_fixup_query:
            space_data = copy.deepcopy(space)

            for block in space_data['blocks']:
                for i, resv in enumerate(block['resv']):
                    if 'settledOn' not in resv:
                        block['resv'][i] = {
                            "id": resv['id'],
                            "cidr": resv['cidr'],
                            "desc": resv['desc'] if 'desc' in resv else None,
                            "createdOn": resv['createdOn'],
                            "createdBy": resv['userId'],
                            "settledOn": None,
                            "settledBy": None,
                            "status": resv['status']
                        }

            await cosmos_replace(space, space_data)

        logger.warning('Reservation patching complete!')
    else:
        logger.info("No existing reservations to patch...")

    # Backfill blocks missing the 'externals' array.
    external_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks WHERE (c.type = 'space' AND NOT IS_DEFINED(block.externals))", tenant_id)

    if external_fixup_query:
        for space in external_fixup_query:
            space_data = copy.deepcopy(space)

            new_blocks = []

            for block in space_data['blocks']:
                new_block = {
                    "name": block['name'],
                    "cidr": block['cidr'],
                    "vnets": block['vnets'],
                    "externals": [],
                    "resv": block['resv']
                }

                new_blocks.append(new_block)

            space_data['blocks'] = new_blocks

            await cosmos_replace(space, space_data)

        logger.warning('External networks patching complete!')
    else:
        logger.info("No existing external networks to patch...")

    # Backfill externals missing the 'subnets' array.
    subnet_fixup_query = await cosmos_query("SELECT DISTINCT VALUE c FROM c JOIN block IN c.blocks JOIN ext in block.externals WHERE (c.type = 'space' AND NOT IS_DEFINED(ext.subnets))", tenant_id)

    if subnet_fixup_query:
        for space in subnet_fixup_query:
            space_data = copy.deepcopy(space)

            for block in space_data['blocks']:
                new_externals = []

                for external in block['externals']:
                    new_external = {
                        "name": external['name'],
                        "desc": external['desc'],
                        "cidr": external['cidr'],
                        "subnets": []
                    }

                    new_externals.append(new_external)

                block['externals'] = new_externals

            await cosmos_replace(space, space_data)

        logger.warning('External subnet patching complete!')
    else:
        logger.info("No existing external subnets to patch...")


# Ordered list of convergence steps. Append new steps with the next version
# number; never renumber or mutate an already-released step. Keep the highest
# version here in sync with "schema" in version.json.
STEPS = [
    ConvergenceStep(version=1, name="v4-baseline", breaking=True, apply=_baseline_v4),
]
