"""
Authorization policy for Azure IPAM: the permissions, the roles that hold them, and how routes declare them.

A route states what it requires with `requires(...)` or `requires_param(...)`, and code that shapes a
response asks `grants.can(...)`. Enforcement and the API documentation both come from these
declarations, so they cannot disagree. See the Conventions documentation, "Declaring Permissions".
"""

from enum import Enum

from fastapi import Depends, HTTPException, Query

from app.dependencies import check_admin
from app.routers.common.helper import AzureScope


class Permission(str, Enum):
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
    Permission.RESERVATIONS_READ_ALL: "See every user's Reservations, not only your own.",
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
    Permission.NOTIFICATIONS_UPDATE: "Resolve notifications.",
}

ROLES = {
    "Admin": frozenset(Permission),
    "User": frozenset(),
}

class Grants:
    """The caller's role and the permissions it holds."""

    def __init__(self, role: str):
        self.role = role
        self.permissions = ROLES[role]

    def can(self, permission: Permission) -> bool:
        return permission in self.permissions

async def get_grants(is_admin: bool = Depends(check_admin)) -> Grants:
    """Resolve the caller's grants. When no administrators are configured, everyone is an administrator."""

    return Grants("Admin" if is_admin else "User")

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
