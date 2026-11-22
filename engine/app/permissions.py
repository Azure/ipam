"""
Authorization policy for Azure IPAM: the permissions, the roles that hold them, and how routes declare them.

A route states what it requires with `requires(...)` or `requires_param(...)`, and code that shapes a
response asks `grants.can(...)`. Enforcement and the API documentation both come from these
declarations, so they cannot disagree. See the Conventions documentation, "Declaring Permissions".
"""

from dataclasses import dataclass
from enum import StrEnum
from uuid import UUID

from fastapi import Depends, HTTPException, Query

from app.dependencies import check_admin
from app.routers.common.helper import AzureScope


class Permission(StrEnum):
    """
    Everything a caller may be permitted to do beyond what every signed-in user can.

    A permission exists only where the code makes a decision about it. Anything every signed-in user
    may do, such as reading Spaces or creating their own Reservations, needs no permission.
    """

    SPACES_CREATE = "spaces/create"
    SPACES_UPDATE = "spaces/update"
    SPACES_DELETE = "spaces/delete"
    SPACES_EXPAND = "spaces/expand"
    BLOCKS_CREATE = "blocks/create"
    BLOCKS_UPDATE = "blocks/update"
    BLOCKS_DELETE = "blocks/delete"
    ASSOCIATIONS_READ = "associations/read"
    ASSOCIATIONS_CREATE = "associations/create"
    ASSOCIATIONS_UPDATE = "associations/update"
    ASSOCIATIONS_DELETE = "associations/delete"
    EXTERNALS_READ = "externals/read"
    EXTERNALS_CREATE = "externals/create"
    EXTERNALS_UPDATE = "externals/update"
    EXTERNALS_DELETE = "externals/delete"
    RESERVATIONS_READ_ALL = "reservations/read/all"
    RESERVATIONS_DELETE_ALL = "reservations/delete/all"
    AZURE_READ_ALL = "azure/read/all"
    ADMINS_READ = "admins/read"
    ADMINS_CREATE = "admins/create"
    ADMINS_UPDATE = "admins/update"
    ADMINS_DELETE = "admins/delete"
    EXCLUSIONS_READ = "exclusions/read"
    EXCLUSIONS_CREATE = "exclusions/create"
    EXCLUSIONS_UPDATE = "exclusions/update"
    EXCLUSIONS_DELETE = "exclusions/delete"
    USERS_READ = "users/read"
    NOTIFICATIONS_READ_ALL = "notifications/read/all"
    NOTIFICATIONS_UPDATE = "notifications/update"

DESCRIPTIONS = {
    Permission.SPACES_CREATE: "Create Spaces.",
    Permission.SPACES_UPDATE: "Change a Space's name or description.",
    Permission.SPACES_DELETE: "Delete Spaces.",
    Permission.SPACES_EXPAND: "Request Spaces and Blocks with their networks expanded to full Azure details.",
    Permission.BLOCKS_CREATE: "Create Blocks.",
    Permission.BLOCKS_UPDATE: "Change a Block's name or CIDR.",
    Permission.BLOCKS_DELETE: "Delete Blocks.",
    Permission.ASSOCIATIONS_READ: "List the networks associated with a Block.",
    Permission.ASSOCIATIONS_CREATE: "Associate a network with a Block.",
    Permission.ASSOCIATIONS_UPDATE: "Replace the networks associated with a Block.",
    Permission.ASSOCIATIONS_DELETE: "Remove networks from a Block.",
    Permission.EXTERNALS_READ: "Read External Networks, and their subnets and endpoints.",
    Permission.EXTERNALS_CREATE: "Create External Networks, and their subnets and endpoints.",
    Permission.EXTERNALS_UPDATE: "Change External Networks, and their subnets and endpoints.",
    Permission.EXTERNALS_DELETE: "Delete External Networks, and their subnets and endpoints.",
    Permission.RESERVATIONS_READ_ALL: "See every user's Reservations in full, not only your own.",
    Permission.RESERVATIONS_DELETE_ALL: "Cancel every user's Reservations, not only your own.",
    Permission.AZURE_READ_ALL: "See Azure resources through Azure IPAM's own access, beyond your own Azure permissions.",
    Permission.ADMINS_READ: "List Azure IPAM administrators.",
    Permission.ADMINS_CREATE: "Add Azure IPAM administrators.",
    Permission.ADMINS_UPDATE: "Replace the list of Azure IPAM administrators.",
    Permission.ADMINS_DELETE: "Remove Azure IPAM administrators.",
    Permission.EXCLUSIONS_READ: "List excluded subscriptions.",
    Permission.EXCLUSIONS_CREATE: "Exclude subscriptions.",
    Permission.EXCLUSIONS_UPDATE: "Replace the list of excluded subscriptions.",
    Permission.EXCLUSIONS_DELETE: "Stop excluding a subscription.",
    Permission.USERS_READ: "List every Azure IPAM user.",
    Permission.NOTIFICATIONS_READ_ALL: "See notifications meant for administrators, not only those for everyone.",
    Permission.NOTIFICATIONS_UPDATE: "Resolve notifications.",
}

