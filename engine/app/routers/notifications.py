from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException
from fastapi.responses import JSONResponse

from app.dependencies import api_auth_checks, get_admin
from app.notifications import get_notifications, get_resolver
from app.notifications.models import NotificationActionResult

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(api_auth_checks)]
)


@router.get(
    "",
    summary="Get Azure IPAM Notifications",
    status_code=200
)
async def list_notifications():
    """
    Active notifications about this Azure IPAM deployment.

    Each notification is self-describing: a stable ``id``, ``severity``, human
    ``title``/``message``, structured ``data``, and zero or more ``actions``.
    An ``api`` action carries the ``method``/``endpoint``/``body`` to remediate
    it (some require an admin); a ``link`` action points at documentation.

    Visible to any authenticated user so a non-admin can surface an issue to an
    admin; the underlying remediation endpoints enforce their own authorization.
    """

    result = await get_notifications()

    return JSONResponse(result.model_dump(exclude_none=True))


@router.post(
    "/{notification_id}/resolve",
    summary="Resolve a Notification",
    response_model=NotificationActionResult,
    status_code=202
)
async def resolve_notification(
    notification_id: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None, description="Azure Bearer token"),
    is_admin: str = Depends(get_admin)
):
    """
    Invoke the server-owned remediation for a notification.

    The backend holds all remediation logic; the caller only asks for the fix to
    be applied (the notification's ``resolve`` action). Requires an admin.

    Returns 404 when the notification has no remediation defined, and 409 when the
    notification is not currently active (e.g. it has already been resolved) — so
    a stale or duplicate request never triggers work.
    """

    if not is_admin:
        raise HTTPException(status_code=403, detail="API restricted to admins.")

    resolver = get_resolver(notification_id)

    if resolver is None:
        raise HTTPException(status_code=404, detail="No remediation is available for this notification.")

    # The detector is the single source of truth for whether a notification is
    # active. Only remediate something that is actually being surfaced right now.
    active = await get_notifications()

    if not any(item.id == notification_id for item in active.notifications):
        raise HTTPException(
            status_code=409,
            detail="This notification is not currently active; it may already have been resolved."
        )

    return await resolver(background_tasks)
