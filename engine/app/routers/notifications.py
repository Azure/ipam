from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query

from app.dependencies import (
    UNAUTHORIZED,
    api_auth_checks,
    get_token_auth_header,
)
from app.notifications import get_notifications, get_resolver, is_active
from app.notifications.models import NotificationActionResult, NotificationList
from app.permissions import Grants, Permission, get_grants, requires

router = APIRouter(
    prefix="/notifications",
    tags=["notifications"],
    dependencies=[Depends(api_auth_checks)],
    responses=UNAUTHORIZED
)


@router.get(
    "",
    summary="Get Azure IPAM Notifications",
    response_model=NotificationList,
    status_code=200
)
async def list_notifications(
    refresh: bool = Query(False, description="Run every check again rather than reuse recent results"),
    grants: Grants = Depends(get_grants)
):
    """
    Active notifications about this Azure IPAM deployment.

    Each notification is self-describing: a stable ``id``, a ``severity``, an
    ``audience``, a ``category``, a human-readable ``title`` and ``message``,
    optional structured ``data``, and zero or more ``actions``. A ``link``
    action points at documentation, a ``navigate`` action at a page in the UI,
    and a ``resolve`` action at the endpoint that fixes the problem. Every field
    is always returned, and is ``null`` when it has no value, such as an action
    field that doesn't apply to that kind of action.

    Each check's result is reused for a short period, which varies by check, so
    the response can be a few minutes old. ``checkedOn`` is the Unix time the
    oldest result was produced, or ``null`` before the first check completes.
    Pass ``refresh=true`` to run every check again; a check that ran very
    recently isn't repeated.

    Visible to any authenticated user so a non-admin can surface an issue to an
    admin. Notifications with an ``admin`` audience are only returned to
    administrators, and the remediation endpoints enforce their own authorization.
    """

    result = await get_notifications(force=refresh)

    if not grants.can(Permission.NOTIFICATIONS_READ_ALL):
        result = NotificationList(
            notifications=[item for item in result.notifications if item.audience != "admin"],
            checkedOn=result.checkedOn,
        )

    return result


@router.post(
    "/{notification_id}/resolve",
    summary="Resolve a Notification",
    response_model=NotificationActionResult,
    status_code=202,
    dependencies = [Depends(requires(Permission.NOTIFICATIONS_UPDATE))]
)
async def resolve_notification(
    notification_id: str,
    background_tasks: BackgroundTasks,
    token: str = Depends(get_token_auth_header)
):
    """
    Invoke the server-owned remediation for a notification.

    The backend holds all remediation logic; the caller only asks for the fix to
    be applied (the notification's ``resolve`` action). Requires an admin.

    Returns 404 when the notification has no remediation defined, and 409 when the
    notification is not currently active (e.g. it has already been resolved) — so
    a stale or duplicate request never triggers work. Whether it is active is
    checked again now, rather than taken from the results ``GET`` reuses.
    """

    resolver = get_resolver(notification_id)

    if resolver is None:
        raise HTTPException(status_code=404, detail="No remediation is available for this notification.")

    # The detector is the single source of truth for whether a notification is
    # active. Only remediate something that is actually being surfaced right now.
    if not await is_active(notification_id):
        raise HTTPException(
            status_code=409,
            detail="This notification is not currently active; it may already have been resolved."
        )

    return await resolver(background_tasks)
