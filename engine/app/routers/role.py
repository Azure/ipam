from fastapi import APIRouter, Depends

from app.dependencies import UNAUTHORIZED, api_auth_checks
from app.models import RoleDefinition
from app.permissions import ROLES

router = APIRouter(
    prefix="/roles",
    tags=["roles"],
    dependencies=[Depends(api_auth_checks)],
    responses=UNAUTHORIZED
)

@router.get(
    "",
    summary = "Get Roles",
    response_model = list[RoleDefinition],
    status_code = 200
)
async def get_roles():
    """
    Get the roles that can be held in Azure IPAM.

    A user's roles are listed by ID in `GET /users/me`. Role definitions describe what a role is for rather
    than who holds it, so every signed-in user can read them.
    """

    return [
        RoleDefinition(
            id = role.id,
            name = role.name,
            description = role.description,
            builtIn = True
        )
        for role in ROLES.values()
    ]