@dataclass(frozen=True)
class Role:
    """
    A named set of permissions.

    The `id` is the stable identifier exposed through the API, and never changes once published. Built-in
    roles have fixed, documented IDs; `name` and `description` are for display and may change freely.
    """

    id: UUID
    name: str
    description: str
    permissions: frozenset[Permission]

ADMIN_ROLE = Role(
    id=UUID("c253f57d-6a28-4e5b-a4b4-70702322d5e5"),
    name="Administrator",
    description=(
        "Manage the address plan, including Spaces, Blocks, External Networks, network associations "
        "and administrators."
    ),
    permissions=frozenset(Permission),
)

USER_ROLE = Role(
    id=UUID("cd6cd44f-5ff3-499f-8d25-fdc630de3d97"),
    name="User",
    description="Reserve address space and work within the plan that administrators create.",
    # Associations and External Networks are already part of every Space and Block response, so their
    # dedicated routes are open to everyone as well. They're still separate permissions, held by both
    # roles, so a future role can be denied them without changing any routes, as the assignable roles
    # planned for v5.0.0 will need.
    permissions=frozenset({
        Permission.ASSOCIATIONS_READ,
        Permission.EXTERNALS_READ,
    }),
)

ROLES = {role.id: role for role in (ADMIN_ROLE, USER_ROLE)}

def role_for(is_admin: bool) -> Role:
    """The built-in role held by an administrator or by everyone else."""

    return ADMIN_ROLE if is_admin else USER_ROLE

class Grants:
    """The caller's role and the permissions it holds."""

    def __init__(self, role: Role):
        self.role = role
        self.permissions = role.permissions

    def can(self, permission: Permission) -> bool:
        return permission in self.permissions

async def get_grants(is_admin: bool = Depends(check_admin)) -> Grants:
    """Resolve the caller's grants. When no administrators are configured, everyone is an administrator."""

    return Grants(role_for(is_admin))

async def get_azure_scope(grants: Grants = Depends(get_grants)) -> AzureScope:
    """The caller's view of Azure: Azure IPAM's full view if they may have it, otherwise their own."""

    return AzureScope.TENANT if grants.can(Permission.AZURE_READ_ALL) else AzureScope.CALLER

def requires(permission: Permission):
    """Route gate. Declare it in a route's `dependencies=[...]`."""

    async def gate(grants: Grants = Depends(get_grants)) -> Grants:
        if not grants.can(permission):
            raise HTTPException(status_code=403, detail="API restricted to admins.")

        return grants

    # Read by the OpenAPI generator while it walks a route's dependency tree.
    gate.required_permission = permission

    return gate

def requires_param(parameter: str, permission: Permission, description: str, detail: str):
    """
    Parameter gate. Declares the boolean query parameter itself, which is only restricted when requested.

    The route depends on the returned gate in place of declaring the parameter.
    """

    async def gate(
        value: bool = Query(False, alias=parameter, title=parameter.title(), description=description),
        grants: Grants = Depends(get_grants)
    ) -> bool:
        if value and not grants.can(permission):
            raise HTTPException(status_code=403, detail=detail)

        return value

    # Read by the OpenAPI generator, which marks only the guarded parameter.
    gate.required_permission = permission
    gate.guarded_parameter = parameter

    return gate

expand_gate = requires_param(
    "expand",
    Permission.SPACES_EXPAND,
    description="Expand network references to full network objects",
    detail="Expand parameter can only be used by admins."
)
